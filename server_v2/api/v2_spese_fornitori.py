"""
API endpoints for spese fornitori (fatture fornitori) operations.
"""

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError
from services.materiali_migration_service import MaterialiMigrationService
import logging

logger = logging.getLogger(__name__)

# Create blueprint
spese_fornitori_v2_bp = Blueprint('spese_fornitori_v2', __name__, url_prefix='/spese-fornitori')

@spese_fornitori_v2_bp.route('/ricerca-articoli', methods=['GET'])
@jwt_required()
def ricerca_articoli():
    """
    Ricerca articoli nelle fatture fornitori.
    
    Query Parameters:
        q (str): Search query (required)
        limit (int): Max results (default: 20, max: 100)
        
    Returns:
        JSON response with search results
    """
    try:
        user_id = require_auth()
        
        # Parse query parameters
        query = request.args.get('q', '').strip()
        limit = min(request.args.get('limit', 20, type=int), 100)
        
        if not query:
            return format_response(
                success=False,
                error="Search query 'q' is required"
            ), 400
        
        # Use migration service to search in DBF data
        migration_service = MaterialiMigrationService(g.database_manager)
        
        # Read all materials data from DBF
        materials_data = migration_service.read_spesafo_data()
        
        # Filter materials based on search query
        search_query_lower = query.lower()
        filtered_materials = []
        
        for material in materials_data:
            # Search in description and codice articolo
            descrizione = material.get('nome', '').lower()
            codice_articolo = material.get('codicearticolo', '').lower()
            
            if (search_query_lower in descrizione or 
                search_query_lower in codice_articolo):
                filtered_materials.append(material)
        
        # Limit results
        limited_materials = filtered_materials[:limit]
        
        # Transform to API format
        articoli = []
        for material in limited_materials:
            articolo = {
                'codice_articolo': material.get('codicearticolo', ''),
                'descrizione': material.get('nome', ''),
                'quantita': material.get('quantita', 0),
                'prezzo_unitario': material.get('costo_unitario', 0),
                'fattura': {
                    'id': material.get('id_fattura', ''),
                    'numero_documento': material.get('numero_documento', ''),
                    'codice_fornitore': material.get('fornitoreid', ''),
                    'nome_fornitore': material.get('fornitorenome', ''),
                    'data_spesa': material.get('data_spesa', ''),
                    'costo_totale': material.get('costo_netto', 0) + material.get('costo_iva', 0)
                }
            }
            articoli.append(articolo)
        
        return format_response(
            data={
                'articoli': articoli,
                'total_found': len(filtered_materials),
                'query': query
            },
            message=f"Found {len(articoli)} articles"
        )
        
    except ValidationError as e:
        logger.warning(f"Validation error in ricerca_articoli: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in ricerca_articoli: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in ricerca_articoli: {e}")
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

