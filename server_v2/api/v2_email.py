"""
Email API Blueprint - Gmail reader with intelligent filtering.
"""
import os
import logging
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app_v2 import format_response
from services.email_service import email_service
from core.exceptions import GmailCredentialsNotFoundError, GmailApiError

logger = logging.getLogger(__name__)

email_v2_bp = Blueprint('email_v2', __name__)


# =============================================================================
# OAuth
# =============================================================================


@email_v2_bp.route('/email/oauth/url', methods=['GET'])
@jwt_required()
def get_gmail_oauth_url():
    """Get Gmail OAuth URL for web flow."""
    try:
        redirect_uri = os.getenv("GMAIL_OAUTH_REDIRECT_URI")
        if not redirect_uri:
            proto = request.headers.get("X-Forwarded-Proto", request.scheme)
            host = request.headers.get("X-Forwarded-Host", request.host)
            redirect_uri = f"{proto}://{host}/oauth/gmail/callback"

        auth_url = email_service.get_oauth_url(redirect_uri)

        return format_response(
            success=True,
            data={'auth_url': auth_url},
            message='Gmail OAuth URL generated',
            state='success'
        ), 200
    except GmailCredentialsNotFoundError as e:
        return format_response(
            success=False,
            error='GMAIL_CREDENTIALS_NOT_FOUND',
            message=str(e),
            state='error'
        ), 200
    except Exception as e:
        logger.error(f"Error generating Gmail OAuth URL: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore generazione URL OAuth Gmail',
            state='error'
        ), 500


@email_v2_bp.route('/email/oauth/status', methods=['GET'])
@jwt_required()
def gmail_oauth_status():
    """Check Gmail OAuth authentication status."""
    try:
        status = email_service.get_oauth_status()
        return format_response(
            success=True,
            data=status,
            message='Gmail authentication active' if status['authenticated'] else 'Gmail authentication required',
            state='success' if status['authenticated'] else 'warning'
        ), 200
    except Exception as e:
        logger.error(f"Error checking Gmail OAuth status: {e}")
        return format_response(
            success=False,
            error=str(e),
            message='Errore verifica stato OAuth Gmail',
            state='error'
        ), 500


# =============================================================================
# Email Messages
# =============================================================================


@email_v2_bp.route('/email/messages', methods=['GET'])
@jwt_required()
def get_emails():
    """Get emails from Gmail with optional search."""
    try:
        max_results = request.args.get('max_results', 20, type=int)
        page_token = request.args.get('page_token')
        query = request.args.get('q')

        result = email_service.get_emails(
            max_results=max_results,
            page_token=page_token,
            query=query
        )

        return format_response(
            success=True,
            data=result,
            message=f"Trovate {len(result.get('emails', []))} email",
            state='success'
        ), 200
    except GmailCredentialsNotFoundError:
        return format_response(
            success=False,
            error='GMAIL_AUTH_REQUIRED',
            message='Autenticazione Gmail richiesta',
            data={'reauth_endpoint': '/api/email/oauth/url'},
            state='error'
        ), 200
    except GmailApiError as e:
        return format_response(
            success=False,
            error=str(e),
            message='Errore API Gmail',
            state='error'
        ), 500
    except Exception as e:
        logger.error(f"Error fetching emails: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore recupero email',
            state='error'
        ), 500


@email_v2_bp.route('/email/messages/<message_id>', methods=['GET'])
@jwt_required()
def get_email_detail(message_id):
    """Get full detail of a single email."""
    try:
        result = email_service.get_email_detail(message_id)
        return format_response(
            success=True,
            data=result,
            state='success'
        ), 200
    except GmailCredentialsNotFoundError:
        return format_response(
            success=False,
            error='GMAIL_AUTH_REQUIRED',
            message='Autenticazione Gmail richiesta',
            state='error'
        ), 200
    except GmailApiError as e:
        return format_response(
            success=False,
            error=str(e),
            message='Errore dettaglio email',
            state='error'
        ), 500
    except Exception as e:
        logger.error(f"Error getting email detail: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore dettaglio email',
            state='error'
        ), 500


@email_v2_bp.route('/email/messages/relevant', methods=['GET'])
@jwt_required()
def get_relevant_emails():
    """Get emails classified as relevant for active scopes."""
    try:
        max_results = request.args.get('max_results', 50, type=int)
        page_token = request.args.get('page_token')
        query = request.args.get('q')

        result = email_service.get_relevant_emails(
            max_results=max_results,
            page_token=page_token,
            query=query
        )

        return format_response(
            success=True,
            data=result,
            message=f"{result.get('total_relevant', 0)} email pertinenti su {result.get('total_fetched', 0)} analizzate",
            state='success'
        ), 200
    except GmailCredentialsNotFoundError:
        return format_response(
            success=False,
            error='GMAIL_AUTH_REQUIRED',
            message='Autenticazione Gmail richiesta',
            state='error'
        ), 200
    except Exception as e:
        logger.error(f"Error getting relevant emails: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore recupero email pertinenti',
            state='error'
        ), 500


@email_v2_bp.route('/email/labels', methods=['GET'])
@jwt_required()
def get_labels():
    """Get Gmail labels."""
    try:
        labels = email_service.get_labels()
        return format_response(
            success=True,
            data=labels,
            state='success'
        ), 200
    except GmailCredentialsNotFoundError:
        return format_response(
            success=False,
            error='GMAIL_AUTH_REQUIRED',
            message='Autenticazione Gmail richiesta',
            state='error'
        ), 200
    except Exception as e:
        logger.error(f"Error getting labels: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore recupero etichette Gmail',
            state='error'
        ), 500


# =============================================================================
# Scopes CRUD
# =============================================================================


@email_v2_bp.route('/email/scopes', methods=['GET'])
@jwt_required()
def get_scopes():
    """Get all email scopes."""
    try:
        scopes = email_service.get_scopes()
        return format_response(
            success=True,
            data=scopes,
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"Error getting scopes: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore recupero scopi',
            state='error'
        ), 500


@email_v2_bp.route('/email/scopes', methods=['POST'])
@jwt_required()
def create_scope():
    """Create a new email scope."""
    try:
        data = request.get_json()
        if not data or not data.get('name') or not data.get('label'):
            return format_response(
                success=False,
                error='MISSING_FIELDS',
                message='Nome e label sono obbligatori',
                state='error'
            ), 400

        result = email_service.create_scope(data)
        return format_response(
            success=True,
            data=result,
            message=f"Scopo '{data['label']}' creato",
            state='success'
        ), 201
    except Exception as e:
        logger.error(f"Error creating scope: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore creazione scopo',
            state='error'
        ), 500


@email_v2_bp.route('/email/scopes/<int:scope_id>', methods=['PUT'])
@jwt_required()
def update_scope(scope_id):
    """Update an email scope."""
    try:
        data = request.get_json()
        result = email_service.update_scope(scope_id, data)
        if result:
            return format_response(
                success=True,
                data=result,
                message='Scopo aggiornato',
                state='success'
            ), 200
        return format_response(
            success=False,
            error='NOT_FOUND',
            message='Scopo non trovato',
            state='error'
        ), 404
    except Exception as e:
        logger.error(f"Error updating scope: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore aggiornamento scopo',
            state='error'
        ), 500


@email_v2_bp.route('/email/scopes/<int:scope_id>', methods=['DELETE'])
@jwt_required()
def delete_scope(scope_id):
    """Delete an email scope."""
    try:
        result = email_service.delete_scope(scope_id)
        if result:
            return format_response(
                success=True,
                message='Scopo eliminato',
                state='success'
            ), 200
        return format_response(
            success=False,
            error='NOT_FOUND',
            message='Scopo non trovato',
            state='error'
        ), 404
    except Exception as e:
        logger.error(f"Error deleting scope: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore eliminazione scopo',
            state='error'
        ), 500


# =============================================================================
# Rules CRUD
# =============================================================================


@email_v2_bp.route('/email/rules', methods=['GET'])
@jwt_required()
def get_rules():
    """Get email filter rules."""
    try:
        scope_id = request.args.get('scope_id', type=int)
        rules = email_service.get_rules(scope_id)
        return format_response(
            success=True,
            data=rules,
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"Error getting rules: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore recupero regole',
            state='error'
        ), 500


@email_v2_bp.route('/email/rules', methods=['POST'])
@jwt_required()
def create_rule():
    """Create a new email filter rule."""
    try:
        data = request.get_json()
        required = ['scope_id', 'field', 'operator', 'value']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return format_response(
                success=False,
                error='MISSING_FIELDS',
                message=f"Campi obbligatori mancanti: {', '.join(missing)}",
                state='error'
            ), 400

        result = email_service.create_rule(data)
        return format_response(
            success=True,
            data=result,
            message='Regola creata',
            state='success'
        ), 201
    except Exception as e:
        logger.error(f"Error creating rule: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore creazione regola',
            state='error'
        ), 500


@email_v2_bp.route('/email/rules/<int:rule_id>', methods=['PUT'])
@jwt_required()
def update_rule(rule_id):
    """Update an email filter rule."""
    try:
        data = request.get_json()
        result = email_service.update_rule(rule_id, data)
        if result:
            return format_response(
                success=True,
                data=result,
                message='Regola aggiornata',
                state='success'
            ), 200
        return format_response(
            success=False,
            error='NOT_FOUND',
            message='Regola non trovata',
            state='error'
        ), 404
    except Exception as e:
        logger.error(f"Error updating rule: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore aggiornamento regola',
            state='error'
        ), 500


@email_v2_bp.route('/email/rules/<int:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_rule(rule_id):
    """Delete an email filter rule."""
    try:
        result = email_service.delete_rule(rule_id)
        if result:
            return format_response(
                success=True,
                message='Regola eliminata',
                state='success'
            ), 200
        return format_response(
            success=False,
            error='NOT_FOUND',
            message='Regola non trovata',
            state='error'
        ), 404
    except Exception as e:
        logger.error(f"Error deleting rule: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore eliminazione regola',
            state='error'
        ), 500


# =============================================================================
# AI Config
# =============================================================================


@email_v2_bp.route('/email/ai/config', methods=['GET'])
@jwt_required()
def get_ai_config():
    """Get AI classification config (API key masked)."""
    try:
        config = email_service.get_ai_config()
        return format_response(
            success=True,
            data=config,
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"Error getting AI config: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore recupero configurazione AI',
            state='error'
        ), 500


@email_v2_bp.route('/email/ai/config', methods=['PUT'])
@jwt_required()
def save_ai_config():
    """Save AI classification config."""
    try:
        data = request.get_json()
        result = email_service.save_ai_config(data)
        return format_response(
            success=True,
            data=result,
            message='Configurazione AI salvata',
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"Error saving AI config: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore salvataggio configurazione AI',
            state='error'
        ), 500


@email_v2_bp.route('/email/ai/test', methods=['POST'])
@jwt_required()
def test_ai_classification():
    """Test AI classification on a specific email."""
    try:
        data = request.get_json()
        email_data = data.get('email')
        if not email_data:
            return format_response(
                success=False,
                error='MISSING_EMAIL',
                message='Dati email mancanti per il test',
                state='error'
            ), 400

        result = email_service.test_ai_classification(email_data)
        return format_response(
            success=True,
            data=result,
            message='Test classificazione AI completato' if result else 'AI non ha classificato questa email',
            state='success' if result else 'warning'
        ), 200
    except Exception as e:
        logger.error(f"Error testing AI classification: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore test classificazione AI',
            state='error'
        ), 500


# =============================================================================
# Cache
# =============================================================================


@email_v2_bp.route('/email/cache/clear', methods=['POST'])
@jwt_required()
def clear_cache():
    """Clear email classification cache."""
    try:
        result = email_service.clear_cache()
        return format_response(
            success=result,
            message='Cache email svuotata' if result else 'Errore svuotamento cache',
            state='success' if result else 'error'
        ), 200
    except Exception as e:
        logger.error(f"Error clearing cache: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore svuotamento cache',
            state='error'
        ), 500
