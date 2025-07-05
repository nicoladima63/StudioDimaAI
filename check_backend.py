import requests
import os
import json
import sys

BASE_URL = "http://localhost:5000"
DATA_DIR = os.path.join("server", "app", "data")
DIAGNOSIS_FILE = "icd9_odontoiatria.json"
DRUGS_FILE = "atc_farmaci.json"

def print_result(step, success, message):
    status = "✅ OK" if success else "❌ ERRORE"
    print(f"[{status}] {step}: {message}")

def check_server_health():
    url = f"{BASE_URL}/health"
    try:
        resp = requests.get(url, timeout=3)
        if resp.status_code == 200:
            print_result("1. Server attivo", True, "Il server risponde correttamente all'endpoint /health.")
            return True
        else:
            print_result("1. Server attivo", False, f"Risposta inattesa: status {resp.status_code}")
            return False
    except Exception as e:
        print_result("1. Server attivo", False, f"Errore di connessione: {e}")
        return False

def check_json_file(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print_result(f"2. Presenza file {filename}", False, f"File mancante: {path}")
        return False
    try:
        with open(path, "r", encoding="utf-8") as f:
            json.load(f)
        print_result(f"2. Lettura file {filename}", True, "File presente e leggibile.")
        return True
    except Exception as e:
        print_result(f"2. Lettura file {filename}", False, f"Errore di lettura/parsing: {e}")
        return False

def check_api(endpoint, query, step_desc):
    url = f"{BASE_URL}{endpoint}?q={query}"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code != 200:
            print_result(step_desc, False, f"Status code {resp.status_code} invece di 200.")
            return False
        try:
            data = resp.json()
        except Exception as e:
            print_result(step_desc, False, f"Risposta non in formato JSON: {e}")
            return False
        if not isinstance(data, list) or len(data) == 0:
            print_result(step_desc, False, "Risposta JSON vuota o non è un array.")
            return False
        print_result(step_desc, True, f"Risposta valida: {len(data)} risultati trovati.")
        return True
    except Exception as e:
        print_result(step_desc, False, f"Errore nella richiesta: {e}")
        return False

def main():
    print("=== Verifica backend Flask ===\n")

    all_ok = True

    # 1. Verifica server attivo
    if not check_server_health():
        all_ok = False

    # 2. Verifica file JSON
    if not check_json_file(DIAGNOSIS_FILE):
        all_ok = False
    if not check_json_file(DRUGS_FILE):
        all_ok = False

    # 3. Verifica endpoint /api/diagnosi
    if not check_api("/api/diagnosi", "carie", "3. Endpoint /api/diagnosi"):
        all_ok = False

    # 4. Verifica endpoint /api/farmaci
    if not check_api("/api/farmaci", "amoxi", "4. Endpoint /api/farmaci"):
        all_ok = False

    print("\n=== RISULTATO FINALE ===")
    if all_ok:
        print("✅ Tutti i controlli sono andati a buon fine!")
    else:
        print("❌ Alcuni controlli sono falliti. Verifica i messaggi sopra per i dettagli.")

if __name__ == "__main__":
    main()
