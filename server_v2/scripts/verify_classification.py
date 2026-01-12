import sys
import os
from datetime import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.appointment_normalizer import normalize_appointment, AppointmentKind
from core.constants_v2 import TIPI_APPUNTAMENTO

def test_logic():
    print("=== Testing Appointment Classification Logic ===")

    # Case 1: Standard 'V' (Prima Visita) without patient ID - CURRENTLY should work
    rec1 = {
        "tipo": "V", 
        "ora_inizio": "9.00", 
        "ora_fine": "10.00", 
        "data": datetime.now(),
        "studio": 1,
        "descrizione": "Prima Visita Mario"
    }
    norm1, anom1 = normalize_appointment(rec1)
    if norm1 and norm1.kind == AppointmentKind.PATIENT_NEW:
        print("[PASS] Case 1: 'V' without patient is valid (PATIENT_NEW)")
    else:
        print(f"[FAIL] Case 1: 'V' without patient failed. Anomaly: {anom1.reason if anom1 else 'None'}")

    # Case 2: Other valid type e.g. 'I' (Igiene) without patient ID - EXPECTED TO FAIL BEFORE FIX
    rec2 = {
        "tipo": "I", 
        "ora_inizio": "11.00", 
        "ora_fine": "12.00", 
        "data": datetime.now(),
        "studio": 1,
        "descrizione": "Igiene Rossi"
    }
    norm2, anom2 = normalize_appointment(rec2)
    
    if norm2 and norm2.kind == AppointmentKind.PATIENT_NEW:
        print("[PASS] Case 2: 'I' without patient is valid (PATIENT_NEW)")
    else:
        print(f"[INFO] Case 2: 'I' without patient currently treated as: {norm2.kind if norm2 else 'Anomaly/None'} (Expected behavior before fix might be SERVICE or Anomaly)")

    # Case 3: Empty/Invalid record
    rec3 = {
        "ora_inizio": "", 
        "ora_fine": "", 
        "data": datetime.now(),
        # No patient, no desc, no notes, no valid type
    }
    norm3, anom3 = normalize_appointment(rec3)
    if not norm3:
         print("[PASS] Case 3: Empty record correctly discarded")
    else:
         print(f"[FAIL] Case 3: Empty record was NOT discarded. Classified as {norm3.kind} (Anomaly: {anom3.reason if anom3 else 'None'})")

if __name__ == "__main__":
    test_logic()
