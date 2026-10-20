"""Catalogo materiali: ricerca, classificazione, unione offerte e aggiunta di voci dal gestionale."""
import math
import threading
import time
from contextlib import contextmanager

from core.exceptions import TransactionError

from .base_service import BaseService
from .catalogo_materiali_migration import (
    DbfSource, clean, fornitori_materiali, leggi_gestionale, regole_testa, rows_as_dicts, salva_offerta, stato_classificazione)
from .catalogo_materiali_parser import norm_code, norm_desc
from .catalogo_materiali_proposte import FamilyIndex

PAGE_SIZES = (10, 20, 50, 100)
SORTS = {'nome': 'p.nome_norm', 'stato': 'p.stato', 'ultimo_acquisto': 'ultimo_acquisto',
         'offerte': 'n_offerte', 'prezzo': 'miglior_prezzo_unitario'}
CACHE_SECONDS = 10 * 60

_cache = {'ts': 0.0, 'offers': None, 'nomi': None}
_cache_lock = threading.Lock()


def _safe(value):
    return None if isinstance(value, float) and (math.isnan(value) or math.isinf(value)) else value


def _clean_row(row):
    return {k: _safe(v) for k, v in row.items()}


def _tokens(text):
    return [t for t in norm_desc(text).split() if t]


def _positive_int(value, label):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f'{label} non valido')
    if number <= 0:
        raise ValueError(f'{label} non valido')
    return number


class CatalogoMaterialiService(BaseService):
    def __init__(self, db_manager, source=None):
        super().__init__(db_manager)
        self._source = source

    @property
    def source(self):
        if self._source is None:
            self._source = DbfSource()
        return self._source

    @contextmanager
    def _tx(self):
        """Transazione che lascia passare gli errori di validazione (ValueError) senza avvolgerli."""
        try:
            with self.db_manager.transaction() as conn:
                yield conn
        except TransactionError as exc:
            if isinstance(exc.cause, ValueError):
                raise exc.cause
            raise

    # ---------- classificazione ----------

    @staticmethod
    def valida_classificazione(conn, classificazione):
        """Conto obbligatorio; branca e sottoconto opzionali ma coerenti con la gerarchia."""
        if not isinstance(classificazione, dict):
            raise ValueError('Classificazione mancante')
        contoid = _positive_int(classificazione.get('contoid'), 'Conto')
        brancaid = classificazione.get('brancaid') or None
        sottocontoid = classificazione.get('sottocontoid') or None
        if not conn.execute('SELECT 1 FROM conti WHERE id=?', (contoid,)).fetchone():
            raise ValueError('Conto inesistente')
        if brancaid is not None:
            brancaid = _positive_int(brancaid, 'Branca')
            if not conn.execute('SELECT 1 FROM branche WHERE id=? AND contoid=?', (brancaid, contoid)).fetchone():
                raise ValueError('La branca non appartiene al conto')
        if sottocontoid is not None:
            sottocontoid = _positive_int(sottocontoid, 'Sottoconto')
            if brancaid is None:
                raise ValueError('Il sottoconto richiede la branca')
            if not conn.execute('SELECT 1 FROM sottoconti WHERE id=? AND brancaid=? AND contoid=?',
                                (sottocontoid, brancaid, contoid)).fetchone():
                raise ValueError('Il sottoconto non appartiene alla branca')
        return {'contoid': contoid, 'brancaid': brancaid, 'sottocontoid': sottocontoid}

    def classifica(self, ids, classificazione):
        if not isinstance(ids, list) or not 1 <= len(ids) <= 1000:
            raise ValueError('Seleziona da 1 a 1000 prodotti')
        ids = [_positive_int(i, 'Prodotto') for i in ids]
        with self._tx() as conn:
            cl = self.valida_classificazione(conn, classificazione)
            stato = stato_classificazione(cl['contoid'], cl['brancaid'], cl['sottocontoid'])
            marks = ','.join('?' for _ in ids)
            updated = conn.execute(
                f'UPDATE materiali_prodotti SET contoid=?, brancaid=?, sottocontoid=?, stato=?, updated_at=CURRENT_TIMESTAMP '
                f'WHERE id IN ({marks})', (cl['contoid'], cl['brancaid'], cl['sottocontoid'], stato, *ids)).rowcount
        return {'aggiornati': updated, 'stato': stato}

    # ---------- elenco e dettaglio ----------

    def search(self, q='', fornitore_id=None, contoid=None, brancaid=None, sottocontoid=None, stato=None,
               archiviati=False, page=1, per_page=20, sort='nome', direction='asc'):
        per_page = per_page if per_page in PAGE_SIZES else 20
        page = max(1, int(page or 1))
        order = SORTS.get(sort, SORTS['nome'])
        direction = 'DESC' if str(direction).lower() == 'desc' else 'ASC'
        where, params = ['p.archiviato = ?'], [1 if archiviati else 0]
        for token in _tokens(q):
            like = '%' + token.replace('!', '!!').replace('%', '!%').replace('_', '!_') + '%'
            where.append("(p.nome_norm LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM materiali_offerte o WHERE o.prodotto_id=p.id AND "
                         "(o.nome_norm LIKE ? ESCAPE '!' OR o.codice_norm LIKE ? ESCAPE '!' OR o.fornitore_norm LIKE ? ESCAPE '!')))")
            params.extend([like] * 4)
        if fornitore_id:
            where.append('EXISTS (SELECT 1 FROM materiali_offerte o WHERE o.prodotto_id=p.id AND o.fornitore_id=?)')
            params.append(clean(fornitore_id))
        for column, value in (('contoid', contoid), ('brancaid', brancaid), ('sottocontoid', sottocontoid)):
            if value:
                where.append(f'p.{column} = ?')
                params.append(int(value))
        if stato in ('classificato', 'parziale', 'da_classificare'):
            where.append('p.stato = ?')
            params.append(stato)
        clause = ' AND '.join(where)
        with self.db_manager.get_connection() as conn:
            total = conn.execute(f'SELECT COUNT(*) FROM materiali_prodotti p WHERE {clause}', params).fetchone()[0]
            rows = rows_as_dicts(conn.execute(
                f'''SELECT p.*, c.nome AS contonome, b.nome AS brancanome, s.nome AS sottocontonome,
                    (SELECT COUNT(*) FROM materiali_offerte o WHERE o.prodotto_id=p.id) AS n_offerte,
                    (SELECT MAX(o.ultimo_acquisto) FROM materiali_offerte o WHERE o.prodotto_id=p.id) AS ultimo_acquisto,
                    (SELECT MIN(o.ultimo_prezzo / NULLIF(o.pezzi_per_confezione, 0)) FROM materiali_offerte o
                        WHERE o.prodotto_id=p.id AND o.ultimo_prezzo > 0) AS miglior_prezzo_unitario
                    FROM materiali_prodotti p
                    LEFT JOIN conti c ON c.id = p.contoid
                    LEFT JOIN branche b ON b.id = p.brancaid
                    LEFT JOIN sottoconti s ON s.id = p.sottocontoid
                    WHERE {clause}
                    ORDER BY {order} {direction}, p.id LIMIT ? OFFSET ?''', [*params, per_page, (page - 1) * per_page]))
            if rows:
                marks = ','.join('?' for _ in rows)
                offers = rows_as_dicts(conn.execute(
                    f'SELECT id, prodotto_id, fornitore_id, fornitore_nome, codice, ultimo_prezzo, pezzi_per_confezione '
                    f'FROM materiali_offerte WHERE prodotto_id IN ({marks}) ORDER BY fornitore_nome', [r['id'] for r in rows]))
            else:
                offers = []
            riepilogo = {r[0]: r[1] for r in conn.execute(
                'SELECT stato, COUNT(*) FROM materiali_prodotti WHERE archiviato=0 GROUP BY stato')}
        by_product = {}
        for o in offers:
            by_product.setdefault(o['prodotto_id'], []).append(_clean_row(o))
        items = [{**_clean_row(r), 'offerte': by_product.get(r['id'], [])} for r in rows]
        return {'prodotti': items, 'riepilogo': riepilogo,
                'pagination': {'page': page, 'per_page': per_page, 'total': total,
                               'pages': max(1, math.ceil(total / per_page))}}

    def get(self, prodotto_id):
        with self.db_manager.get_connection() as conn:
            row = conn.execute(
                'SELECT p.*, c.nome AS contonome, b.nome AS brancanome, s.nome AS sottocontonome FROM materiali_prodotti p '
                'LEFT JOIN conti c ON c.id = p.contoid LEFT JOIN branche b ON b.id = p.brancaid '
                'LEFT JOIN sottoconti s ON s.id = p.sottocontoid WHERE p.id=?', (prodotto_id,))
            prodotto = rows_as_dicts(row)
            if not prodotto:
                return None
            offers = rows_as_dicts(conn.execute('SELECT * FROM materiali_offerte WHERE prodotto_id=? ORDER BY fornitore_nome', (prodotto_id,)))
            for o in offers:
                o['acquisti'] = [_clean_row(a) for a in rows_as_dicts(conn.execute(
                    'SELECT * FROM materiali_acquisti_righe WHERE offerta_id=? ORDER BY data DESC, id DESC', (o['id'],)))]
                pezzi = o['pezzi_per_confezione'] or 1
                o['prezzo_unitario_base'] = o['ultimo_prezzo'] / pezzi if o['ultimo_prezzo'] else None
        return {**_clean_row(prodotto[0]), 'offerte': [_clean_row(o) for o in offers]}

    # ---------- modifica ----------

    def update_prodotto(self, prodotto_id, data):
        if not isinstance(data, dict):
            raise ValueError('Dati mancanti')
        sets, params = [], []
        if 'nome' in data:
            nome = clean(data['nome'])
            if not nome:
                raise ValueError('Il nome non puo essere vuoto')
            sets += ['nome=?', 'nome_norm=?']
            params += [nome, norm_desc(nome)]
        if 'unita_base' in data:
            sets.append('unita_base=?')
            params.append(clean(data['unita_base']))
        if 'note' in data:
            sets.append('note=?')
            params.append(clean(data['note']))
        if 'soglia_minima' in data:
            soglia = data['soglia_minima']
            if soglia in (None, ''):
                soglia = None
            else:
                try:
                    soglia = float(soglia)
                except (TypeError, ValueError):
                    raise ValueError('Soglia minima non valida')
                if soglia < 0 or math.isnan(soglia):
                    raise ValueError('Soglia minima non valida')
            sets.append('soglia_minima=?')
            params.append(soglia)
        if not sets:
            raise ValueError('Nessun campo da aggiornare')
        with self._tx() as conn:
            done = conn.execute(f"UPDATE materiali_prodotti SET {', '.join(sets)}, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                                (*params, prodotto_id)).rowcount
        return self.get(prodotto_id) if done else None

    def update_offerta(self, offerta_id, data):
        if not isinstance(data, dict):
            raise ValueError('Dati mancanti')
        sets, params = [], []
        if 'pezzi_per_confezione' in data:
            try:
                pezzi = float(data['pezzi_per_confezione'])
            except (TypeError, ValueError):
                raise ValueError('Pezzi per confezione non validi')
            if not pezzi > 0 or math.isinf(pezzi):
                raise ValueError('Pezzi per confezione non validi')
            sets += ['pezzi_per_confezione=?', "confezione_fonte='manuale'"]
            params.append(pezzi)
        if 'unita_acquisto' in data:
            sets.append('unita_acquisto=?')
            params.append(clean(data['unita_acquisto']))
        if not sets:
            raise ValueError('Nessun campo da aggiornare')
        with self._tx() as conn:
            prodotto = conn.execute('SELECT prodotto_id FROM materiali_offerte WHERE id=?', (offerta_id,)).fetchone()
            if not prodotto:
                return None
            conn.execute(f"UPDATE materiali_offerte SET {', '.join(sets)} WHERE id=?", (*params, offerta_id))
        return self.get(prodotto[0])

    def archivia(self, prodotto_id, archiviato):
        with self._tx() as conn:
            done = conn.execute('UPDATE materiali_prodotti SET archiviato=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                                (1 if archiviato else 0, prodotto_id)).rowcount
        return bool(done)

    def unisci(self, target_id, source_ids):
        if not isinstance(source_ids, list) or not source_ids:
            raise ValueError('Seleziona i prodotti da unire')
        target_id = _positive_int(target_id, 'Prodotto di destinazione')
        source_ids = sorted({_positive_int(i, 'Prodotto') for i in source_ids})
        if target_id in source_ids:
            raise ValueError('Il prodotto di destinazione non puo essere anche un\'origine')
        with self._tx() as conn:
            found = {r[0]: r for r in conn.execute(
                f"SELECT id, contoid, brancaid, sottocontoid FROM materiali_prodotti WHERE id IN ({','.join('?' for _ in [target_id, *source_ids])})",
                [target_id, *source_ids])}
            if len(found) != len(source_ids) + 1:
                raise ValueError('Prodotto inesistente')
            target = found[target_id]

            def completezza(row):
                return sum(1 for v in row[1:4] if v)

            migliore = max((found[sid] for sid in source_ids), key=completezza)
            ereditata = migliore if completezza(migliore) > completezza(target) else None
            diverse = sum(1 for sid in source_ids if completezza(found[sid]) and tuple(found[sid][1:4]) != tuple(
                (ereditata or target)[1:4]))
            marks = ','.join('?' for _ in source_ids)
            spostate = conn.execute(f'UPDATE materiali_offerte SET prodotto_id=? WHERE prodotto_id IN ({marks})',
                                    (target_id, *source_ids)).rowcount
            if ereditata is not None:
                conn.execute('UPDATE materiali_prodotti SET contoid=?, brancaid=?, sottocontoid=?, stato=? WHERE id=?',
                             (ereditata[1], ereditata[2], ereditata[3],
                              stato_classificazione(ereditata[1], ereditata[2], ereditata[3]), target_id))
            conn.execute(f'DELETE FROM materiali_prodotti WHERE id IN ({marks})', source_ids)
            conn.execute('UPDATE materiali_prodotti SET updated_at=CURRENT_TIMESTAMP WHERE id=?', (target_id,))
        return {'offerte_spostate': spostate, 'classificazioni_diverse_ignorate': diverse}

    def separa_offerta(self, offerta_id):
        with self._tx() as conn:
            offerta = conn.execute('SELECT prodotto_id, nome, nome_norm FROM materiali_offerte WHERE id=?', (offerta_id,)).fetchone()
            if not offerta:
                return None
            if conn.execute('SELECT COUNT(*) FROM materiali_offerte WHERE prodotto_id=?', (offerta[0],)).fetchone()[0] < 2:
                raise ValueError('Il prodotto ha una sola offerta: niente da separare')
            origine = conn.execute('SELECT contoid, brancaid, sottocontoid, stato, unita_base FROM materiali_prodotti WHERE id=?',
                                   (offerta[0],)).fetchone()
            nuovo = conn.execute(
                'INSERT INTO materiali_prodotti (nome, nome_norm, contoid, brancaid, sottocontoid, stato, unita_base) '
                'VALUES (?, ?, ?, ?, ?, ?, ?)', (offerta[1], offerta[2], *origine)).lastrowid
            conn.execute('UPDATE materiali_offerte SET prodotto_id=? WHERE id=?', (nuovo, offerta_id))
        return {'prodotto_id': nuovo}

    def fornitori(self, origine='catalogo'):
        """Fornitori per i filtri: quelli presenti nel catalogo oppure tutti i MATERIALI del gestionale."""
        if origine == 'gestionale':
            offers, _ = self._indice_gestionale()
            conteggi = {}
            for o in offers.values():
                voce = conteggi.setdefault(o['fornitore_id'], {'id': o['fornitore_id'], 'nome': o['fornitore_nome'], 'n': 0})
                voce['n'] += 1
            return sorted(conteggi.values(), key=lambda f: f['nome'].upper())
        with self.db_manager.get_connection() as conn:
            return rows_as_dicts(conn.execute(
                'SELECT fornitore_id AS id, MAX(fornitore_nome) AS nome, COUNT(*) AS n FROM materiali_offerte '
                'GROUP BY fornitore_id ORDER BY UPPER(MAX(fornitore_nome))'))

    # ---------- voci del gestionale ----------

    def _indice_gestionale(self, refresh=False):
        with _cache_lock:
            if not refresh and _cache['offers'] is not None and time.time() - _cache['ts'] < CACHE_SECONDS:
                return _cache['offers'], _cache['nomi']
            nomi = self.source.fornitori()
            with self.db_manager.get_connection() as conn:
                fornitori = fornitori_materiali(conn, nomi)
                testa = regole_testa(conn)
            offers, _, _ = leggi_gestionale(self.source, fornitori, testa, nomi)
            for key, offer in offers.items():
                offer['_key'] = key
                offer['_fornitore_norm'] = norm_desc(offer['fornitore_nome'])
                offer['_ultimo'] = max((a['data'] for a in offer['acquisti']), default='')
            _cache.update(ts=time.time(), offers=offers, nomi=nomi)
            return offers, nomi

    def voci_gestionale(self, q='', fornitore_id=None, solo_nuove=True, page=1, per_page=20, refresh=False):
        per_page = per_page if per_page in PAGE_SIZES else 20
        page = max(1, int(page or 1))
        offers, _ = self._indice_gestionale(refresh)
        with self.db_manager.get_connection() as conn:
            in_catalogo = {(r[0], r[1], r[2]): (r[3], r[4]) for r in conn.execute(
                'SELECT fornitore_id, codice_norm, nome_norm, id, prodotto_id FROM materiali_offerte')}
            tokens = _tokens(q)
            selected = []
            for key, o in offers.items():
                if fornitore_id and o['fornitore_id'] != clean(fornitore_id):
                    continue
                if key in in_catalogo and solo_nuove:
                    continue
                haystack = f"{key[2]} {key[1]} {o['_fornitore_norm']}"
                if all(t in haystack for t in tokens):
                    selected.append(o)
            selected.sort(key=lambda o: (o['_ultimo'], o['nome']), reverse=True)
            total = len(selected)
            page_items = selected[(page - 1) * per_page: page * per_page]
            contesto = self._contesto_proposte(conn)
            out = []
            for o in page_items:
                ids = in_catalogo.get(o['_key'])
                ultimo = max(o['acquisti'], key=lambda a: (a['data'], a['riga']))
                out.append({
                    'fornitore_id': o['fornitore_id'], 'fornitore_nome': o['fornitore_nome'], 'codice': o['codice'],
                    'nome': o['nome'], 'n_acquisti': len(o['acquisti']), 'ultimo_acquisto': ultimo['data'],
                    'ultimo_prezzo': _safe(ultimo['prezzo_unitario']),
                    'fatture': self._ultime_fatture(o['acquisti']),
                    'in_catalogo': ids is not None, 'offerta_id': ids[0] if ids else None, 'prodotto_id': ids[1] if ids else None,
                    'proposta': None if ids else self._proposta(contesto, o),
                })
        return {'voci': out, 'pagination': {'page': page, 'per_page': per_page, 'total': total,
                                            'pages': max(1, math.ceil(total / per_page))}}

    @staticmethod
    def _ultime_fatture(acquisti, limite=3):
        viste, fatture = set(), []
        for a in sorted(acquisti, key=lambda a: a['data'], reverse=True):
            if a['fattura_id'] in viste:
                continue
            viste.add(a['fattura_id'])
            fatture.append({'fattura_id': a['fattura_id'], 'numero_documento': a['numero_documento'], 'data': a['data']})
            if len(fatture) == limite:
                break
        return fatture

    @staticmethod
    def _contesto_proposte(conn):
        classificati = rows_as_dicts(conn.execute(
            '''SELECT o.fornitore_id, o.nome_norm, o.nome AS offerta_nome, o.codice AS offerta_codice, p.id AS prodotto_id, p.nome, p.contoid, p.brancaid, p.sottocontoid
               FROM materiali_offerte o JOIN materiali_prodotti p ON p.id=o.prodotto_id
               WHERE p.contoid IS NOT NULL AND p.archiviato=0'''))
        fornitori = {}
        try:
            for r in conn.execute("SELECT codice_riferimento, contoid, brancaid, sottocontoid FROM classificazioni_costi WHERE tipo_entita='fornitore'"):
                fornitori[clean(r[0])] = (r[1], r[2] or 0, r[3] or 0)
        except Exception:
            pass
        nomi = {
            'conti': {r[0]: r[1] for r in conn.execute('SELECT id, nome FROM conti')},
            'branche': {r[0]: r[1] for r in conn.execute('SELECT id, nome FROM branche')},
            'sottoconti': {r[0]: r[1] for r in conn.execute('SELECT id, nome FROM sottoconti')},
        }
        famiglia = FamilyIndex([{'prodotto_id': c['prodotto_id'], 'nome': c['offerta_nome'], 'fornitore_id': c['fornitore_id'],
                                 'codice': c['offerta_codice'],
                                 'contoid': c['contoid'], 'brancaid': c['brancaid'], 'sottocontoid': c['sottocontoid']}
                                for c in classificati])
        return {'classificati': classificati, 'fornitori': fornitori, 'nomi': nomi, 'famiglia': famiglia}

    @classmethod
    def _proposta(cls, contesto, offer):
        proposta = cls._calcola_proposta(contesto, offer)
        if proposta:
            nomi = contesto['nomi']
            proposta['contonome'] = nomi['conti'].get(proposta['contoid'])
            proposta['brancanome'] = nomi['branche'].get(proposta['brancaid'])
            proposta['sottocontonome'] = nomi['sottoconti'].get(proposta['sottocontoid'])
        return proposta

    @staticmethod
    def _calcola_proposta(contesto, offer):
        """Priorita': stesso nome in catalogo, fornitore con classificazione completa, famiglia di prodotti simili, fornitore parziale."""
        nome = norm_desc(offer['nome'])
        esatti = {(c['contoid'], c['brancaid'], c['sottocontoid']): c for c in contesto['classificati'] if c['nome_norm'] == nome}
        if len(esatti) == 1:
            c = next(iter(esatti.values()))
            return {'contoid': c['contoid'], 'brancaid': c['brancaid'], 'sottocontoid': c['sottocontoid'],
                    'fonte': 'stesso_nome_in_catalogo', 'confidence': 95, 'riferimento': c['nome']}
        fornitore = contesto['fornitori'].get(offer['fornitore_id'])
        famiglia = contesto['famiglia'].propose(offer['nome'], offer['fornitore_id'], codice=offer['codice'])
        if fornitore and fornitore[0] and fornitore[1] and fornitore[2]:
            return {'contoid': fornitore[0], 'brancaid': fornitore[1], 'sottocontoid': fornitore[2],
                    'fonte': 'fornitore_completo', 'confidence': 95, 'riferimento': offer['fornitore_nome']}
        conto_fornitore = fornitore[0] if fornitore else None
        if famiglia and (famiglia['depth'] >= 2 or not conto_fornitore) and (
                not conto_fornitore or famiglia['contoid'] == conto_fornitore):
            return {'contoid': famiglia['contoid'], 'brancaid': famiglia['brancaid'], 'sottocontoid': famiglia['sottocontoid'],
                    'fonte': 'famiglia_prodotti', 'confidence': famiglia['confidence'],
                    'riferimento': ', '.join(famiglia['riferimenti'])}
        if fornitore and fornitore[0]:
            return {'contoid': fornitore[0], 'brancaid': fornitore[1] or None, 'sottocontoid': fornitore[2] or None,
                    'fonte': 'fornitore_parziale', 'confidence': 80, 'riferimento': offer['fornitore_nome']}
        return None

    def aggiungi_voci(self, voci):
        if not isinstance(voci, list) or not 1 <= len(voci) <= 500:
            raise ValueError('Seleziona da 1 a 500 voci')
        offers, _ = self._indice_gestionale()
        risultati, creati = [], 0
        with self._tx() as conn:
            contesto = self._contesto_proposte(conn)
            for voce in voci:
                try:
                    if not isinstance(voce, dict):
                        raise ValueError('Voce non valida')
                    key = (clean(voce.get('fornitore_id')), norm_code(voce.get('codice')), norm_desc(voce.get('nome')))
                    offer = offers.get(key)
                    if offer is None:
                        raise ValueError('Voce non trovata nel gestionale: aggiorna l\'elenco')
                    cl = voce.get('classificazione')
                    cl = self.valida_classificazione(conn, cl) if cl else self._proposta_valida(conn, contesto, offer)
                    offerta_id, creata, _ = salva_offerta(conn, offer, cl)
                    prodotto_id = conn.execute('SELECT prodotto_id FROM materiali_offerte WHERE id=?', (offerta_id,)).fetchone()[0]
                    creati += creata
                    risultati.append({'nome': offer['nome'], 'offerta_id': offerta_id, 'prodotto_id': prodotto_id, 'creata': creata})
                except ValueError as exc:
                    risultati.append({'nome': clean(voce.get('nome')) if isinstance(voce, dict) else '', 'errore': str(exc)})
        return {'creati': creati, 'errori': sum(1 for r in risultati if 'errore' in r), 'risultati': risultati}

    def _proposta_valida(self, conn, contesto, offer):
        proposta = self._proposta(contesto, offer)
        if not proposta:
            return None
        try:
            return self.valida_classificazione(conn, proposta)
        except ValueError:
            return None
