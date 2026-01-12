import hashlib
import re
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from .schemas import (
    AppointmentKind,
    NormalizedAppointment,
    TimeNormalizationResult,
    AppointmentAnomaly,
    NormalizationResult,
)

logger = logging.getLogger(__name__)

# ============================================================
# UTIL
# ============================================================

def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip().lower())


def _hash_uid(parts: Tuple[str, ...]) -> str:
    raw = "|".join(parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


# ============================================================
# CLASSIFICATION
# ============================================================

def classify_appointment(record: Dict[str, Any]) -> AppointmentKind:
    id_paziente = record.get("_PATIENT_ID") or record.get("id_paziente")
    tipo = record.get("TIPO") or record.get("tipo")
    ora_inizio = record.get("ORA_INIZIO") or record.get("ora_inizio")

    if id_paziente:
        return AppointmentKind.PATIENT_EXISTING

    if tipo == "V":
        return AppointmentKind.PATIENT_NEW

    if _is_midnight(ora_inizio):
        return AppointmentKind.DAILY_NOTE

    return AppointmentKind.SERVICE


# ============================================================
# TIME NORMALIZATION
# ============================================================

def _is_midnight(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value in ("0", "0.0", "00:00", "00.00")
    try:
        return float(value) == 0.0
    except Exception:
        return False


def normalize_time(
    raw_start: Any,
    raw_end: Any,
    kind: AppointmentKind
) -> TimeNormalizationResult:

    if kind == AppointmentKind.DAILY_NOTE:
        return TimeNormalizationResult(
            start_time="00:00",
            end_time="00:00",
            is_anomalous=False,
            anomaly_reason=None,
        )

    start, start_err = _parse_time(raw_start)
    end, end_err = _parse_time(raw_end)

    if start_err:
        return TimeNormalizationResult(None, None, True, f"ORA_INIZIO non valida: {start_err}")

    if end_err:
        return TimeNormalizationResult(start, None, True, f"ORA_FINE non valida: {end_err}")

    if end == start:
        return TimeNormalizationResult(start, end, False, None)  # ← valido, non anomalo

    if end < start:
        return TimeNormalizationResult(start, end, True, "ORA_FINE < ORA_INIZIO")

    return TimeNormalizationResult(start, end, False, None)


def _parse_time(value: Any) -> Tuple[Optional[str], Optional[str]]:
    try:
        if isinstance(value, str) and ":" in value:
            h, m = value.split(":")
            return _fmt_time(int(h), int(m)), None

        if isinstance(value, (int, float, str)):
            s = str(value)
            if "." in s:
                h, m = s.split(".")
                hours = int(h)
                minutes = int(m) if m else 0
            else:
                hours = int(s)
                minutes = 0

            if not (0 <= hours <= 23 and 0 <= minutes <= 59):
                return None, f"range non valido ({hours}:{minutes})"

            return _fmt_time(hours, minutes), None

    except Exception as e:
        return None, str(e)

    return None, "formato sconosciuto"


def _fmt_time(h: int, m: int) -> str:
    return f"{h:02d}:{m:02d}"


# ============================================================
# UID
# ============================================================

def build_uid(
    *,
    date: str,
    start: str,
    end: str,
    kind: AppointmentKind,
    studio: Any,
    patient_id: Optional[str],
    title: str,
) -> str:
    return _hash_uid((
        date,
        start,
        end,
        kind.value,
        str(studio),
        patient_id or "-",
        _normalize_title(title),
    ))


# ============================================================
# NORMALIZATION PIPELINE
# ============================================================

def normalize_appointment(record: Dict[str, Any]) -> Tuple[Optional[NormalizedAppointment], Optional[AppointmentAnomaly]]:
    logger.debug("Normalizing record: %s", record)  # ⭐ AGGIUNGI QUESTO

    kind = classify_appointment(record)

    date_raw = record.get("DATA") or record.get("data")
    date = date_raw.strftime("%Y-%m-%d") if hasattr(date_raw, "strftime") else str(date_raw)

    time_result = normalize_time(
        record.get("ORA_INIZIO") or record.get("ora_inizio"),
        record.get("ORA_FINE") or record.get("ora_fine"),
        kind
    )

    title = (record.get("DESCRIZIONE") or record.get("descrizione") or "").strip()
    description = record.get("NOTE") or record.get("note") or ""
    patient_id = record.get("_PATIENT_ID") or record.get("id_paziente")

    uid = build_uid(
        date=date,
        start=time_result.start_time or "00:00",
        end=time_result.end_time or "00:00",
        kind=kind,
        studio=record.get("STUDIO") or record.get("studio"),
        patient_id=patient_id,
        title=title,
    )

    if time_result.is_anomalous:
        return None, AppointmentAnomaly(
            uid=uid,
            date=date,
            title=title,
            raw_start=record.get("ora_inizio"),
            raw_end=record.get("ora_fine"),
            reason=time_result.anomaly_reason or "anomalia oraria",
            raw=record,
        )

    normalized = NormalizedAppointment(
        uid=uid,
        kind=kind,
        date=date,
        start_time=time_result.start_time,
        end_time=time_result.end_time,
        title=title,
        description=description,
        patient_id=record.get("id_paziente") or record.get("_PATIENT_ID"),
        is_new_patient=(kind == AppointmentKind.PATIENT_NEW),
        metadata={
            "tipo": record.get("tipo") or record.get("TIPO"),
            "studio": record.get("STUDIO") or record.get("studio"),
            "medico": record.get("MEDICO_NOME") or record.get("_MEDICO_ID"),
        },
        raw=record,
    )

    return normalized, None


def normalize_batch(records: list[Dict[str, Any]]) -> NormalizationResult:
    valid = []
    anomalies = []

    for record in records:
        normalized, anomaly = normalize_appointment(record)
        if normalized:
            valid.append(normalized)
        if anomaly:
            anomalies.append(anomaly)

    return NormalizationResult(valid=valid, anomalies=anomalies)
