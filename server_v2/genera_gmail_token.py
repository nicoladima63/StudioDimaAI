"""
Script one-shot per generare gmail_token.json.
Eseguire UNA VOLTA sul server (richiede browser aperto sulla macchina server).

Uso:
    cd server_v2
    python genera_gmail_token.py
"""
import sys
from pathlib import Path

# Assicura che i moduli del progetto siano nel path
sys.path.insert(0, str(Path(__file__).parent))

from google_auth_oauthlib.flow import InstalledAppFlow
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_PATH = Path(__file__).parent / "instance" / "credentials.json"
TOKEN_PATH = Path(__file__).parent / "instance" / "gmail_token.json"

if not CREDENTIALS_PATH.exists():
    print(f"ERRORE: {CREDENTIALS_PATH} non trovato")
    sys.exit(1)

print("Avvio flusso OAuth locale...")
print("Si aprira' il browser. Esegui il login con studiodrnicoladimartino@gmail.com")
print()

flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
creds = flow.run_local_server(port=0, open_browser=True)

TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
TOKEN_PATH.write_text(creds.to_json())

print(f"\nToken salvato in: {TOKEN_PATH}")
print("Ora riavvia il server Flask.")
