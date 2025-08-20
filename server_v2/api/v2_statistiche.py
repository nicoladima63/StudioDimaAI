"""
Statistiche API V2 for StudioDimaAI.

Modern API endpoints for statistics and analytics with optimized
queries and intelligent caching.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.statistiche_service import StatisticheService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Create blueprint
statistiche_v2_bp = Blueprint('statistiche_v2', __name__)


@statistiche_v2_bp.route('/statistiche/fornitori', methods=['GET'])
@jwt_required()
def get_statistiche_fornitori():
    """
    Get supplier statistics with performance optimizations.
    
    Query Parameters:
        categoria (str): Filter by category type
        periodo (str): Time period filter (month, quarter, year)
        use_cache (bool): Use cached results (default: true)
        
    Returns:
        JSON response with supplier statistics
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        categoria = request.args.get('categoria', '').strip()
        periodo = request.args.get('periodo', 'month').strip()
        use_cache = request.args.get('use_cache', True, type=bool)
        
        # Build filters
        filters = {}
        if categoria:
            filters['categoria'] = categoria
        if periodo:
            filters['periodo'] = periodo
        
        # Get statistics using service layer
        statistiche_service = StatisticheService(g.database_manager)
        stats = statistiche_service.get_statistiche_fornitori(
            filters=filters,
            use_cache=use_cache
        )
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(stats)
        
        return format_response(
            data=clean_data,
            message="Supplier statistics retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_statistiche_fornitori: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_statistiche_fornitori: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_statistiche_fornitori: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@statistiche_v2_bp.route('/statistiche/materiali', methods=['GET'])
@jwt_required()
def get_statistiche_materiali():
    """
    Get material statistics with category breakdowns.
    
    Query Parameters:
        categoria (str): Filter by category
        include_trends (bool): Include trend analysis
        
    Returns:
        JSON response with material statistics
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        categoria = request.args.get('categoria', '').strip()
        include_trends = request.args.get('include_trends', False, type=bool)
        
        # Build filters
        filters = {}
        if categoria:
            filters['categoria'] = categoria
        if include_trends:
            filters['include_trends'] = True
        
        # Get statistics using service layer
        statistiche_service = StatisticheService(g.database_manager)
        stats = statistiche_service.get_statistiche_materiali(filters=filters)
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(stats)
        
        return format_response(
            data=clean_data,
            message="Material statistics retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_statistiche_materiali: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_statistiche_materiali: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_statistiche_materiali: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@statistiche_v2_bp.route('/statistiche/collaboratori', methods=['GET'])
@jwt_required()
def get_statistiche_collaboratori():
    """
    Get collaborator statistics and performance metrics.
    
    Returns:
        JSON response with collaborator statistics
    """
    try:
        user_id = require_auth()
        
        # Get statistics using service layer
        statistiche_service = StatisticheService(g.database_manager)
        stats = statistiche_service.get_statistiche_collaboratori()
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(stats)
        
        return format_response(
            data=clean_data,
            message="Collaborator statistics retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_statistiche_collaboratori: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_statistiche_collaboratori: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@statistiche_v2_bp.route('/statistiche/spese', methods=['GET'])
@jwt_required()
def get_statistiche_spese():
    """
    Get expense statistics with category breakdowns.
    
    Query Parameters:
        periodo_inizio (str): Start date (YYYY-MM-DD)
        periodo_fine (str): End date (YYYY-MM-DD)
        gruppo_per (str): Group by category (fornitore, categoria, mese)
        
    Returns:
        JSON response with expense statistics
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        periodo_inizio = request.args.get('periodo_inizio', '').strip()
        periodo_fine = request.args.get('periodo_fine', '').strip()
        gruppo_per = request.args.get('gruppo_per', 'categoria').strip()
        
        # Build filters
        filters = {}
        if periodo_inizio:
            filters['periodo_inizio'] = periodo_inizio
        if periodo_fine:
            filters['periodo_fine'] = periodo_fine
        if gruppo_per:
            filters['gruppo_per'] = gruppo_per
        
        # Get statistics using service layer
        statistiche_service = StatisticheService(g.database_manager)
        stats = statistiche_service.get_statistiche_spese(filters=filters)
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(stats)
        
        return format_response(
            data=clean_data,
            message="Expense statistics retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_statistiche_spese: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_statistiche_spese: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_statistiche_spese: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@statistiche_v2_bp.route('/statistiche/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """
    Get comprehensive dashboard statistics.
    
    Returns:
        JSON response with all key metrics for dashboard
    """
    try:
        user_id = require_auth()
        
        # Get comprehensive statistics using service layer
        statistiche_service = StatisticheService(g.database_manager)
        stats = statistiche_service.get_dashboard_statistics()
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(stats)
        
        return format_response(
            data=clean_data,
            message="Dashboard statistics retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_dashboard_stats: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_dashboard_stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500