import os
import logging
from pathlib import Path
from typing import List, Dict, Any

from core.appointment_normalizer import normalize_batch
from core.google_calendar_client import GoogleCalendarClient
from core.exceptions import CalendarSyncError
from services.calendar_sync_engine import sync_appointments

logger = logging.getLogger(__name__)

# Determine base path for Google Calendar credentials
# If running from server_v2 directory, use current dir, otherwise use server_v2 subdirectory
_BASE_DIR = Path(__file__).parent.parent  # Go up from services/ to server_v2/
_CREDENTIALS_PATH = _BASE_DIR / "credentials.json"
_TOKEN_PATH = _BASE_DIR / "tokens" / "google_calendar.json"


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
        credentials_path=_CREDENTIALS_PATH,
        token_path=_TOKEN_PATH,
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
    Restituisce calendari filtrati e formattati come nel vecchio servizio.
    """
    from core.environment_manager import environment_manager
    from core.exceptions import GoogleCredentialsNotFoundError, CalendarSyncError
    
    try:
        client = GoogleCalendarClient(
            credentials_path=_CREDENTIALS_PATH,
            token_path=_TOKEN_PATH,
        )
        service = client.get_service()
    except GoogleCredentialsNotFoundError:
        logger.warning("Google credentials not found in list_google_calendars")
        raise
    except Exception as e:
        logger.error(f"Error creating Google Calendar client: {e}", exc_info=True)
        raise GoogleCredentialsNotFoundError(f"Failed to create Google Calendar client: {str(e)}")

    # Get configured calendar IDs from environment (V1 logic)
    try:
        automation_settings = environment_manager.get_automation_settings()
        configured_ids_str = os.environ.get("CONFIGURED_CALENDAR_IDS", "")
        
        # Fallback: get IDs from automation settings if env var not available
        if not configured_ids_str:
            studio_blu_id = automation_settings.get('calendar_studio_blu_id', '')
            studio_giallo_id = automation_settings.get('calendar_studio_giallo_id', '')
            if studio_blu_id and studio_giallo_id:
                configured_ids_str = f"{studio_blu_id},{studio_giallo_id}"
        
        configured_calendar_ids = {id.strip() for id in configured_ids_str.split(',') if id.strip()}
    except Exception as e:
        logger.warning(f"Error getting configured calendar IDs: {e}, using empty set")
        configured_calendar_ids = set()
    
    # Get all calendars from Google
    try:
        all_calendars = []
        page_token = None
        
        while True:
            result = service.calendarList().list(
                pageToken=page_token
            ).execute()
            
            all_calendars.extend(result.get("items", []))
            page_token = result.get("nextPageToken")
            
            if not page_token:
                break
    except Exception as e:
        logger.error(f"Error listing calendars from Google: {e}", exc_info=True)
        raise CalendarSyncError(f"Failed to list calendars from Google: {str(e)}")
    
    # Filter to show only configured calendars (V1 logic)
    relevant_calendars = [
        {
            'id': cal['id'],
            'name': cal.get('summary', cal['id']),
            'primary': cal.get('primary', False)
        }
        for cal in all_calendars
        if cal['id'] in configured_calendar_ids
    ]
    
    return relevant_calendars


def clear_calendar(calendar_id: str) -> int:
    """
    Funzione distruttiva.
    La teniamo perché esiste già nel vecchio servizio.
    """
    client = GoogleCalendarClient(
        credentials_path=_CREDENTIALS_PATH,
        token_path=_TOKEN_PATH,
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
            credentials_path=_CREDENTIALS_PATH,
            token_path=_TOKEN_PATH,
        )
        service = client.get_service()
        service.calendarList().list(maxResults=1).execute()
        return True
    except Exception as e:
        logger.error("Google connection test failed: %s", e)
        return False
