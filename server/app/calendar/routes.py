# server/app/calendar/routes.py

from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
import os
from datetime import datetime
from ..extensions import db
from ..core.db_handler import DBHandler
from .service import google_sync_appointments_incremental_for_month, google_list_calendars
from .controller import list_calendars as list_calendars_controller
from .controller import sync_appointments as sync_appointments_controller
from .controller import clear_calendar as clear_calendar_controller
from .exceptions import GoogleCredentialsNotFoundError
import threading
import uuid
import time
import pandas as pd
from server.app.config.constants import COLONNE

calendar_bp = Blueprint("calendar", __name__)
logger = logging.getLogger(__name__)

# Stato dei job di cancellazione in memoria
clear_jobs = {}

# Stato dei job di sincronizzazione in memoria
sync_jobs = {}

@calendar_bp.route("/list", methods=["GET"])
@jwt_required()
def list_calendars():
    try:
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
    month = data.get("month")
    year = data.get("year")
    if not (month and year):
        return jsonify({"message": "Fornire month e year"}), 400

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
            # Recupera i calendarId dei due studi
            calendars = google_list_calendars()
            studio_calendar_ids = {}
            for cal in calendars:
                if "blu" in cal["name"].lower():
                    studio_calendar_ids[1] = cal["id"]
                elif "giallo" in cal["name"].lower():
                    studio_calendar_ids[2] = cal["id"]

            if 1 not in studio_calendar_ids or 2 not in studio_calendar_ids:
                sync_jobs[job_id]["status"] = "error"
                sync_jobs[job_id]["error"] = "Non trovati entrambi i calendari Studio Blu e Studio Giallo"
                return

            # Funzione callback per aggiornare il progresso
            def update_sync_progress(synced, total, message=""):
                sync_jobs[job_id]["progress"] = int(100 * synced / max(1, total)) if total > 0 else 0
                sync_jobs[job_id]["synced"] = synced
                sync_jobs[job_id]["total"] = total
                if message:
                    sync_jobs[job_id]["message"] = message

            # Sincronizza
            result = google_sync_appointments_incremental_for_month(
                month=month,
                year=year,
                studio_calendar_ids=studio_calendar_ids,
                progress_callback=update_sync_progress
            )

            if result.get('success', 0) == 0 and result.get('deleted', 0) == 0:
                sync_jobs[job_id]["status"] = "completed"
                sync_jobs[job_id]["message"] = result['message']
                sync_jobs[job_id]["synced"] = 0
                sync_jobs[job_id]["total"] = 0
            else:
                sync_jobs[job_id]["status"] = "completed"
                sync_jobs[job_id]["message"] = result['message']
                sync_jobs[job_id]["synced"] = result.get('success', 0)
                sync_jobs[job_id]["total"] = result.get('total_processed', 0)

        except Exception as e:
            logger.error(f"Errore nella sincronizzazione: {e}")
            sync_jobs[job_id]["status"] = "error"
            sync_jobs[job_id]["error"] = str(e)

    thread = threading.Thread(target=sync_job)
    thread.start()

    return jsonify({"job_id": job_id}), 202

@calendar_bp.route("/sync_status", methods=["GET"])
@jwt_required()
def sync_status():
    job_id = request.args.get("job_id")
    if not job_id or job_id not in sync_jobs:
        return jsonify({"message": "Job non trovato"}), 404
    return jsonify(sync_jobs[job_id]), 200

@calendar_bp.route("/clear", methods=["POST"])
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
            # Recupera tutti gli eventi da cancellare
            deleted_count = 0
            total = 0
            try:
                deleted_count, total = clear_calendar_controller(calendar_id, progress_callback=lambda done, tot: update_progress(job_id, done, tot))
            except TypeError:
                # Se la funzione non supporta progress_callback, fallback
                deleted_count = clear_calendar_controller(calendar_id)
                total = deleted_count
            clear_jobs[job_id]["status"] = "completed"
            clear_jobs[job_id]["deleted"] = deleted_count
            clear_jobs[job_id]["total"] = total
        except Exception as e:
            clear_jobs[job_id]["status"] = "error"
            clear_jobs[job_id]["error"] = str(e)

    def update_progress(job_id, done, tot):
        clear_jobs[job_id]["progress"] = int(100 * done / max(1, tot))
        clear_jobs[job_id]["deleted"] = done
        clear_jobs[job_id]["total"] = tot

    thread = threading.Thread(target=clear_job)
    thread.start()

    return jsonify({"job_id": job_id}), 202

@calendar_bp.route("/clear_status", methods=["GET"])
@jwt_required()
def clear_status():
    job_id = request.args.get("job_id")
    if not job_id or job_id not in clear_jobs:
        return jsonify({"message": "Job non trovato"}), 404
    return jsonify(clear_jobs[job_id]), 200

@calendar_bp.route("/clear/<path:calendar_id>", methods=["DELETE"])
@jwt_required()
def clear_calendar(calendar_id: str):
    if not calendar_id:
        return jsonify({"message": "ID del calendario è obbligatorio"}), 400

    try:
        deleted_count = clear_calendar_controller(calendar_id)
        return jsonify({
            "message": f"Operazione completata. {deleted_count} eventi sono stati eliminati con successo.",
            "deleted_count": deleted_count
        }), 200
    except Exception as e:
        logger.error(f"Errore nella cancellazione degli eventi per il calendario {calendar_id}: {e}")
        return jsonify({"message": "Errore grave durante la cancellazione degli eventi."}), 500

@calendar_bp.route('/appointments', methods=['GET'])
@jwt_required()
def get_appointments_for_month():
    """Restituisce gli appuntamenti del mese richiesto dal DBF"""
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        logger.info(f"Richiesta appuntamenti per mese={month}, anno={year}")
        
        if not month or not year:
            logger.error("Parametri month e year mancanti")
            return jsonify({'error': 'month e year sono obbligatori'}), 400
        
        db_handler = DBHandler()
        logger.info(f"DBHandler inizializzato. Percorsi: {db_handler.path_appuntamenti}, {db_handler.path_anagrafica}")
        
        # Verifica esistenza file
        if not os.path.exists(db_handler.path_appuntamenti):
            logger.error(f"File appuntamenti non trovato: {db_handler.path_appuntamenti}")
            return jsonify({'error': f'File appuntamenti non trovato: {db_handler.path_appuntamenti}'}), 404
        if not os.path.exists(db_handler.path_anagrafica):
            logger.error(f"File anagrafica non trovato: {db_handler.path_anagrafica}")
            return jsonify({'error': f'File anagrafica non trovato: {db_handler.path_anagrafica}'}), 404
        
        logger.info("File DBF trovati, procedo con lettura appuntamenti...")
        appointments = db_handler.get_appointments(month=month, year=year)
        logger.info(f"Letti {len(appointments)} appuntamenti dal DBF")
        
        response = {'appointments': appointments}
        if getattr(db_handler, 'mode_changed', False):
            response['mode_changed'] = True
            response['mode_warning'] = 'Modalità cambiata automaticamente a SVILUPPO: rete studio non raggiungibile.'
        return jsonify(response)
    except Exception as e:
        logger.error(f"Errore in get_appointments_for_month: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@calendar_bp.route('/appointments/year', methods=['GET'])
@jwt_required()
def get_appointments_for_year():
    from datetime import datetime
    import pandas as pd
    db_handler = DBHandler()
    df = db_handler.leggi_tabella_dbf(db_handler.path_appuntamenti)
    # Usa la colonna corretta dal mapping
    col_data = COLONNE['appuntamenti']['data']
    if df.empty or col_data not in df.columns:
        anni = [datetime.now().year - i for i in range(2, -1, -1)]
        return jsonify({'success': True, 'data': {str(anno): [{'month': m, 'count': 0} for m in range(1, 13)] for anno in anni}})
    df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
    # Anni: corrente e due precedenti
    anno_corrente = datetime.now().year
    anni = [anno_corrente - i for i in range(2, -1, -1)]  # es: [2023, 2024, 2025]
    result = {}
    for anno in anni:
        df_anno = df[df[col_data].dt.year == anno]
        result[str(anno)] = []
        for month in range(1, 13):
            count = df_anno[df_anno[col_data].dt.month == month].shape[0]
            result[str(anno)].append({'month': month, 'count': int(count)})
    return jsonify({'success': True, 'data': result})