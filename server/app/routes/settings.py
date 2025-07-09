from flask import Blueprint, request, jsonify
import os

settings_bp = Blueprint('settings', __name__)

MODE_FILE_PATH = os.path.join(os.path.dirname(__file__), '../../instance/mode.txt')
RENTRI_MODE_FILE_PATH = os.path.join(os.path.dirname(__file__), '../../instance/rentri_mode.txt')
RICETTA_MODE_FILE_PATH = os.path.join(os.path.dirname(__file__), '../../instance/ricetta_mode.txt')
DATABASE_MODE_FILE_PATH = os.path.join(os.path.dirname(__file__), '../../instance/database_mode.txt')

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

def read_mode_file(path):
    try:
        with open(path, 'r') as f:
            mode = f.read().strip()
            if mode in ['dev', 'prod']:
                return mode
    except Exception:
        pass
    return 'dev'

def write_mode_file(path, mode):
    with open(path, 'w') as f:
        f.write(mode)

def check_prod_mode_available():
    return True, ""

def read_database_mode():
    try:
        with open(DATABASE_MODE_FILE_PATH, 'r') as f:
            mode = f.read().strip()
            if mode in ['dev', 'prod']:
                return mode
    except Exception:
        pass
    return 'dev'  # default

def write_database_mode(mode):
    with open(DATABASE_MODE_FILE_PATH, 'w') as f:
        f.write(mode)

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

@settings_bp.route('/api/settings/rentri-mode', methods=['POST'])
def set_rentri_mode():
    data = request.get_json()
    mode = data.get('mode')
    if mode not in ['dev', 'prod']:
        return jsonify({'error': 'Modalità non valida'}), 400
    write_mode_file(RENTRI_MODE_FILE_PATH, mode)
    return jsonify({'success': True, 'mode': mode})

@settings_bp.route('/api/settings/rentri-mode', methods=['GET'])
def get_rentri_mode():
    mode = read_mode_file(RENTRI_MODE_FILE_PATH)
    return jsonify({'mode': mode})

@settings_bp.route('/api/settings/ricetta-mode', methods=['POST'])
def set_ricetta_mode():
    data = request.get_json()
    mode = data.get('mode')
    if mode not in ['dev', 'prod']:
        return jsonify({'error': 'Modalità non valida'}), 400
    write_mode_file(RICETTA_MODE_FILE_PATH, mode)
    return jsonify({'success': True, 'mode': mode})

@settings_bp.route('/api/settings/ricetta-mode', methods=['GET'])
def get_ricetta_mode():
    mode = read_mode_file(RICETTA_MODE_FILE_PATH)
    return jsonify({'mode': mode}) 