from flask import Blueprint, request, jsonify
import os
from server.app.core.mode_manager import get_mode, set_mode

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings/<tipo>-mode', methods=['POST'])
def set_any_mode(tipo):
    data = request.get_json()
    modo = data.get('mode')
    if modo not in ['dev', 'prod', 'test']:
        return jsonify({'error': 'Modalità non valida'}), 400
    if tipo == 'database' and modo == 'prod':
        response = os.system("ping -n 1 SERVERDIMA >nul 2>&1")
        network_ok = (response == 0)
        share_ok = os.path.exists(r'\\SERVERDIMA\Pixel\WINDENT')
        if not (network_ok and share_ok):
            return jsonify({
                'error': 'network_unreachable',
                'message': 'La rete studio non è raggiungibile. Impossibile passare a produzione. Assicurati di essere connesso alla risorsa di rete o effettua il login.'
            }), 503
    set_mode(tipo, modo)
    return jsonify({'success': True, 'mode': modo})

@settings_bp.route('/api/settings/<tipo>-mode', methods=['GET'])
def get_any_mode(tipo):
    mode = get_mode(tipo)
    return jsonify({'mode': mode}) 