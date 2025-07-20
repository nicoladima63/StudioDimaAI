from flask import Blueprint, request, jsonify
import os
from server.app.core.mode_manager import get_mode, set_mode
from server.app.core.automation_config import get_automation_settings, set_automation_settings
from server.app.scheduler import reschedule_reminder_job
from flask_jwt_extended import jwt_required
import json

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
    set_automation_settings(data)
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
    set_automation_settings(data)
    # (Opzionale: reschedula job richiami qui se serve)
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