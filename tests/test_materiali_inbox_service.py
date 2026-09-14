import sqlite3
from contextlib import contextmanager

import pytest

from server_v2.services.materiali_inbox_service import MaterialiInboxService


class Database:
    def __init__(self):
        self.conn = sqlite3.connect(':memory:')
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript('''
            CREATE TABLE materiali (id INTEGER PRIMARY KEY, codicearticolo TEXT, nome TEXT,
                fornitoreid TEXT, fornitorenome TEXT, contoid INTEGER, contonome TEXT,
                brancaid INTEGER, brancanome TEXT, sottocontoid INTEGER, sottocontonome TEXT,
                confidence INTEGER, confermato INTEGER, occorrenze INTEGER,
                metodo_classificazione TEXT, data_fattura TEXT, costo_unitario REAL);
            CREATE TABLE conti(id INTEGER PRIMARY KEY, nome TEXT);
            CREATE TABLE branche(id INTEGER PRIMARY KEY, nome TEXT, contoid INTEGER);
            CREATE TABLE sottoconti(id INTEGER PRIMARY KEY, nome TEXT, brancaid INTEGER, contoid INTEGER);
            CREATE TABLE classificazioni_costi(tipo_entita TEXT, fornitore_nome TEXT,
                contoid INTEGER, brancaid INTEGER, sottocontoid INTEGER);
            INSERT INTO conti VALUES(1, 'Materiali');
            INSERT INTO branche VALUES(2, 'Chirurgia', 1);
            INSERT INTO sottoconti VALUES(3, 'Monouso', 2, 1);
            INSERT INTO classificazioni_costi VALUES('fornitore', 'Dentale SRL', 1, 2, 3);
        ''')

    @contextmanager
    def get_connection(self):
        yield self.conn


@pytest.fixture
def service():
    db = Database()
    yield MaterialiInboxService(db, [{'id': 'ZZZ1', 'nome': 'Dentale SRL', 'partita_iva': 'IT00123456789'}])
    db.conn.close()


def xml(number='1', code='001', description='ASPIRASALIVA', vat='00123456789', quantity='1', price='5'):
    return f'''<FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>{vat}</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Dentale SRL</Denominazione></Anagrafica>
        </DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>
        <FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento>
        <Numero>{number}</Numero><Data>2026-09-08</Data></DatiGeneraliDocumento></DatiGenerali>
        <DatiBeniServizi><DettaglioLinee><NumeroLinea>1</NumeroLinea>
        <CodiceArticolo><CodiceTipo>SKU</CodiceTipo><CodiceValore>{code}</CodiceValore></CodiceArticolo>
        <Descrizione>{description}</Descrizione><Quantita>{quantity}</Quantita><PrezzoUnitario>{price}</PrezzoUnitario>
        <PrezzoTotale>{price}</PrezzoTotale><AliquotaIVA>22</AliquotaIVA></DettaglioLinee></DatiBeniServizi>
        </FatturaElettronicaBody></FatturaElettronica>'''.encode()


def ingest(service, **kwargs):
    return service.ingest([('invoice.xml', xml(**kwargs))])


def test_upload_groups_invoices_without_creating_materials_and_is_repeatable(service):
    ingest(service)
    ingest(service, number='2')
    assert ingest(service)['righe_gia_presenti'] == 1
    p, = service.list()['prodotti']
    assert (p['occorrenze'], len(p['fatture']), p['fornitore_id'], p['stato']) == (2, 2, 'ZZZ1', 'nuovo')
    assert p['proposta']['contoid'] == 1
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 0
    assert service.db.conn.row_factory is sqlite3.Row


def test_confirmation_and_later_purchase_reuse_stable_material(service):
    ingest(service)
    p, = service.list()['prodotti']
    payload = {'ids': [p['id']]}
    assert service.confirm(payload)['inseriti'] == 1
    assert service.confirm(payload)['inseriti'] == 0
    ingest(service, number='3', description='ASPIRASALIVA nuovo testo')
    p, = service.list()['prodotti']
    assert p['stato'] == 'presente'
    assert p['occorrenze'] == 2
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 1


def test_unknown_or_ambiguous_supplier_blocks_confirmation(service):
    ingest(service, vat='999')
    p, = service.list()['prodotti']
    assert p['stato'] == 'da_verificare'
    with pytest.raises(ValueError):
        service.confirm({'ids': [p['id']]})
    service.suppliers.append({'id': 'ZZZ2', 'nome': 'Duplicate', 'partita_iva': '00123456789'})
    ingest(service)
    assert all(p['stato'] == 'da_verificare' for p in service.list()['prodotti'])


def test_sizes_and_missing_codes_not_collapsed(service):
    ingest(service, code='', description='Guanti taglia S')
    ingest(service, number='2', code='', description='Guanti taglia M')
    ingest(service, number='3', code='0001')
    ingest(service, number='4', code='1')
    assert len(service.list()['prodotti']) == 4


def test_invalid_category_rolls_back_entire_bulk(service):
    ingest(service)
    ingest(service, number='2', code='002', vat='999')
    products = service.list()['prodotti']
    with pytest.raises(ValueError):
        service.confirm({'ids': [p['id'] for p in sorted(products, key=lambda p: p['stato'], reverse=True)]})
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 0
    p = next(p for p in products if p['stato'] == 'nuovo')
    with pytest.raises(ValueError):
        service.confirm({'ids': [p['id']], 'classificazione': {'contoid': 1, 'brancaid': 2, 'sottocontoid': 999}})


def test_exclusion_is_persistent_and_reversible(service):
    ingest(service, description='Spese di trasporto')
    p, = service.list()['prodotti']
    assert p['tipo_riga'] == 'costo_accessorio'
    service.confirm({'ids': [p['id']], 'azione': 'escludi'})
    ingest(service)
    assert service.list()['prodotti'][0]['stato'] == 'escluso'
    service.confirm({'ids': [p['id']], 'azione': 'ripristina'})
    assert service.list()['prodotti'][0]['stato'] == 'nuovo'


def test_invalid_xml_reported_per_file_and_free_material_preserved(service):
    result = service.ingest([('bad.xml', b'<!DOCTYPE bad><bad/>'), ('good.xml', xml(price='0'))])
    assert len(result['errori']) == 1
    assert result['righe_aggiunte'] == 1
    assert service.list()['prodotti'][0]['costo_unitario'] == '0'


def test_existing_manual_category_is_not_overwritten(service):
    ingest(service)
    p, = service.list()['prodotti']
    service.confirm({'ids': [p['id']]})
    service.db.conn.execute('UPDATE materiali SET metodo_classificazione="manuale"')
    service.db.conn.commit()
    service.confirm({'ids': [p['id']], 'classificazione': {'contoid': 99}})
    assert service.db.conn.execute('SELECT metodo_classificazione FROM materiali').fetchone()[0] == 'manuale'


def test_changed_invoice_reported_without_overwriting_original(service):
    ingest(service)
    result = ingest(service, price='7')
    assert result['righe_aggiunte'] == 0
    assert result['errori']
    assert service.list()['prodotti'][0]['costo_unitario'] == '5'


def test_two_xml_code_types_confirmed_in_same_batch_do_not_duplicate(service):
    ingest(service)
    service.ingest([('second.xml', xml(number='2').replace(b'SKU', b'ART'))])
    ids = [p['id'] for p in service.list()['prodotti']]
    assert len(ids) == 2
    assert service.confirm({'ids': ids})['inseriti'] == 1
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 1


def test_conflicting_legacy_materials_are_not_chosen_arbitrarily(service):
    ingest(service)
    p, = service.list()['prodotti']
    service.confirm({'ids': [p['id']]})
    service.db.conn.execute('DELETE FROM materiali_xml_prodotti')
    service.db.conn.execute('''INSERT INTO materiali(codicearticolo, nome, fornitoreid, contoid)
        VALUES('001', 'Altro materiale', 'ZZZ1', 999)''')
    service.db.conn.commit()
    p, = service.list()['prodotti']
    assert p['stato'] == 'da_verificare'
    with pytest.raises(ValueError):
        service.confirm({'ids': [p['id']]})


def test_manual_category_without_supplier_proposal_is_learned(service):
    service.db.conn.execute('DELETE FROM classificazioni_costi')
    service.db.conn.commit()
    ingest(service)
    p, = service.list()['prodotti']
    assert p['proposta'] is None
    service.confirm({'ids': [p['id']], 'classificazione': {'contoid': 1, 'brancaid': 2, 'sottocontoid': 3}})
    ingest(service, number='2', code='OTHER')
    p = next(p for p in service.list()['prodotti'] if p['stato'] == 'nuovo')
    assert p['proposta']['sottocontoid'] == 3


def test_nonfinite_prices_and_multiple_bodies_are_reported(service):
    assert ingest(service, price='NaN')['errori']
    multi = xml().replace(b'</FatturaElettronica>', b'<FatturaElettronicaBody/></FatturaElettronica>')
    assert service.ingest([('multi.xml', multi)])['errori']
    assert service.list()['prodotti'] == []


def confirmation(products):
    return {'voci': [{'id': p['id'], 'revision': p['revision']} for p in products]}


def test_folder_scan_incremental_and_errors_retryable(service, tmp_path):
    service.email_folder = tmp_path
    (tmp_path / 'nested').mkdir()
    (tmp_path / 'nested' / 'one.XML').write_bytes(xml())
    (tmp_path / 'bad.xml').write_bytes(b'not XML')
    first = service.scan_email_folder()
    assert first['righe_aggiunte'] == 1
    assert len(first['errori']) == 1
    second = service.scan_email_folder()
    assert second['file_invariati'] == 1
    assert len(second['errori']) == 1
    (tmp_path / 'bad.xml').write_bytes(xml(number='2'))
    third = service.scan_email_folder()
    assert third['righe_aggiunte'] == 1
    assert third['errori'] == []
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 0


def test_confirm_all_separates_materials_other_lines_and_incomplete(service):
    ingest(service)
    ingest(service, number='2', code='SHIP', description='Spese di trasporto')
    ingest(service, number='3', code='UNKNOWN', vat='999')
    products = service.list()['prodotti']
    assert len([p for p in products if p['pronto']]) == 2
    result = service.confirm_review(confirmation(products))
    assert (result['inseriti'], result['altre_voci'], len(result['da_rivedere'])) == (1, 1, 1)
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 1
    other = next(p for p in service.list()['prodotti'] if p['codice'] == 'SHIP')
    assert other['stato'] == 'elaborato'
    assert not other['pronto']
    ingest(service, number='4', code='SHIP', description='Spese di trasporto')
    assert next(p for p in service.list()['prodotti'] if p['codice'] == 'SHIP')['stato'] == 'elaborato'
    repeated = service.confirm_review(confirmation(products))
    assert repeated['inseriti'] == repeated['altre_voci'] == 0


def test_draft_preserves_category_and_stale_confirmation_is_skipped(service):
    ingest(service)
    p, = service.list()['prodotti']
    service.save_review({'ids': [p['id']], 'destinazione': 'altra_voce'})
    changed, = service.list()['prodotti']
    assert changed['proposta']['sottocontoid'] == 3
    assert changed['destinazione'] == 'altra_voce'
    assert service.confirm_review(confirmation([p]))['da_rivedere']
    assert service.confirm_review(confirmation([changed]))['altre_voci'] == 1
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 0


def test_correction_reopens_an_other_line_and_inserts_only_after_confirmation(service):
    ingest(service)
    p, = service.list()['prodotti']
    service.save_review({'ids': [p['id']], 'destinazione': 'altra_voce'})
    service.confirm_review(confirmation(service.list()['prodotti']))
    service.save_review({'ids': [p['id']], 'destinazione': 'materiale', 'classificazione': {'contoid': 1, 'brancaid': 2, 'sottocontoid': 3}})
    changed, = service.list()['prodotti']
    assert changed['pronto']
    assert service.confirm_review(confirmation([changed]))['inseriti'] == 1


def test_similar_match_is_suggestion_not_an_insert(service):
    ingest(service, description='GUANTI LATTICE TAGLIA S')
    service.confirm({'ids': [service.list()['prodotti'][0]['id']]})
    ingest(service, number='2', code='002', description='GUANTI LATTICE TAGLIA M')
    p = next(p for p in service.list()['prodotti'] if p['codice'] == '002')
    assert p['proposta']['fonte_classificazione'] == 'materiale_simile'
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 1


def test_new_purchase_after_preview_requires_fresh_confirmation(service):
    ingest(service)
    preview = confirmation(service.list()['prodotti'])
    ingest(service, number='2', price='9')
    result = service.confirm_review(preview)
    assert result['inseriti'] == 0
    assert len(result['da_rivedere']) == 1


def test_conflicting_similar_categories_remain_supplier_suggestion(service):
    ingest(service, description='GUANTI LATTICE TAGLIA S')
    service.confirm({'ids': [service.list()['prodotti'][0]['id']]})
    service.db.conn.execute("INSERT INTO sottoconti VALUES(4, 'Altra categoria', 2, 1)")
    service.db.conn.commit()
    ingest(service, number='2', code='002', description='GUANTI LATTICE TAGLIA L')
    p = next(p for p in service.list()['prodotti'] if p['codice'] == '002')
    service.confirm({'ids': [p['id']], 'classificazione': {'contoid': 1, 'brancaid': 2, 'sottocontoid': 4}})
    ingest(service, number='3', code='003', description='GUANTI LATTICE TAGLIA M')
    p = next(p for p in service.list()['prodotti'] if p['codice'] == '003')
    assert p['proposta']['fonte_classificazione'] == 'fornitore_storico_esatto'


def test_bulk_professional_category_resolves_destinations_and_survives_reload(service):
    service.db.conn.executescript('''
        INSERT INTO conti VALUES(11, 'COLLABORATORI');
        INSERT INTO branche VALUES(12, 'IGIENE', 11);
        INSERT INTO sottoconti VALUES(28, 'PRESTAZIONI PROFESSIONALI', 12, 11);
    ''')
    ingest(service, code='P1', description='Prestazione igiene uno')
    ingest(service, number='2', code='P2', description='Prestazione igiene due')
    ids = [p['id'] for p in service.list()['prodotti']]
    service.save_review({'ids': ids, 'destinazione': 'automatico',
                         'classificazione': {'contoid': 11, 'brancaid': 12, 'sottocontoid': 28}})
    reloaded = MaterialiInboxService(service.db, service.suppliers).list()['prodotti']
    assert all(p['destinazione'] == 'altra_voce' and p['pronto'] and p['proposta']['sottocontoid'] == 28 for p in reloaded)
    assert service.confirm_review(confirmation(reloaded))['altre_voci'] == 2
    assert all(p['stato'] == 'elaborato' for p in service.list()['prodotti'])
    assert service.db.conn.execute('SELECT COUNT(*) FROM materiali').fetchone()[0] == 0


def test_automatic_bulk_without_category_preserves_individual_destinations(service):
    ingest(service)
    ingest(service, number='2', code='SHIP', description='Spese di trasporto')
    before = service.list()['prodotti']
    service.save_review({'ids': [p['id'] for p in before], 'destinazione': 'automatico'})
    assert {p['id']: p['destinazione'] for p in before} == {p['id']: p['destinazione'] for p in service.list()['prodotti']}
