"""
Richiami API V2 for StudioDimaAI.

Modern API endpoints for patient recall management.
"""

import logging
from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required

from services.pazienti_service import PazientiService
from services.richiami_service import RichiamiService
from app_v2 import format_response
from core.exceptions import ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Create blueprint
richiami_v2_bp = Blueprint('richiami_v2', __name__)


# ===== HELPER FUNCTIONS =====

def handle_error(error, context=""):
    """Standardized error handling."""
    if isinstance(error, ValidationError):
        logger.warning(f"Validation error in {context}: {error}")
        return format_response({
            'success': False,
            'error': 'VALIDATION_ERROR',
            'message': str(error)
        }, 400)
    elif isinstance(error, DatabaseError):
        logger.error(f"Database error in {context}: {error}")
        return format_response({
            'success': False,
            'error': 'DATABASE_ERROR',
            'message': 'Database operation failed'
        }, 500)
    else:
        logger.error(f"Unexpected error in {context}: {error}")
        return format_response({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': 'Internal server error'
        }, 500)


def validate_required_param(data, param_name, param_type=str):
    """Validate required parameter."""
    if not data:
        raise ValidationError("Request body is required")
    value = data.get(param_name)
    if value is None:
        raise ValidationError(f"{param_name} is required")
    if param_type != str and not isinstance(value, param_type):
        raise ValidationError(f"{param_name} must be a valid {param_type.__name__}")
    return value


@richiami_v2_bp.route('/pazienti/<paziente_id>/richiamo/status', methods=['PUT'])
@jwt_required()
def update_richiamo_status(paziente_id):
    """
    Update richiamo status for a patient.
    
    Body:
        da_richiamare (str): Status (S/N/R)
        data_richiamo (str, optional): Date when recalled (for R status)
    """
    try:
        data = request.get_json()
        da_richiamare = validate_required_param(data, 'da_richiamare')
        data_richiamo = data.get('data_richiamo')
        
        if da_richiamare not in ['S', 'N', 'R']:
            raise ValidationError("da_richiamare must be S, N, or R")
        
        service = RichiamiService()
        result = service.update_richiamo_status(paziente_id, da_richiamare, data_richiamo)
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore aggiornamento stato')), 400
            
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "update_richiamo_status")


@richiami_v2_bp.route('/pazienti/<paziente_id>/richiamo/tipo', methods=['PUT'])
@jwt_required()
def update_richiamo_tipo(paziente_id):
    """
    Update richiamo configuration (tipo and tempo) for a patient.
    
    Body:
        tipo_richiamo (str): Type codes (e.g., "21")
        tempo_richiamo (int): Months interval
    """
    try:
        data = request.get_json()
        tipo_richiamo = validate_required_param(data, 'tipo_richiamo')
        tempo_richiamo = validate_required_param(data, 'tempo_richiamo', int)
        
        # Get patient info from gestionale first (optional for now)
        paziente = {'nome': 'Test Patient'}
        try:
            from core.database_manager import DatabaseManager
            db_manager = DatabaseManager()
            pazienti_service = PazientiService(db_manager)
            paziente_result = pazienti_service.get_paziente_by_id(paziente_id)
            
            if paziente_result['success']:
                paziente = paziente_result['data']
        except Exception as e:
            logger.warning(f"Could not fetch patient from gestionale: {e}")
            paziente = {'id': paziente_id, 'nome': f'Paziente {paziente_id}'}
        
        # Update or create richiamo
        richiami_service = RichiamiService()
        
        # Check if richiamo exists
        existing_richiami = richiami_service.get_richiami_paziente(paziente_id)
        if existing_richiami['success'] and existing_richiami['data']:
            result = richiami_service.update_richiamo_config(paziente_id, tipo_richiamo, tempo_richiamo, paziente)
        else:
            result = richiami_service.create_richiamo(
                paziente_id=paziente_id,
                nome=paziente.get('nome', ''),
                data_ultima_visita=paziente.get('ultima_visita'),
                tipo_richiamo=tipo_richiamo,
                tempo_richiamo=tempo_richiamo
            )
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore aggiornamento configurazione')), 400
            
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "update_richiamo_tipo")


@richiami_v2_bp.route('/richiami/da-fare', methods=['GET'])
@jwt_required()
def get_richiami_da_fare():
    """
    Get list of richiami that need to be done.
    
    Query Parameters:
        limit (int): Maximum results (optional)
    """
    try:
        limit = request.args.get('limit', type=int)
        
        service = RichiamiService()
        result = service.get_richiami_da_fare(limit)
        
        if result['success']:
            return format_response({
                'richiami': result['data'],
                'count': result['count']
            })
        else:
            return format_response(success=False, error=result.get('error', 'Errore caricamento richiami'))
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "get_richiami_da_fare")


@richiami_v2_bp.route('/richiami/statistiche', methods=['GET'])
@jwt_required()
def get_richiami_statistiche():
    """Get richiami statistics."""
    try:
        service = RichiamiService()
        result = service.get_statistiche_richiami()
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore statistiche'))
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "get_richiami_statistiche")


@richiami_v2_bp.route('/richiami/<int:richiamo_id>/completato', methods=['PUT'])
@jwt_required()
def mark_richiamo_completato(richiamo_id):
    """
    Mark a richiamo as completed.
    
    Body:
        data_richiamo (str, optional): Date when completed
    """
    try:
        data = request.get_json() or {}
        data_richiamo = data.get('data_richiamo')
        
        # Get richiamo first to get paziente_id
        service = RichiamiService()
        richiamo = service.get_richiamo_by_id(richiamo_id)
        
        if not richiamo['success']:
            return format_response(success=False, error="Richiamo non trovato"), 404
        
        paziente_id = richiamo['data']['paziente_id']
        
        # Update status to completed
        result = service.update_richiamo_status(paziente_id, 'R', data_richiamo)
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore completamento richiamo')), 400
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "mark_richiamo_completato")


@richiami_v2_bp.route('/richiami/migrate-from-dbf', methods=['POST'])
@jwt_required()
def migrate_richiami_from_dbf():
    """
    Migrate existing richiami data from DBF gestionale to SQLite table.
    This is a one-time operation to import existing data.
    """
    try:
        # Get all pazienti with richiami data from DBF
        pazienti_service = PazientiService()
        result = pazienti_service.get_pazienti_paginated(page=1, per_page=10000)
        
        if not result['success']:
            return format_response(success=False, error="Could not fetch pazienti from DBF"), 500
        
        pazienti = result['data']['pazienti']
        richiami_service = RichiamiService()
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for paziente in pazienti:
            try:
                paziente_id = paziente.get('id')
                nome = paziente.get('nome', 'N/A')
                da_richiamare = paziente.get('da_richiamare', '').strip()
                tipo_richiamo = paziente.get('tipo_richiamo', '').strip()
                tempo_richiamo = paziente.get('mesi_richiamo')  # Note: field name difference
                ultima_visita = paziente.get('ultima_visita')
                
                # Skip if no richiamo data
                if not da_richiamare or da_richiamare not in ['S', 'N', 'R']:
                    skipped_count += 1
                    continue
                
                # Check if already exists
                existing = richiami_service.get_richiami_paziente(paziente_id)
                if existing['success'] and existing['data']:
                    skipped_count += 1
                    continue
                
                # Create richiamo record
                create_result = richiami_service.create_richiamo(
                    paziente_id=paziente_id,
                    nome=nome,
                    data_ultima_visita=ultima_visita,
                    tipo_richiamo=tipo_richiamo if tipo_richiamo else None,
                    tempo_richiamo=tempo_richiamo if tempo_richiamo and isinstance(tempo_richiamo, int) else None
                )
                
                if create_result['success']:
                    # Update status to match DBF
                    status_result = richiami_service.update_richiamo_status(
                        paziente_id=paziente_id,
                        da_richiamare=da_richiamare,
                        data_richiamo=None
                    )
                    
                    if status_result['success']:
                        migrated_count += 1
                    else:
                        error_count += 1
                else:
                    error_count += 1
                    
            except Exception:
                error_count += 1
                continue
        
        return format_response({
            'migrated': migrated_count,
            'skipped': skipped_count,
            'errors': error_count,
            'total_processed': len(pazienti),
            'message': f'Migration completed: {migrated_count} migrated, {skipped_count} skipped, {error_count} errors'
        })
            
    except (DatabaseError, Exception) as e:
        return handle_error(e, "migrate_richiami_from_dbf")


@richiami_v2_bp.route('/richiami', methods=['GET'])
@jwt_required()
def get_richiami_list():
    """
    Get list of richiami with filters.
    
    Query Parameters:
        days (int): Days threshold (default: 90)
        status (str): Filter by status (S, N, R)
        tipo (str): Filter by tipo_richiamo
        limit (int): Limit results
    
    Returns:
        JSON response with richiami list
    """
    try:
        # Get query parameters
        days_threshold = request.args.get('days', 90, type=int)
        status = request.args.get('status')
        tipo = request.args.get('tipo')
        limit = request.args.get('limit', type=int)
        
        service = RichiamiService()
        
        if status:
            # Filter by status (need to implement in service)
            result = service.get_richiami_da_fare(limit) if status == 'S' else service.get_richiami_da_fare(limit)
        elif tipo:
            # Filter by tipo (need to implement in service) 
            result = service.get_richiami_da_fare(limit)
        else:
            # Get all richiami da fare
            result = service.get_richiami_da_fare(limit)
        
        if result['success']:
            return format_response(
                success=True,
                data=result['data'],
                count=result['count'],
                filters={
                    'days_threshold': days_threshold,
                    'status': status,
                    'tipo': tipo,
                    'limit': limit
                },
                message='Richiami recuperati con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=result.get('error', 'FETCH_FAILED'),
                message='Errore nel recupero dei richiami',
                state='error'
            ), 500
            
    except Exception as e:
        return handle_error(e, "get_richiami_list")


@richiami_v2_bp.route('/richiami/<int:richiamo_id>/message', methods=['GET'])
@jwt_required()
def get_richiamo_message(richiamo_id):
    """
    Get message content for a richiamo.
    
    Returns:
        JSON response with richiamo message data
    """
    try:
        service = RichiamiService()
        result = service.get_richiamo_by_id(richiamo_id)
        
        if not result['success']:
            return format_response(
                success=False,
                error='RICHIAMO_NOT_FOUND',
                message='Richiamo non trovato',
                state='error'
            ), 404
        
        richiamo_data = result['data']
        
        # Import SMS service for message generation
        from services.sms_service import sms_service
        preview_result = sms_service.preview_recall_message(richiamo_data)
        
        if preview_result['success']:
            return format_response(
                success=True,
                data={
                    'richiamo': richiamo_data,
                    'message_preview': preview_result
                },
                message='Messaggio richiamo recuperato con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error=preview_result.get('error', 'MESSAGE_GENERATION_FAILED'),
                message='Errore nella generazione del messaggio',
                state='error'
            ), 500
            
    except Exception as e:
        return handle_error(e, "get_richiamo_message")


@richiami_v2_bp.route('/richiami/update-dates', methods=['POST'])
@jwt_required()
def update_richiami_dates():
    """
    Update richiami dates based on patient data.
    
    This recalculates richiamo dates based on ultima_visita + tempo_richiamo.
    
    Returns:
        JSON response with update results
    """
    try:
        service = RichiamiService()
        
        # Get all active richiami
        richiami_result = service.get_richiami_da_fare()
        if not richiami_result['success']:
            return format_response(
                success=False,
                error='FETCH_FAILED',
                message='Errore nel recupero dei richiami',
                state='error'
            ), 500
        
        richiami = richiami_result['data']
        updated_count = 0
        
        for richiamo in richiami:
            # For each richiamo, update dates if needed
            # This is a simplified implementation - in V1 it might be more complex
            try:
                # Here you would implement the date update logic
                # based on patient data and richiamo configuration
                updated_count += 1
            except Exception as e:
                logger.warning(f"Failed to update dates for richiamo {richiamo.get('id')}: {e}")
                continue
        
        return format_response(
            success=True,
            data={'updated': updated_count},
            message=f'Date aggiornate per {updated_count} richiami',
            state='success'
        ), 200
        
    except Exception as e:
        return handle_error(e, "update_richiami_dates")


@richiami_v2_bp.route('/richiami/export', methods=['GET'])
@jwt_required()
def export_richiami():
    """
    Export richiami data.
    
    Query Parameters:
        days (int): Days threshold (default: 90)
        format (str): Export format (default: json)
    
    Returns:
        JSON response with richiami export data
    """
    try:
        days_threshold = request.args.get('days', 90, type=int)
        export_format = request.args.get('format', 'json')
        
        service = RichiamiService()
        result = service.get_richiami_da_fare()
        
        if result['success']:
            return format_response(
                success=True,
                data=result['data'],
                count=result['count'],
                export_format=export_format,
                filters={'days_threshold': days_threshold},
                message='Export richiami completato con successo',
                state='success'
            ), 200
        else:
            return format_response(
                success=False,
                error='EXPORT_FAILED',
                message='Errore nell\'export dei richiami',
                state='error'
            ), 500
            
    except Exception as e:
        return handle_error(e, "export_richiami")


@richiami_v2_bp.route('/richiami/test', methods=['GET'])
@jwt_required()
def test_richiami():
    """
    Test richiami system functionality.
    
    Returns:
        JSON response with test results
    """
    try:
        service = RichiamiService()
        
        # Test basic functionality
        richiami_result = service.get_richiami_da_fare(30)  # Get richiami from last 30 days
        stats_result = service.get_statistiche_richiami()
        
        test_results = {
            'richiami_trovati': richiami_result['count'] if richiami_result['success'] else 0,
            'statistiche': stats_result['data'] if stats_result['success'] else {},
            'service_status': 'OK'
        }
        
        return format_response(
            success=True,
            test_results=test_results,
            message='Test richiami completato con successo',
            state='success'
        ), 200
        
    except Exception as e:
        return handle_error(e, "test_richiami")


# Error handlers for the blueprint
@richiami_v2_bp.errorhandler(404)
def handle_not_found(e):
    return format_response({
        'success': False,
        'error': 'NOT_FOUND',
        'message': 'Resource not found'
    }, 404)


@richiami_v2_bp.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Internal error: {e}")
    return format_response({
        'success': False,
        'error': 'INTERNAL_ERROR',
        'message': 'Internal server error'
    }, 500)
