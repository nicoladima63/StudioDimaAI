"""
Pazienti API V2 for StudioDimaAI.

Modern API endpoints for patient management with optimized performance.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.pazienti_service import PazientiService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Create blueprint
pazienti_v2_bp = Blueprint('pazienti_v2', __name__)


# ===== HELPER FUNCTIONS =====

def handle_error(error, context=""):
    """
    Standardized error handling for all endpoints.
    
    Args:
        error: The exception object
        context: Context string for logging (e.g., "get_pazienti")
    
    Returns:
        Tuple of (response, status_code)
    """
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


def validate_pagination_params(page, per_page):
    """
    Validate pagination parameters.
    
    Args:
        page: Page number
        per_page: Items per page
    
    Raises:
        ValidationError: If parameters are invalid
    """
    if page < 1:
        raise ValidationError("Page must be >= 1")
    if per_page < 1:
        raise ValidationError("Per page must be >= 1")


@pazienti_v2_bp.route('/pazienti', methods=['GET'])
@jwt_required()
def get_pazienti():
    """
    Get list of patients with pagination and filtering.
    
    Query Parameters:
        page (int): Page number (default: 1)
        per_page (int): Items per page (default: 50, max: 100)
        search (str): Search term for name or codice fiscale
        da_richiamare (bool): Filter by patients to recall
        in_cura (bool): Filter by patients in care
        all (int): If 1, load all patients without pagination
    
    Returns:
        JSON response with paginated patients list
    """
    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        search = request.args.get('search', '').strip()
        da_richiamare = request.args.get('da_richiamare', type=bool)
        in_cura = request.args.get('in_cura', type=bool)
        load_all = request.args.get('all', 0, type=int)
        
        # Validate parameters
        validate_pagination_params(page, per_page)
        
        # If load_all is requested, set high per_page
        if load_all:
            per_page = 10000
            page = 1
        
        # Build filters
        filters = {}
        if search:
            filters['search'] = search
        if da_richiamare is not None:
            filters['da_richiamare'] = da_richiamare
        if in_cura is not None:
            filters['in_cura'] = in_cura
        
        # Get pazienti data
        service = PazientiService(g.database_manager)
        result = service.get_pazienti_paginated(
            page=page,
            per_page=per_page,
            filters=filters
        )
        
        # Return response
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore caricamento pazienti'))
        
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "get_pazienti")


@pazienti_v2_bp.route('/pazienti/<paziente_id>', methods=['GET'])
@jwt_required()
def get_paziente(paziente_id):
    """
    Get single patient by ID.
    
    Args:
        paziente_id (str): Patient ID
    
    Returns:
        JSON response with patient details
    """
    try:
        if not paziente_id:
            raise ValidationError("Patient ID is required")
        
        service = PazientiService(g.database_manager)
        result = service.get_paziente_by_id(paziente_id)
        
        if not result['success']:
            return format_response(success=False, error=result.get('error', 'Paziente non trovato')), 404
        
        return format_response(result['data'])
        
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "get_paziente")


@pazienti_v2_bp.route('/pazienti/search', methods=['GET'])
@jwt_required()
def search_pazienti():
    """
    Search patients by name, codice fiscale or telefono.

    Query Parameters:
        q (str): Search query (required)
        limit (int): Maximum results (default: 20, max: 100)
        telefono (str): Search by phone number (optional, alternative to q)

    Returns:
        JSON response with search results
    """
    try:
        query = request.args.get('q', '').strip()
        telefono = request.args.get('telefono', '').strip()
        limit = min(request.args.get('limit', 20, type=int), 100)

        if not query and not telefono:
            raise ValidationError("Search query is required")
        if query and len(query) < 2:
            raise ValidationError("Search query must be at least 2 characters")

        service = PazientiService(g.database_manager)
        result = service.search_pazienti(query, limit, telefono=telefono)
        
        if result['success']:
            return format_response({
                'pazienti': result['data'],
                'count': result['count'],
                'query': result['query']
            })
        else:
            return format_response(success=False, error=result.get('error', 'Errore ricerca pazienti'))
        
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "search_pazienti")


@pazienti_v2_bp.route('/pazienti/stats', methods=['GET'])
@jwt_required()
def get_pazienti_stats():
    """
    Get patients statistics.
    
    Returns:
        JSON response with statistics
    """
    try:
        service = PazientiService(g.database_manager)
        
        # Get all patients for stats (using high per_page)
        result = service.get_pazienti_paginated(page=1, per_page=10000)
        
        if not result['success']:
            return format_response(success=False, error=result.get('error', 'Errore caricamento pazienti')), 500
        
        pazienti = result['data']['pazienti']
        
        # Calculate statistics
        stats = {
            'totale_pazienti': len(pazienti),
            'da_richiamare': len([p for p in pazienti if p.get('da_richiamare') == 'S']),
            'in_cura': len([p for p in pazienti if not p.get('non_in_cura', False)]),
            'non_in_cura': len([p for p in pazienti if p.get('non_in_cura', False)]),
            'con_email': len([p for p in pazienti if p.get('email')]),
            'con_cellulare': len([p for p in pazienti if p.get('cellulare')])
        }
        
        return format_response(stats)
        
    except Exception as e:
        logger.error(f"Error in get_pazienti_stats: {e}")
        return format_response({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': 'Internal server error'
        }, 500)


# Error handlers for the blueprint
@pazienti_v2_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return format_response({
        'success': False,
        'error': 'VALIDATION_ERROR',
        'message': str(e)
    }, 400)


@pazienti_v2_bp.errorhandler(DatabaseError)
def handle_database_error(e):
    logger.error(f"Database error: {e}")
    return format_response({
        'success': False,
        'error': 'DATABASE_ERROR',
        'message': 'Database operation failed'
    }, 500)


# Error handlers for the blueprint
@pazienti_v2_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return format_response({
        'success': False,
        'error': 'VALIDATION_ERROR',
        'message': str(e)
    }, 400)


@pazienti_v2_bp.errorhandler(DatabaseError)
def handle_database_error(e):
    logger.error(f"Database error: {e}")
    return format_response({
        'success': False,
        'error': 'DATABASE_ERROR',
        'message': 'Database operation failed'
    }, 500)
