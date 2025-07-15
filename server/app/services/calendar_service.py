"""
Servizio centralizzato per la gestione del calendario.
Include:
- Autenticazione e interazione con Google Calendar
- Gestione degli appuntamenti dal DBF
- Sincronizzazione e utilità
"""
import logging
import os
import time
import dbf
from typing import List, Dict
from datetime import datetime, timedelta, time as dt_time
import json
import hashlib
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import Flow

from server.app.config.constants import COLONNE, DBF_TABLES, GOOGLE_COLOR_MAP
from server.app.core.mode_manager import get_mode
from server.app.utils.exceptions import GoogleCredentialsNotFoundError

logger = logging.getLogger(__name__)

# Costanti
TOKEN_FILE = 'server/token.json'
SCOPES = ['https://www.googleapis.com/auth/calendar']
SYNC_STATE_FILE = 'server/sync_state.json'

# Funzioni di utilità per Google Calendar
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

def _decimal_to_time(decimal_time):
    """Converte un orario decimale (es: 14.30) in oggetto time."""
    hours = int(decimal_time)
    minutes = int(round((decimal_time - hours) * 100))
    return dt_time(hours, minutes)

def _safe_to_time(val):
    """Converte un valore in time in modo sicuro."""
    if isinstance(val, dt_time):
        return val
    try:
        return _decimal_to_time(val)
    except Exception:
        return dt_time(8, 0)

def _get_google_color_id(tipo):
    """Ottiene l'ID del colore Google Calendar per un tipo di appuntamento."""
    return GOOGLE_COLOR_MAP.get(tipo, '1')

def _appointment_id(app):
    """Genera un ID univoco per un appuntamento."""
    return f"{app['DATA']}_{app['ORA_INIZIO']}_{app['STUDIO']}_{(app.get('PAZIENTE') or app.get('DESCRIZIONE') or '').replace(' ', '')}"

def _appointment_hash(app):
    """Genera un hash per verificare se un appuntamento è cambiato."""
    s = f"{app['DATA']}|{app['ORA_INIZIO']}|{app['ORA_FINE']}|{app['TIPO']}|{app['STUDIO']}|{app['NOTE']}|{app['DESCRIZIONE']}|{app['PAZIENTE']}"
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

def _load_sync_state():
    """Carica lo stato di sincronizzazione dal file."""
    try:
        with open(SYNC_STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_sync_state(state):
    """Salva lo stato di sincronizzazione su file."""
    with open(SYNC_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

# Servizio principale per la gestione del calendario
class CalendarService:
    """
    Servizio centralizzato per la gestione del calendario.
    Gestisce tutte le operazioni relative a Google Calendar e appuntamenti DBF.
    """

    @staticmethod
    def google_list_calendars():
        service = get_google_service()
        configured_ids_str = os.getenv("CONFIGURED_CALENDAR_IDS", "")
        configured_calendar_ids = {id.strip() for id in configured_ids_str.split(',') if id.strip()}
        all_calendars = service.calendarList().list().execute().get('items', [])
        relevant_calendars = [
            {"id": cal["id"], "name": cal["summary"]}
            for cal in all_calendars
            if cal["id"] in configured_calendar_ids
        ]
        logger.info(f"Trovati {len(relevant_calendars)} calendari pertinenti su {len(all_calendars)} accessibili.")
        return relevant_calendars

    @staticmethod
    def google_sync_appointments(calendar_id: str, start_date, end_date):
        # TODO: logica per sincronizzare eventi dal DB verso Google Calendar
        return {"message": f"Eventi sincronizzati su {calendar_id} da {start_date} a {end_date}"}

    @staticmethod
    def google_clear_calendar(calendar_id: str):
        logger.info(f"Avvio pulizia calendario per l'ID: {calendar_id}")
        service = get_google_service()
        deleted_count = 0
        page_token = None
        try:
            while True:
                events_result = service.events().list(
                    calendarId=calendar_id,
                    pageToken=page_token,
                    maxResults=2500
                ).execute()
                events = events_result.get('items', [])
                if not events:
                    logger.info(f"Nessun altro evento da cancellare per il calendario {calendar_id}.")
                    break
                logger.info(f"Trovati {len(events)} eventi in questo batch. Inizio cancellazione...")
                for event in events:
                    event_id = event['id']
                    try:
                        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
                        deleted_count += 1
                        time.sleep(0.05)
                    except HttpError as e:
                        if e.resp.status == 403 and 'rateLimitExceeded' in str(e.content):
                            logger.warning(f"Rate limit raggiunto. Attendo 5 secondi prima di riprovare l'evento {event_id}.")
                            time.sleep(5)
                            service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
                            deleted_count += 1
                        elif e.resp.status == 404:
                            logger.warning(f"Evento {event_id} non trovato (già cancellato?). Continuo.")
                        else:
                            logger.error(f"Errore HTTP non gestito durante la cancellazione dell'evento {event_id}: {e}")
                            continue
                page_token = events_result.get('nextPageToken')
                if not page_token:
                    break
            logger.info(f"Pulizia completata. Cancellati un totale di {deleted_count} eventi dal calendario {calendar_id}")
            return deleted_count
        except HttpError as e:
            if e.resp.status == 404:
                logger.error(f"Errore critico: Calendario con ID '{calendar_id}' non trovato.")
            elif e.resp.status == 403:
                logger.error(f"Errore critico: Permessi insufficienti per accedere o modificare il calendario '{calendar_id}'.")
            else:
                logger.error(f"Errore HTTP critico durante la pulizia del calendario {calendar_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Errore generico e imprevisto durante la pulizia del calendario {calendar_id}: {e}")
            raise

    @staticmethod
    def sync_appointments_for_month(month, year, studio_calendar_ids, appointments, progress_callback=None):
        service = get_google_service()
        sync_state = _load_sync_state()
        now = datetime.now().isoformat()
        current_ids = set()
        nuovi_o_modificati = 0
        total_processed = 0
        for app in appointments:
            app_id = _appointment_id(app)
            app_hash = _appointment_hash(app)
            current_ids.add(app_id)
            total_processed += 1
            if progress_callback:
                progress_callback(nuovi_o_modificati, len(appointments), f"Analisi appuntamenti... ({total_processed}/{len(appointments)})")
            if app_id in sync_state:
                if sync_state[app_id]['hash'] != app_hash:
                    try:
                        service.events().delete(calendarId=sync_state[app_id]['calendar_id'], eventId=sync_state[app_id]['event_id']).execute()
                        time.sleep(0.1)
                    except Exception as e:
                        logger.warning(f"Errore cancellazione evento modificato: {e}")
                    CalendarService._create_and_save_event_with_retry(service, app, studio_calendar_ids, sync_state, app_id, app_hash, now)
                    nuovi_o_modificati += 1
            else:
                CalendarService._create_and_save_event_with_retry(service, app, studio_calendar_ids, sync_state, app_id, app_hash, now)
                nuovi_o_modificati += 1
        to_delete = [app_id for app_id in sync_state if sync_state[app_id]['month']==month and sync_state[app_id]['year']==year and app_id not in current_ids]
        deleted_count = 0
        if progress_callback:
            progress_callback(nuovi_o_modificati, len(appointments), f"Pulizia appuntamenti rimossi... ({deleted_count}/{len(to_delete)})")
        for app_id in to_delete:
            try:
                service.events().delete(calendarId=sync_state[app_id]['calendar_id'], eventId=sync_state[app_id]['event_id']).execute()
                time.sleep(0.1)
                deleted_count += 1
                if progress_callback:
                    progress_callback(nuovi_o_modificati, len(appointments), f"Pulizia appuntamenti rimossi... ({deleted_count}/{len(to_delete)})")
            except Exception as e:
                logger.warning(f"Errore cancellazione evento rimosso: {e}")
            del sync_state[app_id]
        _save_sync_state(sync_state)
        if progress_callback:
            progress_callback(nuovi_o_modificati, len(appointments), "Sincronizzazione completata")
        if nuovi_o_modificati == 0 and len(to_delete) == 0:
            return {
                'total_processed': len(appointments),
                'success': 0,
                'deleted': 0,
                'message': 'Nessun nuovo appuntamento da sincronizzare.'
            }
        return {
            'total_processed': len(appointments),
            'success': nuovi_o_modificati,
            'deleted': len(to_delete),
            'message': f"Sync incrementale completata. {nuovi_o_modificati} inseriti/aggiornati, {len(to_delete)} cancellati."
        }

    @staticmethod
    def _create_and_save_event_with_retry(service, app, studio_calendar_ids, sync_state, app_id, app_hash, now):
        studio = int(app.get('STUDIO', 0))
        calendar_id = studio_calendar_ids[studio]
        data_evento = app['DATA']
        if isinstance(data_evento, str):
            data_evento = datetime.strptime(data_evento, "%Y-%m-%d").date()
        t_inizio = _safe_to_time(app.get('ORA_INIZIO'))
        t_fine = _safe_to_time(app.get('ORA_FINE'))
        dt_inizio = datetime.combine(data_evento, t_inizio)
        dt_fine = datetime.combine(data_evento, t_fine) if t_fine > t_inizio else dt_inizio + timedelta(minutes=10)
        summary = app.get('PAZIENTE') or app.get('DESCRIZIONE') or "Appuntamento"
        event = {
            'summary': summary.strip(),
            'description': app.get('NOTE', ''),
            'start': {
                'dateTime': dt_inizio.isoformat(),
                'timeZone': os.getenv('GOOGLE_TIMEZONE', 'Europe/Rome'),
            },
            'end': {
                'dateTime': dt_fine.isoformat(),
                'timeZone': os.getenv('GOOGLE_TIMEZONE', 'Europe/Rome'),
            },
            'colorId': _get_google_color_id(app.get('TIPO')),
            'reminders': {
                'useDefault': False
            }
        }
        max_retries = 5
        for attempt in range(max_retries):
            try:
                created = service.events().insert(calendarId=calendar_id, body=event).execute()
                time.sleep(0.1)
                sync_state[app_id] = {
                    'event_id': created['id'],
                    'calendar_id': calendar_id,
                    'hash': app_hash,
                    'month': dt_inizio.month,
                    'year': dt_inizio.year,
                    'last_sync': now
                }
                break
            except HttpError as e:
                if e.resp.status == 403 and 'rateLimitExceeded' in str(e.content):
                    logger.warning(f"Rate limit Google raggiunto. Attendo 5 secondi e riprovo (tentativo {attempt+1}/{max_retries})...")
                    time.sleep(5)
                else:
                    logger.error(f"Errore Google API durante creazione evento: {e}")
                    break
            except Exception as e:
                logger.error(f"Errore generico durante creazione evento: {e}")
                break

    @staticmethod
    def get_db_appointments_for_month(month: int, year: int):
        """
        Legge il DBF degli appuntamenti record per record e restituisce quelli del mese/anno specificato.
        Utilizza map_appointment per normalizzare i dati.
        """
        try:
            path_appuntamenti = _get_dbf_path('agenda')
            path_pazienti = _get_dbf_path('pazienti')
        except (ValueError, FileNotFoundError) as e:
            logger.error(f"Errore nel recuperare il percorso del DBF: {e}")
            raise e

        # 1. Carica i pazienti in un dizionario per un accesso rapido
        patients_dict = {}
        col_paz = COLONNE['pazienti']
        try:
            with dbf.Table(path_pazienti, codepage='cp1252') as pazienti_table:
                pazienti_count = 0
                for record in pazienti_table:
                    pazienti_count += 1
                    pid = str(record[col_paz['id']]).strip()
                    name = str(record[col_paz['nome']]).strip() if record[col_paz['nome']] else ''
                    if pid:
                        patients_dict[pid] = name
                logger.info(f"Letti {pazienti_count} pazienti, {len(patients_dict)} validi")
        except Exception as e:
            logger.error(f"Errore durante la lettura del DBF pazienti {path_pazienti}: {e}")
            raise IOError(f"Impossibile leggere il file dei pazienti.")

        # 2. Legge gli appuntamenti record per record e filtra
        appointments = []
        col_app = COLONNE['appuntamenti']
        try:
            with dbf.Table(path_appuntamenti, codepage='cp1252') as apps_table:
                apps_count = 0
                filtered_count = 0
                processed_count = 0
                
                for r in apps_table:
                    apps_count += 1
                    
                    # Controlla se la data è valida
                    if not r[col_app['data']]:
                        continue
                        
                    app_date = r[col_app['data']]
                    
                    # Filtra per mese/anno
                    if app_date.month != month or app_date.year != year:
                        continue
                        
                    filtered_count += 1
                    idpaz = str(r[col_app['id_paziente']]).strip()
                    
                    # Crea il record grezzo (come nel db_handler originale)
                    raw_appointment = {
                        'DATA': app_date,
                        'ORA_INIZIO': float(r[col_app['ora_inizio']] or 0),
                        'ORA_FINE': float(r[col_app['ora_fine']] or 0),
                        'TIPO': r[col_app['tipo']].strip() if r[col_app['tipo']] else '',
                        'STUDIO': r[col_app['studio']] or 1,
                        'NOTE': r[col_app['note']].strip() if r[col_app['note']] else '',
                        'DESCRIZIONE': r[col_app['descrizione']].strip() if r[col_app['descrizione']] else '',
                        'PAZIENTE': patients_dict.get(idpaz, '')
                    }
                    
                    # Applica il mapping con gestione errori
                    try:
                        mapped_app = map_appointment(raw_appointment)
                        processed_count += 1
                    except Exception as e:
                        logger.error(f"Errore in map_appointment per record {idpaz}: {e}")
                        # Usa il record raw se il mapping fallisce
                        mapped_app = raw_appointment
                    
                    # Converte le date per la serializzazione JSON
                    try:
                        if isinstance(mapped_app.get('DATA'), datetime):
                            mapped_app['DATA'] = mapped_app['DATA'].isoformat()
                        
                        # Gestione time objects per ora_inizio e ora_fine
                        if hasattr(mapped_app.get('ORA_INIZIO'), 'strftime'):
                            mapped_app['ORA_INIZIO'] = mapped_app['ORA_INIZIO'].strftime('%H:%M')
                        elif hasattr(mapped_app.get('ORA_INIZIO'), 'isoformat'):
                            mapped_app['ORA_INIZIO'] = mapped_app['ORA_INIZIO'].isoformat()
                        
                        if hasattr(mapped_app.get('ORA_FINE'), 'strftime'):
                            mapped_app['ORA_FINE'] = mapped_app['ORA_FINE'].strftime('%H:%M')
                        elif hasattr(mapped_app.get('ORA_FINE'), 'isoformat'):
                            mapped_app['ORA_FINE'] = mapped_app['ORA_FINE'].isoformat()
                            
                    except Exception as e:
                        logger.error(f"Errore conversione date per record {idpaz}: {e}")
                        # Continua comunque

                    appointments.append(mapped_app)

                logger.info(f"Letti {apps_count} appuntamenti totali, {filtered_count} filtrati, {processed_count} processati")

        except Exception as e:
            logger.error(f"Errore durante la lettura del DBF appuntamenti {path_appuntamenti}: {e}")
            raise IOError(f"Impossibile leggere il file degli appuntamenti.")
            
        logger.info(f"Trovati e processati {len(appointments)} appuntamenti per {month}/{year}")
        return appointments

    @staticmethod
    def get_db_appointments_stats_for_year():
        """
        Wrapper del servizio per recuperare statistiche annuali dal modulo dati.
        """
        return db_appuntamenti.get_appointments_stats_for_year()

    @staticmethod
    def get_db_appointments_count_by_range(start_date: str, end_date: str):
        """
        Wrapper del servizio per contare appuntamenti in un range dal modulo dati.
        """
        return db_appuntamenti.get_appointments_count_by_range(start_date, end_date)
    
    @staticmethod
    def get_google_oauth_url():
        """Genera l'URL di autorizzazione Google OAuth"""
        # Rimuovi il token esistente se presente
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
        
        flow = Flow.from_client_secrets_file(
            'server/credentials.json',  # Adatta il percorso se necessario
            scopes=SCOPES,
            redirect_uri='http://localhost:5000/api/calendar/oauth2callback'
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            prompt='select_account consent'
        )
        print(f"Generated auth URL: {auth_url}")  # Debug
        return auth_url
    
    @staticmethod
    def handle_oauth2_callback(authorization_response):
        """Gestisce il callback di autorizzazione Google"""
        flow = Flow.from_client_secrets_file(
            'server/credentials.json',  # Adatta il percorso se necessario
            scopes=SCOPES,
            redirect_uri='http://localhost:5000/api/calendar/oauth2callback'
        )
        
        flow.fetch_token(authorization_response=authorization_response)
        creds = flow.credentials
        
        # Salva le credenziali
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
        
        return True