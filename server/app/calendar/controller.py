# server/app/calendar/controller.py

from .service import google_list_calendars, google_sync_appointments, google_clear_calendar

def list_calendars():
    return google_list_calendars()

def sync_appointments(calendar_id, start, end):
    return google_sync_appointments(calendar_id, start, end)

def clear_calendar(calendar_id):
    return google_clear_calendar(calendar_id)
