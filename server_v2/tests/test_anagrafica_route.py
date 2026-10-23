import pytest
from flask_jwt_extended import create_access_token

import api.v2_automation_logs as logs_api
from app_v2 import create_app_v2
from core.database_manager import close_database_manager
from core.exceptions import GmailApiError, GmailCredentialsNotFoundError

URL = '/api/v2/automation/messages/7/anagrafica'
ROW = {'id': 7, 'created_at': '2026-10-22 16:47:57', 'recipient': '3331112233'}
SUBMISSIONS = [{
    'email_id': 'm1', 'received_at': 'Thu, 22 Oct 2026 20:51:00 +0200', 'phone_match': True,
    'fields': [{'label': 'Cognome', 'value': 'Rossi'}],
}]


class FakeLogService:
    def get_message(self, message_id):
        return ROW if message_id == 7 else None


@pytest.fixture(scope='module')
def app():
    app = create_app_v2('testing')
    yield app
    close_database_manager()  # le richieste creano il gestore DB globale: non va lasciato agli altri test


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth(app):
    with app.app_context():
        token = create_access_token(identity={'id': 1, 'username': 'test', 'role': 'admin'})
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture(autouse=True)
def fake_log(monkeypatch):
    monkeypatch.setattr(logs_api, 'get_automation_log_service', lambda: FakeLogService())


def raising(error):
    def _raise(row, email_service):
        raise error
    return _raise


def test_senza_token_risponde_401(client):
    assert client.get(URL).status_code == 401


def test_messaggio_inesistente_risponde_404(client, auth):
    response = client.get('/api/v2/automation/messages/99/anagrafica', headers=auth)
    assert response.status_code == 404
    assert response.get_json()['state'] == 'error'


def test_caso_felice_restituisce_le_anagrafiche(client, auth, monkeypatch):
    seen = {}

    def fake_find(row, email_service):
        seen['row'] = row
        return SUBMISSIONS

    monkeypatch.setattr(logs_api, 'find_submissions', fake_find)
    response = client.get(URL, headers=auth)
    body = response.get_json()
    assert response.status_code == 200
    assert body['state'] == 'success'
    assert body['data']['submissions'] == SUBMISSIONS
    assert seen['row'] == ROW


def test_nessuna_anagrafica_e_un_successo_con_elenco_vuoto(client, auth, monkeypatch):
    monkeypatch.setattr(logs_api, 'find_submissions', lambda row, email_service: [])
    body = client.get(URL, headers=auth).get_json()
    assert body['state'] == 'success'
    assert body['data']['submissions'] == []


def test_gmail_non_collegato(client, auth, monkeypatch):
    monkeypatch.setattr(logs_api, 'find_submissions', raising(GmailCredentialsNotFoundError('manca il token')))
    response = client.get(URL, headers=auth)
    body = response.get_json()
    assert response.status_code == 200
    assert body['state'] == 'error'
    assert body['error'] == 'GMAIL_AUTH_REQUIRED'


def test_errore_api_gmail(client, auth, monkeypatch):
    monkeypatch.setattr(logs_api, 'find_submissions', raising(GmailApiError('quota')))
    response = client.get(URL, headers=auth)
    assert response.status_code == 500
    assert response.get_json()['state'] == 'error'


def test_errore_imprevisto_non_espone_i_dettagli(client, auth, monkeypatch):
    monkeypatch.setattr(logs_api, 'find_submissions', raising(ValueError('dettaglio interno')))
    response = client.get(URL, headers=auth)
    body = response.get_json()
    assert response.status_code == 500
    assert body['error'] == 'internal_error'
    assert 'dettaglio interno' not in str(body)
