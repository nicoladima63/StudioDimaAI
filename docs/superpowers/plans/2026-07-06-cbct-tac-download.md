# Download automatico TAC/CBCT da portale Alliance Medical - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il flusso manuale (login portale → ricerca esame → download .rar → estrazione WinRAR → copia su NAS) con una pagina "Download TAC" in StudioDimaAI che mostra la lista esami del portale e scarica/estrae con un click.

**Architecture:** `CbctService` (backend, in `server_v2/services/`) fa da client HTTP verso il portale Django "myDentalShare" (login + parsing HTML della lista + download), estrae l'archivio `.rar` via 7-Zip in subprocess e copia il risultato su NAS; un blueprint Flask espone 2 endpoint JWT-protetti; il frontend (shadcn/ui) mostra la lista con stato "già scaricato" e un pulsante di download per riga.

**Tech Stack:** Python (Flask, requests, BeautifulSoup, subprocess+7-Zip), SQLite (studio_dima.db), React + TypeScript + shadcn/ui (Radix + Tailwind).

## Global Constraints

- Route Flask protette con `@jwt_required()` (tutte tranne le route di test)
- Risposta API a 3 stati tramite `format_response(..., state='success'|'warning'|'error')`
- Credenziali e password (portale, archivio) esclusivamente in `.env`, mai nel codice — già presenti come `ALLIANCE_USERNAME`, `ALLIANCE_PASSWORD`, `ALLIANCE_ARCHIVE_PASSWORD`, `CBCT_NAS_PATH`, `SEVENZIP_PATH`
- Frontend: `import apiClient from '@/services/api/client'` (default import), niente slash iniziale nelle chiamate (`apiClient.get('cbct/esami')`), risposta letta da `response.data.data`
- Nuove pagine/componenti frontend in shadcn/ui (`@/components/ui/*`), non CoreUI — direzione attuale del progetto (vedi `docs/superpowers/specs/2026-07-06-cbct-tac-download-design.md`)
- Tabella nuova con auto-migrazione obbligatoria: `_ensure_tables()` + flag di modulo `_TABLES_READY`, chiamata a inizio di ogni metodo che tocca la tabella
- Niente `console.log` di debug nel codice finale
- Nessuna emoji né carattere Unicode speciale nei messaggi di log/sistema

---

## Contesto tecnico raccolto (da non ridimostrare in implementazione)

- Portale: `https://portaledentisti.alliancemedical.it` — app Django server-rendered, non SPA
- Login: GET `/accounts/login/` (estrarre `csrfmiddlewaretoken` da input hidden), POST stesso URL con `username`, `password`, `csrfmiddlewaretoken`, header `Referer` uguale all'URL di login
- Il portale ha una catena di certificati non verificabile da `requests` di default (confermato con curl `-k`) — usare `session.verify = False`, stesso approccio già presente in `server_v2/test_scraping.py`
- Lista esami: GET `/package-list/` — tabella HTML `<table class="table">`, righe in `<tbody><tr>`, 11 celle `<td>` per riga nell'ordine: Cod. paziente, Nome (formato `COGNOME^NOME`, es. `BOTTA^NICCOLO'`), Data nascita (`DD/MM/YYYY`), Acc. Num., Data studio (`DD/MM/YYYY`), Descrizione, Dentista, N. download (contatore portale), Disponibile fino al, Imaging center, Azione
- L'ultima cella contiene (tra codice HTML commentato da ignorare) un `<a onclick="downloadUrl('STUDY_ID')">Scarica</a>` — `STUDY_ID` è l'id univoco dell'esame (stringa con trattini tipo UUID), da estrarre con regex
- Download: GET `/download/<STUDY_ID>` (autenticato) → restituisce direttamente il file `.rar`
- Convenzione cartella NAS: `NOME_COGNOME__YYYYMMDD` (nome e cognome invertiti rispetto al formato portale, data da `DD/MM/YYYY` a `YYYYMMDD`)
- Non esiste ancora una cartella `server_v2/tests/` nel progetto — la creiamo qui per la prima volta, con `pytest` semplice basato su funzioni (nessun framework di test esistente da rispettare)

---

### Task 1: Funzioni pure di parsing (nome paziente, cartella NAS, HTML lista esami)

**Files:**
- Create: `server_v2/tests/fixtures/package_list_sample.html`
- Create: `server_v2/services/cbct_service.py`
- Test: `server_v2/tests/test_cbct_service.py`

**Interfaces:**
- Produces: `parse_nome_paziente(raw: str) -> tuple[str, str]` (cognome, nome), `build_cartella_nas(nome: str, cognome: str, data_esame: str) -> str`, `parse_lista_esami_html(html: str) -> list[dict]` (ogni dict con chiavi: `portal_exam_id`, `codice_paziente`, `paziente_raw`, `data_nascita`, `accession_number`, `data_esame`, `descrizione`, `dentista`, `download_count_portale`, `disponibile_fino_al`, `imaging_center`), `merge_stato_esami(esami: list[dict], id_scaricati: set[str]) -> list[dict]` (aggiunge chiave `gia_scaricato: bool` a ogni dict, in place, e ritorna la stessa lista)

- [ ] **Step 1: Crea la fixture HTML anonimizzata**

Crea `server_v2/tests/fixtures/package_list_sample.html` con questo contenuto esatto (2 righe della tabella reale, nomi sostituiti con dati fittizi, struttura HTML invariata inclusi i commenti e lo script inline che deve essere ignorato dal parser):

```html
<div class="table-container">
    <table class="table">
        <thead>
        <tr>
            <th class="orderable"><a href="?sort=patientID">Cod.</a></th>
            <th class="orderable"><a href="?sort=patientName">Nome</a></th>
            <th class="orderable"><a href="?sort=patientBirthDate">Data Nascita</a></th>
            <th class="orderable"><a href="?sort=accessionNumber">Acc. Num.</a></th>
            <th class="orderable"><a href="?sort=studyDate">Data Studio</a></th>
            <th class="orderable"><a href="?sort=studyDescription">Descrizione</a></th>
            <th class="orderable"><a href="?sort=assignedTo">Dentista</a></th>
            <th class="orderable"><a href="?sort=downloadNumber">N.</a></th>
            <th class="orderable"><a href="?sort=availableTill">Fino al</a></th>
            <th class="orderable"><a href="?sort=imaging_center">Imaging center</a></th>
            <th></th>
        </tr>
        </thead>
        <tbody>
        <tr class="even">
            <td>111111</td>
            <td>ROSSI^MARIO</td>
            <td>13/08/2004</td>
            <td>PO000001/2026T2</td>
            <td>03/07/2026</td>
            <td>TC DENTALE SETTORIALE (DENTALSCAN) CONE-BEAM</td>
            <td>DI MARTINO NICOLA</td>
            <td>1</td>
            <td>12/08/2026</td>
            <td>Centro Diagnostico ipr</td>
            <td>
<!--
<a class="btn btn-primary" style="width:80px" onclick="scarica('aaaaaaaa-11111111-bbbbbbbb-22222222-cccccccc')">Scarica</a>
-->
<a class="btn btn-primary" style="width:80px" onclick="downloadUrl('aaaaaaaa-11111111-bbbbbbbb-22222222-cccccccc')">Scarica</a>
<script>
    function downloadUrl(studyID){
        url = '/download/' + studyID;
        window.open(url, '_blank');
    }
</script>
</td>
        </tr>
        <tr class="odd">
            <td>222222</td>
            <td>VERDI^ANNA</td>
            <td>13/11/1970</td>
            <td>PO000002/2026T2</td>
            <td>01/07/2026</td>
            <td>RX ORTOPANTOMOGRAFICA ARCATE DENTARIE</td>
            <td>DI MARTINO NICOLA</td>
            <td>0</td>
            <td>10/08/2026</td>
            <td>Centro Diagnostico ipr</td>
            <td>
<!--
<a class="btn btn-primary" style="width:80px" onclick="scarica('dddddddd-33333333-eeeeeeee-44444444-ffffffff')">Scarica</a>
-->
<a class="btn btn-primary" style="width:80px" onclick="downloadUrl('dddddddd-33333333-eeeeeeee-44444444-ffffffff')">Scarica</a>
<script>
    function downloadUrl(studyID){
        url = '/download/' + studyID;
        window.open(url, '_blank');
    }
</script>
</td>
        </tr>
        </tbody>
    </table>
</div>
```

- [ ] **Step 2: Scrivi i test per le funzioni pure (devono fallire, le funzioni non esistono ancora)**

Crea `server_v2/tests/test_cbct_service.py`:

```python
import os
from pathlib import Path

import pytest

from services.cbct_service import (
    parse_nome_paziente,
    build_cartella_nas,
    parse_lista_esami_html,
    merge_stato_esami,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "package_list_sample.html"


def test_parse_nome_paziente_divide_cognome_e_nome():
    cognome, nome = parse_nome_paziente("BOTTA^NICCOLO'")
    assert cognome == "BOTTA"
    assert nome == "NICCOLO'"


def test_parse_nome_paziente_senza_separatore_solleva_errore():
    with pytest.raises(ValueError):
        parse_nome_paziente("BOTTA NICCOLO")


def test_build_cartella_nas_formatta_nome_cognome_data():
    cartella = build_cartella_nas(nome="NICCOLO'", cognome="BOTTA", data_esame="03/07/2026")
    assert cartella == "NICCOLO_BOTTA__20260703"


def test_parse_lista_esami_html_estrae_tutte_le_righe():
    html = FIXTURE_PATH.read_text(encoding="utf-8")
    esami = parse_lista_esami_html(html)

    assert len(esami) == 2

    primo = esami[0]
    assert primo["portal_exam_id"] == "aaaaaaaa-11111111-bbbbbbbb-22222222-cccccccc"
    assert primo["paziente_raw"] == "ROSSI^MARIO"
    assert primo["data_esame"] == "03/07/2026"
    assert primo["descrizione"] == "TC DENTALE SETTORIALE (DENTALSCAN) CONE-BEAM"
    assert primo["download_count_portale"] == 1

    secondo = esami[1]
    assert secondo["portal_exam_id"] == "dddddddd-33333333-eeeeeeee-44444444-ffffffff"
    assert secondo["paziente_raw"] == "VERDI^ANNA"
    assert secondo["download_count_portale"] == 0


def test_merge_stato_esami_marca_gia_scaricato():
    esami = [
        {"portal_exam_id": "aaa"},
        {"portal_exam_id": "bbb"},
    ]
    risultato = merge_stato_esami(esami, id_scaricati={"aaa"})

    assert risultato[0]["gia_scaricato"] is True
    assert risultato[1]["gia_scaricato"] is False
```

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `cd server_v2 && python -m pytest tests/test_cbct_service.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'services.cbct_service'` (o import error simile)

- [ ] **Step 4: Implementa le funzioni pure in `cbct_service.py`**

Crea `server_v2/services/cbct_service.py` con questo contenuto iniziale (solo funzioni pure, la classe `CbctService` viene aggiunta al Task 2):

```python
"""
Servizio per il download automatico delle TAC/CBCT dal portale
Alliance Medical (myDentalShare) e il loro salvataggio su NAS.
"""

import re
import logging
from datetime import datetime

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_STUDY_ID_RE = re.compile(r"downloadUrl\('([^']+)'\)")
_CARATTERI_NON_VALIDI_RE = re.compile(r"[^A-Za-z0-9_]")


def parse_nome_paziente(raw: str) -> tuple[str, str]:
    """Divide il formato portale 'COGNOME^NOME' in (cognome, nome)."""
    if "^" not in raw:
        raise ValueError(f"Formato nome paziente inatteso (atteso 'COGNOME^NOME'): {raw!r}")
    cognome, _, nome = raw.partition("^")
    return cognome.strip(), nome.strip()


def _sanitizza_componente_cartella(testo: str) -> str:
    pulito = testo.strip().replace(" ", "_").replace("'", "")
    pulito = _CARATTERI_NON_VALIDI_RE.sub("", pulito)
    return pulito.upper()


def build_cartella_nas(nome: str, cognome: str, data_esame: str) -> str:
    """Costruisce il nome cartella NOME_COGNOME__YYYYMMDD dalla data DD/MM/YYYY."""
    data_dt = datetime.strptime(data_esame, "%d/%m/%Y")
    return f"{_sanitizza_componente_cartella(nome)}_{_sanitizza_componente_cartella(cognome)}__{data_dt.strftime('%Y%m%d')}"


def parse_lista_esami_html(html: str) -> list[dict]:
    """Estrae la lista esami dalla pagina /package-list/ del portale."""
    soup = BeautifulSoup(html, "html.parser")
    tabella = soup.find("table", class_="table")
    if tabella is None:
        return []
    corpo = tabella.find("tbody")
    if corpo is None:
        return []

    esami = []
    for riga in corpo.find_all("tr"):
        celle = riga.find_all("td")
        if len(celle) < 11:
            continue

        link = celle[10].find("a")
        if link is None or not link.get("onclick"):
            continue

        match = _STUDY_ID_RE.search(link["onclick"])
        if not match:
            continue

        esami.append({
            "portal_exam_id": match.group(1),
            "codice_paziente": celle[0].get_text(strip=True),
            "paziente_raw": celle[1].get_text(strip=True),
            "data_nascita": celle[2].get_text(strip=True),
            "accession_number": celle[3].get_text(strip=True),
            "data_esame": celle[4].get_text(strip=True),
            "descrizione": celle[5].get_text(strip=True),
            "dentista": celle[6].get_text(strip=True),
            "download_count_portale": int(celle[7].get_text(strip=True) or 0),
            "disponibile_fino_al": celle[8].get_text(strip=True),
            "imaging_center": celle[9].get_text(strip=True),
        })

    return esami


def merge_stato_esami(esami: list[dict], id_scaricati: set[str]) -> list[dict]:
    """Aggiunge il flag gia_scaricato a ogni esame in base agli id già presenti in DB."""
    for esame in esami:
        esame["gia_scaricato"] = esame["portal_exam_id"] in id_scaricati
    return esami
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `cd server_v2 && python -m pytest tests/test_cbct_service.py -v`
Expected: PASS su tutti e 5 i test

- [ ] **Step 6: Commit**

```bash
git add server_v2/tests/fixtures/package_list_sample.html server_v2/tests/test_cbct_service.py server_v2/services/cbct_service.py
git commit -m "feat: add pure parsing helpers for CBCT portal exam list"
```

---

### Task 2: CbctService — client portale, estrazione 7-Zip, registrazione DB

**Files:**
- Modify: `server_v2/services/cbct_service.py`
- Modify: `server_v2/core/exceptions.py`

**Interfaces:**
- Consumes: `parse_nome_paziente`, `build_cartella_nas`, `parse_lista_esami_html`, `merge_stato_esami` (da Task 1)
- Produces: `CbctError(StudioDimaError)`; classe `CbctService(BaseService)` con `get_lista_esami() -> list[dict]` e `scarica_ed_estrai(portal_exam_id: str, paziente_raw: str, data_esame: str, user_id: int | None = None) -> dict` (dict con chiavi `portal_exam_id`, `cartella_nas`)

- [ ] **Step 1: Aggiungi l'eccezione custom**

In `server_v2/core/exceptions.py`, aggiungi in fondo al file (segue lo stesso pattern delle altre eccezioni, es. `DbfProcessingError`):

```python
class CbctError(StudioDimaError):
    """Errore nel flusso di download/estrazione TAC dal portale Alliance Medical."""
    pass
```

- [ ] **Step 2: Aggiungi il client HTTP verso il portale e la classe CbctService**

Aggiungi in fondo a `server_v2/services/cbct_service.py` (dopo le funzioni pure già presenti dal Task 1):

```python
import os
import subprocess
import tempfile
from pathlib import Path

import requests
import urllib3

from .base_service import BaseService
from core.exceptions import CbctError

urllib3.disable_warnings()

PORTAL_BASE_URL = "https://portaledentisti.alliancemedical.it"
LOGIN_PATH = "/accounts/login/"
LIST_PATH = "/package-list/"
DOWNLOAD_PATH_TEMPLATE = "/download/{study_id}"

_TABLES_READY = False


class AllianceMedicalClient:
    """Client HTTP per il portale myDentalShare (Alliance Medical)."""

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.session = requests.Session()
        # Il portale ha una catena certificati non verificabile da requests
        # (confermato con curl -k); stesso approccio di server_v2/test_scraping.py
        self.session.verify = False

    def login(self) -> None:
        pagina_login = self.session.get(PORTAL_BASE_URL + LOGIN_PATH, timeout=15)
        pagina_login.raise_for_status()

        soup = BeautifulSoup(pagina_login.text, "html.parser")
        campo_csrf = soup.find("input", {"name": "csrfmiddlewaretoken"})
        if campo_csrf is None:
            raise CbctError("Impossibile trovare il token CSRF nella pagina di login del portale")

        risposta = self.session.post(
            PORTAL_BASE_URL + LOGIN_PATH,
            data={
                "csrfmiddlewaretoken": campo_csrf["value"],
                "username": self.username,
                "password": self.password,
            },
            headers={"Referer": PORTAL_BASE_URL + LOGIN_PATH},
            timeout=15,
        )
        risposta.raise_for_status()

        if LOGIN_PATH in risposta.url:
            raise CbctError(
                "Login al portale Alliance Medical fallito: credenziali non valide o portale non raggiungibile"
            )

    def get_lista_esami_html(self) -> str:
        risposta = self.session.get(PORTAL_BASE_URL + LIST_PATH, timeout=15)
        risposta.raise_for_status()
        return risposta.text

    def scarica_archivio(self, portal_exam_id: str, destinazione: Path) -> None:
        url = PORTAL_BASE_URL + DOWNLOAD_PATH_TEMPLATE.format(study_id=portal_exam_id)
        with self.session.get(url, stream=True, timeout=60) as risposta:
            risposta.raise_for_status()
            with open(destinazione, "wb") as f:
                for chunk in risposta.iter_content(chunk_size=8192):
                    f.write(chunk)


class CbctService(BaseService):
    """Orchestratore: lista esami dal portale + download/estrazione + tracciamento DB."""

    def __init__(self, database_manager):
        super().__init__(database_manager)
        self._ensure_tables()
        self.username = os.environ["ALLIANCE_USERNAME"]
        self.password = os.environ["ALLIANCE_PASSWORD"]
        self.archive_password = os.environ["ALLIANCE_ARCHIVE_PASSWORD"]
        self.nas_path = os.environ.get("CBCT_NAS_PATH", r"\\servernas\cbct")
        self.sevenzip_path = os.environ.get("SEVENZIP_PATH", r"C:\Program Files\7-Zip\7z.exe")

    def _ensure_tables(self) -> None:
        global _TABLES_READY
        if _TABLES_READY:
            return
        with self.db_manager.transaction() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cbct_downloads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    portal_exam_id TEXT NOT NULL UNIQUE,
                    paziente TEXT NOT NULL,
                    data_esame TEXT NOT NULL,
                    cartella_nas TEXT NOT NULL,
                    downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    downloaded_by INTEGER
                )
            ''')
        _TABLES_READY = True

    def get_lista_esami(self) -> list[dict]:
        client = AllianceMedicalClient(self.username, self.password)
        client.login()
        html = client.get_lista_esami_html()
        esami = parse_lista_esami_html(html)

        righe = self.execute_query("SELECT portal_exam_id FROM cbct_downloads")
        id_scaricati = {r["portal_exam_id"] for r in righe}

        return merge_stato_esami(esami, id_scaricati)

    def scarica_ed_estrai(
        self, portal_exam_id: str, paziente_raw: str, data_esame: str, user_id: int | None = None
    ) -> dict:
        cognome, nome = parse_nome_paziente(paziente_raw)
        cartella_nome = build_cartella_nas(nome=nome, cognome=cognome, data_esame=data_esame)
        cartella_destinazione = Path(self.nas_path) / cartella_nome
        cartella_destinazione.mkdir(parents=True, exist_ok=True)

        client = AllianceMedicalClient(self.username, self.password)
        client.login()

        with tempfile.TemporaryDirectory() as tmp_dir:
            archivio_path = Path(tmp_dir) / f"{portal_exam_id}.rar"
            client.scarica_archivio(portal_exam_id, archivio_path)
            self._estrai_rar(archivio_path, cartella_destinazione)

        self.execute_command(
            '''
            INSERT INTO cbct_downloads (portal_exam_id, paziente, data_esame, cartella_nas, downloaded_by)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(portal_exam_id) DO UPDATE SET
                cartella_nas = excluded.cartella_nas,
                downloaded_at = CURRENT_TIMESTAMP,
                downloaded_by = excluded.downloaded_by
            ''',
            (portal_exam_id, f"{nome} {cognome}", data_esame, cartella_nome, user_id),
        )

        return {"portal_exam_id": portal_exam_id, "cartella_nas": cartella_nome}

    def _estrai_rar(self, archivio_path: Path, cartella_destinazione: Path) -> None:
        comando = [
            self.sevenzip_path,
            "x",
            f"-p{self.archive_password}",
            "-y",
            f"-o{cartella_destinazione}",
            str(archivio_path),
        ]
        risultato = subprocess.run(comando, capture_output=True, text=True)
        if risultato.returncode != 0:
            raise CbctError(
                f"Estrazione archivio fallita (7-Zip exit code {risultato.returncode}): {risultato.stderr.strip()}"
            )
```

Nota: serve aggiungere `from bs4 import BeautifulSoup` in cima al file (vicino agli altri import), dato che era già importato nelle funzioni pure del Task 1 solo dentro `parse_lista_esami_html` — spostalo a livello di modulo per essere usato anche da `AllianceMedicalClient.login()`.

- [ ] **Step 3: Verifica che il modulo si importi senza errori**

Run: `cd server_v2 && python -c "from services.cbct_service import CbctService, AllianceMedicalClient, CbctError; print('OK')"`
Expected: `OK` (nessun `ImportError`/`SyntaxError`). Nota: questo controlla solo che il codice sia sintatticamente corretto e importabile — non richiede DB né rete.

- [ ] **Step 4: Verifica manuale con credenziali reali (non automatizzabile)**

Questo step richiede un login reale al portale e non può essere una parte di una test suite automatica (dipende da uno stato esterno vivo). Prerequisiti: 7-Zip installato in locale (`SEVENZIP_PATH` nel tuo `.env` locale punta a un eseguibile reale) e le variabili `ALLIANCE_USERNAME`/`ALLIANCE_PASSWORD`/`ALLIANCE_ARCHIVE_PASSWORD` valorizzate in `server_v2/.env`.

Crea uno script temporaneo `server_v2/test_cbct_manuale.py` (stesso stile di `test_scraping.py` già presente, non è pytest):

```python
from dotenv import load_dotenv
load_dotenv()

from core.database_manager import get_database_manager
from services.cbct_service import CbctService

service = CbctService(get_database_manager())
esami = service.get_lista_esami()
print(f"Trovati {len(esami)} esami sul portale")
for esame in esami[:3]:
    print(esame)
```

Run: `cd server_v2 && python test_cbct_manuale.py`
Expected: stampa il numero di esami trovati e i primi 3, senza eccezioni. Se fallisce, l'errore (es. `CbctError` di login) indica esattamente dove si è rotto il flusso.

Dopo la verifica, cancella `server_v2/test_cbct_manuale.py` (era solo per il test manuale, non va committato).

- [ ] **Step 5: Commit**

```bash
git add server_v2/services/cbct_service.py server_v2/core/exceptions.py
git commit -m "feat: add CbctService with portal login, download and RAR extraction"
```

---

### Task 3: Blueprint API `v2_cbct.py`

**Files:**
- Create: `server_v2/api/v2_cbct.py`
- Modify: `server_v2/app_v2.py:269` (blocco import) e `server_v2/app_v2.py:314-355` (lista `blueprints`)

**Interfaces:**
- Consumes: `CbctService` (da Task 2), `format_response` da `app_v2` (già esistente), `ValidationError`/`CbctError` da `core.exceptions`
- Produces: `GET /api/v2/cbct/esami`, `POST /api/v2/cbct/esami/<portal_exam_id>/scarica`

- [ ] **Step 1: Crea il blueprint**

Crea `server_v2/api/v2_cbct.py`:

```python
"""
API endpoints per il download automatico delle TAC/CBCT dal portale Alliance Medical.
"""

import logging

from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required

from services.cbct_service import CbctService
from app_v2 import format_response
from core.exceptions import ValidationError, CbctError

logger = logging.getLogger(__name__)

cbct_v2_bp = Blueprint('cbct_v2', __name__)


@cbct_v2_bp.route('/cbct/esami', methods=['GET'])
@jwt_required()
def get_lista_esami():
    try:
        service = CbctService(g.database_manager)
        esami = service.get_lista_esami()
        return format_response(data=esami, state='success')
    except CbctError as e:
        logger.error(f"Errore CBCT nel recupero della lista esami: {e}")
        return format_response(success=False, error=str(e), state='error'), 502
    except Exception as e:
        logger.error(f"Errore imprevisto nella lista esami CBCT: {e}", exc_info=True)
        return format_response(
            success=False, error="Errore imprevisto nel recupero della lista esami", state='error'
        ), 500


@cbct_v2_bp.route('/cbct/esami/<portal_exam_id>/scarica', methods=['POST'])
@jwt_required()
def scarica_esame(portal_exam_id):
    try:
        payload = request.get_json(force=True) or {}
        paziente_raw = payload.get('paziente_raw')
        data_esame = payload.get('data_esame')
        if not paziente_raw or not data_esame:
            raise ValidationError("paziente_raw e data_esame sono obbligatori")

        service = CbctService(g.database_manager)
        risultato = service.scarica_ed_estrai(portal_exam_id, paziente_raw, data_esame)
        return format_response(
            data=risultato,
            message=f"Esame scaricato in {risultato['cartella_nas']}",
            state='success',
        )
    except ValidationError as e:
        return format_response(success=False, error=str(e), state='error'), 400
    except CbctError as e:
        logger.error(f"Errore CBCT nel download esame {portal_exam_id}: {e}")
        return format_response(success=False, error=str(e), state='error'), 502
    except Exception as e:
        logger.error(f"Errore imprevisto nel download esame CBCT {portal_exam_id}: {e}", exc_info=True)
        return format_response(
            success=False, error="Errore imprevisto nel download dell'esame", state='error'
        ), 500
```

- [ ] **Step 2: Registra il blueprint in `app_v2.py`**

In `server_v2/app_v2.py`, nel blocco di import dentro `register_blueprints` (vicino a `from api.v2_simulation import simulation_v2_bp`, circa riga 311), aggiungi:

```python
    from api.v2_cbct import cbct_v2_bp
```

Nella lista `blueprints` (circa riga 354, subito prima della chiusura `]`), aggiungi:

```python
        simulation_v2_bp,
        cbct_v2_bp,
    ]
```

- [ ] **Step 3: Verifica manuale con il server in esecuzione**

Il server è già attivo secondo le istruzioni di progetto (non va riavviato da te — chiedi conferma se serve un riavvio per caricare il nuovo blueprint). Con un token JWT valido:

Run: `curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:5001/api/v2/cbct/esami`
Expected: JSON con `"success": true`, `"data"`: lista di esami (o lista vuota se il portale non ha nulla), nessun errore 500/502

- [ ] **Step 4: Commit**

```bash
git add server_v2/api/v2_cbct.py server_v2/app_v2.py
git commit -m "feat: add v2_cbct API blueprint for TAC list and download"
```

---

### Task 4: Frontend — service e tipi

**Files:**
- Create: `client_v2/src/features/cbct/services/cbct.service.ts`

**Interfaces:**
- Produces: `interface EsameCbct`, `interface RisultatoDownload`, `cbctService.getListaEsami(): Promise<EsameCbct[]>`, `cbctService.scaricaEsame(esame: EsameCbct): Promise<RisultatoDownload>`

- [ ] **Step 1: Crea il service**

Crea `client_v2/src/features/cbct/services/cbct.service.ts`:

```typescript
import apiClient from '@/services/api/client'

export interface EsameCbct {
  portal_exam_id: string
  codice_paziente: string
  paziente_raw: string
  data_nascita: string
  accession_number: string
  data_esame: string
  descrizione: string
  dentista: string
  download_count_portale: number
  disponibile_fino_al: string
  imaging_center: string
  gia_scaricato: boolean
}

export interface RisultatoDownload {
  portal_exam_id: string
  cartella_nas: string
}

export const cbctService = {
  async getListaEsami(): Promise<EsameCbct[]> {
    const response = await apiClient.get('cbct/esami')
    return response.data.data || []
  },

  async scaricaEsame(esame: EsameCbct): Promise<RisultatoDownload> {
    const response = await apiClient.post(`cbct/esami/${esame.portal_exam_id}/scarica`, {
      paziente_raw: esame.paziente_raw,
      data_esame: esame.data_esame,
    })
    return response.data.data
  },
}

export default cbctService
```

- [ ] **Step 2: Verifica che il progetto compili (type-check)**

Run: `cd client_v2 && npx tsc --noEmit`
Expected: nessun errore relativo a `cbct.service.ts` (eventuali errori pre-esistenti in altri file non sono di nostra competenza in questo task)

- [ ] **Step 3: Commit**

```bash
git add client_v2/src/features/cbct/services/cbct.service.ts
git commit -m "feat: add cbct.service.ts for TAC download API calls"
```

---

### Task 5: Frontend — pagina Download TAC, routing e navigazione

**Files:**
- Create: `client_v2/src/components/ui/input.tsx`
- Create: `client_v2/src/features/cbct/pages/DownloadTacPage.tsx`
- Modify: `client_v2/src/router/index.tsx`
- Modify: `client_v2/src/components/layout/_nav.tsx`

**Interfaces:**
- Consumes: `cbctService`, `EsameCbct` (da Task 4); `Button`, `Badge`, `Card`, `CardContent`, `Skeleton` (già esistenti in `@/components/ui/*`); `PageLayout` (già esistente in `@/components/layout/PageLayout`)

- [ ] **Step 1: Crea il primitivo shadcn `Input` (non esiste ancora nel progetto)**

Crea `client_v2/src/components/ui/input.tsx`:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
```

- [ ] **Step 2: Crea la pagina**

Crea `client_v2/src/features/cbct/pages/DownloadTacPage.tsx`:

```tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Loader2, Download, CheckCircle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import cbctService, { type EsameCbct } from '@/features/cbct/services/cbct.service'

const DownloadTacPage: React.FC = () => {
  const [esami, setEsami] = useState<EsameCbct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ricerca, setRicerca] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadEsami = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await cbctService.getListaEsami()
      setEsami(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore caricamento lista esami')
      setEsami([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEsami()
  }, [loadEsami])

  const handleScarica = async (esame: EsameCbct) => {
    try {
      setBusyId(esame.portal_exam_id)
      setError(null)
      await cbctService.scaricaEsame(esame)
      await loadEsami()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore durante il download')
    } finally {
      setBusyId(null)
    }
  }

  const esamiFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    if (!termine) return esami
    return esami.filter((e) => e.paziente_raw.toLowerCase().includes(termine))
  }, [esami, ricerca])

  return (
    <PageLayout>
      <PageLayout.Header
        title="Download TAC"
        headerAction={
          <Button variant="outline" size="sm" onClick={loadEsami} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Aggiorna lista
          </Button>
        }
      />

      <PageLayout.ContentBody>
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Cerca per nome paziente..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>

        {loading && esami.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && esamiFiltrati.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Download className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nessun esame trovato sul portale</p>
          </div>
        )}

        {esamiFiltrati.length > 0 && (
          <>
            {/* Mobile: card list */}
            <div className="space-y-3 md:hidden">
              {esamiFiltrati.map((e) => (
                <Card key={e.portal_exam_id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{e.paziente_raw.replace('^', ' ')}</span>
                          <Badge variant={e.gia_scaricato ? 'success' : 'muted'} className="shrink-0">
                            {e.gia_scaricato
                              ? <><CheckCircle className="h-3 w-3 mr-1" />Scaricato</>
                              : 'Da scaricare'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{e.descrizione}</p>
                        <p className="text-xs text-muted-foreground">{e.data_esame}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === e.portal_exam_id || loading}
                        onClick={() => handleScarica(e)}
                      >
                        {busyId === e.portal_exam_id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : 'Scarica'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: tabella */}
            <div className="hidden md:block overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Paziente</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Data esame</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Descrizione</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Stato</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {esamiFiltrati.map((e) => (
                    <tr key={e.portal_exam_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{e.paziente_raw.replace('^', ' ')}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.data_esame}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.descrizione}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={e.gia_scaricato ? 'success' : 'muted'}>
                          {e.gia_scaricato ? 'Scaricato' : 'Da scaricare'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={busyId === e.portal_exam_id || loading}
                          onClick={() => handleScarica(e)}
                        >
                          {busyId === e.portal_exam_id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                          Scarica
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PageLayout.ContentBody>
    </PageLayout>
  )
}

export default DownloadTacPage
```

- [ ] **Step 3: Registra la route**

In `client_v2/src/router/index.tsx`, aggiungi il lazy import vicino a `const SimulationDashboard = ...` (circa riga 59):

```typescript
const DownloadTacPage = React.lazy(() => import('@/features/cbct/pages/DownloadTacPage'))
```

E la route vicino a `<Route path='simulation' element={<SimulationDashboard />} />` (circa riga 146):

```tsx
          <Route path='cbct' element={<DownloadTacPage />} />
```

- [ ] **Step 4: Aggiungi la voce di navigazione**

In `client_v2/src/components/layout/_nav.tsx`, aggiungi una voce di primo livello subito dopo `{ name: 'Bot WhatsApp', to: '/bot', iconName: 'MessageCircle', allowedRoles: ['admin', 'segreteria'] },` (riga 16):

```typescript
  { name: 'Download TAC', to: '/cbct', iconName: 'ScanLine' },
```

- [ ] **Step 5: Verifica che il progetto compili**

Run: `cd client_v2 && npx tsc --noEmit`
Expected: nessun errore relativo ai file toccati in questo task

- [ ] **Step 6: Verifica manuale nel browser**

Avvia (se non già attivo) il frontend, accedi con un utente autenticato, apri la voce di menu "Download TAC":
- La lista esami del portale deve comparire (o un messaggio di errore chiaro se le credenziali non sono configurate)
- Il campo di ricerca deve filtrare per nome paziente
- Un click su "Scarica" su un esame reale deve produrre la cartella `NOME_COGNOME__YYYYMMDD` dentro il percorso NAS configurato, con i file estratti, e la riga deve passare a stato "Scaricato" dopo il refresh automatico

- [ ] **Step 7: Commit**

```bash
git add client_v2/src/components/ui/input.tsx client_v2/src/features/cbct/pages/DownloadTacPage.tsx client_v2/src/router/index.tsx client_v2/src/components/layout/_nav.tsx
git commit -m "feat: add Download TAC page with search, status badges and NAS extraction trigger"
```

---

## Self-Review (svolto durante la stesura del piano)

**1. Copertura spec:** ogni sezione dello spec (`docs/superpowers/specs/2026-07-06-cbct-tac-download-design.md`) ha un task corrispondente — parsing/naming (Task 1), service+estrazione+DB (Task 2), API (Task 3), frontend service (Task 4), frontend pagina+routing+nav (Task 5). Nessuna sezione dello spec è rimasta senza task.

**2. Placeholder scan:** nessun "TBD"/"da implementare dopo" nei task. Gli unici punti espliciti di verifica manuale (Task 2 Step 4, Task 5 Step 6) sono dichiarati tali perché dipendono da stato esterno vivo (portale reale, NAS reale, 7-Zip installato) e non da pigrizia nello scrivere il piano — sono comunque corredati di comandi esatti e risultato atteso.

**3. Coerenza tipi/nomi:** `portal_exam_id`, `paziente_raw`, `data_esame`, `cartella_nas`, `gia_scaricato` sono usati con lo stesso nome identico in Task 1 (funzioni pure) → Task 2 (service) → Task 3 (API) → Task 4 (tipo TS `EsameCbct`) → Task 5 (uso nella pagina). `CbctService`, `AllianceMedicalClient`, `CbctError` sono nomi coerenti in tutti i task che li citano.

## Prerequisiti non di codice (da fare prima/durante il Task 2 e prima del deploy)

- Installare 7-Zip sulla macchina di sviluppo (per il test manuale del Task 2) e su serverdima (per la produzione) — non è un pacchetto Python, è un eseguibile da scaricare e installare
- Verificare/valorizzare in `server_v2/.env` le variabili `ALLIANCE_USERNAME`, `ALLIANCE_PASSWORD`, `ALLIANCE_ARCHIVE_PASSWORD`, `CBCT_NAS_PATH`, `SEVENZIP_PATH` (già presenti come segnaposto, valori reali già inseriti dall'utente secondo quanto riferito)
