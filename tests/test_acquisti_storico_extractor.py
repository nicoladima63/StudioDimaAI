from decimal import Decimal
import sqlite3
from server_v2.services.acquisti_storico_extractor import AcquistiStoricoExtractor, ClassificazioneStoricoResolver


def test_rebuilds_codes_discounts_zero_price_and_references():
    result = AcquistiStoricoExtractor().extract(
        [{'DB_CODE': 'F1', 'DB_SPFOCOD': 'S1', 'DB_SPNUMER': '4109602789', 'DB_SPDATA': '2026-01-14'}],
        [
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'C', 'DB_VODESCR': 'COD_FORNITORE 0129560'},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'C', 'DB_VODESCR': 'EAN13 0800123456'},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'R', 'DB_VODESCR': 'AGHI DDN 100 PZ', 'DB_VOQUANT': 2, 'DB_VOPREZZ': '15.29', 'DB_VOSCONT': '7.645', 'DB_VOIVA': 22},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'D', 'DB_VODESCR': 'ORDINE 0135206582'},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'r', 'DB_VODESCR': 'CON CONTINUAZIONE'},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'C', 'DB_VODESCR': 'COD_FORNITORE 0346815'},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'R', 'DB_VODESCR': 'CUNEI LEGNO 100 PZ', 'DB_VOQUANT': 1, 'DB_VOPREZZ': 0, 'DB_VOSCONT': 0, 'DB_VOIVA': 22},
            {'DB_VOSPCOD': 'F1', 'DB_VOTIPRI': 'R', 'DB_VODESCR': 'SPESE DI VENDITA E IMBALLAGGIO', 'DB_VOQUANT': 1, 'DB_VOPREZZ': '2.59', 'DB_VOSCONT': 0, 'DB_VOIVA': 22},
        ],
        [{'DB_CODE': 'S1', 'DB_FONOME': 'Henry Schein'}],
    )
    aghi, cunei, spese = result
    assert aghi['codice_articolo'] == '0129560'
    assert [code['codice_articolo'] for code in aghi['codici_articolo']] == ['0129560', '0800123456']
    assert aghi['imponibile_riga'] == Decimal('15.290')
    assert aghi['descrizione'] == 'AGHI DDN 100 PZ CON CONTINUAZIONE'
    assert aghi['riferimenti_sorgente'] == ['ORDINE 0135206582']
    assert cunei['imponibile_riga'] == Decimal('0')
    assert cunei['tipo_riga_proposto'] == 'materiale_candidato'
    assert spese['tipo_riga_proposto'] == 'costo_accessorio'


def test_xml_keeps_supplier_codes_percent_discount_and_zero_price(tmp_path):
    xml = tmp_path / 'fattura.xml'
    xml.write_text('''<FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdCodice>13088630150</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Henry Schein</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Data>2026-01-14</Data><Numero>4109602789</Numero></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DettaglioLinee><NumeroLinea>1</NumeroLinea><CodiceArticolo><CodiceTipo>COD_FORNITORE</CodiceTipo><CodiceValore>0129560</CodiceValore></CodiceArticolo><CodiceArticolo><CodiceTipo>EAN13</CodiceTipo><CodiceValore>0800</CodiceValore></CodiceArticolo><Descrizione>AGHI 100 PZ</Descrizione><Quantita>2</Quantita><UnitaMisura>PZ</UnitaMisura><PrezzoUnitario>15.29</PrezzoUnitario><ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>50</Percentuale></ScontoMaggiorazione><PrezzoTotale>15.29</PrezzoTotale><AliquotaIVA>22</AliquotaIVA></DettaglioLinee><DettaglioLinee><NumeroLinea>2</NumeroLinea><CodiceArticolo><CodiceTipo>COD_FORNITORE</CodiceTipo><CodiceValore>0346815</CodiceValore></CodiceArticolo><Descrizione>CUNEI 100 PZ</Descrizione><Quantita>1</Quantita><UnitaMisura>PZ</UnitaMisura><PrezzoUnitario>0</PrezzoUnitario><PrezzoTotale>0</PrezzoTotale><AliquotaIVA>22</AliquotaIVA></DettaglioLinee></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>''', encoding='utf-8')
    aghi, cunei = AcquistiStoricoExtractor().extract_invoice_xml(str(xml))
    assert aghi['fornitore_id'] == '13088630150'
    assert aghi['unita_acquisto'] == 'PZ'
    assert [x['codice_articolo'] for x in aghi['codici_articolo']] == ['0129560', '0800']
    assert aghi['sconti_origine'][0]['percentuale'] == Decimal('50')
    assert aghi['sconto_unitario'] == Decimal('7.645')
    assert cunei['in_storico_acquisti'] is True


def test_existing_supplier_variant_is_used_only_when_unambiguous():
    db = sqlite3.connect(':memory:')
    db.executescript('''
        CREATE TABLE materiali (nome TEXT, fornitorenome TEXT, contoid INTEGER, contonome TEXT, brancaid INTEGER, brancanome TEXT, sottocontoid INTEGER, sottocontonome TEXT, confermato INTEGER);
        CREATE TABLE classificazioni_costi (fornitore_nome TEXT, contoid INTEGER, brancaid INTEGER, sottocontoid INTEGER, tipo_entita TEXT);
        CREATE TABLE conti (id INTEGER, nome TEXT); CREATE TABLE branche (id INTEGER, contoid INTEGER, nome TEXT); CREATE TABLE sottoconti (id INTEGER, contoid INTEGER, brancaid INTEGER, nome TEXT);
        INSERT INTO conti VALUES (18, 'MATERIALI'); INSERT INTO branche VALUES (3, 18, 'CONSERVATIVA'); INSERT INTO sottoconti VALUES (7, 18, 3, 'COMPOSITI');
        INSERT INTO classificazioni_costi VALUES ('DELTA TRE ELABORAZIONI SNC', 18, 3, 7, 'fornitore');
    ''')
    line = {'descrizione': 'Elaborazione cedolini', 'fornitore_nome': 'DELTA TRE ELABORAZIONI SNC DI RAFFAELLA PRIAMI & C.'}
    result = ClassificazioneStoricoResolver(db).classify([line])[0]['classificazione']
    assert result['contoid'] == 18
    assert result['fonte_classificazione'] == 'fornitore_storico_esatto'


def test_supplier_legal_form_and_phone_are_ignored_for_existing_classification():
    db = sqlite3.connect(':memory:')
    db.executescript('''
        CREATE TABLE materiali (nome TEXT, fornitorenome TEXT, contoid INTEGER, contonome TEXT, brancaid INTEGER, brancanome TEXT, sottocontoid INTEGER, sottocontonome TEXT, confermato INTEGER);
        CREATE TABLE classificazioni_costi (fornitore_nome TEXT, contoid INTEGER, brancaid INTEGER, sottocontoid INTEGER, tipo_entita TEXT);
        CREATE TABLE conti (id INTEGER, nome TEXT); CREATE TABLE branche (id INTEGER, contoid INTEGER, nome TEXT); CREATE TABLE sottoconti (id INTEGER, contoid INTEGER, brancaid INTEGER, nome TEXT);
        INSERT INTO conti VALUES (5, 'STUDIO'); INSERT INTO branche VALUES (52, 5, 'FARMACIA'); INSERT INTO sottoconti VALUES (0, 5, 52, '');
        INSERT INTO classificazioni_costi VALUES ('FARMACIA SAN MICHELE SAS DEI DOTT.', 5, 52, 0, 'fornitore');
    ''')
    result = ClassificazioneStoricoResolver(db).classify([{'descrizione': 'ADRENALINA', 'fornitore_nome': 'FARMACIA SAN MICHELE SRL 0574679484'}])[0]['classificazione']
    assert result['contoid'] == 5


def test_xml_uses_person_name_when_company_name_is_absent(tmp_path):
    xml = tmp_path / 'persona.xml'
    xml.write_text('''<FatturaElettronica><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdCodice>1</IdCodice></IdFiscaleIVA><Anagrafica><Nome>ANET</Nome><Cognome>JABLONSKY</Cognome></Anagrafica></DatiAnagrafici></CedentePrestatore><DatiGeneraliDocumento><Numero>1</Numero><Data>2026-01-01</Data></DatiGeneraliDocumento><DettaglioLinee><Descrizione>Prestazione</Descrizione><PrezzoUnitario>1</PrezzoUnitario><PrezzoTotale>1</PrezzoTotale><AliquotaIVA>0</AliquotaIVA></DettaglioLinee></FatturaElettronica>''', encoding='utf-8')
    line = AcquistiStoricoExtractor().extract_invoice_xml(str(xml))[0]
    assert line['fornitore_nome'] == 'JABLONSKY ANET'
