from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from enum import Enum


# =========================
# ENUM
# =========================

class AppointmentKind(str, Enum):
    PATIENT_EXISTING = "PATIENT_EXISTING"
    PATIENT_NEW = "PATIENT_NEW"
    SERVICE = "SERVICE"
    DAILY_NOTE = "DAILY_NOTE"


# =========================
# TIME NORMALIZATION
# =========================

@dataclass(frozen=True)
class TimeNormalizationResult:
    start_time: Optional[str]        # HH:MM or None
    end_time: Optional[str]          # HH:MM or None
    is_anomalous: bool
    anomaly_reason: Optional[str]    # descrizione leggibile


# =========================
# NORMALIZED APPOINTMENT
# =========================

@dataclass(frozen=True)
class NormalizedAppointment:
    uid: str
    kind: AppointmentKind

    date: str                        # YYYY-MM-DD
    start_time: str                  # HH:MM
    end_time: str                    # HH:MM

    title: str                       # sempre descrizione
    description: str                 # sempre note (anche vuote)

    patient_id: Optional[str]        # solo se presente
    is_new_patient: bool             # true solo per PATIENT_NEW

    metadata: Dict[str, Any]         # tipo, studio, medico
    raw: Dict[str, Any]              # record DBF originale


# =========================
# ANOMALY REPORT
# =========================

@dataclass(frozen=True)
class AppointmentAnomaly:
    uid: str
    date: str
    title: str

    raw_start: Any
    raw_end: Any

    reason: str
    raw: Dict[str, Any]


# =========================
# NORMALIZATION OUTPUT
# =========================

@dataclass
class NormalizationResult:
    valid: List[NormalizedAppointment]
    anomalies: List[AppointmentAnomaly]
