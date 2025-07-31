from flask import Blueprint, request, jsonify
import os
import logging
from server.app.core.mode_manager import get_mode, set_mode
from server.app.core.automation_config import get_automation_settings, set_automation_settings
from server.app.scheduler import reschedule_reminder_job
from flask_jwt_extended import jwt_required
import json

logger = logging.getLogger(__name__)

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings/<tipo>-mode', methods=['POST'])
def set_any_mode(tipo):
    """Imposta la modalità per un tipo di servizio"""
    data = request.get_json()
    modo = data.get('mode')
    
    if modo not in ['dev', 'prod', 'test']:
        return jsonify({'error': 'Modalità non valida'}), 400
    
    # Validazione specifica per database
    if tipo == 'database' and modo == 'prod':
        response = os.system("ping -n 1 SERVERDIMA >nul 2>&1")
        network_ok = (response == 0)
        share_ok = os.path.exists(r'\\SERVERDIMA\Pixel\WINDENT')
        if not (network_ok and share_ok):
            return jsonify({
                'error': 'network_unreachable',
                'message': 'La rete studio non è raggiungibile. Impossibile passare a produzione. Assicurati di essere connesso alla risorsa di rete o effettua il login.'
            }), 503
    
    # Validazione specifica per SMS
    if tipo == 'sms':
        if modo in ['prod', 'test']:
            # Verifica che le credenziali Brevo siano configurate
            from server.app.core.mode_manager import get_env_params
            params = get_env_params('sms', modo)
            
            if not params.get('API_KEY'):
                return jsonify({
                    'error': 'missing_credentials',
                    'message': f'Credenziali Brevo mancanti per modalità {modo}. Configura BREVO_API_KEY_{modo.upper()} nel file .env'
                }), 400
    
    # Imposta la modalità
    set_mode(tipo, modo)
    
    # Se è SMS, reinizializza il servizio
    if tipo == 'sms':
        try:
            from server.app.services.sms_service import sms_service
            sms_service.__init__()  # Reinizializza con la nuova modalità
        except Exception as e:
            return jsonify({
                'error': 'service_initialization_failed',
                'message': f'Errore reinizializzazione servizio SMS: {str(e)}'
            }), 500
    
    return jsonify({'success': True, 'mode': modo})

@settings_bp.route('/api/settings/<tipo>-mode', methods=['GET'])
def get_any_mode(tipo):
    """Ottiene la modalità corrente per un tipo di servizio"""
    mode = get_mode(tipo)
    return jsonify({'mode': mode})

@settings_bp.route('/api/settings/sms/test', methods=['POST'])
def test_sms_connection():
    """Testa la connessione al servizio SMS Brevo"""
    try:
        from server.app.services.sms_service import sms_service
        result = sms_service.test_connection()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Errore test connessione SMS: {str(e)}'
        }), 500

@settings_bp.route('/api/settings/sms/status', methods=['GET'])
def get_sms_status():
    """Ottiene lo stato del servizio SMS"""
    try:
        from server.app.services.sms_service import sms_service
        
        return jsonify({
            'mode': sms_service.get_current_mode(),
            'enabled': sms_service.is_enabled(),
            'sender': sms_service.params.get('SENDER', 'N/A')
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Errore recupero stato SMS: {str(e)}'
        }), 500

@settings_bp.route('/api/settings/sms-promemoria-mode', methods=['GET'])
@jwt_required()
def get_sms_promemoria_mode():
    from server.app.core.automation_config import get_automation_settings
    settings = get_automation_settings()
    return jsonify({'mode': settings.get('sms_promemoria_mode', 'prod')})

@settings_bp.route('/api/settings/sms-promemoria-mode', methods=['POST'])
@jwt_required()
def set_sms_promemoria_mode():
    data = request.get_json() or {}
    mode = data.get('mode')
    if mode not in ['prod', 'test']:
        return jsonify({'error': 'Modalità non valida'}), 400
    from server.app.core.automation_config import set_automation_settings, get_automation_settings
    settings = get_automation_settings()
    settings['sms_promemoria_mode'] = mode
    set_automation_settings(settings)
    return jsonify({'success': True, 'mode': mode})

@settings_bp.route('/api/settings/sms-richiami-mode', methods=['GET'])
@jwt_required()
def get_sms_richiami_mode():
    from server.app.core.automation_config import get_automation_settings
    settings = get_automation_settings()
    return jsonify({'mode': settings.get('sms_richiami_mode', 'prod')})

@settings_bp.route('/api/settings/sms-richiami-mode', methods=['POST'])
@jwt_required()
def set_sms_richiami_mode():
    data = request.get_json() or {}
    mode = data.get('mode')
    if mode not in ['prod', 'test']:
        return jsonify({'error': 'Modalità non valida'}), 400
    from server.app.core.automation_config import set_automation_settings, get_automation_settings
    settings = get_automation_settings()
    settings['sms_richiami_mode'] = mode
    set_automation_settings(settings)
    return jsonify({'success': True, 'mode': mode})

# Aggiorno la rotta /api/settings/appointment-reminder per includere la modalità sms_promemoria
@settings_bp.route('/api/settings/appointment-reminder', methods=['GET'])
@jwt_required()
def get_appointment_reminder_settings():
    settings = get_automation_settings()
    return jsonify({
        'reminder_enabled': settings.get('reminder_enabled', True),
        'reminder_hour': settings.get('reminder_hour', 15),
        'reminder_minute': settings.get('reminder_minute', 0),
        'sms_promemoria_mode': settings.get('sms_promemoria_mode', 'prod')
    })

@settings_bp.route('/api/settings/appointment-reminder', methods=['POST'])
@jwt_required()
def set_appointment_reminder_settings():
    data = request.get_json() or {}
    
    # Ottieni impostazioni esistenti e fai merge
    current_settings = get_automation_settings()
    current_settings.update(data)
    
    set_automation_settings(current_settings)
    reschedule_reminder_job()
    return jsonify({'success': True, 'settings': get_automation_settings()})

@settings_bp.route('/api/settings/appointment-reminder/log', methods=['GET'])
@jwt_required()
def get_appointment_reminder_log():
    """Restituisce gli ultimi 20 log di automazione promemoria appuntamenti"""
    log_path = 'automation_reminder.log'
    logs = []
    try:
        if os.path.exists(log_path):
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                # Prendi le ultime 20 righe (log più recenti)
                for line in lines[-20:]:
                    try:
                        logs.append(json.loads(line))
                    except Exception:
                        continue
        return jsonify({'logs': logs[::-1]})  # Più recente per primo
    except Exception as e:
        return jsonify({'error': f'Errore lettura log: {str(e)}'}), 500

@settings_bp.route('/api/settings/recall-automation', methods=['GET'])
@jwt_required()
def get_recall_automation_settings():
    from server.app.core.automation_config import get_automation_settings
    settings = get_automation_settings()
    return jsonify({
        'recall_enabled': settings.get('recall_enabled', True),
        'recall_hour': settings.get('recall_hour', 16),
        'recall_minute': settings.get('recall_minute', 0),
        'sms_richiami_mode': settings.get('sms_richiami_mode', 'prod')
    })

@settings_bp.route('/api/settings/recall-automation', methods=['POST'])
@jwt_required()
def set_recall_automation_settings():
    from server.app.core.automation_config import set_automation_settings
    data = request.get_json() or {}
    
    # Ottieni impostazioni esistenti e fai merge
    current_settings = get_automation_settings()
    current_settings.update(data)
    
    set_automation_settings(current_settings)
    
    # Reschedula job richiami
    try:
        from server.app.scheduler import reschedule_recall_job
        reschedule_recall_job()
    except ImportError as e:
        logger.error(f"Errore import reschedule_recall_job: {e}")
        
    return jsonify({'success': True})

@settings_bp.route('/api/settings/recall-automation/log', methods=['GET'])
@jwt_required()
def get_recall_automation_log():
    log_path = 'automation_recall.log'
    logs = []
    import os, json
    try:
        if os.path.exists(log_path):
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for line in lines[-20:]:
                    try:
                        logs.append(json.loads(line))
                    except Exception:
                        continue
        return jsonify({'logs': logs[::-1]})
    except Exception as e:
        return jsonify({'error': f'Errore lettura log: {str(e)}'}), 500

@settings_bp.route('/api/settings/calendar-sync', methods=['GET'])
@jwt_required()
def get_calendar_sync_settings():
    """Ottiene le impostazioni della sincronizzazione automatica calendario"""
    settings = get_automation_settings()
    return jsonify({
        'calendar_sync_enabled': settings.get('calendar_sync_enabled', True),
        'calendar_sync_hour': settings.get('calendar_sync_hour', 21),
        'calendar_sync_minute': settings.get('calendar_sync_minute', 0),
        'calendar_studio_blu_id': settings.get('calendar_studio_blu_id', ''),
        'calendar_studio_giallo_id': settings.get('calendar_studio_giallo_id', '')
    })

@settings_bp.route('/api/settings/calendar-sync', methods=['POST'])
@jwt_required()
def set_calendar_sync_settings():
    """Imposta le impostazioni della sincronizzazione automatica calendario"""
    data = request.get_json() or {}
    
    # Validazione dati
    if 'calendar_sync_hour' in data:
        hour = data.get('calendar_sync_hour')
        if not isinstance(hour, int) or hour < 0 or hour > 23:
            return jsonify({'error': 'Ora non valida (0-23)'}), 400
            
    if 'calendar_sync_minute' in data:
        minute = data.get('calendar_sync_minute')
        if not isinstance(minute, int) or minute < 0 or minute > 59:
            return jsonify({'error': 'Minuto non valido (0-59)'}), 400
    
    # Ottieni impostazioni esistenti e fai merge
    current_settings = get_automation_settings()
    current_settings.update(data)
    
    set_automation_settings(current_settings)
    
    # Import locale per evitare import circolari
    try:
        from server.app.scheduler import reschedule_calendar_sync_job
        reschedule_calendar_sync_job()
    except ImportError as e:
        logger.error(f"Errore import reschedule_calendar_sync_job: {e}")
    
    return jsonify({'success': True, 'settings': get_automation_settings()})

@settings_bp.route('/api/settings/calendar-sync/log', methods=['GET']) 
@jwt_required()
def get_calendar_sync_log():
    """Restituisce gli ultimi 20 log di sincronizzazione calendario automatica"""
    log_path = 'automation_calendar_sync.log'
    logs = []
    try:
        if os.path.exists(log_path):
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                # Prendi le ultime 20 righe (log più recenti)
                for line in lines[-20:]:
                    try:
                        logs.append(json.loads(line))
                    except Exception:
                        continue
        return jsonify({'logs': logs[::-1]})  # Più recente per primo
    except Exception as e:
        return jsonify({'error': f'Errore lettura log: {str(e)}'}), 500

@settings_bp.route('/api/settings/calendar-sync/clear-all', methods=['POST'])
@jwt_required()
def clear_all_calendars():
    """Cancella tutti gli eventi da entrambi i calendari configurati"""
    from server.app.services.calendar_service import CalendarService
    from server.app.core.automation_config import get_automation_settings
    
    settings = get_automation_settings()
    studio_blu_calendar = settings.get('calendar_studio_blu_id')
    studio_giallo_calendar = settings.get('calendar_studio_giallo_id')
    
    if not studio_blu_calendar or not studio_giallo_calendar:
        return jsonify({'error': 'ID calendari non configurati'}), 400
    
    results = []
    total_deleted = 0
    
    # Cancella Studio Blu
    try:
        result_blu = CalendarService.google_clear_calendar(studio_blu_calendar)
        results.append({
            'studio': 'blu',
            'success': True,
            'deleted_count': result_blu.get('deleted_count', 0),
            'message': result_blu.get('message', 'Completato')
        })
        total_deleted += result_blu.get('deleted_count', 0)
    except Exception as e:
        results.append({
            'studio': 'blu',
            'success': False,
            'error': str(e)
        })
    
    # Cancella Studio Giallo
    try:
        result_giallo = CalendarService.google_clear_calendar(studio_giallo_calendar)
        results.append({
            'studio': 'giallo',
            'success': True,
            'deleted_count': result_giallo.get('deleted_count', 0),
            'message': result_giallo.get('message', 'Completato')
        })
        total_deleted += result_giallo.get('deleted_count', 0)
    except Exception as e:
        results.append({
            'studio': 'giallo',
            'success': False,
            'error': str(e)
        })
    
    return jsonify({
        'success': True,
        'total_deleted': total_deleted,
        'results': results
    })

@settings_bp.route('/api/settings/calendar-sync/sync-all', methods=['POST'])
@jwt_required()
def sync_all_calendars():
    """Sincronizza entrambi i calendari per il mese corrente"""
    from server.app.services.calendar_service import CalendarService
    from server.app.core.automation_config import get_automation_settings
    from datetime import datetime
    
    settings = get_automation_settings()
    studio_blu_calendar = settings.get('calendar_studio_blu_id')
    studio_giallo_calendar = settings.get('calendar_studio_giallo_id')
    
    if not studio_blu_calendar or not studio_giallo_calendar:
        return jsonify({'error': 'ID calendari non configurati'}), 400
    
    now = datetime.now()
    current_month = now.month
    current_year = now.year
    
    results = []
    total_synced = 0
    
    # Ottieni tutti gli appuntamenti del mese corrente
    all_appointments = CalendarService.get_db_appointments_for_month(current_month, current_year)
    
    # Sincronizza Studio Blu
    try:
        studio_blu_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == 1]
        result_blu = CalendarService.sync_appointments_for_month(
            current_month, current_year,
            {1: studio_blu_calendar},
            studio_blu_appointments
        )
        results.append({
            'studio': 'blu',
            'success': True,
            'synced_count': result_blu.get('success', 0),
            'message': result_blu.get('message', 'Completato')
        })
        total_synced += result_blu.get('success', 0)
    except Exception as e:
        results.append({
            'studio': 'blu',
            'success': False,
            'error': str(e)
        })
    
    # Sincronizza Studio Giallo
    try:
        studio_giallo_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == 2]
        result_giallo = CalendarService.sync_appointments_for_month(
            current_month, current_year,
            {2: studio_giallo_calendar},
            studio_giallo_appointments
        )
        results.append({
            'studio': 'giallo',
            'success': True,
            'synced_count': result_giallo.get('success', 0),
            'message': result_giallo.get('message', 'Completato')
        })
        total_synced += result_giallo.get('success', 0)
    except Exception as e:
        results.append({
            'studio': 'giallo',
            'success': False,
            'error': str(e)
        })
    
    return jsonify({
        'success': True,
        'total_synced': total_synced,
        'results': results,
        'month': f"{current_month:02d}/{current_year}"
    })