"""Catalogo materiali: schema, lettura del gestionale e migrazione di `materiali`.

Perimetro: solo fornitori classificati con conto MATERIALI in `classificazioni_costi`.
`plan()` e' di sola lettura (nemmeno lo schema); `apply()` scrive in una sola transazione ed e'
idempotente. La tabella legacy `materiali` non viene modificata, tranne la cancellazione esplicita
delle righe di fornitori fuori perimetro (elimina_fuori_perimetro=True).
"""
import logging
from collections import Counter, defaultdict

from .catalogo_materiali_parser import is_non_materiale, norm_code, norm_desc, parse_invoice_lines, strip_lotto

logger = logging.getLogger(__name__)

ESCLUSI_NOME = ('TEKHNE', 'BIOMAX')  # laboratori: non fornitori di materiali, anche se classificati MATERIALI
# Decisioni gia' prese: (fornitore, codice) -> 'conto>branca>sottoconto' da tenere.
RISOLUZIONI = {('ZZZZZZ', '938871'): 'MONOUSO>GHIACCIO SACCHETTI'}
REGOLE_INIZIALI = [('ZZZZZJ', 'testa_nome')]  # C.R.T.: codice = primo token della descrizione

SCHEMA = [
    '''CREATE TABLE IF NOT EXISTS materiali_prodotti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_norm TEXT NOT NULL DEFAULT '',
        contoid INTEGER, brancaid INTEGER, sottocontoid INTEGER,
        stato TEXT NOT NULL DEFAULT 'da_classificare',
        archiviato INTEGER NOT NULL DEFAULT 0,
        unita_base TEXT NOT NULL DEFAULT '',
        soglia_minima REAL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP)''',
    '''CREATE TABLE IF NOT EXISTS materiali_offerte (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prodotto_id INTEGER NOT NULL REFERENCES materiali_prodotti(id),
        fornitore_id TEXT NOT NULL,
        fornitore_nome TEXT NOT NULL DEFAULT '',
        fornitore_norm TEXT NOT NULL DEFAULT '',
        codice TEXT NOT NULL DEFAULT '',
        codice_norm TEXT NOT NULL DEFAULT '',
        nome TEXT NOT NULL,
        nome_norm TEXT NOT NULL,
        unita_acquisto TEXT NOT NULL DEFAULT '',
        pezzi_per_confezione REAL NOT NULL DEFAULT 1,
        confezione_fonte TEXT NOT NULL DEFAULT 'default',
        ultimo_prezzo REAL,
        ultimo_acquisto TEXT,
        origine TEXT NOT NULL DEFAULT 'gestionale',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (fornitore_id, codice_norm, nome_norm))''',
    'CREATE INDEX IF NOT EXISTS idx_mat_offerte_prodotto ON materiali_offerte(prodotto_id)',
    'CREATE INDEX IF NOT EXISTS idx_mat_offerte_fornitore ON materiali_offerte(fornitore_id)',
    '''CREATE TABLE IF NOT EXISTS materiali_acquisti_righe (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        offerta_id INTEGER NOT NULL REFERENCES materiali_offerte(id),
        fattura_id TEXT NOT NULL,
        riga INTEGER NOT NULL,
        numero_documento TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL DEFAULT '',
        quantita REAL, prezzo_unitario REAL, sconto REAL,
        lotto TEXT NOT NULL DEFAULT '',
        UNIQUE (fattura_id, riga))''',
    'CREATE INDEX IF NOT EXISTS idx_mat_acquisti_offerta ON materiali_acquisti_righe(offerta_id)',
    '''CREATE TABLE IF NOT EXISTS materiali_regole_codice (
        fornitore_id TEXT PRIMARY KEY,
        modo TEXT NOT NULL)''',
    '''CREATE TABLE IF NOT EXISTS materiali_legacy_map (
        materiale_id INTEGER PRIMARY KEY,
        offerta_id INTEGER NOT NULL REFERENCES materiali_offerte(id))''',
]


def ensure_tables(conn):
    for statement in SCHEMA:
        conn.execute(statement)
    for fornitore_id, modo in REGOLE_INIZIALI:
        conn.execute('INSERT OR IGNORE INTO materiali_regole_codice VALUES (?, ?)', (fornitore_id, modo))


def clean(value):
    return str(value if value is not None else '').strip()


def rows_as_dicts(cursor):
    columns = [c[0] for c in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def stato_classificazione(contoid, brancaid, sottocontoid):
    if contoid and brancaid and sottocontoid:
        return 'classificato'
    return 'parziale' if contoid else 'da_classificare'


class DbfSource:
    """Lettura dei DBF Windent (fornitori, fatture, righe fattura)."""

    def __init__(self, config=None):
        from core.config_manager import get_config
        self.config = config or get_config()

    def _table(self, name):
        from dbfread import DBF
        return DBF(self.config.get_dbf_path(name), encoding='latin-1')

    def fornitori(self):
        return {clean(r['DB_CODE']): clean(r['DB_FONOME']) for r in self._table('fornitori') if r}

    def fatture(self, fornitori_ids):
        return {clean(r['DB_CODE']): (clean(r['DB_SPFOCOD']), clean(r['DB_SPNUMER']), clean(r['DB_SPDATA']))
                for r in self._table('spese') if r and clean(r['DB_SPFOCOD']) in fornitori_ids}

    def voci(self, fatture_ids):
        voci = defaultdict(list)
        for r in self._table('voci_spese'):
            if r and clean(r['DB_VOSPCOD']) in fatture_ids:
                voci[clean(r['DB_VOSPCOD'])].append({'desc': clean(r['DB_VODESCR']), 'qta': r['DB_VOQUANT'] or 0,
                                                    'prezzo': r['DB_VOPREZZ'] or 0, 'sconto': r['DB_VOSCONT'] or 0})
        return voci


def fornitori_materiali(conn, nomi):
    """Id dei fornitori classificati con conto MATERIALI (TEKHNE e simili esclusi)."""
    conto = conn.execute("SELECT id FROM conti WHERE UPPER(nome)='MATERIALI'").fetchone()
    if not conto:
        raise ValueError('Conto MATERIALI non trovato')
    ids = {clean(r[0]) for r in conn.execute(
        "SELECT codice_riferimento FROM classificazioni_costi WHERE tipo_entita='fornitore' AND contoid=?", (conto[0],))}
    return {i for i in ids if not any(e in nomi.get(i, '').upper() for e in ESCLUSI_NOME)}


def regole_testa(conn):
    try:
        return {clean(r[0]) for r in conn.execute("SELECT fornitore_id FROM materiali_regole_codice WHERE modo='testa_nome'")}
    except Exception:
        return {f for f, modo in REGOLE_INIZIALI if modo == 'testa_nome'}


def leggi_gestionale(source, fornitori, testa, nomi):
    """Offerte distinte (fornitore + codice + descrizione) dalle fatture dei fornitori indicati.

    Ritorna (offers, index, esclusi): index mappa (fattura_id, descrizione normalizzata) -> chiave offerta.
    """
    fatture = source.fatture(fornitori)
    voci = source.voci(set(fatture))
    offers, index, esclusi = {}, {}, Counter()
    for fattura_id, (fid, numero, data) in fatture.items():
        for item in parse_invoice_lines(voci.get(fattura_id, []), code_in_head=fid in testa):
            if item['kind'] != 'prodotto':
                esclusi[item['kind']] += 1
                continue
            key = (fid, norm_code(item['codice']), norm_desc(item['nome']))
            offer = offers.setdefault(key, {'fornitore_id': fid, 'fornitore_nome': nomi.get(fid, fid),
                                            'codice': item['codice'], 'nome': item['nome'],
                                            'acquisti': [], 'legacy_ids': [], 'origine': 'gestionale'})
            offer['acquisti'].append({'fattura_id': fattura_id, 'riga': item['riga'], 'numero_documento': numero,
                                      'data': data, 'quantita': item['quantita'], 'prezzo_unitario': item['prezzo'],
                                      'sconto': item['sconto'], 'lotto': item['lotto']})
            index[(fattura_id, norm_desc(item['originale']))] = key
            index[(fattura_id, norm_desc(item['nome']))] = key
    return offers, index, dict(esclusi)


def salva_offerta(conn, offer, classificazione):
    """Crea (se manca) prodotto + offerta e collega le righe di acquisto. Ritorna (offerta_id, creata, righe_nuove)."""
    cl = classificazione or {}
    key = (offer['fornitore_id'], norm_code(offer['codice']), norm_desc(offer['nome']))
    row = conn.execute('SELECT id FROM materiali_offerte WHERE fornitore_id=? AND codice_norm=? AND nome_norm=?', key).fetchone()
    creata = row is None
    if creata:
        contoid, brancaid, sottocontoid = cl.get('contoid'), cl.get('brancaid') or None, cl.get('sottocontoid') or None
        prodotto_id = conn.execute(
            'INSERT INTO materiali_prodotti (nome, nome_norm, contoid, brancaid, sottocontoid, stato) VALUES (?, ?, ?, ?, ?, ?)',
            (offer['nome'], key[2], contoid, brancaid, sottocontoid,
             stato_classificazione(contoid, brancaid, sottocontoid))).lastrowid
        offerta_id = conn.execute(
            'INSERT INTO materiali_offerte (prodotto_id, fornitore_id, fornitore_nome, fornitore_norm, codice, codice_norm, '
            'nome, nome_norm, origine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (prodotto_id, offer['fornitore_id'], offer.get('fornitore_nome', ''), norm_desc(offer.get('fornitore_nome', '')),
             offer['codice'], key[1], offer['nome'], key[2], offer.get('origine', 'gestionale'))).lastrowid
    else:
        offerta_id = row[0]
    righe = 0
    for a in offer['acquisti']:
        righe += conn.execute(
            'INSERT OR IGNORE INTO materiali_acquisti_righe '
            '(offerta_id, fattura_id, riga, numero_documento, data, quantita, prezzo_unitario, sconto, lotto) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (offerta_id, a['fattura_id'], a['riga'], a['numero_documento'], a['data'], a['quantita'],
             a['prezzo_unitario'], a['sconto'], a['lotto'])).rowcount
    ultimo = conn.execute('SELECT prezzo_unitario, data FROM materiali_acquisti_righe WHERE offerta_id=? '
                          'AND prezzo_unitario IS NOT NULL ORDER BY data DESC, id DESC LIMIT 1', (offerta_id,)).fetchone()
    if ultimo:
        conn.execute('UPDATE materiali_offerte SET ultimo_prezzo=?, ultimo_acquisto=? WHERE id=?', (ultimo[0], ultimo[1], offerta_id))
    return offerta_id, creata, righe


class CatalogoMaterialiMigrationService:
    def __init__(self, db_manager, source):
        self.db = db_manager
        self.source = source

    def plan(self):
        nomi = self.source.fornitori()
        with self.db.get_connection() as conn:
            fornitori = fornitori_materiali(conn, nomi)
            testa = regole_testa(conn)
            legacy = rows_as_dicts(conn.execute('SELECT * FROM materiali ORDER BY id'))

        offers, index, esclusi = leggi_gestionale(self.source, fornitori, testa, nomi)
        by_name = defaultdict(list)
        for key in offers:
            by_name[(key[0], key[2])].append(key)

        fuori, non_agganciate, legacy_non_materiale, classi = [], [], [], defaultdict(list)
        for row in legacy:
            fid = clean(row['fornitoreid'])
            if fid not in fornitori:
                fuori.append(row)
                continue
            if is_non_materiale(row['nome']):
                legacy_non_materiale.append(row)
                continue
            key = index.get((clean(row['fattura_id']), norm_desc(row['nome'])))
            if key is None:
                found = by_name.get((fid, norm_desc(strip_lotto(row['nome'])[0])), [])
                key = found[0] if len(found) == 1 else None
            if key is None:
                non_agganciate.append(row)
                continue
            offers[key]['legacy_ids'].append(row['id'])
            classi[key].append(row)

        for row in non_agganciate:
            codice = clean(row['codicearticolo'])
            if codice.upper().startswith('REF '):
                codice = codice[4:].strip()
            nome = strip_lotto(clean(row['nome']))[0]
            key = (clean(row['fornitoreid']), norm_code(codice), norm_desc(nome))
            offer = offers.setdefault(key, {'fornitore_id': key[0], 'fornitore_nome': nomi.get(key[0], clean(row['fornitorenome'])),
                                            'codice': codice, 'nome': nome, 'acquisti': [], 'legacy_ids': [], 'origine': 'legacy'})
            offer['legacy_ids'].append(row['id'])
            classi[key].append(row)
            if row['fattura_id']:
                offer['acquisti'].append({'fattura_id': clean(row['fattura_id']), 'riga': -int(row['id']),
                                          'numero_documento': '', 'data': clean(row['data_fattura']), 'quantita': None,
                                          'prezzo_unitario': row['costo_unitario'], 'sconto': None, 'lotto': ''})

        catalogo = []
        for key, rows in classi.items():
            offer = offers[key]
            scelta = max(rows, key=lambda r: r['id'])
            voluta = RISOLUZIONI.get((key[0], key[1]))
            if voluta:
                scelta = next((r for r in rows if f"{r['contonome']}>{r['brancanome']}>{r['sottocontonome']}" == voluta), scelta)
            offer['classificazione'] = {k: scelta[k] for k in ('contoid', 'brancaid', 'sottocontoid',
                                                              'contonome', 'brancanome', 'sottocontonome')}
            offer['classificazioni_distinte'] = len({(r['contoid'], r['brancaid'] or 0, r['sottocontoid'] or 0) for r in rows})
            catalogo.append(offer)

        return {
            'fornitori': len(fornitori), 'offerte_gestionale': len(offers), 'esclusi': esclusi,
            'catalogo': catalogo, 'fuori_perimetro': fuori, 'non_agganciate': non_agganciate,
            'legacy_non_materiale': legacy_non_materiale, 'nomi_fornitori': nomi,
            'da_rivedere': self._da_rivedere(catalogo, nomi, fuori),
        }

    @staticmethod
    def _da_rivedere(catalogo, nomi, fuori):
        out = []
        by_code, by_desc = defaultdict(list), defaultdict(list)
        for o in catalogo:
            nome_f = nomi.get(o['fornitore_id'], o['fornitore_id'])
            if o['classificazioni_distinte'] > 1 and (o['fornitore_id'], norm_code(o['codice'])) not in RISOLUZIONI:
                out.append(('classificazioni_discordanti', nome_f, o['codice'], o['nome'], ''))
            if o['codice']:
                by_code[(o['fornitore_id'], norm_code(o['codice']))].append(o)
            by_desc[(o['fornitore_id'], norm_desc(o['nome']))].append(o)
        for (fid, code), items in by_code.items():
            if len(items) > 1:
                out.append(('stesso_codice_descrizioni_diverse', nomi.get(fid, fid), code,
                            ' || '.join(i['nome'] for i in items), 'unibili dal pulsante Unisci'))
        for (fid, _), items in by_desc.items():
            codes = sorted({i['codice'] for i in items if i['codice']})
            if len(codes) > 1:
                out.append(('stessa_descrizione_codici_diversi', nomi.get(fid, fid), ' | '.join(codes), items[0]['nome'], 'separate'))
        for o in catalogo:
            if o['origine'] == 'legacy':
                out.append(('riga_catalogo_non_trovata_nel_gestionale', nomi.get(o['fornitore_id'], o['fornitore_id']),
                            o['codice'], o['nome'], 'codice da verificare'))
        for r in fuori:
            out.append(('fuori_perimetro_da_cancellare', r['fornitorenome'], r['codicearticolo'] or '', r['nome'], f"id {r['id']}"))
        return sorted(out, key=lambda x: (x[0], x[1], x[3]))

    def apply(self, plan, elimina_fuori_perimetro=False):
        creati = aggiornati = acquisti = 0
        with self.db.transaction() as conn:
            ensure_tables(conn)
            for o in plan['catalogo']:
                offerta_id, creata, righe = salva_offerta(conn, o, o['classificazione'])
                creati += creata
                aggiornati += not creata
                acquisti += righe
                for legacy_id in o['legacy_ids']:
                    conn.execute('INSERT OR IGNORE INTO materiali_legacy_map VALUES (?, ?)', (legacy_id, offerta_id))
            eliminati, trattenuti = 0, []
            if elimina_fuori_perimetro:
                for r in plan['fuori_perimetro']:
                    if self._referenziata(conn, r['id']):
                        trattenuti.append(r['id'])
                        continue
                    eliminati += conn.execute('DELETE FROM materiali WHERE id=?', (r['id'],)).rowcount
        return {'prodotti_creati': creati, 'offerte_esistenti': aggiornati, 'righe_acquisto_nuove': acquisti,
                'righe_legacy_eliminate': eliminati, 'righe_legacy_trattenute_perche_in_uso': trattenuti}

    @staticmethod
    def _referenziata(conn, materiale_id):
        for table in ('materiali_acquisti', 'materiali_ordini_righe'):
            try:
                if conn.execute(f'SELECT 1 FROM {table} WHERE materiale_id=? LIMIT 1', (materiale_id,)).fetchone():
                    return True
            except Exception:
                continue
        return False
