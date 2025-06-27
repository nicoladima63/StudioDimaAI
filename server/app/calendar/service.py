# server/app/calendar/service.py
import logging
import os
from .utils import get_google_service

logger = logging.getLogger(__name__)

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
    Cancella tutti gli eventi da un calendario specifico.
    Questa è la logica migrata da GoogleCalendarSync.delete_all_events.
    """
    service = get_google_service() # Non richiede più user_id
    deleted_count = 0
    page_token = None

    while True:
        events_result = service.events().list(
            calendarId=calendar_id,
            pageToken=page_token
        ).execute()
        events = events_result.get('items', [])
        if not events:
            break
        for event in events:
            service.events().delete(calendarId=calendar_id, eventId=event['id']).execute()
            deleted_count += 1
        page_token = events_result.get('nextPageToken')
        if not page_token:
            break
    
    logger.info(f"Cancellati {deleted_count} eventi dal calendario {calendar_id}")
    return deleted_count
