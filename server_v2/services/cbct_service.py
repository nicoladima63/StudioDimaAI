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
