"""
API for managing automation settings.
"""
from flask import Blueprint, request, jsonify
from core.environment_manager import environment_manager

automation_settings_bp = Blueprint('automation_settings', __name__)

@automation_settings_bp.route('/automation/settings', methods=['GET'])
def get_settings():
    """Get automation settings."""
    settings = environment_manager.get_automation_settings()
    return jsonify({'success': True, 'data': settings})

@automation_settings_bp.route('/automation/settings', methods=['POST'])
def set_settings():
    """Set automation settings."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Dati JSON richiesti'}), 400
    
    environment_manager.set_automation_settings(data)
    return jsonify({'success': True, 'message': 'Impostazioni di automazione aggiornate con successo'})
