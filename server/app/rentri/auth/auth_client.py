"""
Modulo per autenticazione automatica alle API RENTRI (modalità semplificata OAuth2).
Gestisce caching del token, logging e rinnovo automatico.
"""
import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
import requests
from dotenv import load_dotenv

# Setup logging
LOG_PATH = Path(__file__).parent.parent / 'logs' / 'auth.log'
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.ERROR,
    format='%(asctime)s %(levelname)s %(message)s'
)

# Percorso file token
TOKEN_PATH = Path(__file__).parent.parent / 'token.json'

# Carica variabili d'ambiente
load_dotenv()
CLIENT_ID = os.getenv('RENTRI_CLIENT_ID')
CLIENT_SECRET = os.getenv('RENTRI_CLIENT_SECRET')
TOKEN_URL = os.getenv('RENTRI_TOKEN_URL')


def get_token():
    """
    Restituisce un token OAuth2 valido per le API RENTRI.
    Usa caching su file token.json, rinnova se scaduto.
    """
    # Se esiste un token valido, usalo
    if TOKEN_PATH.exists():
        try:
            with open(TOKEN_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            expires_at = datetime.fromisoformat(data['expires_at'])
            if datetime.utcnow() < expires_at:
                return data['access_token']
        except Exception as e:
            logging.error(f"Errore lettura token.json: {e}")
    # Altrimenti richiedi nuovo token
    try:
        resp = requests.post(
            TOKEN_URL,
            data={
                'grant_type': 'client_credentials',
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET
            },
            timeout=10
        )
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data['access_token']
        expires_in = int(token_data.get('expires_in', 3600))
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)  # margine sicurezza
        # Salva su file
        with open(TOKEN_PATH, 'w', encoding='utf-8') as f:
            json.dump({
                'access_token': access_token,
                'expires_at': expires_at.isoformat()
            }, f, ensure_ascii=False, indent=2)
        return access_token
    except Exception as e:
        logging.error(f"Errore richiesta token RENTRI: {e}")
        raise RuntimeError(f"Impossibile ottenere token RENTRI: {e}")

def get_auth_headers():
    """
    Restituisce headers per autenticazione Bearer RENTRI.
    """
    token = get_token()
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

if __name__ == "__main__":
    try:
        token = get_token()
        print(f"Token valido: {token}\n")
        headers = get_auth_headers()
        print("Headers per autenticazione:")
        for k, v in headers.items():
            print(f"{k}: {v}")
    except Exception as e:
        print(f"[ERRORE] {e}")
