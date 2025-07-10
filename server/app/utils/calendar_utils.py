import os
from typing import List, Dict
from datetime import datetime, time as dt_time
import logging
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import hashlib
import json
from server.app.config.constants import GOOGLE_COLOR_MAP
from server.app.utils.exceptions import GoogleCredentialsNotFoundError

logger = logging.getLogger(__name__)

TOKEN_FILE = 'server/token.json'
SCOPES = ['https://www.googleapis.com/auth/calendar']
SYNC_STATE_FILE = 'server/sync_state.json'


def get_google_service():
    """
    Costruisce e restituisce un oggetto servizio di Google Calendar autenticato
    caricando le credenziali dal file token.json.
    """
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(TOKEN_FILE, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                logger.error(f"Errore durante il refresh del token Google: {e}")
                raise GoogleCredentialsNotFoundError(
                    "Impossibile aggiornare le credenziali Google. "
                    f"Prova a cancellare il file '{TOKEN_FILE}' e a rieseguire lo script di autenticazione."
                ) from e
        else:
            raise GoogleCredentialsNotFoundError(
                f"Credenziali Google non trovate o non valide in '{TOKEN_FILE}'. "
                "Esegui lo script 'server/authenticate_google.py' per ottenere le credenziali."
            )
    return build('calendar', 'v3', credentials=creds)

# Funzioni di utilità per il calendario

def _decimal_to_time(decimal_time):
    hours = int(decimal_time)
    minutes = int(round((decimal_time - hours) * 100))
    return dt_time(hours, minutes)

def _safe_to_time(val):
    if isinstance(val, dt_time):
        return val
    try:
        return _decimal_to_time(val)
    except Exception:
        return dt_time(8, 0)

def _get_google_color_id(tipo):
    return GOOGLE_COLOR_MAP.get(tipo, '1')

def _appointment_id(app):
    return f"{app['DATA']}_{app['ORA_INIZIO']}_{app['STUDIO']}_{(app.get('PAZIENTE') or app.get('DESCRIZIONE') or '').replace(' ', '')}"

def _appointment_hash(app):
    s = f"{app['DATA']}|{app['ORA_INIZIO']}|{app['ORA_FINE']}|{app['TIPO']}|{app['STUDIO']}|{app['NOTE']}|{app['DESCRIZIONE']}|{app['PAZIENTE']}"
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

def _load_sync_state():
    try:
        with open(SYNC_STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_sync_state(state):
    with open(SYNC_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2) 