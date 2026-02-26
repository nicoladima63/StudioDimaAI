from typing import Optional,Dict, Any, Tuple
from datetime import datetime
from core.constants_v2 import GOOGLE_COLOR_MAP
from core.database_manager import DatabaseManager
from services.pazienti_service import PazientiService

import os
from .schemas import NormalizedAppointment, AppointmentKind

db_manager = DatabaseManager()


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
    pazienti_service: Optional[PazientiService] = None, # Iniezione del servizio
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Restituisce un dict pronto per Google Calendar API e il relativo calendar_id.
    """

    calendar_id = _get_calendar_id(appointment.metadata.get("studio"))
    
    # Costruzione dinamica della descrizione
    description_lines = []
    if appointment.description:
        description_lines.append(appointment.description)

    # Recupero info paziente usando il servizio iniettato
    if appointment.patient_id and pazienti_service:
        result = pazienti_service.get_paziente_by_id(appointment.patient_id)
        if result.get("success") and result.get("data"):
            paziente_data = result["data"]
            phone = paziente_data.get("cellulare") or paziente_data.get("telefono")
            if phone:
                description_lines.append(f"Telefono: {phone}")

    full_description = "\n".join(description_lines).strip()

    # ISO format (RFC3339) per le date
    start_dt = _build_datetime(appointment.date, appointment.start_time)
    end_dt = _build_datetime(appointment.date, appointment.end_time)

    event = {
        "summary": appointment.title,
        "description": full_description,
        "eventType": "default",
        "status": "confirmed",
        "start": {
            "dateTime": start_dt,
            "timeZone": "Europe/Rome",
        },
        "end": {
            "dateTime": end_dt,
            "timeZone": "Europe/Rome",
        },
        "reminders": {
            "useDefault": False,
            "overrides": [],
        },
        "extendedProperties": {
            "private": {
                "uid": str(appointment.uid),
                "kind": appointment.kind.value,
            }
        },
    }

    # Mapping colore
    tipo = appointment.metadata.get("tipo")
    color_id = GOOGLE_COLOR_MAP.get(tipo)
    if color_id:
        event["colorId"] = str(color_id)

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
    
