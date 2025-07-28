"""
API per la gestione unificata degli appuntamenti.
Include:
- Lettura e statistiche appuntamenti dal DBF
- Sincronizzazione con Google Calendar
- Report e analisi
"""

from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import jwt_required
from server.app.services.calendar_service import CalendarService
from datetime import date
import logging

logger = logging.getLogger(__name__)

calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')
sync_jobs = {}
clear_jobs = {}

# Sezione 1: Route per statistiche e report appuntamenti
@calendar_bp.route('/stats/year', methods=['GET'])
@jwt_required()
def get_appointments_stats_for_year():
    """Restituisce le statistiche degli appuntamenti per anno/mese."""
    try:
        stats = CalendarService.get_db_appointments_stats_for_year()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        logger.error(f"Errore in get_appointments_stats_for_year: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@calendar_bp.route('/stats/range', methods=['GET'])
@jwt_required()
def get_appointments_by_range():
    """Restituisce il conteggio degli appuntamenti in un range di date."""
    start_str = request.args.get('start')
    end_str = request.args.get('end')
    
    if not start_str or not end_str:
        return jsonify({
            'success': False, 
            'error': 'Parametri start e end obbligatori (formato: DD/MM/YYYY)'
        }), 400

    try:
        from server.app.core import db_calendar
        count = db_calendar.get_appointments_count_by_range(start_str, end_str)
        return jsonify({'success': True, 'count': count})
    except ValueError as e:
        logger.error(f"Errore nel formato delle date: {str(e)}")
        return jsonify({
            'success': False, 
            'error': f'Formato date non valido. Usa DD/MM/YYYY: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f"Errore in get_appointments_by_range: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500
    
@calendar_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_appointments_stats():
    """Restituisce statistiche per mese precedente, corrente e successivo."""
    try:
        oggi = date.today()
        mese_corrente = oggi.month
        anno_corrente = oggi.year

        # Mese precedente
        mese_precedente = 12 if mese_corrente == 1 else mese_corrente - 1
        anno_precedente = anno_corrente - 1 if mese_corrente == 1 else anno_corrente

        # Mese prossimo
        mese_prossimo = 1 if mese_corrente == 12 else mese_corrente + 1
        anno_prossimo = anno_corrente + 1 if mese_corrente == 12 else anno_corrente

        # Recupera dati
        app_mese_precedente = CalendarService.get_db_appointments_for_month(mese_precedente, anno_precedente)
        app_mese_corrente = CalendarService.get_db_appointments_for_month(mese_corrente, anno_corrente)
        app_mese_prossimo = CalendarService.get_db_appointments_for_month(mese_prossimo, anno_prossimo)

        return jsonify({'success': True, 'data': {
            'mese_precedente': len(app_mese_precedente),
            'mese_corrente': len(app_mese_corrente),
            'mese_prossimo': len(app_mese_prossimo),
        }})
    except Exception as e:
        logger.error(f"Errore in get_appointments_stats: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@calendar_bp.route('/stats/first-visits', methods=['GET'])
@jwt_required()
def get_first_visits_stats():
    """Statistiche prime visite del mese corrente."""
    try:
        oggi = date.today()
        appuntamenti_mese_corrente = CalendarService.get_db_appointments_for_month(oggi.month, oggi.year)
        
        # TODO: Implementare logica specifica per le "prime visite"
        count_nuove_visite = len(appuntamenti_mese_corrente)

        return jsonify({'success': True, 'data': {'nuove_visite': count_nuove_visite}}), 200
    except Exception as e:
        logger.error(f"Errore in get_first_visits_stats: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

# Sezione 2: Route per Google Calendar
@calendar_bp.route('/list', methods=['GET'])
@jwt_required()
def list_calendars():
    """Lista dei calendari Google disponibili."""
    try:
        calendars = CalendarService.google_list_calendars()
        return jsonify({"success": True, "calendars": calendars}), 200
    except Exception as e:
        from server.app.utils.exceptions import GoogleCredentialsNotFoundError
        logger.error(f"Errore in list_calendars: {str(e)}", exc_info=True)
        
        if isinstance(e, GoogleCredentialsNotFoundError):
            return jsonify({
                "success": False,
                "error": "google_auth_required",
                "message": "Autenticazione Google richiesta. Script automatico eseguito.",
                "action_required": "Riprova la richiesta tra qualche secondo"
            }), 401
        else:
            return jsonify({
                "success": False,
                "error": "server_error", 
                "message": str(e)
            }), 500

@calendar_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync_calendar():
    """Sincronizza gli appuntamenti con Google Calendar."""
    data = request.get_json()
    calendar_id = data.get("calendar_id")
    month = data.get("month")
    year = data.get("year")
    studio_id = data.get("studio_id")  # Nuovo parametro
    
    if not (calendar_id and month and year and studio_id):
        return jsonify({"error": "calendar_id, month, year e studio_id sono obbligatori."}), 400

    # Genera un job_id per il sistema asincrono
    import uuid
    job_id = str(uuid.uuid4())
    
    # Dizionario per i job (aggiungilo in cima al file se non c'è)
    if 'sync_jobs' not in globals():
        global sync_jobs
        sync_jobs = {}
    
    sync_jobs[job_id] = {
        "status": "in_progress",
        "progress": 0,
        "synced": 0,
        "total": 0,
        "message": "Avvio sincronizzazione...",
        "error": None,
        "cancelled": False
    }

    def sync_job():
        try:
            logger.info(f"Inizio sync job per studio {studio_id}, mese {month}/{year} su calendario {calendar_id}")
            
            # Recupera gli appuntamenti
            appointments = CalendarService.get_db_appointments_for_month(month, year)
            logger.info(f"Recuperati {len(appointments)} appuntamenti totali")
            
            # Filtra per studio
            filtered_appointments = [app for app in appointments if int(app.get('STUDIO', 0)) == int(studio_id)]
            logger.info(f"Filtrati {len(filtered_appointments)} appuntamenti per studio {studio_id}")
            
            # Usa il calendar_id ricevuto dal frontend solo per lo studio specifico
            studio_calendar_ids = {int(studio_id): calendar_id}
            
            logger.info(f"Mappatura studi: {studio_calendar_ids}")

            # Funzione callback per aggiornare il progresso
            def update_sync_progress(synced, total, message=""):
                # Controlla se il job è stato cancellato
                if sync_jobs[job_id]["cancelled"]:
                    raise Exception("Sincronizzazione interrotta dall'utente")
                    
                logger.info(f"Progresso sync: {synced}/{total} - {message}")
                sync_jobs[job_id]["progress"] = int(100 * synced / max(1, total)) if total > 0 else 0
                sync_jobs[job_id]["synced"] = synced
                sync_jobs[job_id]["total"] = total
                if message:
                    sync_jobs[job_id]["message"] = message

            logger.info("Avvio sincronizzazione...")
            # Esegui la sincronizzazione con gli appuntamenti filtrati
            result = CalendarService.sync_appointments_for_month(
                month, 
                year, 
                studio_calendar_ids, 
                filtered_appointments,
                progress_callback=update_sync_progress
            )
            
            logger.info(f"Sincronizzazione completata: {result}")

            # Aggiorna lo stato finale
            sync_jobs[job_id]["status"] = "completed"
            sync_jobs[job_id]["message"] = result.get('message', 'Sincronizzazione completata')
            sync_jobs[job_id]["synced"] = result.get('success', 0)
            sync_jobs[job_id]["total"] = result.get('total_processed', 0)
            sync_jobs[job_id]["progress"] = 100

        except Exception as e:
            if "interrotta dall'utente" in str(e):
                logger.info(f"Sincronizzazione cancellata dall'utente: {e}")
                sync_jobs[job_id]["status"] = "cancelled"
                sync_jobs[job_id]["message"] = "Sincronizzazione interrotta dall'utente"
            else:
                logger.error(f"Errore nella sincronizzazione: {e}", exc_info=True)
                sync_jobs[job_id]["status"] = "error"
                sync_jobs[job_id]["error"] = str(e)
                sync_jobs[job_id]["message"] = f"Errore: {str(e)}"

    # Avvia il thread asincrono
    import threading
    thread = threading.Thread(target=sync_job)
    thread.start()

    return jsonify({"job_id": job_id}), 202

@calendar_bp.route('/sync-status', methods=['GET'])
@jwt_required()
def sync_status():
    """Controlla lo stato di una sincronizzazione in corso."""
    job_id = request.args.get("jobId")
    logger.info(f"Richiesta stato per job: {job_id}")
    
    if not job_id:
        return jsonify({"error": "jobId è obbligatorio"}), 400
    
    if job_id not in sync_jobs:
        logger.warning(f"Job {job_id} non trovato. Jobs disponibili: {list(sync_jobs.keys())}")
        return jsonify({"error": "Job non trovato"}), 404
    
    status = sync_jobs[job_id]
    logger.info(f"Status job {job_id}: {status}")
    return jsonify(status), 200

@calendar_bp.route('/sync/cancel', methods=['POST'])
@jwt_required()
def cancel_sync_job():
    """Cancella un job di sincronizzazione in corso."""
    data = request.get_json()
    job_id = data.get("job_id")
    
    if not job_id:
        return jsonify({"error": "job_id è obbligatorio"}), 400
    
    if job_id not in sync_jobs:
        return jsonify({"error": "Job non trovato"}), 404
    
    # Marca il job come cancellato
    if sync_jobs[job_id]["status"] == "in_progress":
        sync_jobs[job_id]["cancelled"] = True
        logger.info(f"Job {job_id} marcato per cancellazione")
        return jsonify({"message": "Job cancellato con successo"}), 200
    else:
        return jsonify({"error": "Il job non è in corso"}), 400

@calendar_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_calendar_sync():
    """Cancella tutti gli eventi da un calendario Google (sincrono)."""
    data = request.get_json()
    calendar_id = data.get("calendar_id")
    
    if not calendar_id:
        return jsonify({"error": "calendar_id è obbligatorio"}), 400

    try:
        # Usa il metodo del CalendarService
        deleted_count = CalendarService.google_clear_calendar(calendar_id)
        
        return jsonify({
            "message": f"Cancellati {deleted_count} eventi dal calendario",
            "deleted_count": deleted_count
        }), 200
        
    except Exception as e:
        logger.error(f"Errore nella cancellazione del calendario {calendar_id}: {e}")
        return jsonify({"error": str(e)}), 500


@calendar_bp.route('/clear/<path:calendar_id>', methods=['DELETE'])
@jwt_required()
def clear_calendar(calendar_id: str):
    """Cancella tutti gli eventi da un calendario Google."""
    try:
        result = CalendarService.google_clear_calendar(calendar_id)
        return jsonify(result), 200
    except ValueError as e:
        # Eccezioni con messaggi user-friendly
        return jsonify({
            "message": str(e),
            "error": True,
            "deleted_count": 0
        }), 400
    except Exception as e:
        logger.error(f"Errore imprevisto nella cancellazione del calendario {calendar_id}: {e}", exc_info=True)
        return jsonify({
            "message": "Si è verificato un errore durante la cancellazione. Riprova più tardi o contatta l'assistenza.",
            "error": True,
            "deleted_count": 0
        }), 500

@calendar_bp.route('/clear-status', methods=['GET'])
@jwt_required()
def clear_status():
    """Controlla lo stato di una pulizia calendario in corso."""
    job_id = request.args.get("job_id")
    if not job_id:
        return jsonify({"error": "job_id è obbligatorio"}), 400
    try:
        status = CalendarService.get_clear_status(job_id)
        return jsonify(status), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/reauth-url', methods=['GET'])
@jwt_required()
def get_google_oauth_url():
    """Genera l'URL di riautorizzazione Google."""
    try:
        auth_url = CalendarService.get_google_oauth_url()
        return jsonify({"auth_url": auth_url})
    except Exception as e:
        logger.error(f"Errore nella generazione dell'URL OAuth: {e}")
        return jsonify({"error": str(e)}), 500



@calendar_bp.route('/appointments', methods=['GET'])
@jwt_required()
def get_appointments_for_month():
    """Restituisce gli appuntamenti del mese richiesto dal DBF, filtrati per studio se specificato"""
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        # Nuovo parametro per filtrare per studio
        studio = request.args.get('studio', type=int)
        
        logger.info(f"Richiesta appuntamenti per mese={month}, anno={year}, studio={studio}")
        
        if not month or not year:
            logger.error("Parametri month e year mancanti")
            return jsonify({'error': 'month e year sono obbligatori'}), 400
        
        # Usa la funzione dal modulo db_calendar
        from server.app.core import db_calendar
        appointments = db_calendar._get_appointments_for_month(month, year)
        
        # Filtra per studio se specificato
        if studio is not None:
            appointments = [app for app in appointments if int(app.get('STUDIO', 0)) == studio]
            logger.info(f"Filtrati {len(appointments)} appuntamenti per studio {studio}")
        
        # Cambia il nome degli appuntamenti alle 8:00 da "Appuntamento" a "Nota giornaliera"
        for app in appointments:
            ora_inizio = app.get('ORA_INIZIO')
            # Verifica se è un appuntamento alle 8:00
            is_eight_am = False
            if isinstance(ora_inizio, str) and ora_inizio.startswith("8:") or ora_inizio == "8.0" or ora_inizio == "08:00":
                is_eight_am = True
            elif isinstance(ora_inizio, (int, float)) and (ora_inizio == 8 or ora_inizio == 8.0):
                is_eight_am = True
                
            # Se è alle 8:00 e ha come contenuto "Appuntamento", cambialo in "Nota giornaliera"
            if is_eight_am:
                if app.get('PAZIENTE') == "Appuntamento" or app.get('PAZIENTE') == "":
                    app['PAZIENTE'] = "Nota giornaliera"
                if app.get('DESCRIZIONE') == "Appuntamento" or app.get('DESCRIZIONE') == "":
                    app['DESCRIZIONE'] = "Nota giornaliera"
        
        logger.info(f"Restituiti {len(appointments)} appuntamenti")
        
        response = {'appointments': appointments}
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Errore in get_appointments_for_month: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@calendar_bp.route('/appointments/legacy', methods=['GET'])
@jwt_required()
def get_appointments_for_month_legacy():
    """Restituisce gli appuntamenti del mese richiesto dal DBF"""
    try:
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        logger.info(f"Richiesta appuntamenti per mese={month}, anno={year}")
        
        if not month or not year:
            logger.error("Parametri month e year mancanti")
            return jsonify({'error': 'month e year sono obbligatori'}), 400
        
        # Usa la nuova funzione dal modulo db_calendar
        from server.app.core import db_calendar  # o il path corretto
        appointments = db_calendar._get_appointments_for_month(month, year)
        
        logger.info(f"Letti {len(appointments)} appuntamenti dal DBF")
        
        response = {'appointments': appointments}
        # Note: la logica del mode_changed non è più presente nella nuova versione
        # Se serve, dovrai implementarla separatamente
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Errore in get_appointments_for_month: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@calendar_bp.route('/appointments/year', methods=['GET'])
@jwt_required()
def get_appointments_for_year():
    """Restituisce statistiche appuntamenti per anno"""
    try:
        from server.app.core import db_calendar  # o il path corretto
        data = db_calendar.get_appointments_stats_for_year()
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Errore in get_appointments_for_year: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500
    
@calendar_bp.route('/test-time-conversion', methods=['GET'])
def test_time_conversion():
    """Test temporaneo per la conversione degli orari."""
    try:
        CalendarService.test_time_conversion()
        return jsonify({"message": "Test completato, controlla i log del server"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/test-deleted-filter', methods=['GET'])
def test_deleted_filter():
    """Test per verificare il filtro dei record cancellati."""
    month = request.args.get('month', type=int, default=7)  # Default luglio
    year = request.args.get('year', type=int, default=2025)  # Default 2025
    
    try:
        result = CalendarService.test_deleted_filter(month, year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/clear-all/start', methods=['POST'])
@jwt_required()
def start_clear_all():
    """Avvia job di cancellazione di tutti i calendari con tracking real-time"""
    import uuid
    import threading
    
    if 'clear_jobs' not in globals():
        global clear_jobs
        clear_jobs = {}
    
    job_id = str(uuid.uuid4())
    
    clear_jobs[job_id] = {
        "status": "in_progress",
        "progress": 0,
        "deleted": 0,
        "total_calendars": 2,
        "current_calendar": "",
        "message": "Avvio cancellazione...",
        "results": []
    }
    
    def clear_job():
        from server.app.core.automation_config import get_automation_settings
        try:
            settings = get_automation_settings()
            studio_blu_calendar = settings.get('calendar_studio_blu_id')
            studio_giallo_calendar = settings.get('calendar_studio_giallo_id')
            
            calendars = [
                {"id": studio_blu_calendar, "name": "Studio Blu"},
                {"id": studio_giallo_calendar, "name": "Studio Giallo"}
            ]
            
            total_deleted = 0
            
            for i, calendar in enumerate(calendars):
                if clear_jobs[job_id].get("cancelled"):
                    raise Exception("Cancellazione interrotta dall'utente")
                
                clear_jobs[job_id]["current_calendar"] = calendar["name"]
                clear_jobs[job_id]["message"] = f"Cancellazione {calendar['name']}..."
                clear_jobs[job_id]["progress"] = int(50 * i / len(calendars))
                
                try:
                    result = CalendarService.google_clear_calendar(calendar["id"])
                    deleted_count = result.get("deleted_count", 0)
                    total_deleted += deleted_count
                    
                    clear_jobs[job_id]["results"].append({
                        "studio": calendar["name"],
                        "success": True,
                        "deleted_count": deleted_count,
                        "message": result.get("message", "")
                    })
                    
                except Exception as e:
                    clear_jobs[job_id]["results"].append({
                        "studio": calendar["name"],
                        "success": False,
                        "error": str(e)
                    })
            
            clear_jobs[job_id]["status"] = "completed"
            clear_jobs[job_id]["deleted"] = total_deleted
            clear_jobs[job_id]["progress"] = 100
            clear_jobs[job_id]["message"] = f"Cancellazione completata. {total_deleted} eventi rimossi totali."
            
        except Exception as e:
            if "interrotta dall'utente" in str(e):
                clear_jobs[job_id]["status"] = "cancelled"
                clear_jobs[job_id]["message"] = "Cancellazione interrotta dall'utente"
            else:
                clear_jobs[job_id]["status"] = "error"
                clear_jobs[job_id]["error"] = str(e)
                clear_jobs[job_id]["message"] = f"Errore: {str(e)}"
    
    # Avvia il thread asincrono
    thread = threading.Thread(target=clear_job)
    thread.start()
    
    return jsonify({"job_id": job_id, "status": "started"}), 200

@calendar_bp.route('/clear-all/status/<job_id>', methods=['GET'])
@jwt_required()
def get_clear_status(job_id):
    """Ottiene lo stato del job di cancellazione"""
    if job_id not in clear_jobs:
        return jsonify({"error": "Job non trovato"}), 404
    
    status = clear_jobs[job_id]
    return jsonify(status), 200

@calendar_bp.route('/clear-all/cancel', methods=['POST'])
@jwt_required()
def cancel_clear():
    """Cancella il job di cancellazione in corso"""
    data = request.get_json() or {}
    job_id = data.get('job_id')
    
    if not job_id or job_id not in clear_jobs:
        return jsonify({"error": "Job non trovato"}), 404
    
    if clear_jobs[job_id]["status"] == "in_progress":
        clear_jobs[job_id]["cancelled"] = True
        return jsonify({"message": "Job cancellato con successo"}), 200
    else:
        return jsonify({"error": "Il job non è in corso"}), 400