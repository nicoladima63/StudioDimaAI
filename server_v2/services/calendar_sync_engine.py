import os
import time
import logging
from typing import Dict, List, Tuple, Optional

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
    existing_by_uid: Dict[str, Dict],  # uid -> event (da Google)
    existing_by_fingerprint: Dict[str, Dict],  # fingerprint -> event (legacy fallback)
    on_progress=None,  # callback(synced, total)
) -> Dict[str, int]:
    """
    existing_by_uid: mappa uid -> evento google esistente
    existing_by_fingerprint: fallback per riconciliare eventi legacy senza uid
    """

    stats = {
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "pruned": 0,
        "errors": 0,
    }

    total = len(appointments)
    processed = 0

    for appt in appointments:
        uid = appt.uid
        google_event = existing_by_uid.get(uid)

        try:
            if google_event is None:
                # Fallback: prova a riconciliare evento legacy senza uid (stesso slot)
                fp = _appointment_fingerprint(appt)
                legacy_event = existing_by_fingerprint.get(fp) if fp else None

                if legacy_event is not None:
                    _patch_event_add_uid(service, legacy_event, uid, appt_kind=appt.kind.value)
                    existing_by_uid[uid] = legacy_event
                    google_event = legacy_event

                if google_event is None:
                    _insert_event(service, appt)
                    stats["inserted"] += 1
                else:
                    if _is_modified(appt, google_event):
                        _upsert_event(service, appt, google_event)
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1
            else:
                if _is_modified(appt, google_event):
                    _upsert_event(service, appt, google_event)
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

    # ---- PRUNE: cancella eventi Google orfani per le date sincronizzate ----
    synced_dates = {appt.date for appt in appointments}
    synced_uids = {appt.uid for appt in appointments}

    # Determina i calendarId coinvolti in questo batch di sync
    synced_calendar_ids = set()
    for appt in appointments:
        studio = appt.metadata.get("studio")
        try:
            studio = int(studio)
        except (TypeError, ValueError):
            continue
        if studio == 1:
            cal_id = os.getenv("CALENDAR_ID_STUDIO_1")
        elif studio == 2:
            cal_id = os.getenv("CALENDAR_ID_STUDIO_2")
        else:
            continue
        if cal_id:
            synced_calendar_ids.add(cal_id)

    for uid, google_event in existing_by_uid.items():
        start_dt = google_event.get("start", {}).get("dateTime", "")
        if not start_dt:
            continue
        event_date = start_dt[:10]  # "2026-02-25T10:00:00" -> "2026-02-25"

        event_id = google_event.get("id", "")
        event_calendar = google_event.get("calendarId", "")

        # Prune solo eventi dello stesso calendario, stesse date, UID non piu nel sorgente
        if (event_date in synced_dates
                and uid not in synced_uids
                and event_id.startswith("sdai")
                and event_calendar in synced_calendar_ids):
            try:
                logger.info("PRUNE orphan uid=%s date=%s", uid, event_date)
                _delete_event(service, google_event)
                stats["pruned"] += 1
                time.sleep(SYNC_SLEEP_SECONDS)
            except HttpError as e:
                if e.resp.status == 410:
                    # Already deleted on Google side, count as pruned
                    stats["pruned"] += 1
                else:
                    logger.error("Prune error uid=%s (%s)", uid, str(e))
                    stats["errors"] += 1
            except Exception as e:
                logger.error("Prune error uid=%s (%s)", uid, str(e))
                stats["errors"] += 1

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

    # Deterministic event id → idempotent inserts across restarts/deploys
    event["id"] = _desired_event_id(appointment.uid)

    try:
        execute_with_retry(
            lambda: service.events().insert(
                calendarId=calendar_id,
                body=event
            ).execute(),
            context=f"INSERT uid={appointment.uid}"
        )
    except HttpError as e:
        # If event id already exists, treat as upsert and update it
        if getattr(e, "resp", None) is not None and getattr(e.resp, "status", None) == 409:
            execute_with_retry(
                lambda: service.events().update(
                    calendarId=calendar_id,
                    eventId=event["id"],
                    body=event,
                ).execute(),
                context=f"INSERT_CONFLICT_UPDATE uid={appointment.uid}",
            )
            return
        raise


def _upsert_event(service, appointment: NormalizedAppointment, google_event: Dict):
    """
    Aggiorna in-place se l'evento ha già l'id deterministico;
    altrimenti migra via delete+insert per fissare l'id e prevenire duplicati futuri.
    """
    desired_id = _desired_event_id(appointment.uid)

    # Build target event
    new_event, calendar_id = build_google_event(appointment)
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

    new_event["id"] = desired_id

    current_calendar_id = google_event.get("calendarId", calendar_id)
    current_event_id = google_event.get("id")

    # Update in place if already deterministic
    if current_calendar_id == calendar_id and current_event_id == desired_id:
        execute_with_retry(
            lambda: service.events().update(
                calendarId=calendar_id,
                eventId=desired_id,
                body=new_event,
            ).execute(),
            context=f"UPDATE uid={appointment.uid}",
        )
        return

    # Migrate: delete old then insert deterministic
    _delete_event(service, google_event)
    try:
        _insert_event(service, appointment)
    except HttpError as e:
        if getattr(e, "resp", None) is not None and getattr(e.resp, "status", None) == 409:
            execute_with_retry(
                lambda: service.events().update(
                    calendarId=calendar_id,
                    eventId=desired_id,
                    body=new_event,
                ).execute(),
                context=f"UPDATE_AFTER_CONFLICT uid={appointment.uid}",
            )
            return
        raise


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


def _desired_event_id(uid: str) -> str:
    # Google Calendar event IDs: only base32hex chars allowed (a-v and 0-9), no underscores
    return f"sdai{uid}"


def _appointment_fingerprint(appt: NormalizedAppointment) -> Optional[str]:
    """
    Fingerprint per riconciliare eventi legacy senza uid.
    calendarId + YYYY-MM-DD + HH:MM start/end + summary normalizzato
    """
    try:
        studio = appt.metadata.get("studio")
        try:
            studio_int = int(studio)
        except (TypeError, ValueError):
            studio_int = None

        if studio_int == 1:
            calendar_id = os.getenv("CALENDAR_ID_STUDIO_1")
        elif studio_int == 2:
            calendar_id = os.getenv("CALENDAR_ID_STUDIO_2")
        else:
            calendar_id = None

        if not calendar_id:
            return None

        summary = (appt.title or "").strip().lower()
        if not summary:
            return None

        return f"{calendar_id}|{appt.date}|{appt.start_time}|{appt.end_time}|{summary}"
    except Exception:
        return None


def _patch_event_add_uid(service, google_event: Dict, uid: str, appt_kind: str):
    """
    Adds extendedProperties.private.uid to an existing Google event (legacy),
    so future runs match by uid and we stop producing duplicates.
    """
    calendar_id = google_event.get("calendarId")
    event_id = google_event.get("id")
    if not calendar_id or not event_id:
        return

    private_props = ((google_event.get("extendedProperties") or {}).get("private") or {})
    private_props = dict(private_props)
    private_props["uid"] = str(uid)
    private_props.setdefault("kind", appt_kind)

    patch_body = {"extendedProperties": {"private": private_props}}

    execute_with_retry(
        lambda: service.events().patch(
            calendarId=calendar_id,
            eventId=event_id,
            body=patch_body,
        ).execute(),
        context=f"PATCH_ADD_UID uid={uid}",
    )


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

            # 4xx (other than quota/rate) are not retriable (e.g. 400, 404, 409)
            if 400 <= status < 500 and status not in (403, 429):
                logger.error("Non-retriable Google API error %s (%s)", status, context)
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
