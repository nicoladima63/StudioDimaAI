"""
Piani di Cura API V2 for StudioDimaAI.

Modern READ-ONLY API endpoints for treatment plans.
"""

import logging
from flask import Blueprint, g
from flask_jwt_extended import jwt_required

from services.piani_cura_service import PianiCuraService
from app_v2 import format_response
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)

# Create blueprint
piani_cura_v2_bp = Blueprint('piani_cura_v2', __name__)


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


# ===== ENDPOINTS =====

@piani_cura_v2_bp.route('/pazienti/<paziente_id>/piani-cura', methods=['GET'])
@jwt_required()
def get_piani_paziente(paziente_id):
    """
    Get all treatment plans for a patient.
    
    Args:
        paziente_id: Patient ID
        
    Returns:
        JSON response with treatment plans list and statistics
    """
    try:
        service = PianiCuraService(g.database_manager)
        result = service.get_piani_paziente(paziente_id)
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Errore recupero piani'))
            
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "get_piani_paziente")


@piani_cura_v2_bp.route('/piani-cura/<piano_id>', methods=['GET'])
@jwt_required()
def get_piano_dettaglio(piano_id):
    """
    Get detailed treatment plan with all procedures.
    
    Args:
        piano_id: Treatment plan ID
        
    Returns:
        JSON response with complete plan details and procedures
    """
    try:
        service = PianiCuraService(g.database_manager)
        result = service.get_piano_dettaglio(piano_id)
        
        if result['success']:
            return format_response(result['data'])
        else:
            return format_response(success=False, error=result.get('error', 'Piano non trovato')), 404
            
    except (ValidationError, DatabaseError, Exception) as e:
        return handle_error(e, "get_piano_dettaglio")


# Error handlers for the blueprint
@piani_cura_v2_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return format_response({
        'success': False,
        'error': 'VALIDATION_ERROR',
        'message': str(e)
    }, 400)


@piani_cura_v2_bp.errorhandler(DatabaseError)
def handle_database_error(e):
    logger.error(f"Database error: {e}")
    return format_response({
        'success': False,
        'error': 'DATABASE_ERROR',
        'message': 'Database operation failed'
    }, 500)
