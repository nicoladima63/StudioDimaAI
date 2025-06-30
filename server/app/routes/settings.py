from flask import Blueprint, request, jsonify
import os

settings_bp = Blueprint('settings', __name__)

MODE_FILE_PATH = os.path.join(os.path.dirname(__file__), '../../instance/mode.txt')

# Funzione di utilità per leggere la modalità
def read_mode():
    try:
        with open(MODE_FILE_PATH, 'r') as f:
            mode = f.read().strip()
            if mode in ['dev', 'prod']:
                return mode
    except Exception:
        pass
    return 'dev'  # default

# Funzione di utilità per scrivere la modalità
def write_mode(mode):
    with open(MODE_FILE_PATH, 'w') as f:
        f.write(mode)

@settings_bp.route('/api/settings/mode', methods=['POST'])
def set_mode():
    data = request.get_json()
    mode = data.get('mode')
    if mode not in ['dev', 'prod']:
        return jsonify({'error': 'Modalità non valida'}), 400
    write_mode(mode)
    return jsonify({'success': True, 'mode': mode})

@settings_bp.route('/api/settings/mode', methods=['GET'])
def get_mode():
    mode = read_mode()
    return jsonify({'mode': mode}) 