"""
API endpoints per recuperare i log dei messaggi inviati dalle automazioni.
"""
from flask import Blueprint, jsonify, request
from app_v2 import format_response
from core.exceptions import GmailApiError, GmailCredentialsNotFoundError
from services.anagrafica_email_service import find_submissions
from services.automation_log_service import get_automation_log_service
from services.email_service import email_service
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


@automation_logs_bp.route('/automation/messages/<int:message_id>/anagrafica', methods=['GET'])
def get_message_anagrafica(message_id):
    """Anagrafica compilata sul sito dal paziente a cui e' stato inviato il link (letta da Gmail)."""
    row = get_automation_log_service().get_message(message_id)
    if not row:
        return format_response(success=False, error='not_found', message='Messaggio non trovato',
                               state='error'), 404
    try:
        submissions = find_submissions(row, email_service)
    except GmailCredentialsNotFoundError:
        return format_response(success=False, error='GMAIL_AUTH_REQUIRED',
                               message='Autenticazione Gmail richiesta', state='error'), 200
    except GmailApiError as e:
        logger.error(f"Gmail error reading anagrafica for message {message_id}: {e}")
        return format_response(success=False, error=str(e), message='Errore API Gmail',
                               state='error'), 500
    except Exception as e:
        logger.error(f"Error reading anagrafica for message {message_id}: {e}", exc_info=True)
        return format_response(success=False, error='internal_error',
                               message='Errore recupero anagrafica', state='error'), 500
    return format_response(data={'submissions': submissions}, state='success'), 200
