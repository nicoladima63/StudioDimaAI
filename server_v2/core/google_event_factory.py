from typing import Optional,Dict, Any
from datetime import datetime
from core.constants_v2 import GOOGLE_COLOR_MAP
from services.pazienti_service import PazientiService
import os
from .schemas import NormalizedAppointment, AppointmentKind


# ============================================================
# CONFIG
# ============================================================

def _get_calendar_id(studio: int) -> str | None:
    if studio == 1:
        return os.getenv("CALENDAR_ID_STUDIO_1")
    if studio == 2:
        return os.getenv("CALENDAR_ID_STUDIO_2")
    return None



# ============================================================
# EVENT FACTORY
# ============================================================

def build_google_event(
    appointment: NormalizedAppointment,
) -> Dict[str, Any]:
    """
    Restituisce un dict pronto per Google Calendar API (events.insert)
    """

    calendar_id = _get_calendar_id(
        appointment.metadata.get("studio")
    )
    
    patient_phone = None
    if appointment.patient_id:
        pazienti_service = PazientiService()
        result = pazienti_service.get_paziente_by_id(appointment.patient_id)
        if result.get("success") and result.get("data"):
            paziente_data = result["data"]
            # Prioritize mobile phone for SMS, fallback to landline
            patient_phone = paziente_data.get("cellulare") or paziente_data.get("telefono")

    description = appointment.description or ""

    if patient_phone:
        description = f"{description}\nTelefono: {patient_phone}".strip()

    start_dt = _build_datetime(
        appointment.date,
        appointment.start_time
    )
    end_dt = _build_datetime(
        appointment.date,
        appointment.end_time
    )

    event = {
        "summary": appointment.title,
        "description": description,
        "start": {
            "dateTime": start_dt,
            "timeZone": "Europe/Rome",
        },
        "end": {
            "dateTime": end_dt,
            "timeZone": "Europe/Rome",
        },
        "reminders": {
            "useDefault": False
        },
        "extendedProperties": {
            "private": {
                "uid": appointment.uid,
                "kind": appointment.kind.value,
            }
        },
    }

    color_id = GOOGLE_COLOR_MAP.get(
        appointment.metadata.get("tipo")
    )
    if color_id:
        event["colorId"] = color_id

    return event, calendar_id


# ============================================================
# UTIL
# ============================================================

def _build_datetime(date: str, time: str) -> str:
    """
    YYYY-MM-DD + HH:MM -> RFC3339
    """
    dt = datetime.fromisoformat(f"{date}T{time}")
    return dt.isoformat()
