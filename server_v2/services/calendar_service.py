import os
import logging
from pathlib import Path
from typing import List, Dict, Any

from core.appointment_normalizer import normalize_batch
from core.google_calendar_client import GoogleCalendarClient
from services.calendar_sync_engine import sync_appointments

logger = logging.getLogger(__name__)


# ============================================================
# PUBLIC – ENTRY POINT PRINCIPALE (SYNC)
# ============================================================

def sync_calendar_from_records(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Entry point unico per la sincronizzazione.
    records: lista di dict già prodotti dal loader DBF esistente
    """

    logger.info("=== Avvio sincronizzazione Google Calendar ===")

    # --------------------------------------------------------
    # 1. Normalizzazione
    # --------------------------------------------------------
    normalization = normalize_batch(records)

    logger.info(
        "Normalizzati: %s | Anomalie: %s",
        len(normalization.valid),
        len(normalization.anomalies),
    )

    if not normalization.valid:
        logger.warning("Nessun appuntamento valido da sincronizzare")
        return {
            "sync": {},
            "anomalies": normalization.anomalies,
        }

    # --------------------------------------------------------
    # 2. OAuth / Google Service
    # --------------------------------------------------------
    client = GoogleCalendarClient(
        credentials_path=Path("credentials.json"),
        token_path=Path("tokens/google_calendar.json"),
    )
    service = client.get_service()

    # --------------------------------------------------------
    # 3. Caricamento eventi Google esistenti
    # --------------------------------------------------------
    existing_events = load_existing_google_events(service)

    logger.info("Eventi Google indicizzati: %s", len(existing_events))

    # --------------------------------------------------------
    # 4. Sync
    # --------------------------------------------------------
    stats = sync_appointments(
        service=service,
        appointments=normalization.valid,
        existing_events=existing_events,
    )

    logger.info(
        "Sync completata | inserted=%s updated=%s skipped=%s errors=%s",
        stats.get("inserted"),
        stats.get("updated"),
        stats.get("skipped"),
        stats.get("errors"),
    )

    return {
        "sync": stats,
        "anomalies": normalization.anomalies,
    }


# ============================================================
# GOOGLE – LOADER EVENTI (ESSENZIALE)
# ============================================================

def load_existing_google_events(service) -> Dict[str, Dict]:
    """
    Costruisce una mappa:
        uid -> evento Google
    Serve al sync engine.
    """

    events_map: Dict[str, Dict] = {}

    calendar_ids = [
        os.getenv("CALENDAR_ID_STUDIO_1"),
        os.getenv("CALENDAR_ID_STUDIO_2"),
    ]

    for calendar_id in calendar_ids:
        if not calendar_id:
            continue

        page_token = None
        while True:
            result = service.events().list(
                calendarId=calendar_id,
                maxResults=2500,
                pageToken=page_token,
                singleEvents=True,
                privateExtendedProperty="uid",
            ).execute()

            for event in result.get("items", []):
                uid = (
                    event
                    .get("extendedProperties", {})
                    .get("private", {})
                    .get("uid")
                )
                if uid:
                    event["calendarId"] = calendar_id
                    events_map[uid] = event

            page_token = result.get("nextPageToken")
            if not page_token:
                break

    return events_map


# ============================================================
# ---- FUNZIONI “LEGACY ESSENZIALI” (DA TENERE PER ORA) ----
# ============================================================

def list_google_calendars() -> List[Dict[str, Any]]:
    """
    Usata da UI / debug.
    NON coinvolta nella sync.
    """
    client = GoogleCalendarClient(
        credentials_path=Path("credentials.json"),
        token_path=Path("tokens/google_calendar.json"),
    )
    service = client.get_service()

    calendars = []
    page_token = None

    while True:
        result = service.calendarList().list(
            pageToken=page_token
        ).execute()

        calendars.extend(result.get("items", []))
        page_token = result.get("nextPageToken")

        if not page_token:
            break

    return calendars


def clear_calendar(calendar_id: str) -> int:
    """
    Funzione distruttiva.
    La teniamo perché esiste già nel vecchio servizio.
    """
    client = GoogleCalendarClient(
        credentials_path=Path("credentials.json"),
        token_path=Path("tokens/google_calendar.json"),
    )
    service = client.get_service()

    deleted = 0
    page_token = None

    while True:
        events = service.events().list(
            calendarId=calendar_id,
            pageToken=page_token,
            singleEvents=True,
        ).execute()

        for event in events.get("items", []):
            service.events().delete(
                calendarId=calendar_id,
                eventId=event["id"],
            ).execute()
            deleted += 1

        page_token = events.get("nextPageToken")
        if not page_token:
            break

    logger.warning("Calendario %s svuotato (%s eventi)", calendar_id, deleted)
    return deleted


def test_google_connection() -> bool:
    """
    Usata da health-check / UI.
    """
    try:
        client = GoogleCalendarClient(
            credentials_path=Path("credentials.json"),
            token_path=Path("tokens/google_calendar.json"),
        )
        service = client.get_service()
        service.calendarList().list(maxResults=1).execute()
        return True
    except Exception as e:
        logger.error("Google connection test failed: %s", e)
        return False
