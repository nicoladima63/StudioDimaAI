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
        return jsonify(calendars), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync_calendar():
    """Sincronizza gli appuntamenti con Google Calendar."""
    data = request.get_json()
    month = data.get("month")
    year = data.get("year")
    if not (month and year):
        return jsonify({"error": "Mese e anno sono obbligatori."}), 400
    try:
        result = CalendarService.sync_appointments_for_month(month, year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/sync-status', methods=['GET'])
@jwt_required()
def sync_status():
    """Controlla lo stato di una sincronizzazione in corso."""
    job_id = request.args.get("job_id")
    if not job_id:
        return jsonify({"error": "job_id è obbligatorio"}), 400
    try:
        status = CalendarService.get_sync_status(job_id)
        return jsonify(status), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@calendar_bp.route('/clear/<path:calendar_id>', methods=['DELETE'])
@jwt_required()
def clear_calendar(calendar_id: str):
    """Cancella tutti gli eventi da un calendario Google."""
    try:
        result = CalendarService.google_clear_calendar(calendar_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        appointments = db_calendar.get_appointments_for_month(month, year)
        
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