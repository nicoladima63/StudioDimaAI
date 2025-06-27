# server/app/calendar/service.py

def google_list_calendars():
    # TODO: collegare al modulo che elenca i calendari
    return [
        {"id": "calendar1_id", "name": "Calendario Studio"},
        {"id": "calendar2_id", "name": "Calendario Personale"},
    ]

def google_sync_appointments(calendar_id, start_date, end_date):
    # TODO: logica per sincronizzare eventi dal DB verso Google Calendar
    return {"message": f"Eventi sincronizzati su {calendar_id} da {start_date} a {end_date}"}

def google_clear_calendar(calendar_id):
    # TODO: cancella eventi Google Calendar associati
    return {"message": f"Eventi cancellati da {calendar_id}"}
