import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:5000/api"
USERNAME = "admin"
PASSWORD = "admin123"
LOG_FILE = "automation_test_log.txt"

def log(msg):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now().isoformat()} | {msg}\n")

def login():
    url = f"{BASE_URL}/auth/login"
    data = {"username": USERNAME, "password": PASSWORD}
    try:
        r = requests.post(url, json=data)
        r.raise_for_status()
        token = r.json().get("access_token")
        if not token:
            log(f"[FAIL] Login: token mancante. Risposta: {r.text}")
            return None
        log("[OK] Login riuscito")
        return token
    except Exception as e:
        log(f"[FAIL] Login: {e}")
        return None

def test_get(url, token, desc):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get(url, headers=headers)
        log(f"[GET] {desc} | Status: {r.status_code}")
        log(f"      Response: {r.text}")
        return r
    except Exception as e:
        log(f"[FAIL] GET {desc}: {e}")
        return None

def test_post(url, token, desc, payload):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.post(url, headers=headers, json=payload)
        log(f"[POST] {desc} | Status: {r.status_code}")
        log(f"       Payload: {json.dumps(payload)}")
        log(f"       Response: {r.text}")
        return r
    except Exception as e:
        log(f"[FAIL] POST {desc}: {e}")
        return None

def test_put(url, token, desc, payload):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.put(url, headers=headers, json=payload)
        log(f"[PUT] {desc} | Status: {r.status_code}")
        log(f"       Payload: {json.dumps(payload)}")
        log(f"       Response: {r.text}")
        return r
    except Exception as e:
        log(f"[FAIL] PUT {desc}: {e}")
        return None

def run_tests():
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"Automation Test Suite - {datetime.now().isoformat()}\n\n")
    token = login()
    if not token:
        log("[FATAL] Login fallito, abortisco i test.")
        sys.exit(1)

    # 1. Test GET impostazioni promemoria
    test_get(f"{BASE_URL}/settings/appointment-reminder", token, "Impostazioni Promemoria")
    # 2. Test GET impostazioni richiami
    test_get(f"{BASE_URL}/settings/recall-automation", token, "Impostazioni Richiami")
    # 3. Test GET modalità SMS promemoria
    test_get(f"{BASE_URL}/settings/sms-promemoria-mode", token, "Modalità SMS Promemoria")
    # 4. Test GET modalità SMS richiami
    test_get(f"{BASE_URL}/settings/sms-richiami-mode", token, "Modalità SMS Richiami")
    # 5. Test POST salvataggio impostazioni promemoria
    test_post(f"{BASE_URL}/settings/appointment-reminder", token, "Salva Promemoria", {
        "reminder_enabled": True,
        "reminder_hour": 10,
        "reminder_minute": 30
    })
    # 6. Test POST salvataggio impostazioni richiami
    test_post(f"{BASE_URL}/settings/recall-automation", token, "Salva Richiami", {
        "recall_enabled": True,
        "recall_hour": 17,
        "recall_minute": 45
    })
    # 7. Test GET log promemoria
    test_get(f"{BASE_URL}/settings/appointment-reminder/log", token, "Log Promemoria")
    # 8. Test GET log richiami
    test_get(f"{BASE_URL}/settings/recall-automation/log", token, "Log Richiami")
    # 9. Test GET template promemoria
    test_get(f"{BASE_URL}/sms/templates/promemoria", token, "Template Promemoria")
    # 10. Test GET template richiamo
    test_get(f"{BASE_URL}/sms/templates/richiamo", token, "Template Richiamo")
    # 11. Test POST preview template promemoria (con variabili mancanti)
    test_post(f"{BASE_URL}/sms/templates/promemoria/preview", token, "Preview Template Promemoria (mancano variabili)", {
        "content": "Ciao {nome_completo}, il tuo appuntamento è il {data_appuntamento}.",
        "description": "Test preview con variabili mancanti"
    })
    # 12. Test POST preview template richiamo (con variabili mancanti)
    test_post(f"{BASE_URL}/sms/templates/richiamo/preview", token, "Preview Template Richiamo (mancano variabili)", {
        "content": "Ciao {nome_completo}, ti ricordo il richiamo {tipo_richiamo}.",
        "description": "Test preview con variabili mancanti"
    })
    # 13. Test PUT salvataggio template promemoria (simula errore: content vuoto)
    test_put(f"{BASE_URL}/sms/templates/promemoria", token, "Salva Template Promemoria (vuoto)", {
        "content": "",
        "description": "Test errore content vuoto"
    })
    # 14. Test PUT salvataggio template richiamo (simula errore: content vuoto)
    test_put(f"{BASE_URL}/sms/templates/richiamo", token, "Salva Template Richiamo (vuoto)", {
        "content": "",
        "description": "Test errore content vuoto"
    })

    # Imposta modalità SMS promemoria e richiami su 'prod' prima dei test SMS reali
    test_post(f"{BASE_URL}/settings/sms-promemoria-mode", token, "Set SMS Promemoria mode PROD", {"mode": "prod"})
    test_post(f"{BASE_URL}/settings/sms-richiami-mode", token, "Set SMS Richiami mode PROD", {"mode": "prod"})

    # 15. Test invio SMS promemoria reale
    test_post(
        f"{BASE_URL}/sms/send",
        token,
        "Invio SMS Promemoria reale",
        {
            "to_number": "+393335467518",
            "message": "Ciao Amore questo è un test di invio SMS di promemoria dallo Studio Di Martino."
        }
    )
    # 16. Test invio SMS richiamo reale
    test_post(
        f"{BASE_URL}/sms/send-recall",
        token,
        "Invio SMS Richiamo reale",
        {
            "richiamo_data": {
                "telefono": "+393335467518",
                "nome_completo": "Test Paziente",
                "tipo": "Controllo periodico",
                "data1": "2025-08-15",
                "messaggio": "Test SMS richiamo reale"
            }
        }
    )

    # Rimetti modalità SMS promemoria e richiami su 'test' dopo i test SMS reali
    test_post(f"{BASE_URL}/settings/sms-promemoria-mode", token, "Set SMS Promemoria mode TEST", {"mode": "test"})
    test_post(f"{BASE_URL}/settings/sms-richiami-mode", token, "Set SMS Richiami mode TEST", {"mode": "test"})

    log("\n[INFO] Test suite completata. Controlla il file automation_test_log.txt per i dettagli.")

if __name__ == "__main__":
    run_tests() 