# server/app/routes/calendar.py

from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
import os
from ..extensions import db

# Placeholder per l'integrazione con Google Calendar
from .controller import list_calendars as list_calendars_controller
from .controller import sync_appointments as sync_appointments_controller
from .controller import clear_calendar as clear_calendar_controller
from .exceptions import GoogleCredentialsNotFoundError

calendar_bp = Blueprint("calendar", __name__)
logger = logging.getLogger(__name__)

@calendar_bp.route("/list", methods=["GET"])
@jwt_required()
def list_calendars():
    try:
        # L'identità dell'utente è verificata da @jwt_required(), ma non
        # serve più per recuperare le credenziali Google, che sono globali.
        calendars = list_calendars_controller()
        return jsonify(calendars), 200
    except GoogleCredentialsNotFoundError:
        logger.warning(f"Tentativo di accesso fallito: credenziali Google globali non configurate.")
        return jsonify({
            "message": "Credenziali Google per lo studio non trovate. IMPORTANTE: assicurarsi di essere loggati nell'account Google corretto (studiodrnicoladimartino@gmail.com) prima di procedere con l'autorizzazione.",
            "error_code": "GLOBAL_GOOGLE_AUTH_REQUIRED",
            "authorization_url": url_for('auth_google.login', _external=True)
        }), 401
    except Exception as e:
        logger.error(f"Errore nel recupero calendari: {e}")
        return jsonify({"message": "Errore durante il recupero dei calendari."}), 500

@calendar_bp.route("/events", methods=["GET"])
@jwt_required()
def get_events():
    return jsonify({"message": "Not implemented"}), 501

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
        count = sync_appointments_controller(calendar_id, start, end)
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
        deleted = clear_calendar_controller(calendar_id)
        return jsonify({"message": f"{deleted} eventi eliminati."}), 200
    except Exception as e:
        logger.error(f"Errore nella cancellazione eventi: {e}")
        return jsonify({"message": "Errore durante la cancellazione degli eventi."}), 500
