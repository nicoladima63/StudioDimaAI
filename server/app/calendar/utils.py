# app/core/calendar_utils.py

from typing import List, Dict
from datetime import datetime
import logging

# Dummy data for now
from os import getenv

logger = logging.getLogger(__name__)

CALENDAR_IDS = [
    getenv("CALENDAR_ID_STUDIO_1"),
    getenv("CALENDAR_ID_STUDIO_2")
]

def list_available_calendars() -> List[Dict[str, str]]:
    """Restituisce la lista degli ID dei calendari disponibili."""
    return [
        {"id": cid, "name": f"Calendario {i+1}"}
        for i, cid in enumerate(CALENDAR_IDS) if cid
    ]

def fetch_events(calendar_id: str, start: datetime, end: datetime) -> List[Dict]:
    """Recupera eventi esistenti in un intervallo di date."""
    logger.info(f"[GoogleCalendar] Recupero eventi per {calendar_id} da {start} a {end}")
    # TODO: integrazione con Google Calendar API
    return []

def sync_appointments_to_calendar(calendar_id: str, start: datetime, end: datetime) -> Dict:
    """Sincronizza appuntamenti nel range specificato."""
    logger.info(f"[Sync] Sincronizzazione appuntamenti verso {calendar_id} da {start} a {end}")
    # TODO: estrai appuntamenti dal DB e crea eventi in Google Calendar
    return {"synced": 0, "status": "OK"}

def clear_calendar_events(calendar_id: str) -> Dict:
    """Cancella tutti gli eventi da un calendario."""
    logger.warning(f"[GoogleCalendar] Eliminazione eventi da {calendar_id}")
    # TODO: chiamata alle API Google per eliminare eventi
    return {"cleared": True}
