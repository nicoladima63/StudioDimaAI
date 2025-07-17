from flask import Blueprint, request, jsonify
import os
from server.app.core.mode_manager import get_mode, set_mode

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