"""Vista acquisti con conferme locali delle classificazioni: DBF completi e XML, senza dipendere dal catalogo."""
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
import hashlib
import io
import json
import os
import xml.etree.ElementTree as ET

from .acquisti_storico_extractor import AcquistiStoricoExtractor, ClassificazioneStoricoResolver


def text(value):
    return str(value or '').strip()


def vat(value):
    value = text(value).upper().replace(' ', '')
    return value[2:] if value.startswith('IT') else value


def identity(line):
    return (text(line['fornitore_id']), text(line['data_documento'])[:10], text(line['numero_documento']).upper(), text(line.get('tipo_documento')))


def merge_sources(dbf_lines, xml_documents, suppliers):
    """XML sostituisce l'intero documento DBF solo con abbinamento univoco.

    Conflitti XML e abbinamenti ambigui sono esposti, mai sommati come acquisti.
    """
    by_vat = defaultdict(list)
    for supplier in suppliers:
        if vat(supplier.get('DB_FOPAIVA')):
            by_vat[vat(supplier['DB_FOPAIVA'])].append(supplier)
    dbf = defaultdict(list)
    for line in dbf_lines:
        dbf[identity(line)].append({**line, 'fonte': 'dbf'})
    documents = defaultdict(list)
    warnings = []
    for lines in xml_documents:
        if not lines:
            continue
        matches = by_vat[vat(lines[0]['fornitore_id'])]
        if len(matches) > 1:
            warnings.append('XML con partita IVA associata a più fornitori: ' + lines[0]['numero_documento'])
            continue
        supplier = matches[0] if matches else None
        mapped = [{**line, 'fornitore_id': text(supplier['DB_CODE']) if supplier else 'piva:' + vat(line['fornitore_id']),
                   'fornitore_nome': text(supplier['DB_FONOME']) if supplier else line['fornitore_nome']} for line in lines]
        documents[identity(mapped[0])].append(mapped)
    replaced = 0
    for key, versions in documents.items():
        unique = {json.dumps(v, sort_keys=True, default=str): v for v in versions}
        if len(unique) != 1:
            warnings.append('Versioni XML discordanti, mantenuto solo il DBF se disponibile: ' + key[2])
            continue
        lines = next(iter(unique.values()))
        matched_key = key
        if key not in dbf:
            candidates = [k for k in dbf if k[:3] == key[:3] and not k[3]]
            if len(candidates) == 1:
                matched_key = candidates[0]
        old = dbf.get(matched_key, [])
        if len({r['id_fattura'] for r in old}) > 1:
            warnings.append('Abbinamento DBF ambiguo, XML non sommato: ' + key[2])
            continue
        if old:
            replaced += 1
            lines = [{**line, 'id_fattura_gestionale': old[0]['id_fattura']} for line in lines]
        if matched_key != key:
            dbf.pop(matched_key, None)
        dbf[key] = lines
    return [line for lines in dbf.values() for line in lines], warnings, replaced


def utility_classifications(conn):
    records = conn.execute("""SELECT cc.codice_riferimento, cc.contoid, c.nome,
        cc.brancaid, b.nome, cc.sottocontoid, sc.nome
        FROM classificazioni_costi cc JOIN conti c ON c.id=cc.contoid
        LEFT JOIN branche b ON b.id=cc.brancaid
        LEFT JOIN sottoconti sc ON sc.id=cc.sottocontoid
        WHERE cc.tipo_entita='fornitore' AND UPPER(TRIM(c.nome))='UTENZE'
        ORDER BY cc.id""").fetchall()
    return {text(r[0]): dict(zip(('contoid', 'contonome', 'brancaid', 'brancanome', 'sottocontoid', 'sottocontonome'), r[1:])) for r in records}


def collapse_utilities(rows, invoices, suppliers, categories):
    """Il documento del gestionale è autorevole per imponibile e totale utenza."""
    result = [r for r in rows if r['fornitoreid'] not in categories]
    names = {text(s['DB_CODE']): text(s['DB_FONOME']) for s in suppliers}
    groups = defaultdict(list)
    for row in rows:
        if row['fornitoreid'] in categories:
            groups[row['fattura_id']].append(row)
    for invoice in invoices:
        supplier = text(invoice.get('DB_SPFOCOD'))
        if supplier not in categories:
            continue
        invoice_id = text(invoice['DB_CODE'])
        groups.pop(invoice_id, None)
        kind = text(invoice.get('DB_SPTD'))
        credit = kind in ('4', '8', 'TD04', 'TD08')
        net = Decimal(str(invoice.get('DB_SPCOSTO') or 0))
        tax = Decimal(str(invoice.get('DB_SPCOIVA') or 0))
        # DB_SPXMLTD è il totale documento; nei documenti storici può mancare.
        total = Decimal(str(invoice.get('DB_SPXMLTD') or 0)) or net + tax
        if credit:
            net, total = -abs(net), -abs(total)
        result.append({
            'id': 'utenza:' + invoice_id, 'nome': names.get(supplier, supplier),
            'codicearticolo': '', 'fornitoreid': supplier, 'fornitorenome': names.get(supplier, supplier),
            'fattura_id': invoice_id, 'numero_documento': text(invoice.get('DB_SPNUMER')),
            'data_fattura': text(invoice.get('DB_SPDATA'))[:10], 'quantita': -1 if credit else 1,
            'unita_acquisto': 'fattura', 'costo_unitario': abs(float(net)),
            'imponibile_riga': float(net), 'totale_documento': float(total), 'fonte': 'dbf_documento',
            'tipo_documento': kind, 'tipo_riga': 'utenza', 'confermato': 1,
            **categories[supplier], 'proposta_classificazione': None,
        })
    # XML non ancora registrati nel gestionale: una riga per documento.
    for lines in groups.values():
        first = lines[0]
        net = sum(Decimal(str(r['imponibile_riga'])) for r in lines)
        result.append({**first, 'id': 'utenza:' + first['fattura_id'],
            'nome': first['fornitorenome'], 'codicearticolo': '',
            'quantita': -1 if first.get('tipo_documento') in ('TD04', 'TD08') else 1,
            'unita_acquisto': 'fattura', 'costo_unitario': abs(float(net)),
            'imponibile_riga': float(net), 'totale_documento': first.get('totale_documento'),
            'tipo_riga': 'utenza', 'confermato': 1, **categories[first['fornitoreid']],
            'proposta_classificazione': None})
    return result


class StoricoAcquistiService:
    def __init__(self, db, config, xml_folder=None):
        self.db = db
        self.config = config
        self.xml_folder = Path(xml_folder or os.getenv('FATTURE_XML_EMAIL_DIR') or Path(__file__).resolve().parents[2] / 'logs' / 'fatture_xml_email')

    @staticmethod
    def product_key(row):
        normalize = lambda value: ' '.join(text(value).upper().split())
        return json.dumps([text(row['fornitoreid']), normalize(row['nome']), normalize(row.get('codicearticolo'))], ensure_ascii=False)

    @staticmethod
    def proposal_token(proposal):
        return hashlib.sha256(json.dumps(proposal, sort_keys=True, default=str).encode()).hexdigest()

    def confirm(self, data, user_id):
        if not isinstance(data, dict) or not isinstance(data.get('id'), str) or not isinstance(data.get('token'), str):
            raise ValueError('Riga e proposta obbligatorie')
        rows = self.load()['materiali']
        row = next((r for r in rows if r['id'] == data['id']), None)
        if not row or not row.get('proposta_classificazione'):
            raise ValueError('Proposta non più disponibile. Aggiorna la ricerca.')
        proposal = row['proposta_classificazione']
        if data['token'] != self.proposal_token(proposal):
            raise ValueError('La proposta è cambiata. Aggiorna prima di confermare.')
        if proposal.get('contoid') is None:
            raise ValueError('La proposta non contiene un conto')
        product = self.product_key(row)
        with self.db.get_connection() as conn, conn:
            conn.execute('CREATE TABLE IF NOT EXISTS acquisti_classificazioni_confermate (product_key TEXT PRIMARY KEY, classificazione TEXT NOT NULL, utente TEXT NOT NULL, data_conferma TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
            conn.execute('INSERT OR IGNORE INTO acquisti_classificazioni_confermate (product_key, classificazione, utente) VALUES (?, ?, ?)', (product, json.dumps(proposal), str(user_id)))
            saved = json.loads(conn.execute('SELECT classificazione FROM acquisti_classificazioni_confermate WHERE product_key=?', (product,)).fetchone()[0])
        fields = {k: saved.get(k) for k in ('contoid', 'contonome', 'brancaid', 'brancanome', 'sottocontoid', 'sottocontonome')}
        return {'ids': [r['id'] for r in rows if self.product_key(r) == product], 'classificazione': fields}

    def load(self):
        from dbfread import DBF
        extractor = AcquistiStoricoExtractor()
        suppliers = list(DBF(self.config.get_dbf_path('fornitori'), encoding='latin-1'))
        invoices = list(DBF(self.config.get_dbf_path('spese'), encoding='latin-1'))
        details = list(DBF(self.config.get_dbf_path('voci_spese'), encoding='latin-1'))
        dbf_lines = extractor.extract(invoices, details, suppliers)
        types = {text(i['DB_CODE']): ('TD' + text(i.get('DB_SPTD')).zfill(2) if text(i.get('DB_SPTD')).isdigit() else text(i.get('DB_SPTD'))) for i in invoices}
        for line in dbf_lines:
            line['tipo_documento'] = types.get(line['id_fattura'], '')
        xml_documents = []
        xml_totals = {}
        warnings = []
        files = 0
        if self.xml_folder.is_dir():
            for path in sorted(self.xml_folder.rglob('*')):
                if path.suffix.lower() != '.xml' or not path.is_file():
                    continue
                files += 1
                try:
                    if not path.resolve().is_relative_to(self.xml_folder.resolve()) or path.stat().st_size > 5 * 1024 * 1024:
                        raise ValueError('File esterno o oltre 5 MB')
                    content = path.read_bytes()
                    root = ET.fromstring(content)
                    bodies = [e for e in root.iter() if e.tag.split('}')[-1] == 'FatturaElettronicaBody']
                    if len(bodies) != 1:
                        raise ValueError('Richiesto un solo corpo fattura')
                    extracted = extractor.extract_invoice_xml(io.BytesIO(content))
                    xml_documents.append(extracted)
                    for element in root.iter():
                        element.tag = element.tag.split('}')[-1]
                    total_text = root.findtext('.//DatiGeneraliDocumento/ImportoTotaleDocumento')
                    if extracted and total_text is not None:
                        value = Decimal(total_text)
                        if extracted[0].get('tipo_documento') in ('TD04', 'TD08'):
                            value = -abs(value)
                        xml_totals[extracted[0]['id_fattura']] = float(value)
                except (OSError, ValueError, ET.ParseError, AttributeError) as exc:
                    warnings.append(path.name + ': ' + str(exc))
        else:
            warnings.append('Cartella XML non disponibile: storico limitato a DBF e XML già acquisiti.')
        with self.db.get_connection() as conn:
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if 'materiali_xml_righe' in tables:
                imported = defaultdict(list)
                for row in conn.execute('SELECT payload FROM materiali_xml_righe'):
                    line = json.loads(row[0])
                    imported[(line['id_fattura'], line.get('tipo_documento', ''))].append(line)
                xml_documents.extend(sorted(lines, key=lambda r: r['riga_documento']) for lines in imported.values())
            lines, conflicts, replaced = merge_sources(dbf_lines, xml_documents, suppliers)
            warnings.extend(conflicts)
            factory = conn.row_factory
            try:
                resolver = ClassificazioneStoricoResolver(conn)
            finally:
                conn.row_factory = factory
            saved = {r[0]: json.loads(r[1]) for r in conn.execute('SELECT product_key, classificazione FROM acquisti_classificazioni_confermate')} if 'acquisti_classificazioni_confermate' in tables else {}
            rows = []
            for line in lines:
                if not line['in_storico_acquisti']:
                    continue
                classification = resolver.resolve(line)
                # Solo una corrispondenza esatta prodotto/fornitore è classificazione
                # recuperata. Le affinità restano proposte visibili ma fuori dai conti.
                confirmed = classification and classification['fonte_classificazione'] == 'materiale_storico_esatto'
                category = classification if confirmed else {}
                quantity = Decimal(str(line['quantita_acquistata']))
                total = Decimal(str(line['imponibile_riga']))
                credit = line.get('tipo_documento') in ('TD04', 'TD08')
                if credit:
                    quantity, total = -abs(quantity), -abs(total)
                source_key = f"{line['id_fattura']}:{line.get('tipo_documento', '')}:{line['riga_documento']}"
                rows.append({
                    'id': hashlib.sha256(source_key.encode()).hexdigest(),
                    'nome': line['descrizione'], 'codicearticolo': line['codice_articolo'],
                    'fornitoreid': line['fornitore_id'], 'fornitorenome': line['fornitore_nome'],
                    'fattura_id': line.get('id_fattura_gestionale', line['id_fattura']),
                    'numero_documento': line['numero_documento'], 'data_fattura': line['data_documento'][:10],
                    'quantita': float(quantity), 'unita_acquisto': line.get('unita_acquisto') or '',
                    'costo_unitario': float(total / quantity) if quantity else None,
                    'totale_documento': xml_totals.get(line['id_fattura']),
                    'imponibile_riga': float(total), 'fonte': line.get('fonte', 'dbf'),
                    'tipo_documento': line.get('tipo_documento', ''),
                    'tipo_riga': line['tipo_riga_proposto'],
                    'confermato': int(bool(confirmed)),
                    **{k: category.get(k) for k in ('contoid', 'contonome', 'brancaid', 'brancanome', 'sottocontoid', 'sottocontonome')},
                    'proposta_classificazione': classification if not confirmed else None,
                })
            rows = collapse_utilities(rows, invoices, suppliers, utility_classifications(conn))
            material_suppliers = sorted({text(r[0]) for r in conn.execute("""SELECT cc.codice_riferimento
                FROM classificazioni_costi cc JOIN conti c ON c.id=cc.contoid
                WHERE cc.tipo_entita='fornitore' AND UPPER(TRIM(c.nome))='MATERIALI'""")})
        for row in rows:
            classification = saved.get(self.product_key(row))
            if classification and row.get('tipo_riga') != 'utenza':
                row.update({k: classification.get(k) for k in ('contoid', 'contonome', 'brancaid', 'brancanome', 'sottocontoid', 'sottocontonome')})
                row['confermato'] = 1
                row['proposta_classificazione'] = None
            row['proposta_token'] = self.proposal_token(row['proposta_classificazione']) if row['proposta_classificazione'] else None
        rows.sort(key=lambda r: (r['data_fattura'], r['id']), reverse=True)
        return {'materiali': rows, 'fornitori_materiali_ids': material_suppliers, 'avvisi': warnings, 'copertura': {
            'documenti_dbf': len(invoices), 'righe_dbf': len(dbf_lines), 'file_xml': files,
            'documenti_riconciliati': replaced, 'righe_storico': len(rows),
            'righe_classificate': sum(r['confermato'] for r in rows)}}
