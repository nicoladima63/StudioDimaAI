from flask import Blueprint, request, jsonify, url_for, redirect
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
import uuid
import threading
from server.app.services.calendar_service import CalendarService
from server.app.calendar.utils import GoogleCredentialsNotFoundError

calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')
logger = logging.getLogger(__name__)

# Stato dei job di cancellazione e sync in memoria
clear_jobs = {}
sync_jobs = {}

@calendar_bp.route('/list', methods=['GET'])
@jwt_required()
def list_calendars():
    try:
        calendars = CalendarService.google_list_calendars()
        return jsonify(calendars), 200
    except GoogleCredentialsNotFoundError:
        logger.warning(f"Tentativo di accesso fallito: credenziali Google globali non configurate.")
        return jsonify({
            "message": "Credenziali Google per lo studio non trovate. IMPORTANTE: assicurarsi di essere loggati nell'account Google corretto prima di procedere con l'autorizzazione.",
            "error_code": "GLOBAL_GOOGLE_AUTH_REQUIRED",
            "authorization_url": url_for('auth.login', _external=True)
        }), 401
    except Exception as e:
        logger.error(f"Errore nel recupero calendari: {e}")
        return jsonify({"message": "Errore durante il recupero dei calendari."}), 500

@calendar_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync_calendar():
    data = request.get_json()
    month = data.get("month")
    year = data.get("year")
    if not (month and year):
        return jsonify({"message": "Fornire mese e anno"}), 400
    job_id = str(uuid.uuid4())
    sync_jobs[job_id] = {
        "status": "in_progress",
        "progress": 0,
        "synced": 0,
        "total": 0,
        "message": "",
        "error": None
    }
    def sync_job():
        try:
            result = CalendarService.sync_appointments_for_month(month, year, sync_jobs, job_id)
            sync_jobs[job_id].update(result)
            sync_jobs[job_id]["status"] = "completed"
        except Exception as e:
            logger.error(f"Errore nella sincronizzazione: {e}")
            sync_jobs[job_id]["status"] = "error"
            sync_jobs[job_id]["error"] = str(e)
    thread = threading.Thread(target=sync_job)
    thread.start()
    return jsonify({"job_id": job_id}), 202

@calendar_bp.route('/sync_status', methods=['GET'])
@jwt_required()
def sync_status():
    job_id = request.args.get("job_id")
    if not job_id or job_id not in sync_jobs:
        return jsonify({"message": "Job non trovato"}), 404
    return jsonify(sync_jobs[job_id]), 200

@calendar_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_calendar_post():
    data = request.get_json()
    calendar_id = data.get("calendarId")
    if not calendar_id:
        return jsonify({"message": "calendarId è obbligatorio nel body"}), 400
    job_id = str(uuid.uuid4())
    clear_jobs[job_id] = {
        "status": "in_progress",
        "progress": 0,
        "deleted": 0,
        "total": 0,
        "error": None
    }
    def clear_job():
        try:
            deleted_count = CalendarService.clear_calendar(calendar_id, clear_jobs, job_id)
            clear_jobs[job_id]["deleted"] = deleted_count
            clear_jobs[job_id]["status"] = "completed"
        except Exception as e:
            clear_jobs[job_id]["status"] = "error"
            clear_jobs[job_id]["error"] = str(e)
    thread = threading.Thread(target=clear_job)
    thread.start()
    return jsonify({"job_id": job_id}), 202

@calendar_bp.route('/clear_status', methods=['GET'])
@jwt_required()
def clear_status():
    job_id = request.args.get("job_id")
    if not job_id or job_id not in clear_jobs:
        return jsonify({"message": "Job non trovato"}), 404
    return jsonify(clear_jobs[job_id]), 200

@calendar_bp.route('/clear/<path:calendar_id>', methods=['DELETE'])
@jwt_required()
def clear_calendar(calendar_id: str):
    if not calendar_id:
        return jsonify({"message": "ID del calendario è obbligatorio"}), 400
    try:
        deleted_count = CalendarService.clear_calendar(calendar_id)
        return jsonify({
            "message": f"Operazione completata. {deleted_count} eventi sono stati eliminati con successo.",
            "deleted": deleted_count
        }), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# (Altri endpoint come appointments, reauth-url, oauth2callback possono essere aggiunti qui con la stessa logica) 