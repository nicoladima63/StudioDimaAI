# app/core/calendar_utils.py

import os
from typing import List, Dict
from datetime import datetime
import logging
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from os import getenv
from .exceptions import GoogleCredentialsNotFoundError

logger = logging.getLogger(__name__)

TOKEN_FILE = 'server/token.json'
SCOPES = ['https://www.googleapis.com/auth/calendar']


def get_google_service():
    """
    Costruisce e restituisce un oggetto servizio di Google Calendar autenticato
    caricando le credenziali dal file token.json.
    """
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # Se non ci sono credenziali valide, solleva un'eccezione.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Salva le credenziali aggiornate nel file token.json
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

