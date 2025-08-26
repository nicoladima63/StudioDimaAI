"""
SMS API V2 for StudioDimaAI.

Modern API endpoints for SMS management with environment switching and richiami integration.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required
from typing import Dict, Any, Optional

from services.sms_service import sms_service
from services.richiami_service import RichiamiService
from app_v2 import require_auth, format_response
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# Create blueprint
sms_v2_bp = Blueprint('sms_v2', __name__)

# Services
richiami_service = RichiamiService()


@sms_v2_bp.route('/sms/send', methods=['POST'])
@jwt_required()
def send_sms():
    """
    Send generic SMS.
    
    Request JSON:
    {
        "recipient": "+393331234567",
        "message": "Testo del messaggio",
        "sender": "StudioDima" (optional)
    }
    
    Returns:
        JSON response with send result
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='REQUEST_DATA_REQUIRED',
                message='Dati richiesta richiesti',
                state='error'
            ), 400
        
        recipient = data.get('recipient')
        message = data.get('message')
        sender = data.get('sender')
        
        if not recipient or not message:
            return format_response(
                success=False,
                error='REQUIRED_FIELDS_MISSING',
                message='Destinatario e messaggio sono obbligatori',
                state='error'
            ), 400
        
        result = sms_service.send_sms(recipient, message, sender)
        
        if result['success']:
            return format_response(
                success=True,
                data=result,
                message='SMS inviato con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'SEND_FAILED'),
                message=result.get('message', 'Errore invio SMS'),
                data=result,
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error in send_sms endpoint: {e}")
        return format_response(
            success=False,
            error='INTERNAL_ERROR',
            message=f'Errore interno: {str(e)}',
            state='error'
        ), 500


@sms_v2_bp.route('/sms/send-recall', methods=['POST'])
@jwt_required()
def send_recall_sms():
    """
    Send recall SMS.
    
    Request JSON:
    {
        "richiamo_id": 12345 (optional, use richiamo_data if not provided)
        "richiamo_data": {
            "telefono": "+393331234567",
            "nome": "Mario Rossi",
            "tipo_richiamo": "1",
            ...
        },
        "custom_message": "Custom message text" (optional)
    }
    
    Returns:
        JSON response with send result
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='REQUEST_DATA_REQUIRED',
                message='Dati richiesta richiesti',
                state='error'
            ), 400
        
        richiamo_data = data.get('richiamo_data')
        richiamo_id = data.get('richiamo_id')
        custom_message = data.get('custom_message')
        
        # If richiamo_id provided, fetch richiamo data
        if richiamo_id and not richiamo_data:
            richiamo_result = richiami_service.get_richiamo_by_id(richiamo_id)
            if richiamo_result['success']:
                richiamo_data = richiamo_result['data']
            else:
                return format_response(
                    success=False,
                    error='RICHIAMO_NOT_FOUND',
                    message='Richiamo non trovato',
                    state='error'
                ), 404
        
        if not richiamo_data:
            return format_response(
                success=False,
                error='RICHIAMO_DATA_REQUIRED',
                message='Dati richiamo richiesti',
                state='error'
            ), 400
        
        result = sms_service.send_recall_sms(richiamo_data, custom_message)
        
        if result['success']:
            # Mark SMS as sent in richiami table if richiamo_id provided
            if richiamo_id:
                try:
                    richiami_service.mark_sms_sent(richiamo_id)
                except Exception as e:
                    logger.warning(f"Failed to mark SMS as sent for richiamo {richiamo_id}: {e}")
            
            return format_response(
                success=True,
                data=result,
                message='SMS richiamo inviato con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'SEND_FAILED'),
                message=result.get('message', 'Errore invio SMS richiamo'),
                data=result,
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error in send_recall_sms endpoint: {e}")
        return format_response(
            success=False,
            error='INTERNAL_ERROR',
            message=f'Errore interno: {str(e)}',
            state='error'
        ), 500


@sms_v2_bp.route('/sms/send-bulk', methods=['POST'])
@jwt_required()
def send_bulk_sms():
    """
    Send bulk SMS.
    
    Request JSON:
    {
        "type": "generic" | "recall", 
        "sms_list": [
            {"recipient": "+393331234567", "message": "Text 1"},
            {"recipient": "+393337654321", "message": "Text 2"}
        ] (for generic),
        "richiami_list": [
            {"telefono": "+393331234567", "nome": "Mario", ...},
            {"telefono": "+393337654321", "nome": "Anna", ...}
        ] (for recall)
    }
    
    Returns:
        JSON response with bulk send results
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='REQUEST_DATA_REQUIRED',
                message='Dati richiesta richiesti',
                state='error'
            ), 400
        
        sms_type = data.get('type', 'generic')
        
        if sms_type == 'recall':
            # Bulk recall SMS
            richiami_list = data.get('richiami_list')
            if not richiami_list or not isinstance(richiami_list, list):
                return format_response(
                    success=False,
                    error='RICHIAMI_LIST_REQUIRED',
                    message='Lista richiami richiesta',
                    state='error'
                ), 400
            
            result = sms_service.send_bulk_recall_sms(richiami_list)
        else:
            # Bulk generic SMS
            sms_list = data.get('sms_list')
            if not sms_list or not isinstance(sms_list, list):
                return format_response(
                    success=False,
                    error='SMS_LIST_REQUIRED',
                    message='Lista SMS richiesta',
                    state='error'
                ), 400
            
            recipients = []
            message = ""
            for sms in sms_list:
                recipients.append(sms.get('recipient'))
                if not message:
                    message = sms.get('message')
            
            result = sms_service.send_bulk_sms(recipients, message)
        
        return format_response(
            success=True,
            data=result,
            message=result.get('message', 'Invio bulk completato'),
            state='success' if result['success'] else 'warning'
        ), 200
        
    except Exception as e:
        logger.error(f"Error in send_bulk_sms endpoint: {e}")
        return format_response(
            success=False,
            error='INTERNAL_ERROR',
            message=f'Errore interno: {str(e)}',
            state='error'
        ), 500


@sms_v2_bp.route('/sms/status', methods=['GET'])
@jwt_required()
def get_sms_status():
    """
    Get SMS service status.
    
    Returns:
        JSON response with service status and configuration
    """
    try:
        status = sms_service.get_service_status()
        
        return format_response(
            success=True,
            data=status,
            message='Status SMS recuperato con successo',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error in get_sms_status endpoint: {e}")
        return format_response(
            success=False,
            error='STATUS_ERROR',
            message=f'Errore recupero status: {str(e)}',
            state='error'
        ), 500


@sms_v2_bp.route('/sms/test', methods=['POST'])
@jwt_required()
def test_sms_connection():
    """
    Test SMS service connection.
    
    Returns:
        JSON response with connection test result
    """
    try:
        result = sms_service.test_connection()
        
        if result['success']:
            return format_response(
                success=True,
                data=result,
                message='Test connessione SMS completato con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'TEST_FAILED'),
                message=result.get('message', 'Test connessione fallito'),
                data=result,
                state='warning'
            ), 200  # 200 because test completed, but with negative result
            
    except Exception as e:
        logger.error(f"Error in test_sms_connection endpoint: {e}")
        return format_response(
            success=False,
            error='TEST_ERROR',
            message=f'Errore test connessione: {str(e)}',
            state='error'
        ), 500


@sms_v2_bp.route('/sms/preview', methods=['POST'])
@jwt_required()
def preview_sms():
    """
    Preview SMS message without sending.
    
    Request JSON:
    {
        "type": "generic" | "recall",
        "richiamo_data": {...} (for recall preview),
        "message": "Custom message" (for generic preview)
    }
    
    Returns:
        JSON response with message preview
    """
    try:
        data = request.get_json()
        
        if not data:
            return format_response(
                success=False,
                error='REQUEST_DATA_REQUIRED',
                message='Dati richiesta richiesti',
                state='error'
            ), 400
        
        sms_type = data.get('type', 'generic')
        
        if sms_type == 'recall':
            richiamo_data = data.get('richiamo_data')
            if not richiamo_data:
                return format_response(
                    success=False,
                    error='RICHIAMO_DATA_REQUIRED',
                    message='Dati richiamo richiesti per anteprima',
                    state='error'
                ), 400
            
            result = sms_service.preview_recall_message(richiamo_data)
        else:
            message = data.get('message', '')
            result = {
                'success': True,
                'message': message,
                'length': len(message),
                'estimated_sms_parts': (len(message) // 160) + 1,
                'template_used': 'custom'
            }
        
        if result['success']:
            return format_response(
                success=True,
                data=result,
                message='Anteprima SMS generata con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'PREVIEW_FAILED'),
                message=result.get('message', 'Errore generazione anteprima'),
                state='error'
            ), 400
            
    except Exception as e:
        logger.error(f"Error in preview_sms endpoint: {e}")
        return format_response(
            success=False,
            error='PREVIEW_ERROR',
            message=f'Errore generazione anteprima: {str(e)}',
            state='error'
        ), 500


@sms_v2_bp.route('/sms/templates', methods=['GET'])
@jwt_required()
def get_sms_templates():
    """
    Get SMS templates.
    
    Returns:
        JSON response with available templates
    """
    try:
        templates = sms_service.get_sms_templates()
        
        return format_response(
            success=True,
            data=templates,
            message='Template SMS recuperati con successo',
            state='success'
        ), 200
        
    except Exception as e:
        logger.error(f"Error in get_sms_templates endpoint: {e}")
        return format_response(
            success=False,
            error='TEMPLATES_ERROR',
            message=f'Errore recupero template: {str(e)}',
            state='error'
        ), 500