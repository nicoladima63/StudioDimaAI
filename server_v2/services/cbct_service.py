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
