"""Persistent XML purchase review; material writes require explicit confirmation."""
import hashlib
import io
import json
import re
import os
from pathlib import Path
from difflib import SequenceMatcher
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date
from decimal import DecimalException

from .acquisti_storico_extractor import AcquistiStoricoExtractor, ClassificazioneStoricoResolver


def key(value):
    # Preserve punctuation, sizes and leading zeros in product identifiers.
    return ' '.join(str(value or '').strip().upper().split())


def vat(value):
    return re.sub(r'^IT', '', re.sub(r'\s+', '', key(value)))


class MaterialiInboxService:
    def __init__(self, db, suppliers, email_folder=None):
        self.db = db
        self.suppliers = suppliers
        self.email_folder = Path(email_folder or os.getenv('FATTURE_XML_EMAIL_DIR') or
                                 Path(__file__).resolve().parents[2] / 'logs' / 'fatture_xml_email')

    @staticmethod
    def schema(conn):
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_xml_righe (
            source_id TEXT PRIMARY KEY, payload TEXT NOT NULL)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_xml_prodotti (
            product_key TEXT PRIMARY KEY, materiale_id INTEGER, escluso INTEGER NOT NULL DEFAULT 0)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_xml_file (
            path TEXT PRIMARY KEY, digest TEXT NOT NULL)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS materiali_xml_revisioni (
            product_key TEXT PRIMARY KEY, destinazione TEXT NOT NULL,
            classificazione TEXT, confermato INTEGER NOT NULL DEFAULT 0)''')

    def scan_email_folder(self):
        folder = self.email_folder.resolve()
        if not folder.is_dir():
            raise ValueError(f'Cartella fatture email non disponibile: {folder}')
        with self.db.get_connection() as conn, conn:
            self.schema(conn)
            known = dict(conn.execute('SELECT path, digest FROM materiali_xml_file').fetchall())
        result = {'file_trovati': 0, 'file_letti': 0, 'file_invariati': 0, 'righe_aggiunte': 0, 'errori': []}
        for path in sorted(folder.rglob('*')):
            if path.suffix.lower() != '.xml' or not path.is_file():
                continue
            result['file_trovati'] += 1
            try:
                resolved = path.resolve()
                if not resolved.is_relative_to(folder):
                    raise ValueError('Collegamento esterno alla cartella ignorato')
                with path.open('rb') as stream:
                    content = stream.read(5 * 1024 * 1024 + 1)
                digest = hashlib.sha256(content).hexdigest()
                if known.get(str(resolved)) == digest:
                    result['file_invariati'] += 1
                    continue
                imported = self.ingest([(str(path.relative_to(folder)), content)])
                result['file_letti'] += 1
                result['righe_aggiunte'] += imported['righe_aggiunte']
                result['errori'].extend(imported['errori'])
                if not imported['errori']:
                    with self.db.get_connection() as conn, conn:
                        conn.execute('INSERT OR REPLACE INTO materiali_xml_file VALUES (?, ?)', (str(resolved), digest))
            except (OSError, ValueError) as exc:
                result['errori'].append({'file': path.name, 'errore': str(exc)})
        return result

    @staticmethod
    def similar_classification(description, supplier_id, materials):
        matches = []
        for m in materials:
            if not m.get('confermato') or not all(m.get(k) for k in ('contoid', 'brancaid', 'sottocontoid')):
                continue
            if str(m['fornitoreid']).strip() != supplier_id:
                continue
            score = SequenceMatcher(None, key(description), key(m['nome'])).ratio()
            if score >= .82:
                matches.append((score, m))
        matches.sort(key=lambda item: (-item[0], item[1]['id']))
        if not matches:
            return None
        best, material = matches[0]
        category = tuple(material[k] for k in ('contoid', 'brancaid', 'sottocontoid'))
        if any(best - score < .08 and tuple(m[k] for k in ('contoid', 'brancaid', 'sottocontoid')) != category for score, m in matches[1:]):
            return None
        return {**{k: material[k] for k in ('contoid', 'contonome', 'brancaid', 'brancanome', 'sottocontoid', 'sottocontonome')},
                'fonte_classificazione': 'materiale_simile', 'confidence_classificazione': 70,
                'riferimento': material['nome']}

    @staticmethod
    def rows(cursor):
        columns = [c[0] for c in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def ingest(self, files):
        if not files or len(files) > 100:
            raise ValueError('Seleziona da 1 a 100 file XML')
        parsed = []
        errors = []
        for name, content in files:
            try:
                if len(content) > 5 * 1024 * 1024:
                    raise ValueError('File oltre 5 MB')
                # Reject declarations even when an XML uses UTF-16 encoding.
                if b'<!DOCTYPE' in content.replace(b'\x00', b'').upper() or b'<!ENTITY' in content.replace(b'\x00', b'').upper():
                    raise ValueError('Dichiarazioni XML non supportate')
                root = ET.fromstring(content)
                for node in root.iter():
                    node.tag = node.tag.split('}')[-1]
                if len(root.findall('FatturaElettronicaBody')) != 1:
                    raise ValueError('Richiesta una fattura con un solo corpo documento')
                document = root.find('.//DatiGeneraliDocumento')
                if document is None or not document.findtext('Numero') or not document.findtext('Data'):
                    raise ValueError('Numero o data fattura mancanti')
                date.fromisoformat(document.findtext('Data'))
                lines = AcquistiStoricoExtractor().extract_invoice_xml(io.BytesIO(content))
                line_numbers = set()
                for line in lines:
                    if not line['fornitore_id']:
                        raise ValueError('Partita IVA fornitore mancante')
                    if not line['descrizione']:
                        raise ValueError('Descrizione riga mancante')
                    if line['riga_documento'] in line_numbers:
                        raise ValueError('Numero riga duplicato nella fattura')
                    line_numbers.add(line['riga_documento'])
                    if any(not line[field].is_finite() for field in ('quantita_acquistata', 'prezzo_unitario_lordo', 'imponibile_riga')):
                        raise ValueError('Importi o quantità non validi')
                parsed.append((name, lines))
            except (ET.ParseError, ValueError, AttributeError, DecimalException) as exc:
                errors.append({'file': name, 'errore': str(exc)})
        added = 0
        duplicate = 0
        with self.db.get_connection() as conn, conn:
            self.schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            for name, lines in parsed:
                records = [(f"{line['id_fattura']}:{line.get('tipo_documento', '')}:{line['riga_documento']}",
                            json.dumps(line, default=str)) for line in lines]
                conflict = False
                for source_id, serialized in records:
                    existing = conn.execute('SELECT payload FROM materiali_xml_righe WHERE source_id=?', (source_id,)).fetchone()
                    if existing and existing[0] != serialized:
                        conflict = True
                        break
                if conflict:
                    errors.append({'file': name, 'errore': 'Fattura già caricata con dati diversi: mantenuta la versione precedente'})
                    continue
                for source_id, serialized in records:
                    inserted = conn.execute('INSERT OR IGNORE INTO materiali_xml_righe VALUES (?, ?)', (source_id, serialized)).rowcount
                    added += inserted
                    duplicate += 1 - inserted
        return {'righe_aggiunte': added, 'righe_gia_presenti': duplicate, 'errori': errors}

    def products(self, conn):
        materials = self.rows(conn.execute('SELECT * FROM materiali'))
        mappings = {r[0]: (r[1], r[2]) for r in conn.execute('SELECT * FROM materiali_xml_prodotti')}
        reviews = {r[0]: (r[1], json.loads(r[2]) if r[2] else None, r[3])
                   for r in conn.execute('SELECT * FROM materiali_xml_revisioni')}
        by_vat = defaultdict(dict)
        for supplier in self.suppliers:
            if vat(supplier.get('partita_iva')) and supplier.get('id'):
                by_vat[vat(supplier['partita_iva'])][str(supplier['id']).strip()] = supplier
        # Resolver temporarily changes row_factory; restore pooled connection state.
        factory = conn.row_factory
        try:
            resolver = ClassificazioneStoricoResolver(conn)
        finally:
            conn.row_factory = factory
        groups = defaultdict(list)
        for row in conn.execute('SELECT payload FROM materiali_xml_righe ORDER BY source_id'):
            line = json.loads(row[0])
            if not line['in_storico_acquisti']:
                continue
            codes = sorted({(key(c['codice_tipo']), key(c['codice_articolo'])) for c in line['codici_articolo'] if c['codice_articolo']})
            identity = [vat(line['fornitore_id']), codes or key(line['descrizione'])]
            product_key = hashlib.sha256(json.dumps(identity).encode()).hexdigest()
            groups[product_key].append(line)
        result = []
        for product_key, lines in groups.items():
            line = max(lines, key=lambda r: (r['data_documento'], r['id_fattura'], r['riga_documento']))
            suppliers = list(by_vat[vat(line['fornitore_id'])].values())
            supplier = suppliers[0] if len(suppliers) == 1 else None
            supplier_id = str(supplier['id']).strip() if supplier else None
            codes = {key(c['codice_articolo']) for c in line['codici_articolo'] if c['codice_articolo']}
            candidates = [m for m in materials if supplier_id and str(m['fornitoreid']).strip() == supplier_id and (
                (codes and key(m['codicearticolo']) in codes) or
                (not m['codicearticolo'] and key(m['nome']) == key(line['descrizione'])))]
            mapped_id, excluded = mappings.get(product_key, (None, 0))
            mapped = next((m for m in materials if m['id'] == mapped_id), None)
            if mapped:
                candidates = [mapped]
            classifications = {(m['contoid'], m['brancaid'], m['sottocontoid']) for m in candidates}
            existing = min(candidates, key=lambda m: m['id']) if candidates and len(classifications) == 1 else None
            reason = ''
            if not supplier:
                reason = 'Partita IVA assente o duplicata nell’anagrafica fornitori'
            elif candidates and not existing:
                reason = 'Materiali esistenti con classificazioni discordanti'
            elif existing and (not existing.get('confermato') or not all(existing.get(k) for k in ('contoid', 'brancaid', 'sottocontoid'))):
                reason = 'Materiale già presente da completare nella pagina Materiali'
            suggestion = resolver.resolve({**line, 'fornitore_nome': supplier['nome'] if supplier else line['fornitore_nome']}) if supplier else None
            if supplier and (not suggestion or suggestion.get('fonte_classificazione', '').startswith('fornitore')):
                suggestion = self.similar_classification(line['descrizione'], supplier_id, materials) or suggestion
            if existing:
                suggestion = {k: existing.get(k) for k in ('contoid', 'contonome', 'brancaid', 'brancanome', 'sottocontoid', 'sottocontonome')}
                suggestion['fonte_classificazione'] = 'Materiale già presente'
            status = 'escluso' if excluded else 'da_verificare' if reason else 'presente' if existing else 'nuovo'
            destination = 'da_decidere'
            if line['tipo_riga_proposto'] in ('costo_accessorio', 'servizio_o_utenza'):
                destination = 'altra_voce'
            elif suggestion and suggestion.get('contoid'):
                destination = 'materiale' if key(suggestion.get('contonome')) == 'MATERIALI' else 'altra_voce'
            elif line['tipo_riga_proposto'] == 'materiale_candidato':
                destination = 'materiale'
            review = reviews.get(product_key)
            if review:
                destination, suggestion, confirmed = review
                if confirmed and not existing:
                    status = 'elaborato'
            else:
                confirmed = False
            complete = self.valid_classification(conn, suggestion)
            ready = (status in ('nuovo', 'da_verificare') and destination != 'da_decidere' and complete
                     and (destination == 'altra_voce' or not reason))
            revision = hashlib.sha256(json.dumps([status, destination, suggestion, supplier_id, reason, line,
                                                   len(lines)], sort_keys=True).encode()).hexdigest()
            result.append({
                'id': product_key, 'descrizione': line['descrizione'], 'codice': line['codice_articolo'],
                'fornitore_id': supplier_id, 'fornitore_nome': supplier['nome'] if supplier else line['fornitore_nome'],
                'partita_iva': line['fornitore_id'], 'ultimo_acquisto': line['data_documento'],
                'costo_unitario': str(line['prezzo_unitario_lordo']), 'unita': line.get('unita_acquisto', ''),
                'tipo_riga': line['tipo_riga_proposto'], 'stato': status, 'motivo': reason,
                'materiale_id': existing['id'] if existing else None, 'proposta': suggestion,
                'destinazione': destination, 'pronto': bool(ready), 'revision': revision,
                'priorita': 0 if not ready else 1 if suggestion and suggestion.get('fonte_classificazione') == 'materiale_simile' else 2,
                'occorrenze': len(lines), 'fatture': sorted({r['id_fattura'] for r in lines}),
            })
        return sorted(result, key=lambda r: (r['priorita'], r['fornitore_nome'], r['descrizione']))

    @staticmethod
    def valid_classification(conn, classification):
        if not isinstance(classification, dict):
            return False
        ids = [classification.get(k) for k in ('contoid', 'brancaid', 'sottocontoid')]
        if any(type(i) is not int or i <= 0 for i in ids):
            return False
        return bool(conn.execute('''SELECT 1 FROM conti c JOIN branche b ON b.contoid=c.id
            JOIN sottoconti s ON s.brancaid=b.id AND s.contoid=c.id
            WHERE c.id=? AND b.id=? AND s.id=?''', ids).fetchone())

    def save_review(self, payload):
        ids = payload.get('ids') if isinstance(payload, dict) else None
        if not isinstance(ids, list) or not 1 <= len(ids) <= 5000 or any(not isinstance(i, str) for i in ids):
            raise ValueError('Seleziona da 1 a 5000 voci')
        destination = payload.get('destinazione')
        if destination not in ('materiale', 'altra_voce', 'da_decidere', 'automatico'):
            raise ValueError('Destinazione non valida')
        with self.db.get_connection() as conn, conn:
            self.schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            products = {p['id']: p for p in self.products(conn)}
            classification = payload.get('classificazione')
            if classification is not None:
                if not self.valid_classification(conn, classification):
                    raise ValueError('Seleziona conto, branca e sottoconto coerenti')
                classification = dict(classification)
                for table, id_field, name_field in [('conti', 'contoid', 'contonome'), ('branche', 'brancaid', 'brancanome'), ('sottoconti', 'sottocontoid', 'sottocontonome')]:
                    classification[name_field] = conn.execute(f'SELECT nome FROM {table} WHERE id=?', (classification[id_field],)).fetchone()[0]
                classification['fonte_classificazione'] = 'correzione_manuale'
            for product_id in set(ids):
                p = products.get(product_id)
                if not p or p['stato'] == 'presente':
                    raise ValueError('Voce inesistente o già presente nei materiali: aggiorna l’elenco')
                proposal = classification if classification is not None else p['proposta']
                resolved_destination = destination
                if destination == 'automatico':
                    resolved_destination = p['destinazione']
                    if classification is not None or resolved_destination == 'da_decidere':
                        resolved_destination = ('materiale' if key(proposal.get('contonome')) == 'MATERIALI'
                                                else 'altra_voce') if proposal and proposal.get('contoid') else 'da_decidere'
                conn.execute('''INSERT INTO materiali_xml_revisioni VALUES (?, ?, ?, 0)
                    ON CONFLICT(product_key) DO UPDATE SET destinazione=excluded.destinazione,
                    classificazione=excluded.classificazione, confermato=0''',
                    (product_id, resolved_destination, json.dumps(proposal)))
                conn.execute('UPDATE materiali_xml_prodotti SET escluso=0 WHERE product_key=?', (product_id,))
        return {'elaborati': len(set(ids))}

    def confirm_review(self, payload):
        items = payload.get('voci') if isinstance(payload, dict) else None
        if not isinstance(items, list) or not 1 <= len(items) <= 5000 or any(
                not isinstance(item, dict) or not isinstance(item.get('id'), str) or not isinstance(item.get('revision'), str) for item in items):
            raise ValueError('Seleziona da 1 a 5000 voci da confermare')
        with self.db.get_connection() as conn, conn:
            self.schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            products = {p['id']: p for p in self.products(conn)}
            result = {'inseriti': 0, 'altre_voci': 0, 'gia_presenti': 0, 'da_rivedere': []}
            for product_id, revision in {item['id']: item['revision'] for item in items}.items():
                p = products.get(product_id)
                if not p or p['revision'] != revision or not p['pronto']:
                    result['da_rivedere'].append({'id': product_id, 'errore': 'Voce cambiata o incompleta: aggiorna e verifica'})
                    continue
                c = p['proposta']
                if p['destinazione'] == 'materiale':
                    # Recheck inside the write transaction, including earlier inserts in this batch.
                    material = conn.execute('''SELECT id FROM materiali WHERE fornitoreid=? AND
                        ((? != '' AND UPPER(TRIM(codicearticolo))=?) OR
                        (COALESCE(codicearticolo, '')='' AND UPPER(TRIM(nome))=?)) ORDER BY id LIMIT 1''',
                        (p['fornitore_id'], p['codice'], key(p['codice']), key(p['descrizione']))).fetchone()
                    if material:
                        material_id = material[0]
                        result['gia_presenti'] += 1
                    else:
                        material_id = conn.execute('''INSERT INTO materiali
                            (codicearticolo, nome, fornitoreid, fornitorenome, contoid, contonome,
                             brancaid, brancanome, sottocontoid, sottocontonome, confidence, confermato,
                             occorrenze, metodo_classificazione, data_fattura, costo_unitario)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1, ?, 'xml_confermato', ?, ?)''',
                            (p['codice'], p['descrizione'], p['fornitore_id'], p['fornitore_nome'],
                             c['contoid'], c['contonome'], c['brancaid'], c['brancanome'], c['sottocontoid'], c['sottocontonome'],
                             p['occorrenze'], p['ultimo_acquisto'], p['costo_unitario'])).lastrowid
                        result['inseriti'] += 1
                    conn.execute('INSERT OR REPLACE INTO materiali_xml_prodotti VALUES (?, ?, 0)', (p['id'], material_id))
                else:
                    result['altre_voci'] += 1
                conn.execute('INSERT OR REPLACE INTO materiali_xml_revisioni VALUES (?, ?, ?, 1)',
                             (p['id'], p['destinazione'], json.dumps(c)))
            return result

    def list(self):
        with self.db.get_connection() as conn, conn:
            self.schema(conn)
            return {'prodotti': self.products(conn)}

    def confirm(self, payload):
        ids = payload.get('ids') if isinstance(payload, dict) else None
        if not isinstance(ids, list) or not 1 <= len(ids) <= 500 or any(not isinstance(i, str) for i in ids):
            raise ValueError('Seleziona da 1 a 500 prodotti')
        action = payload.get('azione', 'conferma')
        if action not in ('conferma', 'escludi', 'ripristina'):
            raise ValueError('Azione non valida')
        with self.db.get_connection() as conn, conn:
            self.schema(conn)
            conn.execute('BEGIN IMMEDIATE')
            products = {p['id']: p for p in self.products(conn)}
            inserted = 0
            for product_id in dict.fromkeys(ids):
                p = products.get(product_id)
                if not p:
                    raise ValueError('Elenco cambiato: aggiorna la pagina')
                if action != 'conferma':
                    conn.execute('''INSERT INTO materiali_xml_prodotti(product_key, escluso) VALUES (?, ?)
                        ON CONFLICT(product_key) DO UPDATE SET escluso=excluded.escluso''', (product_id, int(action == 'escludi')))
                    continue
                if p['motivo'] or p['stato'] == 'escluso':
                    raise ValueError(f"{p['descrizione']}: risolvi prima l’anomalia o ripristina il prodotto")
                material_id = p['materiale_id']
                if material_id is None:
                    # An earlier selection in this same transaction may have created
                    # the product under another XML code type/alias.
                    if p['codice']:
                        saved = conn.execute('''SELECT id FROM materiali WHERE fornitoreid=?
                            AND UPPER(TRIM(codicearticolo))=? ORDER BY id LIMIT 1''',
                            (p['fornitore_id'], key(p['codice']))).fetchone()
                        if saved:
                            material_id = saved[0]
                if material_id is None:
                    classification = payload.get('classificazione') or p['proposta']
                    if not isinstance(classification, dict):
                        raise ValueError('Seleziona una classificazione per tutti i prodotti')
                    conto, branca, sotto = (classification.get(k) for k in ('contoid', 'brancaid', 'sottocontoid'))
                    if any(type(i) is not int or i <= 0 for i in (conto, branca, sotto)):
                        raise ValueError('Conto, branca e sottoconto obbligatori')
                    names = conn.execute('''SELECT c.nome, b.nome, s.nome FROM conti c
                        JOIN branche b ON b.contoid=c.id JOIN sottoconti s ON s.brancaid=b.id
                        WHERE c.id=? AND b.id=? AND s.id=? AND s.contoid=c.id''', (conto, branca, sotto)).fetchone()
                    if not names:
                        raise ValueError('La classificazione selezionata non è coerente')
                    material_id = conn.execute('''INSERT INTO materiali
                        (codicearticolo, nome, fornitoreid, fornitorenome, contoid, contonome,
                         brancaid, brancanome, sottocontoid, sottocontonome, confidence, confermato,
                         occorrenze, metodo_classificazione, data_fattura, costo_unitario)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1, ?, 'xml_confermato', ?, ?)''',
                        (p['codice'], p['descrizione'], p['fornitore_id'], p['fornitore_nome'],
                         conto, names[0], branca, names[1], sotto, names[2], p['occorrenze'],
                         p['ultimo_acquisto'], p['costo_unitario'])).lastrowid
                    inserted += 1
                conn.execute('''INSERT INTO materiali_xml_prodotti VALUES (?, ?, 0)
                    ON CONFLICT(product_key) DO UPDATE SET materiale_id=excluded.materiale_id, escluso=0''', (product_id, material_id))
            return {'inseriti': inserted, 'elaborati': len(set(ids))}
