"""
Conti API V2 for StudioDimaAI.

Modern API endpoints for accounts management (conti, branche, sottoconti) 
using the new service layer architecture and standardized response patterns.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.conti_service import ContiService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)

# Create blueprint
conti_v2_bp = Blueprint('conti_v2', __name__)

# ===================== CONTI =====================

@conti_v2_bp.route('/conti', methods=['GET'])
@jwt_required() 
def get_conti():
    """
    Get all conti ordered by name.
    
    Returns:
        JSON response with conti list
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        # Get conti using service layer
        conti_service = ContiService(g.database_manager)
        conti = conti_service.get_all_conti()
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(conti)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} conti"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_conti: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_conti: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/conti/<int:conto_id>', methods=['GET'])
@jwt_required()
def get_conto(conto_id):
    """
    Get a specific conto by ID.
    
    Args:
        conto_id: Conto ID
        
    Returns:
        JSON response with conto data
    """
    try:
        user_id = require_auth()
        
        # Get conto using service layer
        conti_service = ContiService(g.database_manager)
        conto = conti_service.get_conto_by_id(conto_id)
        
        if not conto:
            return format_response(
                success=False,
                error="Conto non trovato"
            ), 404
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(conto)
        
        return format_response(
            data=clean_data,
            message="Conto retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_conto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_conto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/conti', methods=['POST'])
@jwt_required()
def create_conto():
    """
    Create a new conto.
    
    Request Body:
        nome (str): Conto name
        
    Returns:
        JSON response with created conto data
    """
    try:
        user_id = require_auth()
        
        data = request.get_json()
        if not data:
            return format_response(
                success=False,
                error="Request body is required"
            ), 400
        
        # Create conto using service layer
        conti_service = ContiService(g.database_manager)
        conto = conti_service.create_conto(data.get('nome', ''))
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(conto)
        
        return format_response(
            data=clean_data,
            message=f'Conto "{conto["nome"]}" creato con successo'
        ), 201
        
    except ValidationError as e:
        logger.warning(f"Validation error in create_conto: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in create_conto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in create_conto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/conti/<int:conto_id>', methods=['PUT'])
@jwt_required()
def update_conto(conto_id):
    """
    Update an existing conto.
    
    Args:
        conto_id: Conto ID
        
    Request Body:
        nome (str): New conto name
        
    Returns:
        JSON response with updated conto data
    """
    try:
        user_id = require_auth()
        
        data = request.get_json()
        if not data:
            return format_response(
                success=False,
                error="Request body is required"
            ), 400
        
        # Update conto using service layer
        conti_service = ContiService(g.database_manager)
        conto = conti_service.update_conto(conto_id, data.get('nome', ''))
        
        if not conto:
            return format_response(
                success=False,
                error="Conto non trovato"
            ), 404
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(conto)
        
        return format_response(
            data=clean_data,
            message="Conto aggiornato con successo"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in update_conto: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in update_conto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in update_conto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/conti/<int:conto_id>', methods=['DELETE'])
@jwt_required()
def delete_conto(conto_id):
    """
    Delete a conto if it has no associated branche.
    
    Args:
        conto_id: Conto ID
        
    Returns:
        JSON response confirming deletion
    """
    try:
        user_id = require_auth()
        
        # Delete conto using service layer
        conti_service = ContiService(g.database_manager)
        deleted = conti_service.delete_conto(conto_id)
        
        if not deleted:
            return format_response(
                success=False,
                error="Conto non trovato"
            ), 404
        
        return format_response(
            message="Conto eliminato con successo"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in delete_conto: {e}")
        return format_response(
            success=False,
            state='warning',
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in delete_conto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in delete_conto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

# ===================== BRANCHE =====================

@conti_v2_bp.route('/branche', methods=['GET'])
@jwt_required() 
def get_branche():
    """
    Get branche, optionally filtered by conto.
    
    Query Parameters:
        conto_id (int): Optional conto ID filter
        
    Returns:
        JSON response with branche list
    """
    try:
        # Temporarily disable auth for testing  
        # user_id = require_auth()
        
        conto_id = request.args.get('conto_id', type=int)
        
        # Get branche using service layer
        conti_service = ContiService(g.database_manager)
        branche = conti_service.get_branche(conto_id)
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(branche)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} branche"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_branche: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_branche: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/branche/<int:branca_id>', methods=['GET'])
@jwt_required()
def get_branca(branca_id):
    """
    Get a specific branca by ID.
    
    Args:
        branca_id: Branca ID
        
    Returns:
        JSON response with branca data
    """
    try:
        user_id = require_auth()
        
        # Get branca using service layer
        conti_service = ContiService(g.database_manager)
        branca = conti_service.get_branca_by_id(branca_id)
        
        if not branca:
            return format_response(
                success=False,
                error="Branca non trovata"
            ), 404
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(branca)
        
        return format_response(
            data=clean_data,
            message="Branca retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_branca: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_branca: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/branche', methods=['POST'])
@jwt_required() 
def create_branca():
    """
    Create a new branca.
    
    Request Body:
        nome (str): Branca name
        contoid (int): Parent conto ID
        
    Returns:
        JSON response with created branca data
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        data = request.get_json()
        if not data:
            return format_response(
                success=False,
                error="Request body is required"
            ), 400
        
        # Create branca using service layer
        conti_service = ContiService(g.database_manager)
        branca = conti_service.create_branca(
            nome=data.get('nome', ''),
            contoid=data.get('contoid')
        )
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(branca)
        
        return format_response(
            data=clean_data,
            message=f'Branca "{branca["nome"]}" creata con successo'
        ), 201
        
    except ValidationError as e:
        logger.warning(f"Validation error in create_branca: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in create_branca: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in create_branca: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/branche/<int:branca_id>', methods=['PUT'])
@jwt_required() 
def update_branca(branca_id):
    """
    Update an existing branca.
    
    Args:
        branca_id: Branca ID
        
    Request Body:
        nome (str): New branca name
        
    Returns:
        JSON response confirming update
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        data = request.get_json()
        if not data:
            return format_response(
                success=False,
                error="Request body is required"
            ), 400
        
        # Update branca using service layer
        conti_service = ContiService(g.database_manager)
        updated_branca = conti_service.update_branca(branca_id, data.get('nome', ''))
        
        if not updated_branca:
            return format_response(
                success=False,
                error="Branca non trovata"
            ), 404
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(updated_branca)
        
        return format_response(
            data=clean_data,
            message="Branca aggiornata con successo"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in update_branca: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in update_branca: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in update_branca: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/branche/<int:branca_id>', methods=['DELETE'])
@jwt_required() 
def delete_branca(branca_id):
    """
    Delete a branca if it has no associated sottoconti.
    
    Args:
        branca_id: Branca ID
        
    Returns:
        JSON response confirming deletion
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        # Delete branca using service layer
        conti_service = ContiService(g.database_manager)
        deleted = conti_service.delete_branca(branca_id)
        
        if not deleted:
            return format_response(
                success=False,
                error="Branca non trovata"
            ), 404
        
        return format_response(
            message="Branca eliminata con successo"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in delete_branca: {e}")
        return format_response(
            success=False,
            state='warning',
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in delete_branca: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in delete_branca: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

# ===================== SOTTOCONTI =====================

@conti_v2_bp.route('/sottoconti', methods=['GET'])
@jwt_required() 
def get_sottoconti():
    """
    Get sottoconti, optionally filtered by branca or conto.
    
    Query Parameters:
        branca_id (int): Optional branca ID filter
        conto_id (int): Optional conto ID filter
        
    Returns:
        JSON response with sottoconti list
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        branca_id = request.args.get('branca_id', type=int)
        conto_id = request.args.get('conto_id', type=int)
        
        # Get sottoconti using service layer
        conti_service = ContiService(g.database_manager)
        sottoconti = conti_service.get_sottoconti(branca_id, conto_id)
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(sottoconti)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} sottoconti"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_sottoconti: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_sottoconti: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/sottoconti/<int:sottoconto_id>', methods=['GET'])
@jwt_required()
def get_sottoconto(sottoconto_id):
    """
    Get a specific sottoconto by ID.
    
    Args:
        sottoconto_id: Sottoconto ID
        
    Returns:
        JSON response with sottoconto data
    """
    try:
        user_id = require_auth()
        
        # Get sottoconto using service layer
        conti_service = ContiService(g.database_manager)
        sottoconto = conti_service.get_sottoconto_by_id(sottoconto_id)
        
        if not sottoconto:
            return format_response(
                success=False,
                error="Sottoconto non trovato"
            ), 404
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(sottoconto)
        
        return format_response(
            data=clean_data,
            message="Sottoconto retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_sottoconto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_sottoconto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/sottoconti', methods=['POST'])
@jwt_required() 
def create_sottoconto():
    """
    Create a new sottoconto.
    
    Request Body:
        nome (str): Sottoconto name
        brancaid (int): Parent branca ID
        
    Returns:
        JSON response with created sottoconto data
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        data = request.get_json()
        if not data:
            return format_response(
                success=False,
                error="Request body is required"
            ), 400
        
        # Create sottoconto using service layer
        conti_service = ContiService(g.database_manager)
        sottoconto = conti_service.create_sottoconto(
            nome=data.get('nome', ''),
            brancaid=data.get('brancaid')
        )
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(sottoconto)
        
        return format_response(
            data=clean_data,
            message=f'Sottoconto "{sottoconto["nome"]}" creato con successo'
        ), 201
        
    except ValidationError as e:
        logger.warning(f"Validation error in create_sottoconto: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in create_sottoconto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in create_sottoconto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/sottoconti/<int:sottoconto_id>', methods=['PUT'])
@jwt_required() 
def update_sottoconto(sottoconto_id):
    """
    Update an existing sottoconto.
    
    Args:
        sottoconto_id: Sottoconto ID
        
    Request Body:
        nome (str): New sottoconto name
        
    Returns:
        JSON response confirming update
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        data = request.get_json()
        if not data:
            return format_response(
                success=False,
                error="Request body is required"
            ), 400
        
        # Update sottoconto using service layer
        conti_service = ContiService(g.database_manager)
        updated_sottoconto = conti_service.update_sottoconto(sottoconto_id, data.get('nome', ''))
        
        if not updated_sottoconto:
            return format_response(
                success=False,
                error="Sottoconto non trovato"
            ), 404
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(updated_sottoconto)
        
        return format_response(
            data=clean_data,
            message="Sottoconto aggiornato con successo"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in update_sottoconto: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in update_sottoconto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in update_sottoconto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@conti_v2_bp.route('/sottoconti/<int:sottoconto_id>', methods=['DELETE'])
@jwt_required() 
def delete_sottoconto(sottoconto_id):
    """
    Delete a sottoconto if it has no associated classificazioni.
    
    Args:
        sottoconto_id: Sottoconto ID
        
    Returns:
        JSON response confirming deletion
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()
        
        # Delete sottoconto using service layer
        conti_service = ContiService(g.database_manager)
        deleted = conti_service.delete_sottoconto(sottoconto_id)
        
        if not deleted:
            return format_response(
                success=False,
                error="Sottoconto non trovato"
            ), 404
        
        return format_response(
            message="Sottoconto eliminato con successo"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in delete_sottoconto: {e}")
        return format_response(
            success=False,
            state='warning',
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in delete_sottoconto: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in delete_sottoconto: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

# ===================== STRUTTURA COMPLETA =====================

@conti_v2_bp.route('/struttura-completa', methods=['GET'])
@jwt_required()
def get_struttura_completa():
    """
    Get complete conti structure with branche and sottoconti.
    
    Returns:
        JSON response with complete structure
    """
    try:
        user_id = require_auth()
        
        # Get struttura using service layer
        conti_service = ContiService(g.database_manager)
        struttura = conti_service.get_struttura_completa()
        
        # Clean data for JSON response
        clean_data = handle_dbf_data(struttura)
        
        return format_response(
            data=clean_data,
            message="Retrieved complete conti structure"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_struttura_completa: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_struttura_completa: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500