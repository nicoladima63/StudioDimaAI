"""
Classificazioni API V2 for StudioDimaAI.

Modern API endpoints for classification management with intelligent
pattern learning and confidence scoring.
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required

from services.classificazioni_service import ClassificazioniService
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Create blueprint
classificazioni_v2_bp = Blueprint('classificazioni_v2', __name__)


@classificazioni_v2_bp.route('/classificazioni/conti', methods=['GET'])
@jwt_required()
def get_conti():
    """
    Get list of accounts (conti) for classification.
    
    Returns:
        JSON response with accounts list
    """
    try:
        user_id = require_auth()
        
        # Get accounts using service layer
        classificazioni_service = ClassificazioniService(g.database_manager)
        conti = classificazioni_service.get_conti()
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(conti)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} accounts"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_conti: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_conti: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@classificazioni_v2_bp.route('/classificazioni/branche/<int:conto_id>', methods=['GET'])
@jwt_required()
def get_branche(conto_id):
    """
    Get branches for specific account.
    
    Args:
        conto_id (int): Account ID
        
    Returns:
        JSON response with branches list
    """
    try:
        user_id = require_auth()
        
        # Get branches using service layer
        classificazioni_service = ClassificazioniService(g.database_manager)
        branche = classificazioni_service.get_branche(conto_id)
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(branche)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} branches for account {conto_id}"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_branche: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_branche: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_branche: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@classificazioni_v2_bp.route('/classificazioni/sottoconti/<int:branca_id>', methods=['GET'])
@jwt_required()
def get_sottoconti(branca_id):
    """
    Get sub-accounts for specific branch.
    
    Args:
        branca_id (int): Branch ID
        
    Returns:
        JSON response with sub-accounts list
    """
    try:
        user_id = require_auth()
        
        # Get sub-accounts using service layer
        classificazioni_service = ClassificazioniService(g.database_manager)
        sottoconti = classificazioni_service.get_sottoconti(branca_id)
        
        # Clean DBF data for JSON response
        clean_data = handle_dbf_data(sottoconti)
        
        return format_response(
            data=clean_data,
            message=f"Retrieved {len(clean_data)} sub-accounts for branch {branca_id}"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in get_sottoconti: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_sottoconti: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_sottoconti: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@classificazioni_v2_bp.route('/classificazioni/auto-suggest', methods=['POST'])
@jwt_required()
def auto_suggest_classification():
    """
    Get automatic classification suggestions using AI patterns.
    
    Request Body:
        text (str): Text to classify (material/supplier name/description)
        context (str): Additional context (optional)
        
    Returns:
        JSON response with classification suggestions
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
        text = data.get('text', '').strip()
        if not text:
            return format_response(
                success=False,
                error="Field 'text' is required"
            ), 400
        
        context = data.get('context', '').strip()
        
        # Get suggestions using service layer
        classificazioni_service = ClassificazioniService(g.database_manager)
        suggestions = classificazioni_service.auto_suggest_classification(
            text=text,
            context=context
        )
        
        return format_response(
            data=suggestions,
            message="Classification suggestions generated successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in auto_suggest_classification: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in auto_suggest_classification: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in auto_suggest_classification: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@classificazioni_v2_bp.route('/classificazioni/learn', methods=['POST'])
@jwt_required()
def learn_classification():
    """
    Learn from manual classification to improve future suggestions.
    
    Request Body:
        text (str): Original text
        contoid (int): Classified account ID
        brancaid (int): Classified branch ID (optional)
        sottocontoid (int): Classified sub-account ID (optional)
        confidence (float): User confidence in classification (0-1)
        
    Returns:
        JSON response with learning confirmation
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
        required_fields = ['text', 'contoid']
        for field in required_fields:
            if field not in data:
                return format_response(
                    success=False,
                    error=f"Field '{field}' is required"
                ), 400
        
        # Learn from classification using service layer
        classificazioni_service = ClassificazioniService(g.database_manager)
        result = classificazioni_service.learn_classification(
            text=data['text'],
            contoid=data['contoid'],
            brancaid=data.get('brancaid', 0),
            sottocontoid=data.get('sottocontoid', 0),
            confidence=data.get('confidence', 1.0),
            learned_by=user_id
        )
        
        return format_response(
            data=result,
            message="Classification learned successfully"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in learn_classification: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in learn_classification: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in learn_classification: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500


@classificazioni_v2_bp.route('/classificazioni/stats', methods=['GET'])
@jwt_required()
def get_classification_stats():
    """
    Get classification statistics and accuracy metrics.
    
    Returns:
        JSON response with classification statistics
    """
    try:
        user_id = require_auth()
        
        # Get statistics using service layer
        classificazioni_service = ClassificazioniService(g.database_manager)
        stats = classificazioni_service.get_statistics()
        
        return format_response(
            data=stats,
            message="Classification statistics retrieved successfully"
        )
        
    except DatabaseError as e:
        logger.error(f"Database error in get_classification_stats: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_classification_stats: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500