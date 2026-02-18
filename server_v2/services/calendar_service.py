import os
import logging
from typing import List, Dict, Any

from core.appointment_normalizer import normalize_batch
from core.google_calendar_client import GoogleCalendarClient
from core.exceptions import CalendarSyncError
from core.paths import GOOGLE_CREDENTIALS_PATH, GOOGLE_TOKEN_PATH, ensure_data_dir
from services.calendar_sync_engine import sync_appointments, execute_with_retry

logger = logging.getLogger(__name__)

# ============================================================
# PUBLIC – ENTRY POINT PRINCIPALE (SYNC)
# ============================================================

def sync_calendar_from_records(records: List[Dict[str, Any]], on_progress=None) -> Dict[str, Any]:
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
    ensure_data_dir()
    client = GoogleCalendarClient(
        credentials_path=GOOGLE_CREDENTIALS_PATH,
        token_path=GOOGLE_TOKEN_PATH,
    )
    service = client.get_service()

    # --------------------------------------------------------
    # 3. Caricamento eventi Google esistenti
    # --------------------------------------------------------
    existing_by_uid, existing_by_fingerprint = load_existing_google_events(service)

    logger.info(
        "Eventi Google indicizzati: uid=%s fingerprint=%s",
        len(existing_by_uid),
        len(existing_by_fingerprint),
    )

    # --------------------------------------------------------
    # 4. Sync
    # --------------------------------------------------------
    stats = sync_appointments(
        service=service,
        appointments=normalization.valid,
        existing_by_uid=existing_by_uid,
        existing_by_fingerprint=existing_by_fingerprint,
        on_progress=on_progress,
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

def load_existing_google_events(service) -> tuple[Dict[str, Dict], Dict[str, Dict]]:
    """
    Costruisce due mappe:
      - uid -> evento Google (source of truth per sync)
      - fingerprint -> evento Google (fallback per "heal" eventi legacy senza uid)
    """

    by_uid: Dict[str, Dict] = {}
    by_fingerprint: Dict[str, Dict] = {}

    calendar_ids = [
        os.getenv("CALENDAR_ID_STUDIO_1"),
        os.getenv("CALENDAR_ID_STUDIO_2"),
    ]

    for calendar_id in calendar_ids:
        if not calendar_id:
            continue

        page_token = None
        while True:
            result = execute_with_retry(
                lambda: service.events().list(
                    calendarId=calendar_id,
                    maxResults=2500,
                    pageToken=page_token,
                    singleEvents=True,
                ).execute(),
                context=f"LIST_EXISTING calendar={calendar_id}"
            )

            for event in result.get("items", []):
                event["calendarId"] = calendar_id

                uid = (
                    event.get("extendedProperties", {})
                    .get("private", {})
                    .get("uid")
                )
                if uid:
                    by_uid[str(uid)] = event
                else:
                    fp = _event_fingerprint(event)
                    if fp:
                        by_fingerprint[fp] = event

            page_token = result.get("nextPageToken")
            if not page_token:
                break

    return by_uid, by_fingerprint


def _event_fingerprint(event: Dict[str, Any]) -> str | None:
    """
    Fingerprint per riconciliare eventi legacy senza extendedProperties.private.uid.
    Usa: calendarId + data + start/end HH:MM + summary normalizzato.
    """
    try:
        calendar_id = event.get("calendarId")
        summary = (event.get("summary") or "").strip().lower()

        start_dt = (event.get("start") or {}).get("dateTime")
        end_dt = (event.get("end") or {}).get("dateTime")
        if not calendar_id or not summary or not start_dt or not end_dt:
            return None

        # RFC3339 → YYYY-MM-DD + HH:MM
        # python datetime.fromisoformat supports "+01:00" offsets but not "Z"
        start_iso = str(start_dt).replace("Z", "+00:00")
        end_iso = str(end_dt).replace("Z", "+00:00")
        from datetime import datetime

        start_parsed = datetime.fromisoformat(start_iso)
        end_parsed = datetime.fromisoformat(end_iso)

        date = start_parsed.date().isoformat()
        start_hm = start_parsed.strftime("%H:%M")
        end_hm = end_parsed.strftime("%H:%M")

        return f"{calendar_id}|{date}|{start_hm}|{end_hm}|{summary}"
    except Exception:
        return None


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
            credentials_path=GOOGLE_CREDENTIALS_PATH,
            token_path=GOOGLE_TOKEN_PATH,
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
            result = execute_with_retry(
                lambda: service.calendarList().list(
                    pageToken=page_token
                ).execute(),
                context="LIST_CALENDARS"
            )
            
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
        credentials_path=GOOGLE_CREDENTIALS_PATH,
        token_path=GOOGLE_TOKEN_PATH,
    )
    service = client.get_service()

    deleted = 0
    page_token = None

    while True:
        events = execute_with_retry(
            lambda: service.events().list(
                calendarId=calendar_id,
                pageToken=page_token,
                singleEvents=True,
            ).execute(),
            context=f"CLEAR_LIST calendar={calendar_id}"
        )

        for event in events.get("items", []):
            execute_with_retry(
                lambda: service.events().delete(
                    calendarId=calendar_id,
                    eventId=event["id"],
                ).execute(),
                context=f"CLEAR_DELETE eventId={event['id']}"
            )
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
            credentials_path=GOOGLE_CREDENTIALS_PATH,
            token_path=GOOGLE_TOKEN_PATH,
        )
        service = client.get_service()
        service.calendarList().list(maxResults=1).execute()
        return True
    except Exception as e:
        logger.error("Google connection test failed: %s", e)
        return False
