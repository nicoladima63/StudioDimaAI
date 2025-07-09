from flask import Blueprint, request, jsonify
import os
from server.app.core.mode_manager import get_mode, set_mode

settings_bp = Blueprint('settings', __name__)

INSTANCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../instance'))
DATABASE_MODE_FILE_PATH = os.path.join(INSTANCE_DIR, 'database_mode.txt')
RENTRI_MODE_FILE_PATH = os.path.join(INSTANCE_DIR, 'rentri_mode.txt')
RICETTA_MODE_FILE_PATH = os.path.join(INSTANCE_DIR, 'ricetta_mode.txt')

@settings_bp.route('/api/settings/check-prod', methods=['GET'])
def check_prod():
    allowed, message = check_prod_mode_available()
    return jsonify({'allowed': allowed, 'message': message})

@settings_bp.route('/api/settings/mode', methods=['POST'])
def set_mode():
    data = request.get_json()
    mode = data.get('mode')
    if mode not in ['dev', 'prod']:
        return jsonify({'error': 'Modalità non valida'}), 400
    if mode == 'prod':
        allowed, message = check_prod_mode_available()
        if not allowed:
            return jsonify({'error': message}), 400
    write_database_mode(mode)
    return jsonify({'success': True, 'mode': mode})

@settings_bp.route('/api/settings/mode', methods=['GET'])
def get_mode():
    mode = read_database_mode()
    return jsonify({'mode': mode})

@settings_bp.route('/api/settings/<tipo>-mode', methods=['POST'])
def set_any_mode(tipo):
    data = request.get_json()
    modo = data.get('mode')
    if modo not in ['dev', 'prod', 'test']:
        return jsonify({'error': 'Modalità non valida'}), 400
    set_mode(tipo, modo)
    return jsonify({'success': True, 'mode': modo})

@settings_bp.route('/api/settings/<tipo>-mode', methods=['GET'])
def get_any_mode(tipo):
    mode = get_mode(tipo)
    return jsonify({'mode': mode}) 