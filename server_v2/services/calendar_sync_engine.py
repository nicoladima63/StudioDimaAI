import os
import time
import logging
from typing import Dict, List, Tuple

from googleapiclient.errors import HttpError

from core.schemas import NormalizedAppointment
from core.google_event_factory import build_google_event

logger = logging.getLogger(__name__)


# ============================================================
# STRATEGIA SYNC
# ============================================================

SYNC_SLEEP_SECONDS = 0.15     # throttling soft
MAX_RETRIES = 3
RETRY_BACKOFF = 2             # esponenziale


# ============================================================
# ENTRY POINT
# ============================================================

def sync_appointments(
    *,
    service,   # google calendar service autenticato
    appointments: List[NormalizedAppointment],
    existing_events: Dict[str, Dict],  # uid -> event (da Google)
    on_progress=None,  # callback(synced, total)
) -> Dict[str, int]:
    """
    existing_events: mappa uid -> evento google esistente
    """

    stats = {
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
    }

    total = len(appointments)
    processed = 0

    for appt in appointments:
        uid = appt.uid
        google_event = existing_events.get(uid)

        try:
            if google_event is None:
                _insert_event(service, appt)
                stats["inserted"] += 1
            else:
                if _is_modified(appt, google_event):
                    _delete_event(service, google_event)
                    _insert_event(service, appt)
                    stats["updated"] += 1
                else:
                    stats["skipped"] += 1

            time.sleep(SYNC_SLEEP_SECONDS)

            processed += 1
            if on_progress:
                on_progress(processed, total)

        except Exception as e:
            stats["errors"] += 1
            logger.error(
                "Sync error uid=%s (%s)",
                uid,
                str(e),
                exc_info=True
            )

    return stats


# ============================================================
# GOOGLE OPERATIONS
# ============================================================

def _insert_event(service, appointment: NormalizedAppointment):
    event, calendar_id = build_google_event(appointment)

    if not calendar_id:
        studio = appointment.metadata.get("studio")

        try:
            studio = int(studio)
        except (TypeError, ValueError):
            studio = None

        if studio == 1:
            calendar_id = os.getenv("CALENDAR_ID_STUDIO_1")
        elif studio == 2:
            calendar_id = os.getenv("CALENDAR_ID_STUDIO_2")
        else:
            raise ValueError(f"Studio non valido uid={appointment.uid}")

    execute_with_retry(
        lambda: service.events().insert(
            calendarId=calendar_id,
            body=event
        ).execute(),
        context=f"INSERT uid={appointment.uid}"
    )


def _delete_event(service, google_event: Dict):
    calendar_id = google_event["calendarId"]
    event_id = google_event["id"]

    execute_with_retry(
        lambda: service.events().delete(
            calendarId=calendar_id,
            eventId=event_id
        ).execute(),
        context=f"DELETE eventId={event_id}"
    )


# ============================================================
# DECISION LOGIC
# ============================================================

def _is_modified(appt: NormalizedAppointment, google_event: Dict) -> bool:
    """
    confronto logico minimo:
    - titolo
    - description
    - start / end
    - colorId
    """
    if google_event.get("summary") != appt.title:
        return True

    if google_event.get("description", "") != appt.description:
        return True

    if google_event["start"]["dateTime"][-5:] != appt.start_time:
        return True

    if google_event["end"]["dateTime"][-5:] != appt.end_time:
        return True

    # Get colorId from appointment metadata
    from core.constants_v2 import GOOGLE_COLOR_MAP
    appt_color_id = GOOGLE_COLOR_MAP.get(appt.metadata.get("tipo"))
    if google_event.get("colorId") != appt_color_id:
        return True

    return False


# ============================================================
# ERROR HANDLING / QUOTA
# ============================================================

def execute_with_retry(fn, context: str):
    attempt = 0

    while True:
        try:
            return fn()

        except HttpError as e:
            status = e.resp.status

            # 401 / invalid_grant → hard fail
            if status == 401:
                logger.critical("OAuth invalid (%s)", context)
                raise

            # 403 quota / rate limit
            if status in (403, 429):
                if attempt >= MAX_RETRIES:
                    logger.error("Quota exceeded (%s)", context)
                    raise

            # 5xx Google
            if status >= 500:
                if attempt >= MAX_RETRIES:
                    logger.error("Google server error (%s)", context)
                    raise

            attempt += 1
            sleep = RETRY_BACKOFF ** attempt
            logger.warning(
                "Retry %s (%s) in %ss",
                attempt,
                context,
                sleep
            )
            time.sleep(sleep)

        except Exception:
            raise
