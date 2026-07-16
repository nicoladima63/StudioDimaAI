"""
API endpoints per recuperare i log dei messaggi inviati dalle automazioni.
"""
from flask import Blueprint, jsonify, request
from services.automation_log_service import get_automation_log_service
import logging

logger = logging.getLogger(__name__)

automation_logs_bp = Blueprint('automation_logs_bp', __name__)


@automation_logs_bp.route('/automation/messages', methods=['GET'])
def list_automation_messages():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        since = request.args.get('since')

        # The service supports limit and since; page handled by offset simulation
        limit = per_page
        svc = get_automation_log_service()
        rows = svc.list_messages(limit=limit, since=since)

        return jsonify({'success': True, 'data': rows, 'page': page, 'per_page': per_page})
    except Exception as e:
        logger.error(f"Error listing automation messages: {e}")
        return jsonify({'success': False, 'error': 'internal_error'}), 500
