# server/app/calendar/service.py
import logging
import os
import time
from googleapiclient.errors import HttpError
from .utils import get_google_service
from ..core.db_handler import DBHandler
from ..config.constants import GOOGLE, GOOGLE_COLOR_MAP
from datetime import datetime, timedelta, time as dt_time
import json
import hashlib

logger = logging.getLogger(__name__)

SYNC_STATE_FILE = 'server/sync_state.json'

def google_list_calendars():
    """
    Recupera la lista dei calendari dall'account Google e restituisce
    solo quelli i cui ID sono specificati nella variabile d'ambiente
    CONFIGURED_CALENDAR_IDS (separati da virgola).
    """
    service = get_google_service()
    
    # Ottieni gli ID dei calendari desiderati dalla variabile d'ambiente
    configured_ids_str = os.getenv("CONFIGURED_CALENDAR_IDS", "")
    configured_calendar_ids = {id.strip() for id in configured_ids_str.split(',') if id.strip()}

    # Recupera tutti i calendari a cui l'account ha accesso
    all_calendars = service.calendarList().list().execute().get('items', [])
    
    # Filtra i calendari per mantenere solo quelli configurati
    # e formatta l'output
    relevant_calendars = [
        {"id": cal["id"], "name": cal["summary"]}
        for cal in all_calendars
        if cal["id"] in configured_calendar_ids
    ]
    
    logger.info(f"Trovati {len(relevant_calendars)} calendari pertinenti su {len(all_calendars)} accessibili.")
    return relevant_calendars

def google_sync_appointments(calendar_id: str, start_date, end_date):
    # TODO: logica per sincronizzare eventi dal DB verso Google Calendar
    # 1. Ottieni il servizio Google per l'utente
    # service = get_google_service() # Non richiede più user_id
    # 2. Recupera gli appuntamenti dal tuo DB locale
    # appointments = ...
    # 3. Itera e crea/aggiorna eventi usando service.events().insert/update()
    #    (ispirandoti a GoogleCalendarSync.sync_appointments_for_month)
    return {"message": f"Eventi sincronizzati su {calendar_id} da {start_date} a {end_date}"}

def google_clear_calendar(calendar_id: str):
    """
    Cancella tutti gli eventi da un calendario specifico, con gestione robusta degli errori.
    """
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
                    time.sleep(0.05)  # Pausa ridotta ma ancora presente per rate limit
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

def google_sync_appointments_for_month(month, year, studio_calendar_ids):
    """
    Sincronizza gli appuntamenti del mese/anno specificato sui calendari Google degli studi.
    studio_calendar_ids: dict {1: id_blu, 2: id_giallo}
    """
    service = get_google_service()
    db_handler = DBHandler()
    appointments = db_handler.get_appointments(month=month, year=year)

    appointments_by_studio = {}
    for app in appointments:
        studio = int(app.get('STUDIO', 0))
        if studio in studio_calendar_ids:
            appointments_by_studio.setdefault(studio, []).append(app)

    total = sum(len(a) for a in appointments_by_studio.values())
    success = errors = 0
    error_details = []

    for studio, apps in appointments_by_studio.items():
        calendar_id = studio_calendar_ids[studio]
        for app in apps:
            try:
                if not app.get('PAZIENTE'):
                    continue
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
                        'timeZone': GOOGLE['timezone'],
                    },
                    'end': {
                        'dateTime': dt_fine.isoformat(),
                        'timeZone': GOOGLE['timezone'],
                    },
                    'colorId': _get_google_color_id(app.get('TIPO')),
                    'reminders': {
                        'useDefault': False
                    }
                }
                service.events().insert(
                    calendarId=calendar_id,
                    body=event
                ).execute()
                success += 1
                time.sleep(0.1)  # Pausa per evitare rate limit
            except HttpError as error:
                logger.error(f"Errore Google API: {error}")
                errors += 1
                error_details.append(str(error))
            except Exception as e:
                logger.error(f"Errore generico: {e}")
                errors += 1
                error_details.append(str(e))
    return {
        'total': total,
        'success': success,
        'errors': errors,
        'error_details': error_details
    }

def _appointment_id(app):
    # Costruisce un identificativo unico per l'appuntamento
    return f"{app['DATA']}_{app['ORA_INIZIO']}_{app['STUDIO']}_{(app.get('PAZIENTE') or app.get('DESCRIZIONE') or '').replace(' ', '')}"

def _appointment_hash(app):
    # Calcola un hash dei dati rilevanti
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

def google_sync_appointments_incremental_for_month(month, year, studio_calendar_ids, progress_callback=None):
    service = get_google_service()
    db_handler = DBHandler()
    appointments = db_handler.get_appointments(month=month, year=year)
    sync_state = _load_sync_state()
    now = datetime.now().isoformat()

    # Costruisci mappa appuntamenti attuali
    current_ids = set()
    nuovi_o_modificati = 0
    total_processed = 0
    
    # Prima fase: analisi appuntamenti
    for app in appointments:
        app_id = _appointment_id(app)
        app_hash = _appointment_hash(app)
        current_ids.add(app_id)
        total_processed += 1
        
        if progress_callback:
            progress_callback(nuovi_o_modificati, len(appointments), f"Analisi appuntamenti... ({total_processed}/{len(appointments)})")
        
        if app_id in sync_state:
            # Se modificato, cancella vecchio evento e ricrea
            if sync_state[app_id]['hash'] != app_hash:
                try:
                    service.events().delete(calendarId=sync_state[app_id]['calendar_id'], eventId=sync_state[app_id]['event_id']).execute()
                    time.sleep(0.1)
                except Exception as e:
                    logger.warning(f"Errore cancellazione evento modificato: {e}")
                # Crea nuovo evento
                _create_and_save_event_with_retry(service, app, studio_calendar_ids, sync_state, app_id, app_hash, now)
                nuovi_o_modificati += 1
            # Se identico, non fare nulla
        else:
            # Nuovo appuntamento
            _create_and_save_event_with_retry(service, app, studio_calendar_ids, sync_state, app_id, app_hash, now)
            nuovi_o_modificati += 1

    # Seconda fase: cancellazione appuntamenti rimossi
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
            'timeZone': GOOGLE['timezone'],
        },
        'end': {
            'dateTime': dt_fine.isoformat(),
            'timeZone': GOOGLE['timezone'],
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
