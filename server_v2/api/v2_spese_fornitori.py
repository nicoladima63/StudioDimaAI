"""
Spese Fornitori API V2 for StudioDimaAI.

Modern API endpoints for supplier expenses management with optimized performance.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.spese_fornitori_service import SpeseFornitoService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Create blueprint
spese_fornitori_v2_bp = Blueprint('spese_fornitori_v2', __name__)


@spese_fornitori_v2_bp.route('/fornitori/<int:fornitore_id>/spese', methods=['GET'])
@jwt_required()
def get_spese_fornitore(fornitore_id):
    """
    Get paginated list of expenses for a specific supplier.
    
    Args:
        fornitore_id (int): Supplier ID
        
    Query Parameters:
        page (int): Page number (default: 1)
        per_page (int): Items per page (default: 10, max: 100)
        data_inizio (str): Start date filter (YYYY-MM-DD)
        data_fine (str): End date filter (YYYY-MM-DD)
        search (str): Search term for description/document number
        
    Returns:
        JSON response with expenses list and pagination info
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 100)
        
        # Build filters
        filters = {}
        data_inizio = request.args.get('data_inizio')
        data_fine = request.args.get('data_fine')
        search = request.args.get('search', '').strip()
        
        if data_inizio and data_fine:
            filters['data_inizio'] = data_inizio
            filters['data_fine'] = data_fine
        
        if search:
            filters['search'] = search
        
        # Get expenses using service layer
        spese_service = SpeseFornitoService(g.database_manager)
        result = spese_service.get_spese_by_fornitore(
            fornitore_id=str(fornitore_id),
            page=page,
            per_page=per_page,
            filters=filters
        )
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(result['spese'])
        
        return format_response(
            data={
                'spese': clean_data,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': result['total'],
                    'pages': result['pages'],
                    'has_next': result['has_next'],
                    'has_prev': result['has_prev']
                }
            },
            message=f"Retrieved {len(clean_data)} expenses for supplier {fornitore_id}"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_spese_fornitore: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_spese_fornitore: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_spese_fornitore: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@spese_fornitori_v2_bp.route('/spese/<string:spesa_id>', methods=['GET'])
@jwt_required()
def get_spesa(spesa_id):
    """
    Get specific expense by ID.
    
    Args:
        spesa_id (str): Expense ID
        
    Returns:
        JSON response with expense details
    """
    try:
        user_id = require_auth()
        
        # Get expense using service layer
        spese_service = SpeseFornitoService(g.database_manager)
        spesa = spese_service.get_spesa_by_id(spesa_id)
        
        if not spesa:
            return format_response(
                success=False,
                error=f"Expense with ID {spesa_id} not found"
            ), 404
        
        # Clean DBF data
        clean_data = handle_dbf_data(spesa)
        
        return format_response(
            data=clean_data,
            message="Expense retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_spesa: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_spesa: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_spesa: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@spese_fornitori_v2_bp.route('/spese/<string:spesa_id>/righe', methods=['GET'])
@jwt_required()
def get_righe_spesa(spesa_id):
    """
    Get expense line items/details.
    
    Args:
        spesa_id (str): Expense ID
        
    Returns:
        JSON response with expense line items
    """
    try:
        user_id = require_auth()
        
        # Get expense details using service layer
        spese_service = SpeseFornitoService(g.database_manager)
        righe = spese_service.get_righe_spesa(spesa_id)
        
        # Clean DBF data
        clean_data = handle_dbf_data(righe)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} line items for expense {spesa_id}"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_righe_spesa: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_righe_spesa: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_righe_spesa: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500