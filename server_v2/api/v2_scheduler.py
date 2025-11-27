from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from services.scheduler_service import scheduler_service
from core.automation_config import get_automation_settings, save_automation_settings
import logging

logger = logging.getLogger(__name__)

scheduler_v2_bp = Blueprint('scheduler_v2', __name__)

@scheduler_v2_bp.route('/scheduler/status', methods=['GET'])
@jwt_required()
def get_scheduler_status():
    """Ottieni status dello scheduler e job attivi"""
    try:
        status = scheduler_service.get_scheduler_status()
        settings = get_automation_settings()
        
        # Rimuovi le vecchie chiavi se esistono per pulizia
        settings.pop('calendar_sync_hour', None)
        settings.pop('calendar_sync_minute', None)

        return jsonify({
            'state': 'success',
            'data': {
                'scheduler': status,
                'settings': {
                    'reminder_enabled': settings['reminder_enabled'],
                    'reminder_hour': settings['reminder_hour'],
                    'reminder_minute': settings['reminder_minute'],
                    'recall_enabled': settings['recall_enabled'],
                    'recall_hour': settings['recall_hour'],
                    'recall_minute': settings['recall_minute'],
                    'calendar_sync_enabled': settings['calendar_sync_enabled'],
                    'calendar_sync_multi_time_enabled': settings['calendar_sync_multi_time_enabled'],
                    'calendar_sync_fallback_time': settings['calendar_sync_fallback_time'],
                    'calendar_sync_times': settings['calendar_sync_times'],
                    'calendar_sync_weeks_to_sync': settings['calendar_sync_weeks_to_sync'],
                    'calendar_studio_blu_id': settings['calendar_studio_blu_id'],
                    'calendar_studio_giallo_id': settings['calendar_studio_giallo_id']
                }
            }
        })
    except Exception as e:
        logger.error(f"Errore ottenimento status scheduler: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore ottenimento status scheduler: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/reminder/settings', methods=['PUT'])
@jwt_required()
def update_reminder_settings():
    """Aggiorna impostazioni promemoria appuntamenti"""
    try:
        data = request.get_json()
        settings = get_automation_settings()
        
        # Aggiorna settings promemoria
        if 'enabled' in data:
            settings['reminder_enabled'] = bool(data['enabled'])
        if 'hour' in data:
            settings['reminder_hour'] = int(data['hour'])
        if 'minute' in data:
            settings['reminder_minute'] = int(data['minute'])
            
        # Salva settings
        save_automation_settings(settings)
        
        # Riprogramma job
        scheduler_service.reschedule_reminder_job()
        
        return jsonify({
            'state': 'success',
            'data': {
                'message': 'Impostazioni promemoria aggiornate',
                'settings': {
                    'reminder_enabled': settings['reminder_enabled'],
                    'reminder_hour': settings['reminder_hour'],
                    'reminder_minute': settings['reminder_minute']
                }
            }
        })
    except Exception as e:
        logger.error(f"Errore aggiornamento settings promemoria: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore aggiornamento settings promemoria: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/recall/settings', methods=['PUT'])
@jwt_required()
def update_recall_settings():
    """Aggiorna impostazioni richiami"""
    try:
        data = request.get_json()
        settings = get_automation_settings()
        
        # Aggiorna settings richiami
        if 'enabled' in data:
            settings['recall_enabled'] = bool(data['enabled'])
        if 'hour' in data:
            settings['recall_hour'] = int(data['hour'])
        if 'minute' in data:
            settings['recall_minute'] = int(data['minute'])
            
        # Salva settings
        save_automation_settings(settings)
        
        # Riprogramma job
        scheduler_service.reschedule_recall_job()
        
        return jsonify({
            'state': 'success',
            'data': {
                'message': 'Impostazioni richiami aggiornate',
                'settings': {
                    'recall_enabled': settings['recall_enabled'],
                    'recall_hour': settings['recall_hour'],
                    'recall_minute': settings['recall_minute']
                }
            }
        })
    except Exception as e:
        logger.error(f"Errore aggiornamento settings richiami: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore aggiornamento settings richiami: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/calendar/settings', methods=['PUT'])
@jwt_required()
def update_calendar_sync_settings():
    """Aggiorna impostazioni sincronizzazione calendario"""
    try:
        data = request.get_json()
        settings = get_automation_settings()
        
        # Aggiorna settings calendario sync
        if 'enabled' in data:
            settings['calendar_sync_enabled'] = bool(data['enabled'])
        if 'multi_time_enabled' in data:
            settings['calendar_sync_multi_time_enabled'] = bool(data['multi_time_enabled'])
        if 'fallback_time' in data:
            settings['calendar_sync_fallback_time'] = data['fallback_time']
        if 'sync_times' in data and isinstance(data['sync_times'], list):
            settings['calendar_sync_times'] = data['sync_times']
        if 'weeks_to_sync' in data:
            settings['calendar_sync_weeks_to_sync'] = int(data['weeks_to_sync'])
        if 'calendar_studio_blu_id' in data:
            settings['calendar_studio_blu_id'] = data['calendar_studio_blu_id']
        if 'calendar_studio_giallo_id' in data:
            settings['calendar_studio_giallo_id'] = data['calendar_studio_giallo_id']
            
        # Rimuovi le vecchie chiavi per pulizia
        settings.pop('calendar_sync_hour', None)
        settings.pop('calendar_sync_minute', None)

        # Salva settings
        save_automation_settings(settings)
        
        # Riprogramma job
        scheduler_service.reschedule_calendar_sync_job()
        
        return jsonify({
            'state': 'success',
            'data': {
                'message': 'Impostazioni sincronizzazione calendario aggiornate',
                'settings': {
                    'calendar_sync_enabled': settings['calendar_sync_enabled'],
                    'calendar_sync_multi_time_enabled': settings['calendar_sync_multi_time_enabled'],
                    'calendar_sync_fallback_time': settings['calendar_sync_fallback_time'],
                    'calendar_sync_times': settings['calendar_sync_times'],
                    'calendar_studio_blu_id': settings.get('calendar_studio_blu_id'),
                    'calendar_studio_giallo_id': settings.get('calendar_studio_giallo_id')
                }
            }
        })
    except Exception as e:
        logger.error(f"Errore aggiornamento settings calendario: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore aggiornamento settings calendario: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/start', methods=['POST'])
@jwt_required()
def start_scheduler():
    """Avvia lo scheduler"""
    try:
        scheduler_service.start()
        status = scheduler_service.get_scheduler_status()
        
        return jsonify({
            'state': 'success',
            'data': {
                'message': 'Scheduler avviato',
                'status': status
            }
        })
    except Exception as e:
        logger.error(f"Errore avvio scheduler: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore avvio scheduler: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/stop', methods=['POST'])
@jwt_required()
def stop_scheduler():
    """Ferma lo scheduler"""
    try:
        scheduler_service.shutdown()
        
        return jsonify({
            'state': 'success',
            'data': {
                'message': 'Scheduler fermato'
            }
        })
    except Exception as e:
        logger.error(f"Errore stop scheduler: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore stop scheduler: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/logs/recall', methods=['GET'])
@jwt_required()
def get_recall_logs():
    """Ottieni log richiami automatici"""
    try:
        logs = []
        try:
            with open('automation_recall.log', 'r', encoding='utf-8') as f:
                lines = f.readlines()[-50:]  # Ultimi 50 log
                for line in lines:
                    if line.strip():
                        import json
                        logs.append(json.loads(line.strip()))
        except FileNotFoundError:
            pass
        
        return jsonify({
            'state': 'success',
            'data': logs
        })
    except Exception as e:
        logger.error(f"Errore lettura log richiami: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore lettura log richiami: {str(e)}'
        }), 500

@scheduler_v2_bp.route('/scheduler/logs/calendar', methods=['GET'])
@jwt_required()
def get_calendar_sync_logs():
    """Ottieni log sincronizzazione calendario"""
    try:
        logs = []
        try:
            with open('automation_calendar_sync.log', 'r', encoding='utf-8') as f:
                lines = f.readlines()[-50:]  # Ultimi 50 log
                for line in lines:
                    if line.strip():
                        import json
                        logs.append(json.loads(line.strip()))
        except FileNotFoundError:
            pass
        
        return jsonify({
            'state': 'success',
            'data': logs
        })
    except Exception as e:
        logger.error(f"Errore lettura log calendario: {e}")
        return jsonify({
            'state': 'error',
            'error': f'Errore lettura log calendario: {str(e)}'
        }), 500