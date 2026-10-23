# Anagrafica prime visite - Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dalla pagina Prime visite, un'icona "Dettaglio" su ogni messaggio inviato cerca in Gmail l'email del modulo anagrafico e apre una finestra con un pulsante "Copia" per ogni campo.

**Architecture:** Una rotta server `GET /automation/messages/<id>/anagrafica` legge la riga del registro, cerca in Gmail le email "Nuova anagrafica paziente" arrivate dopo l'invio, ne ricava i campi dal testo e segna quelle il cui `Cellulare` coincide con il destinatario. Il frontend mostra una finestra CoreUI: apre direttamente i campi se c'e' una sola coincidenza, altrimenti elenca le email e l'utente sceglie. Nulla viene salvato.

**Tech Stack:** Python/Flask (pytest), React 18 + TypeScript, CoreUI, `react-hot-toast`, `vitest` + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-10-23-prime-visite-anagrafica-design.md`

## Global Constraints

- Collegamento messaggio-email: il `Cellulare` dell'email coincide con il `recipient` del registro sulle **ultime 9 cifre**, ignorando `+39`, spazi e simboli; stringhe con meno di 9 cifre non coincidono mai.
- Query Gmail: `subject:"Nuova anagrafica paziente" after:<epoch di created_at>`, **senza** `-from:me` e **senza** `in:inbox`, al massimo **15** email.
- `created_at` del registro e' in UTC, formato `YYYY-MM-DD HH:MM:SS`.
- I 13 campi, nell'ordine: Cognome, Nome, Data di nascita, Comune di nascita, Codice fiscale, Sesso, Indirizzo, CAP, Citta, Provincia, Cellulare, Email, Informativa privacy. Campo mancante o vuoto: valore `-`.
- Un pulsante "Copia" per campo, **nessun "Copia tutto"**. Copia: `navigator.clipboard.writeText`, con riserva `textarea` + `document.execCommand('copy')` quando l'API manca (l'app e' servita sia da `https://app.valorian.it` sia da `http://serverdima:5001`). Toast verde "Copiato", rosso "Copia non riuscita".
- Risposta della rotta a tre stati: `{"state": "success|warning|error", "data": {"submissions": [...]}, "message": "..."}`; Gmail non collegato: `state: error`, `error: GMAIL_AUTH_REQUIRED`, HTTP 200 (come le altre rotte email); errore Gmail: HTTP 500.
- La rotta sta nel blueprint `automation_logs_bp`, che gia' richiede il login (`before_request`): non aggiungere altre autenticazioni e non registrare un nuovo blueprint.
- Niente dati del paziente nel database dell'app: solo lettura da Gmail, nessun salvataggio.
- Frontend: componenti CoreUI, skeleton (`@/components/ui/skeleton`) al posto dello spinner, `import type` per i tipi, nessun `console.log`, nei service il prefisso `api` (`apiGetAnagrafica`), service in `features/automation/services/`. Stile dei file della feature `automation`: **senza punto e virgola**, apici singoli per le stringhe, doppi per gli attributi JSX, indentazione a 2 spazi (come `AutomationMessages.tsx`).
- Backend: testi di log e messaggi del server solo in ASCII, niente emoji. Nei test usare **solo dati inventati** (mai quelli di pazienti veri).
- Tutti i comandi backend si lanciano da `server_v2` con `venv/Scripts/python.exe`; quelli frontend da `client_v2`. Non avviare il server.
- `server_v2/tests/` e' escluso da git (`.gitignore`): i file di test del backend di questo piano si aggiungono con `git add -f`.
- Trailer dei commit, esatto: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Mappa dei file

| File | Azione | Responsabilita' |
|---|---|---|
| `server_v2/services/anagrafica_email_service.py` | Crea | Parser del testo, confronto numeri, ricerca in Gmail |
| `server_v2/services/automation_log_service.py` | Modifica | Aggiunge `get_message(id)` |
| `server_v2/api/v2_automation_logs.py` | Modifica | Rotta `GET /automation/messages/<id>/anagrafica` |
| `server_v2/tests/test_anagrafica_email_service.py` | Crea | Test di parser, confronto, ricerca, `get_message` |
| `server_v2/tests/test_anagrafica_route.py` | Crea | Test della rotta |
| `client_v2/src/features/automation/services/automationMessagesService.ts` | Modifica | Tipi e `apiGetAnagrafica` |
| `client_v2/src/features/automation/components/AnagraficaModal.tsx` | Crea | Finestra con elenco, campi e Copia |
| `client_v2/src/features/automation/components/AnagraficaModal.test.tsx` | Crea | Test della finestra |
| `client_v2/src/features/automation/pages/AutomationMessages.tsx` | Modifica | Colonna con l'icona "Dettaglio" |
| `client_v2/src/features/automation/pages/AutomationMessages.test.tsx` | Crea | Test del clic sull'icona |

---

### Task 1: Servizio backend (parser, confronto numeri, ricerca)

**Files:**
- Create: `server_v2/services/anagrafica_email_service.py`
- Modify: `server_v2/services/automation_log_service.py` (aggiunge `get_message` dopo `list_messages`, riga ~89)
- Test: `server_v2/tests/test_anagrafica_email_service.py`

**Interfaces:**
- Produces (usato dal Task 2):
  - `find_submissions(row: dict, email_service) -> list[dict]`, dove `row` ha `created_at: str` e `recipient: str`, e `email_service` espone `get_emails(max_results=15, query=...) -> {'emails': [{'id': str, ...}]}` e `get_email_detail(id) -> {'id', 'date', 'body_text'}`. Ritorna elementi `{'email_id': str, 'received_at': str, 'phone_match': bool, 'fields': [{'label': str, 'value': str}]}`.
  - `AutomationLogService.get_message(message_id: int) -> Optional[dict]`.
- Consumes: nulla da altri task.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `server_v2/tests/test_anagrafica_email_service.py`:

```python
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
```

- [ ] **Step 2: Lancia i test e verifica che falliscano**

Run: `venv/Scripts/python.exe -m pytest tests/test_anagrafica_email_service.py -q -p no:cacheprovider --no-header -W ignore::DeprecationWarning`
Expected: errore di raccolta `ModuleNotFoundError: No module named 'services.anagrafica_email_service'` (nessun test eseguito).

- [ ] **Step 3: Scrivi il servizio**

Crea `server_v2/services/anagrafica_email_service.py`:

```python
"""
Anagrafica prime visite: recupero da Gmail dell'email del modulo del sito.

Il sito (studiodimartino-next) manda a "segreteria" un'email con oggetto
"Nuova anagrafica paziente - <Cognome> <Nome>" e corpo in righe "Etichetta: valore".
Qui la si collega al messaggio con il link al modulo inviato dall'automazione.
"""
import re
from datetime import datetime, timezone
from typing import Any, Dict, List

ANAGRAFICA_SUBJECT = 'Nuova anagrafica paziente'

# Stesse etichette e stesso ordine di src/app/api/anagrafica/route.js del sito
ANAGRAFICA_LABELS = [
    'Cognome', 'Nome', 'Data di nascita', 'Comune di nascita', 'Codice fiscale', 'Sesso',
    'Indirizzo', 'CAP', 'Citta', 'Provincia', 'Cellulare', 'Email', 'Informativa privacy',
]

EMPTY_VALUE = '-'  # lo stesso segnaposto che scrive il sito per un campo vuoto
MAX_CANDIDATES = 15
PHONE_DIGITS_COMPARED = 9


def parse_anagrafica_text(body_text: Any) -> List[Dict[str, str]]:
    """I 13 campi nell'ordine fisso; un campo non trovato vale '-'."""
    found: Dict[str, str] = {}
    for line in str(body_text or '').splitlines():
        for label in ANAGRAFICA_LABELS:
            prefix = f'{label}: '
            if line.startswith(prefix) and label not in found:
                found[label] = line[len(prefix):].strip() or EMPTY_VALUE
                break
    return [{'label': label, 'value': found.get(label, EMPTY_VALUE)} for label in ANAGRAFICA_LABELS]


def _digits(value: Any) -> str:
    return re.sub(r'\D', '', str(value or ''))


def phone_matches(recipient: Any, cellulare: Any) -> bool:
    """Stesse ultime 9 cifre: ignora +39, spazi e simboli."""
    a, b = _digits(recipient), _digits(cellulare)
    if len(a) < PHONE_DIGITS_COMPARED or len(b) < PHONE_DIGITS_COMPARED:
        return False
    return a[-PHONE_DIGITS_COMPARED:] == b[-PHONE_DIGITS_COMPARED:]


def _created_at_epoch(created_at: Any) -> int:
    """created_at del registro e' UTC senza offset ('YYYY-MM-DD HH:MM:SS')."""
    parsed = datetime.strptime(str(created_at).replace('T', ' ')[:19], '%Y-%m-%d %H:%M:%S')
    return int(parsed.replace(tzinfo=timezone.utc).timestamp())


def find_submissions(row: Dict[str, Any], email_service) -> List[Dict[str, Any]]:
    """Anagrafiche arrivate dopo l'invio del messaggio `row`, con prime quelle dello stesso numero.

    Niente '-from:me' ne' 'in:inbox': il sito puo' spedire dalla stessa casella e la
    posta puo' essere archiviata.
    """
    query = f'subject:"{ANAGRAFICA_SUBJECT}" after:{_created_at_epoch(row["created_at"])}'
    summaries = email_service.get_emails(max_results=MAX_CANDIDATES, query=query).get('emails', [])

    submissions: List[Dict[str, Any]] = []
    for summary in summaries:
        detail = email_service.get_email_detail(summary['id'])
        fields = parse_anagrafica_text(detail.get('body_text', ''))
        if all(field['value'] == EMPTY_VALUE for field in fields):
            continue  # non e' un modulo leggibile
        cellulare = next(field['value'] for field in fields if field['label'] == 'Cellulare')
        submissions.append({
            'email_id': summary['id'],
            'received_at': detail.get('date', ''),
            'phone_match': phone_matches(row.get('recipient'), cellulare),
            'fields': fields,
        })

    # Ordinamento stabile: Gmail restituisce gia' le piu' recenti per prime
    submissions.sort(key=lambda submission: not submission['phone_match'])
    return submissions
```

In `server_v2/services/automation_log_service.py`, subito dopo il metodo `list_messages` (prima di `# Singleton accessor`), aggiungi:

```python
    def get_message(self, message_id: int) -> Optional[Dict[str, Any]]:
        try:
            rows = self.db_manager.execute_query(
                "SELECT * FROM automation_message_log WHERE id = ?", (message_id,))
            return dict(rows[0]) if rows else None
        except Exception as e:
            logger.error(f"Error reading automation message {message_id}: {e}")
            return None
```

- [ ] **Step 4: Lancia i test e verifica che passino**

Run: `venv/Scripts/python.exe -m pytest tests/test_anagrafica_email_service.py -q -p no:cacheprovider --no-header -W ignore::DeprecationWarning`
Expected: PASS, `21 passed`. Se `test_get_message_*` fallisce perche' `execute_query` restituisce righe in un formato diverso da quello atteso da `dict(...)`, adatta solo `get_message` e annotalo nel report.

- [ ] **Step 5: Commit**

```bash
git add server_v2/services/anagrafica_email_service.py server_v2/services/automation_log_service.py
git add -f server_v2/tests/test_anagrafica_email_service.py
git commit -m "feat(prime-visite): ricerca in Gmail dell'anagrafica compilata sul sito" -m "Parser del testo dell'email, confronto del cellulare sulle ultime 9 cifre e get_message sul registro." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Rotta server

**Files:**
- Modify: `server_v2/api/v2_automation_logs.py` (import in testa e nuova rotta in fondo)
- Test: `server_v2/tests/test_anagrafica_route.py`

**Interfaces:**
- Consumes (dal Task 1): `find_submissions(row, email_service)` e `get_automation_log_service().get_message(id)`.
- Produces (usato dal Task 3): `GET /api/v2/automation/messages/<int:message_id>/anagrafica` con le risposte:
  - 401 senza token;
  - 404 `{"state": "error", "error": "not_found", "message": "Messaggio non trovato"}`;
  - 200 `{"state": "success", "data": {"submissions": [...]}}`;
  - 200 `{"state": "error", "error": "GMAIL_AUTH_REQUIRED", "message": "Autenticazione Gmail richiesta"}`;
  - 500 `{"state": "error", "message": "Errore API Gmail", "error": "<testo>"}`;
  - 500 `{"state": "error", "message": "Errore recupero anagrafica", "error": "internal_error"}`.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `server_v2/tests/test_anagrafica_route.py`:

```python
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
```

- [ ] **Step 2: Lancia i test e verifica che falliscano**

Run: `venv/Scripts/python.exe -m pytest tests/test_anagrafica_route.py -q -p no:cacheprovider --no-header -W ignore::DeprecationWarning`
Expected: FAIL: `AttributeError: module 'api.v2_automation_logs' has no attribute 'find_submissions'` (il monkeypatch fallisce) e i 404 attesi diventano 404 generici della rotta mancante.

- [ ] **Step 3: Aggiungi la rotta**

In `server_v2/api/v2_automation_logs.py` sostituisci le righe di import:

```python
from flask import Blueprint, jsonify, request
from services.automation_log_service import get_automation_log_service
import logging
```

con:

```python
from flask import Blueprint, jsonify, request
from app_v2 import format_response
from core.exceptions import GmailApiError, GmailCredentialsNotFoundError
from services.anagrafica_email_service import find_submissions
from services.automation_log_service import get_automation_log_service
from services.email_service import email_service
import logging
```

e in fondo al file aggiungi:

```python


@automation_logs_bp.route('/automation/messages/<int:message_id>/anagrafica', methods=['GET'])
def get_message_anagrafica(message_id):
    """Anagrafica compilata sul sito dal paziente a cui e' stato inviato il link (letta da Gmail)."""
    row = get_automation_log_service().get_message(message_id)
    if not row:
        return format_response(success=False, error='not_found', message='Messaggio non trovato',
                               state='error'), 404
    try:
        submissions = find_submissions(row, email_service)
    except GmailCredentialsNotFoundError:
        return format_response(success=False, error='GMAIL_AUTH_REQUIRED',
                               message='Autenticazione Gmail richiesta', state='error'), 200
    except GmailApiError as e:
        logger.error(f"Gmail error reading anagrafica for message {message_id}: {e}")
        return format_response(success=False, error=str(e), message='Errore API Gmail',
                               state='error'), 500
    except Exception as e:
        logger.error(f"Error reading anagrafica for message {message_id}: {e}", exc_info=True)
        return format_response(success=False, error='internal_error',
                               message='Errore recupero anagrafica', state='error'), 500
    return format_response(data={'submissions': submissions}, state='success'), 200
```

- [ ] **Step 4: Lancia i test della rotta e quelli di accesso**

Run: `venv/Scripts/python.exe -m pytest tests/test_anagrafica_route.py tests/test_anagrafica_email_service.py tests/test_access_control.py -q -p no:cacheprovider --no-header -W ignore::DeprecationWarning`
Expected: PASS, `42 passed` (7 + 21 + 14). `test_access_control.py` verifica che i blueprint protetti rispondano 401 senza token: deve restare verde.

- [ ] **Step 5: Commit**

```bash
git add server_v2/api/v2_automation_logs.py
git add -f server_v2/tests/test_anagrafica_route.py
git commit -m "feat(prime-visite): rotta GET /automation/messages/<id>/anagrafica" -m "Cerca in Gmail l'anagrafica del paziente; protetta dal login del blueprint." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Service e finestra del frontend

**Files:**
- Modify: `client_v2/src/features/automation/services/automationMessagesService.ts`
- Create: `client_v2/src/features/automation/components/AnagraficaModal.tsx`
- Test: `client_v2/src/features/automation/components/AnagraficaModal.test.tsx`

**Interfaces:**
- Consumes (dal Task 2): la rotta `GET /automation/messages/<id>/anagrafica` e la forma della risposta descritta li'.
- Produces (usato dal Task 4):
  - `automationMessagesService.apiGetAnagrafica(id: number): Promise<AnagraficaResponse>`
  - tipi `AnagraficaField = { label: string; value: string }`, `AnagraficaSubmission = { email_id: string; received_at: string; phone_match: boolean; fields: AnagraficaField[] }`, `AnagraficaResponse = { state: 'success' | 'warning' | 'error'; data?: { submissions: AnagraficaSubmission[] }; message?: string; error?: string }`
  - componente `export default AnagraficaModal` con props `{ messageId: number | null; onClose: () => void }`: visibile quando `messageId !== null`, carica all'apertura.

- [ ] **Step 1: Registra il numero di errori di tipo di partenza**

Run: `npm run type-check 2>&1 | grep -c "error TS"`
Annota il numero N (serve al Task 4). Run: `npm run type-check 2>&1 | grep "features/automation"` e annota le eventuali righe preesistenti.

- [ ] **Step 2: Scrivi i test che falliscono**

Crea `client_v2/src/features/automation/components/AnagraficaModal.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import toast from 'react-hot-toast'
import AnagraficaModal from './AnagraficaModal'
import automationMessagesService from '../services/automationMessagesService'
import type { AnagraficaSubmission } from '../services/automationMessagesService'

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('../services/automationMessagesService', () => ({
  default: { apiGetAnagrafica: vi.fn() },
}))

const FIELD_LABELS = [
  'Cognome', 'Nome', 'Data di nascita', 'Comune di nascita', 'Codice fiscale', 'Sesso',
  'Indirizzo', 'CAP', 'Citta', 'Provincia', 'Cellulare', 'Email', 'Informativa privacy',
]

const makeSubmission = (
  id: string,
  overrides: Record<string, string>,
  phoneMatch: boolean,
): AnagraficaSubmission => {
  const values: Record<string, string> = {
    Cognome: 'Rossi', Nome: 'Mario', 'Data di nascita': '01/02/1990', 'Comune di nascita': 'Prato',
    'Codice fiscale': 'RSSMRA90B01G999X', Sesso: 'Maschio', Indirizzo: 'Via Roma 1', CAP: '59100',
    Citta: 'Prato', Provincia: 'PO', Cellulare: '3331112233', Email: 'mario.rossi@example.com',
    'Informativa privacy': "Letta e confermata dall'utente", ...overrides,
  }
  return {
    email_id: id,
    received_at: 'Thu, 22 Oct 2026 20:51:00 +0200',
    phone_match: phoneMatch,
    fields: FIELD_LABELS.map(label => ({ label, value: values[label] })),
  }
}

const respond = (submissions: AnagraficaSubmission[]) =>
  vi.mocked(automationMessagesService.apiGetAnagrafica).mockResolvedValue({
    state: 'success',
    data: { submissions },
  })

const open = () => render(<AnagraficaModal messageId={5} onClose={vi.fn()} />)

describe('AnagraficaModal', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('con una sola coincidenza per numero apre direttamente i campi, senza Copia tutto', async () => {
    respond([makeSubmission('m1', {}, true), makeSubmission('m2', { Cognome: 'Bianchi' }, false)])
    open()
    expect(await screen.findByRole('button', { name: 'Copia Cognome' })).toBeInTheDocument()
    expect(automationMessagesService.apiGetAnagrafica).toHaveBeenCalledWith(5)
    expect(screen.getAllByRole('button', { name: /^Copia / })).toHaveLength(13)
    expect(screen.queryByRole('button', { name: /copia tutto/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Indietro' })).not.toBeInTheDocument()
  })

  it('senza coincidenze mostra l elenco; Apri mostra i campi e Indietro torna all elenco', async () => {
    respond([
      makeSubmission('m1', { Cognome: 'Verdi', Nome: 'Anna' }, false),
      makeSubmission('m2', { Cognome: 'Neri', Nome: 'Luca' }, false),
    ])
    open()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText(/Verdi Anna/)).toBeInTheDocument()
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Apri' }))
    expect(await screen.findByRole('button', { name: 'Copia Cognome' })).toBeInTheDocument()
    expect(screen.getByText('Neri')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
  })

  it('con piu coincidenze mostra l elenco e segna quelle dello stesso numero', async () => {
    respond([makeSubmission('m1', {}, true), makeSubmission('m2', {}, true)])
    open()
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByText('stesso numero')).toHaveLength(2)
  })

  it('senza anagrafiche dice che non e ancora arrivata', async () => {
    respond([])
    open()
    expect(await screen.findByText('Anagrafica non ancora ricevuta')).toBeInTheDocument()
  })

  it('Copia scrive il solo valore del campo negli appunti e mostra il toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Cellulare' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('3331112233'))
    expect(toast.success).toHaveBeenCalledWith('Copiato')
  })

  it('senza navigator.clipboard usa il metodo di riserva', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Email' }))
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
    expect(toast.success).toHaveBeenCalledWith('Copiato')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('se la copia non riesce mostra il toast rosso', async () => {
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true })
    respond([makeSubmission('m1', {}, true)])
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Copia Nome' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Copia non riuscita'))
  })

  it('un campo vuoto ha il Copia disabilitato', async () => {
    respond([makeSubmission('m1', { Provincia: '-' }, true)])
    open()
    expect(await screen.findByRole('button', { name: 'Copia Provincia' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copia Cognome' })).toBeEnabled()
  })

  it('se Gmail risponde con un errore mostra il messaggio e Riprova ricarica', async () => {
    vi.mocked(automationMessagesService.apiGetAnagrafica).mockResolvedValueOnce({
      state: 'error',
      error: 'GMAIL_AUTH_REQUIRED',
      message: 'Autenticazione Gmail richiesta',
    })
    open()
    expect(await screen.findByText('Autenticazione Gmail richiesta')).toBeInTheDocument()
    respond([makeSubmission('m1', {}, true)])
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByRole('button', { name: 'Copia Cognome' })).toBeInTheDocument()
    expect(automationMessagesService.apiGetAnagrafica).toHaveBeenCalledTimes(2)
  })

  it('se la richiesta fallisce mostra un errore di rete', async () => {
    vi.mocked(automationMessagesService.apiGetAnagrafica).mockRejectedValueOnce(new Error('Network Error'))
    open()
    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Lancia i test e verifica che falliscano**

Run: `npx vitest run src/features/automation/components/AnagraficaModal.test.tsx`
Expected: FAIL: `Failed to resolve import "./AnagraficaModal"`.

- [ ] **Step 4: Aggiungi tipi e metodo al service**

Sostituisci l'intero contenuto di `client_v2/src/features/automation/services/automationMessagesService.ts` con:

```ts
import apiClient from '@/services/api/client'

export type AutomationMessage = {
  id: number
  created_at: string
  trigger_type?: string
  trigger_id?: string
  monitor_id?: string
  rule_id?: number
  action_name?: string
  channel?: string
  recipient?: string
  message_text?: string
  result_json?: string
}

export type AnagraficaField = { label: string; value: string }

export type AnagraficaSubmission = {
  email_id: string
  received_at: string
  phone_match: boolean
  fields: AnagraficaField[]
}

export type AnagraficaResponse = {
  state: 'success' | 'warning' | 'error'
  data?: { submissions: AnagraficaSubmission[] }
  message?: string
  error?: string
}

export const automationMessagesService = {
  async list(page = 1, per_page = 50) {
    const res = await apiClient.get('/automation/messages', { params: { page, per_page } })
    return res.data
  },

  async apiGetAnagrafica(id: number): Promise<AnagraficaResponse> {
    const res = await apiClient.get(`/automation/messages/${id}/anagrafica`)
    return res.data
  }
}

export default automationMessagesService
```

- [ ] **Step 5: Scrivi la finestra**

Crea `client_v2/src/features/automation/components/AnagraficaModal.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CAlert,
  CBadge,
  CButton,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import { Skeleton } from '@/components/ui/skeleton'
import automationMessagesService from '../services/automationMessagesService'
import type { AnagraficaSubmission } from '../services/automationMessagesService'

type Props = {
  messageId: number | null
  onClose: () => void
}

// L'app e' servita anche da http://serverdima:5001 (senza HTTPS), dove navigator.clipboard puo' mancare
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // si passa al metodo di riserva
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(area)
  }
}

const isEmpty = (value: string) => value === '' || value === '-'

const fieldValue = (submission: AnagraficaSubmission, label: string) =>
  submission.fields.find(field => field.label === label)?.value ?? '-'

const fmtReceived = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
}

const AnagraficaModal: React.FC<Props> = ({ messageId, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<AnagraficaSubmission[]>([])
  const [selected, setSelected] = useState<AnagraficaSubmission | null>(null)
  const [fromList, setFromList] = useState(false)

  const load = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    setSubmissions([])
    setSelected(null)
    setFromList(false)
    try {
      const res = await automationMessagesService.apiGetAnagrafica(id)
      if (res.state === 'error') {
        setError(res.message || res.error || 'Errore nel recupero dell\'anagrafica')
        return
      }
      const found = res.data?.submissions ?? []
      setSubmissions(found)
      const matches = found.filter(submission => submission.phone_match)
      if (matches.length === 1) setSelected(matches[0])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (messageId !== null) load(messageId)
  }, [messageId, load])

  const handleCopy = async (value: string) => {
    if (await copyText(value)) toast.success('Copiato')
    else toast.error('Copia non riuscita')
  }

  const renderBody = () => {
    if (loading) {
      return (
        <>
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </>
      )
    }
    if (error) {
      return (
        <CAlert color="danger" className="d-flex justify-content-between align-items-center mb-0">
          <span>{error}</span>
          <CButton color="danger" variant="outline" size="sm" onClick={() => messageId !== null && load(messageId)}>
            Riprova
          </CButton>
        </CAlert>
      )
    }
    if (selected) {
      return (
        <CListGroup flush>
          {selected.fields.map(field => (
            <CListGroupItem key={field.label} className="d-flex justify-content-between align-items-center">
              <div>
                <div className="small text-muted">{field.label}</div>
                <div>{field.value}</div>
              </div>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                aria-label={`Copia ${field.label}`}
                disabled={isEmpty(field.value)}
                onClick={() => handleCopy(field.value)}
              >
                Copia
              </CButton>
            </CListGroupItem>
          ))}
        </CListGroup>
      )
    }
    if (submissions.length === 0) {
      return <CAlert color="info" className="mb-0">Anagrafica non ancora ricevuta</CAlert>
    }
    return (
      <>
        <p className="small text-muted">Scegli l&apos;email giusta tra quelle arrivate dopo l&apos;invio:</p>
        <CListGroup flush>
          {submissions.map(submission => (
            <CListGroupItem key={submission.email_id} className="d-flex justify-content-between align-items-center">
              <div>
                <div>
                  {fieldValue(submission, 'Cognome')} {fieldValue(submission, 'Nome')}{' '}
                  {submission.phone_match && <CBadge color="success">stesso numero</CBadge>}
                </div>
                <div className="small text-muted">
                  {fmtReceived(submission.received_at)} - {fieldValue(submission, 'Cellulare')}
                </div>
              </div>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected(submission)
                  setFromList(true)
                }}
              >
                Apri
              </CButton>
            </CListGroupItem>
          ))}
        </CListGroup>
      </>
    )
  }

  return (
    <CModal visible={messageId !== null} onClose={onClose} size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Anagrafica paziente</CModalTitle>
      </CModalHeader>
      <CModalBody>{renderBody()}</CModalBody>
      <CModalFooter>
        {fromList && selected && (
          <CButton color="secondary" variant="outline" className="me-auto" onClick={() => setSelected(null)}>
            Indietro
          </CButton>
        )}
        <CButton color="secondary" onClick={onClose}>
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default AnagraficaModal
```

- [ ] **Step 6: Lancia i test e verifica che passino**

Run: `npx vitest run src/features/automation/components/AnagraficaModal.test.tsx`
Expected: PASS, `Tests  10 passed (10)`, output senza avvisi `act(...)` o errori di CoreUI. Se la finestra CoreUI non si rende in `jsdom` (transizioni del `CModal`), **non cambiare i componenti**: riporta l'errore esatto come NEEDS_CONTEXT.

- [ ] **Step 7: Controlla i tipi sui file toccati**

Run: `npm run type-check 2>&1 | grep -E "features/automation/(services|components)"`
Expected: nessuna riga in output. Il conteggio totale di `error TS` non deve superare N del Step 1.

- [ ] **Step 8: Commit**

```bash
git add client_v2/src/features/automation/services/automationMessagesService.ts client_v2/src/features/automation/components/AnagraficaModal.tsx client_v2/src/features/automation/components/AnagraficaModal.test.tsx
git commit -m "feat(prime-visite): finestra con i campi dell'anagrafica e un Copia per campo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Icona "Dettaglio" nella pagina Prime visite e verifica finale

**Files:**
- Modify: `client_v2/src/features/automation/pages/AutomationMessages.tsx`
- Test: `client_v2/src/features/automation/pages/AutomationMessages.test.tsx`

**Interfaces:**
- Consumes (dal Task 3): `AnagraficaModal` con props `{ messageId: number | null; onClose: () => void }` e `automationMessagesService.apiGetAnagrafica`.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `client_v2/src/features/automation/pages/AutomationMessages.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import AutomationMessages from './AutomationMessages'
import automationMessagesService from '../services/automationMessagesService'

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('../services/automationMessagesService', () => ({
  default: { list: vi.fn(), apiGetAnagrafica: vi.fn() },
}))

const row = (id: number, recipient: string) => ({
  id,
  created_at: '2026-10-22 16:47:57',
  channel: 'whatsapp',
  recipient,
  message_text: 'Ciao Mario Rossi, ecco il modulo https://example.com/form',
  result_json: '{"message": "ok"}',
})

describe('AutomationMessages', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.mocked(automationMessagesService.list).mockResolvedValue({
      data: [row(12, '3331112233'), row(11, '3334445566')],
    })
    vi.mocked(automationMessagesService.apiGetAnagrafica).mockResolvedValue({
      state: 'success',
      data: { submissions: [] },
    })
  })

  it('ogni riga ha l icona Dettaglio', async () => {
    render(<AutomationMessages />)
    expect(await screen.findAllByRole('button', { name: 'Dettaglio' })).toHaveLength(2)
  })

  it('il clic su Dettaglio cerca l anagrafica di quella riga e apre la finestra', async () => {
    render(<AutomationMessages />)
    const rows = await screen.findAllByRole('row')
    fireEvent.click(within(rows[2]).getByRole('button', { name: 'Dettaglio' }))
    expect(await screen.findByText('Anagrafica non ancora ricevuta')).toBeInTheDocument()
    expect(automationMessagesService.apiGetAnagrafica).toHaveBeenCalledWith(11)
    expect(screen.getByText('Anagrafica paziente')).toBeInTheDocument()
  })

  it('Chiudi nasconde la finestra', async () => {
    render(<AutomationMessages />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Dettaglio' }))[0])
    await screen.findByText('Anagrafica non ancora ricevuta')
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    await vi.waitFor(() => expect(screen.queryByText('Anagrafica paziente')).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Lancia il test e verifica che fallisca**

Run: `npx vitest run src/features/automation/pages/AutomationMessages.test.tsx`
Expected: FAIL su tutti e 3: `Unable to find role="button" and name "Dettaglio"`.

- [ ] **Step 3: Modifica la pagina**

In `client_v2/src/features/automation/pages/AutomationMessages.tsx`, tre modifiche.

**3a. Import.** Sostituisci

```tsx
import { CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell, CSpinner, CAlert, CButton } from '@coreui/react'
import automationMessagesService, { AutomationMessage } from '../services/automationMessagesService'
```

con

```tsx
import { CTable, CTableHead, CTableBody, CTableRow, CTableHeaderCell, CTableDataCell, CSpinner, CAlert, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilInfo } from '@coreui/icons'
import automationMessagesService from '../services/automationMessagesService'
import type { AutomationMessage } from '../services/automationMessagesService'
import AnagraficaModal from '../components/AnagraficaModal'
```

**3b. Stato.** Sostituisci

```tsx
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
```

con

```tsx
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = async () => {
```

**3c. Colonna e finestra.** Sostituisci

```tsx
              <CTableHeaderCell>Risultato</CTableHeaderCell>
            </CTableRow>
```

con

```tsx
              <CTableHeaderCell>Risultato</CTableHeaderCell>
              <CTableHeaderCell></CTableHeaderCell>
            </CTableRow>
```

sostituisci

```tsx
                <CTableDataCell><small>{getResultMessage(it.result_json)}</small></CTableDataCell>
              </CTableRow>
```

con

```tsx
                <CTableDataCell><small>{getResultMessage(it.result_json)}</small></CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton color="primary" variant="ghost" size="sm" aria-label="Dettaglio" onClick={() => setDetailId(it.id)}>
                    <CIcon icon={cilInfo} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
```

e sostituisci

```tsx
        </CTable>
      )}
    </div>
```

con

```tsx
        </CTable>
      )}

      <AnagraficaModal messageId={detailId} onClose={() => setDetailId(null)} />
    </div>
```

- [ ] **Step 4: Lancia i test della feature**

Run: `npx vitest run src/features/automation`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  13 passed (13)`.

- [ ] **Step 5: Verifica finale del frontend**

Run: `npx vitest run`
Expected: nessun test fallito (i test di `features/tempo` non ci sono su questo branch).
Run: `npm run type-check 2>&1 | grep -c "error TS"`
Expected: un numero minore o uguale a N annotato nel Task 3 Step 1.
Run: `npm run type-check 2>&1 | grep "features/automation"`
Expected: nessuna riga. (Se `AutomationMessages.tsx` aveva errori preesistenti annotati al Task 3 Step 1, non devono aumentare.)
Run: `grep -rn "console.log" src/features/automation || echo "nessuno"`
Expected: `nessuno`.

- [ ] **Step 6: Verifica finale del backend**

Run (da `server_v2`): `venv/Scripts/python.exe -m pytest tests -q -p no:cacheprovider --no-header -W ignore::DeprecationWarning`
Expected: tutti i test passano.

- [ ] **Step 7: Commit**

```bash
git add client_v2/src/features/automation/pages/AutomationMessages.tsx client_v2/src/features/automation/pages/AutomationMessages.test.tsx
git commit -m "feat(prime-visite): icona Dettaglio su ogni messaggio inviato" -m "Apre la finestra con i campi dell'anagrafica compilata sul sito." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Prova manuale (a cura dell'utente, il server e' gia' acceso)**

Dopo il deploy, dalla pagina Prime visite:
- clic su "Dettaglio" di un messaggio recente: se il paziente ha compilato il modulo con lo stesso numero, si aprono direttamente i campi;
- clic su "Copia" accanto al Cellulare e incolla nel gestionale: deve arrivare solo la cifra, senza `tel:` ne' tabulazioni;
- prova da `https://app.valorian.it` e da `http://serverdima:5001`;
- un messaggio il cui paziente non ha ancora compilato: "Anagrafica non ancora ricevuta";
- un caso con numero diverso (genitore): compare l'elenco, scegli con "Apri" e usa "Indietro";
- verifica che la casella Gmail collegata all'app sia quella che riceve le email del modulo.
