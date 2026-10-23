import pytest

import services.automation_log_service as log_module
from core.config import Config
from core.database_manager import DatabaseManager
from services.anagrafica_email_service import (
    ANAGRAFICA_LABELS,
    find_submissions,
    parse_anagrafica_text,
    phone_matches,
)
from services.automation_log_service import AutomationLogService

CREATED_AT = '2026-10-22 16:47:57'
CREATED_EPOCH = 1792687677  # 2026-10-22 16:47:57 UTC


def make_body(overrides=None):
    values = {
        'Cognome': 'Rossi', 'Nome': 'Mario', 'Data di nascita': '01/02/1990',
        'Comune di nascita': 'Prato', 'Codice fiscale': 'RSSMRA90B01G999X', 'Sesso': 'Maschio',
        'Indirizzo': 'Via Roma 1', 'CAP': '59100', 'Citta': 'Prato', 'Provincia': 'PO',
        'Cellulare': '3331112233', 'Email': 'mario.rossi@example.com',
        'Informativa privacy': "Letta e confermata dall'utente",
    }
    values.update(overrides or {})
    lines = ['Nuova anagrafica paziente - Rossi Mario', '']
    lines += [f'{label}: {values[label]}' for label in ANAGRAFICA_LABELS]
    lines += ['', 'Messaggio inviato dal sito studiodimartino.eu tramite endpoint server-side.']
    return '\n'.join(lines)


class FakeEmailService:
    def __init__(self, emails):
        self.emails = emails  # [(id, date, body_text)] dalla piu' recente
        self.queries = []

    def get_emails(self, max_results=20, page_token=None, query=None):
        self.queries.append((max_results, query))
        return {'emails': [{'id': email_id} for email_id, _, _ in self.emails], 'next_page_token': None}

    def get_email_detail(self, message_id):
        for email_id, date, body in self.emails:
            if email_id == message_id:
                return {'id': email_id, 'date': date, 'body_text': body}
        raise KeyError(message_id)


def values_of(fields):
    return {f['label']: f['value'] for f in fields}


def test_parse_estrae_i_13_campi_nell_ordine():
    fields = parse_anagrafica_text(make_body())
    assert [f['label'] for f in fields] == ANAGRAFICA_LABELS
    assert len(fields) == 13
    values = values_of(fields)
    assert values['Cognome'] == 'Rossi'
    assert values['Cellulare'] == '3331112233'
    assert values['Informativa privacy'] == "Letta e confermata dall'utente"


def test_parse_valore_con_due_punti():
    values = values_of(parse_anagrafica_text(make_body({'Indirizzo': 'Via Roma 3: interno 2'})))
    assert values['Indirizzo'] == 'Via Roma 3: interno 2'


def test_parse_campo_mancante_vale_trattino():
    body = make_body().replace('Provincia: PO\n', '')
    assert values_of(parse_anagrafica_text(body))['Provincia'] == '-'


def test_parse_righe_con_ritorno_a_capo_windows():
    body = make_body().replace('\n', '\r\n')
    assert values_of(parse_anagrafica_text(body))['Cognome'] == 'Rossi'


@pytest.mark.parametrize('text', ['', None, 'Ciao, questo non e un modulo'])
def test_parse_testo_senza_etichette_da_tutti_trattini(text):
    assert all(f['value'] == '-' for f in parse_anagrafica_text(text))


@pytest.mark.parametrize('recipient, cellulare, expected', [
    ('3331112233', '3331112233', True),
    ('393331112233', '+39 333 111 2233', True),
    ('3331112233', '333-111-2234', False),
    ('3331112233', '', False),
    ('', '3331112233', False),
    ('12345', '12345', False),  # meno di 9 cifre: non si confrontano
    (None, '3331112233', False),
])
def test_phone_matches(recipient, cellulare, expected):
    assert phone_matches(recipient, cellulare) is expected


def test_la_ricerca_usa_oggetto_e_data_di_invio():
    fake = FakeEmailService([])
    assert find_submissions({'created_at': CREATED_AT, 'recipient': '3331112233'}, fake) == []
    assert fake.queries == [(15, f'subject:"Nuova anagrafica paziente" after:{CREATED_EPOCH}')]


def test_data_di_invio_con_la_t_vale_come_con_lo_spazio():
    fake = FakeEmailService([])
    find_submissions({'created_at': '2026-10-22T16:47:57', 'recipient': '3331112233'}, fake)
    assert fake.queries[0][1].endswith(f'after:{CREATED_EPOCH}')


def test_la_coincidenza_per_numero_va_per_prima():
    fake = FakeEmailService([
        ('m1', 'Thu, 22 Oct 2026 21:00:00 +0200', make_body({'Cognome': 'Bianchi', 'Cellulare': '3470000000'})),
        ('m2', 'Thu, 22 Oct 2026 20:00:00 +0200', make_body()),
    ])
    result = find_submissions({'created_at': CREATED_AT, 'recipient': '+39 333 111 2233'}, fake)
    assert [s['email_id'] for s in result] == ['m2', 'm1']
    assert [s['phone_match'] for s in result] == [True, False]
    assert result[0]['received_at'] == 'Thu, 22 Oct 2026 20:00:00 +0200'
    assert values_of(result[0]['fields'])['Cognome'] == 'Rossi'


def test_senza_coincidenze_resta_l_ordine_di_gmail():
    fake = FakeEmailService([
        ('m1', 'd1', make_body({'Cellulare': '3470000001'})),
        ('m2', 'd2', make_body({'Cellulare': '3470000002'})),
    ])
    result = find_submissions({'created_at': CREATED_AT, 'recipient': '3331112233'}, fake)
    assert [s['email_id'] for s in result] == ['m1', 'm2']
    assert [s['phone_match'] for s in result] == [False, False]


def test_email_senza_campi_riconoscibili_viene_scartata():
    fake = FakeEmailService([('m1', 'd', 'Ciao, questo non e un modulo'), ('m2', 'd', make_body())])
    result = find_submissions({'created_at': CREATED_AT, 'recipient': '3331112233'}, fake)
    assert [s['email_id'] for s in result] == ['m2']


@pytest.fixture
def log_service(tmp_path):
    log_module._TABLES_READY = False  # le tabelle si creano una volta per processo: questo DB e' nuovo
    db = DatabaseManager(Config(db_path=str(tmp_path / 'log.db')))
    yield AutomationLogService(db)
    db.close()
    log_module._TABLES_READY = False


def test_get_message_restituisce_la_riga(log_service):
    new_id = log_service.log_message(
        action_name='send_sms_link', channel='whatsapp', recipient='3331112233',
        message_text='ciao', result={'success': True},
    )
    row = log_service.get_message(new_id)
    assert row['id'] == new_id
    assert row['recipient'] == '3331112233'
    assert row['created_at']


def test_get_message_inesistente(log_service):
    assert log_service.get_message(9999) is None
