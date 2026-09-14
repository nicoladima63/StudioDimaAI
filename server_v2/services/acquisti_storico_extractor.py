"""Ricostruzione fedele dello storico acquisti dai DBF del gestionale.

Questo modulo non decide quali righe caricare in magazzino. Conserva ogni riga
commerciale (anche omaggi, costi accessori, resi e righe a valore zero) e ne
espone la natura proposta per la revisione.
"""
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from typing import Any, Dict, Iterable, List
import xml.etree.ElementTree as ET
import unicodedata


ZERO = Decimal('0')
_ACCESSORY = re.compile(r'\b(spese?\s+(?:bancarie|di\s+vendita|trasp|sped)|trasporto|spedizione|imballaggio|imballo|bollo)\b', re.I)
_SERVICE = re.compile(r'\b(canone|sub(?:locazione|loc)|fastweb|acquedotto|fognatura|depurazione|assicurativ|telefon|utenza)\b', re.I)
_DENTAL = re.compile(r'\b(ago|aghi|aspirasaliva|bicchier|cunei|dental|sutura|pellicola|punte?\s+carta|gutta|resina|composito|cemento|algin|garze?|mascherin|guanti|fresa|pasta\s+iodoformica)\b', re.I)
_INFORMATIONAL = re.compile(r'^(riga\s+ausiliaria|(?:m|x)\d+\s*-|prestazione\s+non\s+soggetta|informazioni\s+documento)', re.I)


def _clean(value: Any) -> str:
    return '' if value is None else str(value).strip()


def _key(value: Any) -> str:
    """Chiave prudente per confrontare nomi salvati con varianti di punteggiatura."""
    ascii_value = unicodedata.normalize('NFKD', _clean(value)).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'[^A-Z0-9]+', '', ascii_value)


def _supplier_key(value: Any) -> str:
    """Riduce solo la forma giuridica e le appendici dell'anagrafica fornitore."""
    raw = unicodedata.normalize('NFKD', _clean(value)).encode('ascii', 'ignore').decode().upper()
    raw = re.sub(r'\b(S\.?\s*R\.?\s*L\.?|S\.?\s*P\.?\s*A\.?|S\.?\s*A\.?\s*S\.?|S\.?\s*N\.?\s*C\.?)\b.*$', '', raw)
    return _key(raw)


def _decimal(value: Any) -> Decimal:
    if value in (None, ''):
        return ZERO
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return ZERO


def _code(text: str) -> Dict[str, str]:
    """Interpreta una riga C del DBF senza inventare un codice prodotto."""
    code_type, sep, code_value = text.partition(' ')
    return {
        'codice_tipo': code_type if sep else '',
        'codice_articolo': code_value.strip() if sep else '',
        'codice_sorgente': text,
    }


def propose_line_kind(description: str) -> str:
    """Proposta prudente; i casi sconosciuti restano da revisionare."""
    if _ACCESSORY.search(description):
        return 'costo_accessorio'
    if _SERVICE.search(description):
        return 'servizio_o_utenza'
    if _DENTAL.search(description):
        return 'materiale_candidato'
    return 'da_revisionare'


def is_purchase_history_line(description: str, quantity: Decimal, price: Decimal, codes: List[Dict[str, str]]) -> bool:
    """Separa le note FatturaPA dalle righe da conservare nello storico.

    Gli omaggi restano inclusi quando hanno un codice articolo o un quantitativo
    commerciale; le annotazioni fiscali a valore zero restano solo nella fonte.
    """
    if _INFORMATIONAL.search(description):
        return False
    return bool(codes[0].get('codice_articolo')) or quantity != ZERO or price != ZERO


class AcquistiStoricoExtractor:
    """Ricompatta le righe SPESAFOR, VOCISPES e FORNITOR in acquisti leggibili."""

    def extract(
        self,
        invoices: Iterable[Dict[str, Any]],
        details: Iterable[Dict[str, Any]],
        suppliers: Iterable[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        supplier_names = {_clean(r.get('DB_CODE')): _clean(r.get('DB_FONOME')) for r in suppliers}
        by_invoice: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for record in details:
            by_invoice[_clean(record.get('DB_VOSPCOD'))].append(record)

        purchases: List[Dict[str, Any]] = []
        for invoice in invoices:
            invoice_id = _clean(invoice.get('DB_CODE'))
            if not invoice_id:
                continue
            supplier_id = _clean(invoice.get('DB_SPFOCOD'))
            pending_codes: List[Dict[str, str]] = []
            current: Dict[str, Any] | None = None
            line_number = 0
            for source_position, record in enumerate(by_invoice.get(invoice_id, []), start=1):
                # R is a commercial row. Lowercase r is a continuation caused by
                # the 75-character DBF description field and must not become a
                # second purchase line.
                record_kind = _clean(record.get('DB_VOTIPRI'))
                text = _clean(record.get('DB_VODESCR'))
                if record_kind == 'C':
                    pending_codes.append(_code(text))
                    continue
                if record_kind == 'r':
                    if current and text:
                        current['descrizione'] = f"{current['descrizione']} {text}".strip()
                    continue
                if record_kind != 'R':
                    # D contains supplementary source information; preserve it under
                    # the preceding commercial line but never pretend it is a lot.
                    if current and text:
                        current['riferimenti_sorgente'].append(text)
                    continue

                line_number += 1
                quantity = _decimal(record.get('DB_VOQUANT'))
                price = _decimal(record.get('DB_VOPREZZ'))
                discount = _decimal(record.get('DB_VOSCONT'))
                codes = pending_codes if pending_codes else [{
                    'codice_tipo': '', 'codice_articolo': _clean(record.get('DB_VOSOCOD')), 'codice_sorgente': ''
                }]
                pending_codes = []
                code = codes[0]
                net_calculated = quantity * (price - discount)
                current = {
                    'id_fattura': invoice_id,
                    'numero_documento': _clean(invoice.get('DB_SPNUMER')),
                    'data_documento': _clean(invoice.get('DB_SPDATA')),
                    'fornitore_id': supplier_id,
                    'fornitore_nome': supplier_names.get(supplier_id, ''),
                    'riga_documento': line_number,
                    'posizione_sorgente': source_position,
                    **code,
                    'codici_articolo': codes,
                    'descrizione': text,
                    'quantita_acquistata': quantity,
                    'prezzo_unitario_lordo': price,
                    'sconto_unitario': discount,
                    'imponibile_riga_calcolato': net_calculated,
                    # FatturaPA esprime il totale di riga in centesimi. Il DBF
                    # conserva prezzo e sconto unitari, quindi ricalcoliamo e
                    # arrotondiamo soltanto al totale della riga.
                    'imponibile_riga': net_calculated.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    'aliquota_iva': _decimal(record.get('DB_VOIVA')),
                    'tipo_riga_proposto': propose_line_kind(text),
                    'in_storico_acquisti': is_purchase_history_line(text, quantity, price, codes),
                    'riferimenti_sorgente': [],
                }
                purchases.append(current)
        return purchases

    def extract_invoice_xml(self, path: str) -> List[Dict[str, Any]]:
        # The XML parser is shared with the resolver only to keep the public
        # extraction API in this class.
        return ClassificazioneStoricoResolver.extract_invoice_xml(path)


class ClassificazioneStoricoResolver:
    """Riusa classificazioni manuali già confermate, senza scrivere nel DB."""

    def __init__(self, connection):
        connection.row_factory = None
        cursor = connection.cursor()
        self._materials_by_supplier = defaultdict(list)
        self._materials_by_description = defaultdict(list)
        material_rows = cursor.execute('''
            SELECT nome, fornitorenome, contoid, contonome, brancaid, brancanome,
                   sottocontoid, sottocontonome
            FROM materiali WHERE confermato = 1 AND contoid IS NOT NULL
        ''').fetchall()
        for row in material_rows:
            classification = self._classification(*row[2:], source='materiale_storico_esatto', confidence=100)
            self._materials_by_supplier[(_key(row[0]), _supplier_key(row[1]))].append(classification)
            self._materials_by_description[_key(row[0])].append(classification)
        self._suppliers = defaultdict(list)
        supplier_rows = cursor.execute('''
            SELECT fornitore_nome, contoid, brancaid, sottocontoid
            FROM classificazioni_costi
            WHERE tipo_entita = 'fornitore' AND contoid IS NOT NULL
        ''').fetchall()
        names = {
            'conto': dict(cursor.execute('SELECT id, nome FROM conti').fetchall()),
            'branca': dict(cursor.execute('SELECT id, nome FROM branche').fetchall()),
            'sottoconto': dict(cursor.execute('SELECT id, nome FROM sottoconti').fetchall()),
        }
        for supplier_name, conto, branca, sottoconto in supplier_rows:
            classification = self._classification(
                conto, names['conto'].get(conto, ''), branca, names['branca'].get(branca, ''),
                sottoconto, names['sottoconto'].get(sottoconto, ''),
                source='fornitore_storico_esatto', confidence=95,
            )
            self._suppliers[_supplier_key(supplier_name)].append(classification)

    @staticmethod
    def _classification(contoid, contonome, brancaid, brancanome, sottocontoid, sottocontonome, *, source, confidence):
        return {
            'contoid': contoid, 'contonome': contonome or '',
            'brancaid': brancaid, 'brancanome': brancanome or '',
            'sottocontoid': sottocontoid, 'sottocontonome': sottocontonome or '',
            'fonte_classificazione': source, 'confidence_classificazione': confidence,
        }

    @staticmethod
    def _unique(candidates):
        unique = {(item['contoid'], item['brancaid'], item['sottocontoid']): item for item in candidates}
        return next(iter(unique.values())) if len(unique) == 1 else None

    def resolve(self, line: Dict[str, Any]) -> Dict[str, Any] | None:
        exact_material = self._unique(self._materials_by_supplier[(_key(line['descrizione']), _supplier_key(line['fornitore_nome']))])
        if exact_material:
            return exact_material
        description_material = self._unique(self._materials_by_description[_key(line['descrizione'])])
        if description_material:
            return {**description_material, 'fonte_classificazione': 'materiale_storico_descrizione', 'confidence_classificazione': 90}
        supplier_key = _supplier_key(line['fornitore_nome'])
        exact_supplier = self._unique(self._suppliers[supplier_key])
        if exact_supplier:
            return exact_supplier
        # Match only a substantial, unique stored supplier name. This accepts
        # legal-form/punctuation variations but never chooses between categories.
        candidates = [item for key, items in self._suppliers.items() if len(key) >= 12 and (key in supplier_key or supplier_key in key) for item in items]
        fuzzy_supplier = self._unique(candidates)
        if fuzzy_supplier:
            return {**fuzzy_supplier, 'fonte_classificazione': 'fornitore_storico_variante', 'confidence_classificazione': 85}
        return None

    def classify(self, lines: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        result = []
        for line in lines:
            classification = self.resolve(line)
            result.append({**line, 'classificazione': classification})
        return result

    @staticmethod
    def extract_invoice_xml(path: str) -> List[Dict[str, Any]]:
        """Estrae le righe commerciali dall'XML FatturaPA senza passare dal DBF.

        L'XML conserva unità di misura, tutti i codici articolo e sconti
        percentuali/importi: è la fonte preferita quando è disponibile.
        """
        root = ET.parse(path).getroot()
        for element in root.iter():
            element.tag = element.tag.split('}')[-1]
        document = root.find('.//DatiGeneraliDocumento')
        supplier = root.find('.//CedentePrestatore/DatiAnagrafici')
        supplier_vat = root.findtext('.//CedentePrestatore/DatiAnagrafici/IdFiscaleIVA/IdCodice') or ''
        anagrafica = root.find('.//CedentePrestatore/DatiAnagrafici/Anagrafica')
        supplier_name = (anagrafica.findtext('Denominazione') if anagrafica is not None else '') or ''
        if not supplier_name and anagrafica is not None:
            # Per persone fisiche FatturaPA usa Nome/Cognome, non Denominazione.
            supplier_name = ' '.join(part for part in [anagrafica.findtext('Cognome'), anagrafica.findtext('Nome')] if part)
        invoice_id = f"xml:{supplier_vat}:{document.findtext('Numero')}:{document.findtext('Data')}"
        purchases: List[Dict[str, Any]] = []
        for row in root.findall('.//DettaglioLinee'):
            description = _clean(row.findtext('Descrizione'))
            quantity_text = row.findtext('Quantita')
            quantity = _decimal(quantity_text) if quantity_text is not None else Decimal('1')
            price = _decimal(row.findtext('PrezzoUnitario'))
            total = _decimal(row.findtext('PrezzoTotale'))
            codes = [{
                'codice_tipo': _clean(code.findtext('CodiceTipo')),
                'codice_articolo': _clean(code.findtext('CodiceValore')),
                'codice_sorgente': _clean(code.findtext('CodiceTipo')) + ' ' + _clean(code.findtext('CodiceValore')),
            } for code in row.findall('CodiceArticolo')]
            if not codes:
                codes = [{'codice_tipo': '', 'codice_articolo': '', 'codice_sorgente': ''}]
            discounts = [{
                'tipo': _clean(discount.findtext('Tipo')),
                'percentuale': _decimal(discount.findtext('Percentuale')) if discount.findtext('Percentuale') is not None else None,
                'importo': _decimal(discount.findtext('Importo')) if discount.findtext('Importo') is not None else None,
            } for discount in row.findall('ScontoMaggiorazione')]
            unit_discount = (price - total / quantity) if quantity else ZERO
            line = {
                'id_fattura': invoice_id,
                'numero_documento': _clean(document.findtext('Numero')),
                'data_documento': _clean(document.findtext('Data')),
                'tipo_documento': _clean(document.findtext('TipoDocumento')),
                'fornitore_id': supplier_vat,
                'fornitore_nome': _clean(supplier_name),
                'riga_documento': int(row.findtext('NumeroLinea') or len(purchases) + 1),
                **codes[0],
                'codici_articolo': codes,
                'descrizione': description,
                'quantita_acquistata': quantity,
                'quantita_esplicita': quantity_text is not None,
                'unita_acquisto': _clean(row.findtext('UnitaMisura')),
                'prezzo_unitario_lordo': price,
                'sconto_unitario': unit_discount,
                'sconti_origine': discounts,
                'imponibile_riga': total,
                'imponibile_riga_calcolato': quantity * (price - unit_discount),
                'aliquota_iva': _decimal(row.findtext('AliquotaIVA')),
                'natura_iva': _clean(row.findtext('Natura')),
                'tipo_cessione_prestazione': _clean(row.findtext('TipoCessionePrestazione')),
                'tipo_riga_proposto': propose_line_kind(description),
                'in_storico_acquisti': is_purchase_history_line(description, quantity, price, codes),
                'riferimenti_sorgente': [_clean(item.findtext('RiferimentoTesto')) for item in row.findall('AltriDatiGestionali') if _clean(item.findtext('RiferimentoTesto'))],
                'fonte': 'xml_fatturapa',
            }
            purchases.append(line)
        return purchases
