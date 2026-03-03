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

#FORNITORI
@classificazioni_v2_bp.route('/classificazioni/fornitori', methods=['GET'])
@jwt_required()
def get_fornitori_classificati():
    """
    Ottiene tutti i fornitori classificati
    """
    try:
        user_id = require_auth()
        
        classificazioni_service = ClassificazioniService()
        fornitori = classificazioni_service.get_fornitori_classificati()
        
        return jsonify({
            "success": True,
            "data": fornitori,
            "count": len(fornitori)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@classificazioni_v2_bp.route('/classificazioni/fornitore/<fornitore_id>', methods=['PUT'])
@jwt_required()
def classifica_fornitore(fornitore_id):
    """
    Classify a supplier (create/update).
    """
    try:
        user_id = require_auth()
        
        # Validate request data
        if not request.is_json:
            return jsonify({
                "success": False,
                "error": "Content-Type must be application/json"
            }), 400
        
        data = request.get_json()
        
        # Get classification service
        classificazioni_service = ClassificazioniService()
        
        # Support both legacy and new hierarchical classification
        if 'contoid' in data:
            # New hierarchical format
            contoid = data.get('contoid')
            if not contoid:
                return jsonify({
                    "success": False,
                    "error": "contoid is required for hierarchical classification"
                }), 400
                
            result = classificazioni_service.classifica_fornitore_completo(
                codice_fornitore=fornitore_id,
                contoid=contoid,
                brancaid=data.get('brancaid', 0),
                sottocontoid=data.get('sottocontoid', 0),
                tipo_di_costo=data.get('tipo_di_costo', 1),
                note=data.get('note'),
                fornitore_nome=data.get('fornitore_nome')
            )
        else:
            # Legacy format with tipo_di_costo
            tipo_di_costo = data.get('tipo_di_costo')
            if tipo_di_costo not in [1, 2, 3]:
                return jsonify({
                    "success": False,
                    "error": "tipo_di_costo must be 1 (direct), 2 (indirect) or 3 (non_deductible)"
                }), 400
                
            result = classificazioni_service.classifica_fornitore(
                codice_fornitore=fornitore_id,
                tipo_di_costo=tipo_di_costo,
                categoria=data.get('categoria'),
                note=data.get('note')
            )
        
        if result:
            # Get updated classification
            classificazione = classificazioni_service.get_classificazione_fornitore(fornitore_id)
            return jsonify({
                "success": True,
                "data": classificazione,
                "message": "Supplier classified successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Error classifying supplier"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@classificazioni_v2_bp.route('/classificazioni/fornitore/<fornitore_id>', methods=['GET'])
@jwt_required()
def get_classificazione_fornitore(fornitore_id):
    """
    Get supplier classification.
    """
    try:
        user_id = require_auth()
        
        # Get classification using service layer
        classificazioni_service = ClassificazioniService()
        classificazione = classificazioni_service.get_classificazione_fornitore(fornitore_id)
        
        if classificazione:
            return jsonify({
                "success": True,
                "data": classificazione,
                "message": "Supplier classification retrieved successfully"
            }), 200
        else:
            return jsonify({
                "success": True,
                "data": None,
                "message": "Supplier not classified"
            }), 200
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@classificazioni_v2_bp.route('/classificazioni/fornitore/<fornitore_id>', methods=['DELETE'])
@jwt_required()
def rimuovi_classificazione_fornitore(fornitore_id):
    """
    Remove supplier classification.
    """
    try:
        user_id = require_auth()
        
        # Remove classification using service layer
        classificazioni_service = ClassificazioniService()
        success = classificazioni_service.rimuovi_classificazione_fornitore(fornitore_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Supplier classification removed successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Classification not found or error in removal"
            }), 404
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


#CONTI BRANCHE SOTTOCONTI
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
        
        # Get accounts using ContiService
        from services.conti_service import ContiService
        conti_service = ContiService(g.database_manager)
        conti = conti_service.get_all_conti()
        
        return format_response(
            data=conti,
            message=f"Retrieved {len(conti)} accounts"
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

@classificazioni_v2_bp.route('/classificazioni/branche', methods=['GET'])
@jwt_required()
def get_branche():
    """
    Get branches for specific account.
    """
    try:
        user_id = require_auth()
        conto_id = request.args.get('conto_id', type=int)
        
        if not conto_id:
            return format_response(
                success=False,
                error="Parameter 'conto_id' is required"
            ), 400
        
        # Get branches using ContiService
        from services.conti_service import ContiService
        conti_service = ContiService(g.database_manager)
        branche = conti_service.get_branche(conto_id)
        
        return format_response(
            data=branche,
            message=f"Retrieved {len(branche)} branches for account {conto_id}"
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

@classificazioni_v2_bp.route('/classificazioni/sottoconti', methods=['GET'])
@jwt_required()
def get_sottoconti():
    """
    Get sub-accounts for specific branch.
    """
    try:
        user_id = require_auth()
        branca_id = request.args.get('branca_id', type=int)
        
        if not branca_id:
            return format_response(
                success=False,
                error="Parameter 'branca_id' is required"
            ), 400
        
        # Get sub-accounts using ContiService
        from services.conti_service import ContiService
        conti_service = ContiService(g.database_manager)
        sottoconti = conti_service.get_sottoconti(branca_id)
        
        return format_response(
            data=sottoconti,
            message=f"Retrieved {len(sottoconti)} sub-accounts for branch {branca_id}"
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