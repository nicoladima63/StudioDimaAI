"""
API for managing automation settings.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from core.environment_manager import environment_manager
from services.scheduler_service import scheduler_service
import logging

logger = logging.getLogger(__name__)

automation_settings_bp = Blueprint('automation_settings', __name__)

@automation_settings_bp.route('/automation/settings', methods=['GET'])
@jwt_required()
def get_settings():
    """Get automation settings."""
    settings = environment_manager.get_automation_settings()
    return jsonify({'success': True, 'data': settings})

@automation_settings_bp.route('/automation/settings', methods=['POST'])
@jwt_required()
def set_settings():
    """Set automation settings."""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Dati JSON richiesti'}), 400

    environment_manager.set_automation_settings(data)

    # Reschedule jobs if enabled state changed
    try:
        if 'reminder_enabled' in data:
            scheduler_service.reschedule_reminder_job()
            logger.info("Reminder job rescheduled after settings change")
        if 'recall_enabled' in data:
            scheduler_service.reschedule_recall_job()
            logger.info("Recall job rescheduled after settings change")
    except Exception as e:
        logger.error(f"Error rescheduling jobs: {e}")

    return jsonify({'success': True, 'message': 'Impostazioni di automazione aggiornate con successo'})
