"""
Fornitori API V2 for StudioDimaAI.

Modern API endpoints for supplier management with integrated classification
system and optimized performance.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.fornitori_service import FornitoriService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Create blueprint
fornitori_v2_bp = Blueprint('fornitori_v2', __name__)


@fornitori_v2_bp.route('/fornitori', methods=['GET'])
@jwt_required()
def get_fornitori():
    """
    Get list of suppliers with pagination and filtering.
    
    Query Parameters:
        page (int): Page number (default: 1)
        per_page (int): Items per page (default: 50, max: 100)
        search (str): Search term for name/description
        classificato (bool): Filter by classification status
        
    Returns:
        JSON response with suppliers list and pagination info
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        search = request.args.get('search', '').strip()
        classificato = request.args.get('classificato', type=bool)
        
        # Build filters
        filters = {}
        if search:
            filters['search'] = search
        if classificato is not None:
            filters['classificato'] = classificato
        
        # Get suppliers using service layer
        fornitori_service = FornitoriService(g.database_manager)
        result = fornitori_service.get_fornitori_paginated(
            page=page,
            per_page=per_page,
            filters=filters
        )
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(result['fornitori'])
        
        return format_response(
            data={
                'fornitori': clean_data,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': result['total'],
                    'pages': result['pages'],
                    'has_next': result['has_next'],
                    'has_prev': result['has_prev']
                }
            },
            message=f"Retrieved {len(clean_data)} suppliers"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_fornitori: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_fornitori: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_fornitori: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@fornitori_v2_bp.route('/fornitori/<int:fornitore_id>', methods=['GET'])
@jwt_required()
def get_fornitore(fornitore_id):
    """
    Get specific supplier by ID with classification details.
    
    Args:
        fornitore_id (int): Supplier ID
        
    Returns:
        JSON response with supplier details and classification
    """
    try:
        user_id = require_auth()
        
        # Get supplier using service layer
        fornitori_service = FornitoriService(g.database_manager)
        fornitore = fornitori_service.get_fornitore_by_id(fornitore_id)
        
        if not fornitore:
            return format_response(
                success=False,
                error=f"Supplier with ID {fornitore_id} not found"
            ), 404
        
        # Clean DBF data
        clean_data = handle_dbf_data(fornitore)
        
        return format_response(
            data=clean_data,
            message="Supplier retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_fornitore: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_fornitore: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_fornitore: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@fornitori_v2_bp.route('/fornitori/<int:fornitore_id>/classificazione', methods=['PUT'])
@jwt_required()
def update_classificazione(fornitore_id):
    """
    Update supplier classification.
    
    Args:
        fornitore_id (int): Supplier ID
        
    Request Body:
        contoid (int): Account ID (required)
        brancaid (int): Branch ID (optional)
        sottocontoid (int): Sub-account ID (optional)
        
    Returns:
        JSON response with updated classification
    """
    try:
        user_id = require_auth()
        
        # Validate request data
        if not request.is_json:
            return format_response(
                success=False,
                error="Content-Type must be application/json"
            ), 400
        
        data = request.get_json()
        
        # Required fields validation
        if not data.get('contoid'):
            return format_response(
                success=False,
                error="Field 'contoid' is required"
            ), 400
        
        # Update classification using service layer
        fornitori_service = FornitoriService(g.database_manager)
        result = fornitori_service.update_classificazione(
            fornitore_id=fornitore_id,
            contoid=data['contoid'],
            brancaid=data.get('brancaid', 0),
            sottocontoid=data.get('sottocontoid', 0),
            updated_by=user_id
        )
        
        if not result['success']:
            return format_response(
                success=False,
                error=result.get('error', 'Classification update failed')
            ), 400
        
        return format_response(
            data=result['data'],
            message="Classification updated successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in update_classificazione: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in update_classificazione: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in update_classificazione: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@fornitori_v2_bp.route('/fornitori/<int:fornitore_id>/suggest-categoria', methods=['GET'])
@jwt_required()
def suggest_categoria(fornitore_id):
    """
    Get intelligent category suggestions for supplier.
    
    Args:
        fornitore_id (int): Supplier ID
        
    Returns:
        JSON response with category suggestions
    """
    try:
        user_id = require_auth()
        
        # Get suggestions using service layer
        fornitori_service = FornitoriService(g.database_manager)
        suggestions = fornitori_service.suggest_categoria(fornitore_id)
        
        return format_response(
            data=suggestions,
            message="Category suggestions retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in suggest_categoria: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in suggest_categoria: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in suggest_categoria: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@fornitori_v2_bp.route('/fornitori/stats', methods=['GET'])
@jwt_required()
def get_fornitori_stats():
    """
    Get suppliers statistics and classification analytics.
    
    Returns:
        JSON response with statistics
    """
    try:
        user_id = require_auth()
        
        # Get statistics using service layer
        fornitori_service = FornitoriService(g.database_manager)
        stats = fornitori_service.get_statistics()
        
        return format_response(
            data=stats,
            message="Statistics retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_fornitori_stats: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_fornitori_stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500