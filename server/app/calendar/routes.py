# server/app/routes/calendar.py

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
import os
from app.extensions import db

# Placeholder per l'integrazione con Google Calendar
from .utils import (
    list_available_calendars,
    fetch_events,
    sync_appointments_to_calendar,
    clear_calendar_events
)

calendar_bp = Blueprint("calendar", __name__)
logger = logging.getLogger(__name__)

@calendar_bp.route("/list", methods=[GET])
@jwt_required()
def list_calendars():
    try:
        calendars = list_available_calendars()
        return jsonify(calendars), 200
    except Exception as e:
        logger.error(f"Errore nel recupero calendari: {e}")
        return jsonify({"message": "Errore durante il recupero dei calendari."}), 500

@calendar_bp.route("/events", methods=["GET"])
@jwt_required()
def get_events():
    calendar_id = request.args.get("calendarId")
    start = request.args.get("start")
    end = request.args.get("end")

    if not all([calendar_id, start, end]):
        return jsonify({"message": "calendarId, start e end sono obbligatori"}), 400

    try:
        events = fetch_events(calendar_id, start, end)
        return jsonify(events), 200
    except Exception as e:
        logger.error(f"Errore nel recupero eventi: {e}")
        return jsonify({"message": "Errore durante il recupero degli eventi."}), 500

@calendar_bp.route("/sync", methods=["POST"])
@jwt_required()
def sync_calendar():
    data = request.get_json()
    calendar_id = data.get("calendarId")
    start = data.get("start")
    end = data.get("end")

    if not all([calendar_id, start, end]):
        return jsonify({"message": "calendarId, start e end sono obbligatori"}), 400

    try:
        count = sync_appointments_to_calendar(calendar_id, start, end)
        return jsonify({"message": f"{count} eventi sincronizzati."}), 200
    except Exception as e:
        logger.error(f"Errore nella sincronizzazione: {e}")
        return jsonify({"message": "Errore durante la sincronizzazione."}), 500

@calendar_bp.route("/clear", methods=["DELETE"])
@jwt_required()
def clear_calendar():
    calendar_id = request.args.get("calendarId")

    if not calendar_id:
        return jsonify({"message": "calendarId obbligatorio"}), 400

    try:
        deleted = clear_calendar_events(calendar_id)
        return jsonify({"message": f"{deleted} eventi eliminati."}), 200
    except Exception as e:
        logger.error(f"Errore nella cancellazione eventi: {e}")
        return jsonify({"message": "Errore durante la cancellazione degli eventi."}), 500
