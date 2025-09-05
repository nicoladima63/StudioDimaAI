"""
Materiali API V2 for StudioDimaAI.

Modern API endpoints for materials management using the new service layer
architecture and optimized database access patterns.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.materiali_service import MaterialiService
from services.materiali_migration_service import MaterialiMigrationService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError, DbfProcessingError
from core.database_manager import get_database_manager
from datetime import datetime


logger = logging.getLogger(__name__)

# Create blueprint
materiali_v2_bp = Blueprint('materiali_v2', __name__)


@materiali_v2_bp.route('/materiali', methods=['GET'])
@jwt_required()
def get_materiali():
    """
    Get list of materials with pagination and filtering.
    
    Query Parameters:
        page (int): Page number (default: 1)
        per_page (int): Items per page (default: 50, max: 100)
        search (str): Search term for name/description
        categoria (str): Filter by category
        fornitore_id (int): Filter by supplier ID
        classificato (bool): Filter by classification status
        
    Returns:
        JSON response with materials list and pagination info
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        search = request.args.get('search', '').strip()
        categoria = request.args.get('categoria', '').strip()
        fornitore_id = request.args.get('fornitore_id', type=int)
        classificato = request.args.get('classificato', type=bool)
        
        # Build filters
        filters = {}
        if search:
            filters['search'] = search
        if categoria:
            filters['categoria'] = categoria
        if fornitore_id:
            filters['fornitore_id'] = fornitore_id
        if classificato is not None:
            filters['classificato'] = classificato
        
        # Get materials using service layer
        materiali_service = MaterialiService(g.database_manager)
        result = materiali_service.get_materiali_paginated(
            page=page,
            per_page=per_page,
            filters=filters
        )
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(result['materiali'])
        
        return format_response(
            data={
                'materiali': clean_data,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': result['total'],
                    'pages': result['pages'],
                    'has_next': result['has_next'],
                    'has_prev': result['has_prev']
                }
            },
            message=f"Retrieved {len(clean_data)} materials"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_materiali: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_materiali: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_materiali: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@materiali_v2_bp.route('/materiali/<int:materiale_id>', methods=['GET'])
@jwt_required()
def get_materiale(materiale_id):
    """
    Get specific material by ID with full details.
    
    Args:
        materiale_id (int): Material ID
        
    Returns:
        JSON response with material details
    """
    try:
        user_id = require_auth()
        
        # Get material using service layer
        materiali_service = MaterialiService(g.database_manager)
        materiale = materiali_service.get_materiale_by_id(materiale_id)
        
        if not materiale:
            return format_response(
                success=False,
                error=f"Material with ID {materiale_id} not found"
            ), 404
        
        # Clean DBF data
        clean_data = handle_dbf_data(materiale)
        
        return format_response(
            data=clean_data,
            message="Material retrieved successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_materiale: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_materiale: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_materiale: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@materiali_v2_bp.route('/materiali', methods=['POST'])
@jwt_required()
def create_materiale():
    """
    Create new material.
    
    Request Body:
        nome (str): Material name (required)
        descrizione (str): Material description
        categoria (str): Material category
        fornitore_id (int): Supplier ID
        prezzo (float): Material price
        unita_misura (str): Unit of measurement
        codice_fornitore (str): Supplier code
        
    Returns:
        JSON response with created material
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
        required_fields = ['nome']
        for field in required_fields:
            if not data.get(field):
                return format_response(
                    success=False,
                    error=f"Field '{field}' is required"
                ), 400
        
        # Create material using service layer
        materiali_service = MaterialiService(g.database_manager)
        materiale = materiali_service.create_materiale(data, created_by=user_id)
        
        # Clean DBF data
        clean_data = handle_dbf_data(materiale)
        
        return format_response(
            data=clean_data,
            message="Material created successfully"
        ), 201
        
    except ValidationError as e:
        logger.warning(f"Validation error in create_materiale: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in create_materiale: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in create_materiale: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@materiali_v2_bp.route('/materiali/<int:materiale_id>', methods=['PUT'])
@jwt_required()
def update_materiale(materiale_id):
    """
    Update existing material.
    
    Args:
        materiale_id (int): Material ID
        
    Request Body:
        Fields to update (partial updates supported)
        
    Returns:
        JSON response with updated material
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
        
        # Update material using service layer
        materiali_service = MaterialiService(g.database_manager)
        materiale = materiali_service.update_materiale(
            materiale_id, 
            data, 
            updated_by=user_id
        )
        
        if not materiale:
            return format_response(
                success=False,
                error=f"Material with ID {materiale_id} not found"
            ), 404
        
        # Clean DBF data
        clean_data = handle_dbf_data(materiale)
        
        return format_response(
            data=clean_data,
            message="Material updated successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in update_materiale: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in update_materiale: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in update_materiale: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@materiali_v2_bp.route('/materiali/<int:materiale_id>', methods=['DELETE'])
@jwt_required()
def delete_materiale(materiale_id):
    """
    Delete material (soft delete).
    
    Args:
        materiale_id (int): Material ID
        
    Returns:
        JSON response with deletion confirmation
    """
    try:
        user_id = require_auth()
        
        # Delete material using service layer
        materiali_service = MaterialiService(g.database_manager)
        success = materiali_service.delete_materiale(materiale_id, deleted_by=user_id)
        
        if not success:
            return format_response(
                success=False,
                error=f"Material with ID {materiale_id} not found"
            ), 404
        
        return format_response(
            message="Material deleted successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in delete_materiale: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in delete_materiale: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in delete_materiale: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@materiali_v2_bp.route('/materiali/search', methods=['GET'])
@jwt_required()
def search_materiali():
    """
    Advanced material search with intelligent suggestions.
    
    Query Parameters:
        q (str): Search query (required)
        limit (int): Max results (default: 20, max: 100)
        include_suggestions (bool): Include intelligent suggestions
        
    Returns:
        JSON response with search results and suggestions
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        query = request.args.get('q', '').strip()
        limit = min(request.args.get('limit', 20, type=int), 100)
        include_suggestions = request.args.get('include_suggestions', True, type=bool)
        
        if not query:
            return format_response(
                success=False,
                error="Search query 'q' is required"
            ), 400
        
        # Search using service layer
        materiali_service = MaterialiService(g.database_manager)
        results = materiali_service.search_materiali(
            query=query,
            limit=limit,
            include_suggestions=include_suggestions
        )
        
        # Clean DBF data
        clean_results = handle_dbf_data(results['materiali'])
        clean_suggestions = handle_dbf_data(results.get('suggestions', []))
        
        return format_response(
            data={
                'materiali': clean_results,
                'suggestions': clean_suggestions,
                'query': query,
                'total_found': len(clean_results)
            },
            message=f"Found {len(clean_results)} materials"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in search_materiali: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in search_materiali: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in search_materiali: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@materiali_v2_bp.route('/materiali/stats', methods=['GET'])
@jwt_required()
def get_materiali_stats():
    """
    Get materials statistics and analytics.
    
    Returns:
        JSON response with statistics
    """
    try:
        user_id = require_auth()
        
        # Get statistics using service layer
        materiali_service = MaterialiService(g.database_manager)
        stats = materiali_service.get_statistics()
        
        return format_response(
            data=stats,
            message="Statistics retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_materiali_stats: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_materiali_stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


# ============================================================================
# MATERIALI MIGRATION ENDPOINTS
# ============================================================================

@materiali_v2_bp.route('/materiali/migrazione/preview', methods=['GET'])
@materiali_v2_bp.route('/materiali/migrazione/preview/<fornitore_id>', methods=['GET'])
@jwt_required()
def preview_migration(fornitore_id=None):
    """
    Preview materials migration without actually migrating.
    Shows what materials would be migrated and their classification.
    If fornitore_id is provided, shows only materials for that supplier.
    """
    try:
        user_id = require_auth()
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Read and filter materials without saving to database
        materials_data = migration_service.read_spesafo_data()
        
        # If fornitore_id is specified, filter materials for that supplier only
        if fornitore_id:
            materials_data = [
                material for material in materials_data 
                if material.get('fornitoreid', '') == fornitore_id
            ]
            logger.info(f"Filtered materials for supplier {fornitore_id}: {len(materials_data)} materials")
        
        classified_materials = migration_service.filter_materials_by_classification(materials_data)
        
        # Group by supplier for frontend display
        suppliers_data = {}
        for material in classified_materials:
            supplier_name = material.get('fornitore_normalizzato', 'Unknown')
            if supplier_name not in suppliers_data:
                suppliers_data[supplier_name] = {
                    'fornitore': supplier_name,
                    'materiali': [],
                    'count': 0
                }
            suppliers_data[supplier_name]['materiali'].append(material)
            suppliers_data[supplier_name]['count'] += 1
        
        # Create preview statistics matching frontend interface
        stats = {
            'total_valid_materials': len(materials_data),
            'dental_materials': len(classified_materials),
            'suppliers_with_materials': len(suppliers_data)
        }
        
        # Transform suppliers data to match frontend interface
        suppliers_list = []
        for supplier_name, supplier_data in suppliers_data.items():
            suppliers_list.append({
                'fornitore_nome': supplier_name,
                'fornitore_originale': supplier_name,  # Could be enhanced to show original name
                'materiali_count': supplier_data['count'],
                'materiali': supplier_data['materiali']
            })
        
        # If fornitore_id is specified, return single supplier data directly
        if fornitore_id and suppliers_list:
            return format_response(
                data=suppliers_list[0],  # Return first (and only) supplier directly
                message="Supplier preview generated successfully"
            )
        
        # Otherwise return full preview structure
        return format_response(
            data={
                'suppliers': suppliers_list,
                'total_suppliers': len(suppliers_list),
                'total_materials': len(classified_materials),
                'stats': stats,
                'preview_generated_at': datetime.now().isoformat()
            },
            message="Migration preview generated successfully"
        )
        
    except DbfProcessingError as e:
        logger.error(f"DBF processing error in preview: {e}")
        return format_response(
            success=False,
            error=f"DBF processing error: {str(e)}"
        ), 500
    except Exception as e:
        logger.error(f"Error in preview_migration: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred during preview"
        ), 500


@materiali_v2_bp.route('/materiali/migrazione/import/<supplier_name>', methods=['POST'])
@jwt_required()
def import_supplier_materials(supplier_name):
    """
    Import materials for a specific supplier.
    """
    try:
        user_id = require_auth()
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Read and filter materials
        materials_data = migration_service.read_spesafo_data()
        classified_materials = migration_service.filter_materials_by_classification(materials_data)
        
        # Filter by supplier
        supplier_materials = [
            m for m in classified_materials 
            if m.get('fornitore_normalizzato', '').lower() == supplier_name.lower()
        ]
        
        if not supplier_materials:
            return format_response(
                success=False,
                error=f"No materials found for supplier: {supplier_name}"
            ), 404
        
        # Import materials for this supplier
        result = migration_service.import_materials_for_supplier(supplier_name, supplier_materials)
        
        return format_response(
            data=result,
            message=f"Successfully imported {result.get('imported_count', 0)} materials for {supplier_name}"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in import_supplier_materials: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
    except DatabaseError as e:
        logger.error(f"Database error in import_supplier_materials: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
    except Exception as e:
        logger.error(f"Error in import_supplier_materials: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred during import"
        ), 500


@materiali_v2_bp.route('/materiali/migrazione/import-all', methods=['POST'])
@jwt_required()
def import_all_materials():
    """
    Import all identified dental materials.
    """
    try:
        user_id = require_auth()
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(db_manager)
        
        # Execute full migration
        result = migration_service.run_full_migration()
        
        return format_response(
            data=result,
            message="Full migration completed successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in import_all_materials: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
    except DatabaseError as e:
        logger.error(f"Database error in import_all_materials: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
    except Exception as e:
        logger.error(f"Error in import_all_materials: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred during migration"
        ), 500