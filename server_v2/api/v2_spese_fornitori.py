"""
API endpoints for spese fornitori (fatture fornitori) operations.
"""

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required
import os
from dbfread import DBF
from app_v2 import require_auth, format_response, handle_dbf_data
from core.exceptions import ValidationError, DatabaseError
from services.fornitori_service import FornitoriService
from services.materiali_migration_service import MaterialiMigrationService
import logging

logger = logging.getLogger(__name__)

# Create blueprint
spese_fornitori_v2_bp = Blueprint('spese_fornitori_v2', __name__)

# Helper function to safely convert DBF values
def _safe_dbf_value(value, default_val=''):
    if value is None:
        return default_val
    if isinstance(value, bytes):
        try:
            return value.decode('latin-1').strip()
        except UnicodeDecodeError:
            return value.decode('utf-8', errors='ignore').strip()
    return str(value).strip()

def _safe_float(value, default_val=0.0):
    try:
        return float(value)
    except (ValueError, TypeError):
        return default_val



@spese_fornitori_v2_bp.route('/spese-fornitori/health', methods=['GET'])
def health_check():
    """Health check endpoint for spese fornitori"""
    return jsonify({
        'status': 'ok',
        'service': 'spese-fornitori-ciccio-bello-è-contro-gpt',
        'message': 'Service is running'
    }), 200



@spese_fornitori_v2_bp.route('/spese-fornitori/ricerca-articoli', methods=['GET'])
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

@spese_fornitori_v2_bp.route('/spese-fornitori/<fattura_id>/all', methods=['GET'])
@jwt_required()
def get_fattura_completa(fattura_id):
    """
    Ottieni l'intestazione e tutti i dettagli di una specifica fattura.
    
    Args:
        fattura_id (str): ID della fattura
        
    Returns:
        JSON response con intestazione e dettagli della fattura
    """
    try:
        # user_id = require_auth() # Uncomment if auth is fully enabled
        
        spesafo_path = os.path.join('..', 'windent', 'DATI', 'SPESAFOR.DBF')
        vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')

        invoice_header = None
        total_net_cost = 0.0
        total_iva_cost = 0.0

        # Step 1: Read Invoice Header from SPESAFOR.DBF
        # Aggregate costs if multiple records exist for the same invoice ID
        found_header_records = []
        with DBF(spesafo_path, encoding='latin-1') as spesafo_table:
            for record in spesafo_table:
                if record is None:
                    continue
                
                current_fattura_id = _safe_dbf_value(record.get('DB_CODE'))
                if current_fattura_id == fattura_id:
                    found_header_records.append(record)
                    
        if not found_header_records:
            return format_response(
                success=False,
                error=f"Fattura con ID {fattura_id} non trovata"
            ), 404

        # Aggregate header data from found records
        first_record = found_header_records[0]
        
        # Correctly fetch fornitore nome using FornitoriService
        fornitore_id = _safe_dbf_value(first_record.get('DB_SPFOCOD'))
        fornitore_nome = 'N/A'
        if fornitore_id:
            try:
                fornitori_service = FornitoriService(g.database_manager)
                fornitore_data = fornitori_service.get_fornitore_by_id(fornitore_id)
                if fornitore_data and 'nome' in fornitore_data:
                    fornitore_nome = fornitore_data['nome']
            except Exception as e:
                logger.error(f"Could not fetch fornitore name for id {fornitore_id}: {e}")

        invoice_header = {
            'id': fattura_id,
            'numero_documento': _safe_dbf_value(first_record.get('DB_SPNUMER')),
            'fornitoreid': fornitore_id,
            'fornitorenome': fornitore_nome,
            'data_spesa': _safe_dbf_value(first_record.get('DB_SPDATA')),
            'costo_netto_totale': 0.0,
            'costo_iva_totale': 0.0,
            'costo_totale': 0.0
        }

        for record in found_header_records:
            total_net_cost += _safe_float(record.get('DB_SPCOSTO', 0))
            total_iva_cost += _safe_float(record.get('DB_SPCOIVA', 0))
        
        invoice_header['costo_netto_totale'] = total_net_cost
        invoice_header['costo_iva_totale'] = total_iva_cost
        invoice_header['costo_totale'] = total_net_cost + total_iva_cost

        # Step 2: Read Invoice Details from VOCISPES.DBF
        invoice_details = []
        with DBF(vocispes_path, encoding='latin-1') as vocispes_table:
            for record in vocispes_table:
                if record is None:
                    continue
                
                if _safe_dbf_value(record.get('DB_VOSPCOD')) == fattura_id:
                    quantita = _safe_float(record.get('DB_VOQUANT', 0))
                    prezzo_unitario = _safe_float(record.get('DB_VOPREZZ', 0))
                    sconto = _safe_float(record.get('DB_VOSCONT', 0))
                    
                    # Calculate total_riga considering quantity, unit price, and discount
                    # Assuming discount is a percentage (e.g., 10 for 10%)
                    total_riga = quantita * prezzo_unitario * (1 - (sconto / 100))
                    
                    invoice_details.append({
                        'codice_articolo': _safe_dbf_value(record.get('DB_VOSOCOD')),
                        'descrizione': _safe_dbf_value(record.get('DB_VODESCR')),
                        'quantita': quantita,
                        'prezzo_unitario': prezzo_unitario,
                        'sconto': sconto,
                        'aliquota_iva': _safe_float(record.get('DB_VOIVA', 0)),
                        'totale_riga': total_riga
                    })
        
        return format_response(
            data={
                'intestazione': invoice_header,
                'dettagli': invoice_details
            },
            message=f"Fattura completa {fattura_id} retrieved successfully"
        )
        
    except FileNotFoundError:
        logger.error(f"DBF file not found for fattura_id {fattura_id}")
        return format_response(
            success=False,
            error="DBF file not found. Check server configuration."
        ), 500
    except ValidationError as e:
        logger.warning(f"Validation error in get_fattura_completa: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
    except DatabaseError as e:
        logger.error(f"Database error in get_fattura_completa: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
    except Exception as e:
        logger.error(f"Unexpected error in get_fattura_completa: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500

@spese_fornitori_v2_bp.route('/spese-fornitori/<fattura_id>/dettagli', methods=['GET'])
@jwt_required()
def get_dettagli_fattura(fattura_id):
    """
    Ottieni dettagli di una specifica fattura.
    
    Args:
        fattura_id (str): ID della fattura
        
    Returns:
        JSON response with fattura details
    """
    try:
        # Temporarily disable auth for testing
        # user_id = require_auth()

        vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
        
        # Get dettagli from VOCISPES.DBF
        dettagli = []
        with DBF(vocispes_path, encoding='latin-1') as vocispes_table:
            for record in vocispes_table:
                if record is None:
                    continue

                # Check if this record belongs to the requested fattura
                if _safe_dbf_value(record.get('DB_VOSPCOD')) == fattura_id:
                    quantita = _safe_float(record.get('DB_VOQUANT', 0))
                    prezzo_unitario = _safe_float(record.get('DB_VOPREZZ', 0))
                    sconto = _safe_float(record.get('DB_VOSCONT', 0))
                    
                    total_riga = quantita * prezzo_unitario * (1 - (sconto / 100))

                    dettagli.append({
                        'codice_articolo': _safe_dbf_value(record.get('DB_VOSOCOD')),
                        'descrizione': _safe_dbf_value(record.get('DB_VODESCR')),
                        'quantita': quantita,
                        'prezzo_unitario': prezzo_unitario,
                        'sconto': sconto,
                        'aliquota_iva': _safe_float(record.get('DB_VOIVA', 0)),
                        'totale_riga': total_riga
                    })
        
        return format_response(
            data=dettagli,
            message=f"Retrieved {len(dettagli)} details for fattura {fattura_id}"
        )
        
    except FileNotFoundError:
        logger.error(f"DBF file not found for fattura_id {fattura_id} in get_dettagli_fattura")
        return format_response(
            success=False,
            error="DBF file not found. Check server configuration."
        ), 500
    except ValidationError as e:
        logger.warning(f"Validation error in get_dettagli_fattura: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 400
        
    except DatabaseError as e:
        logger.error(f"Database error in get_dettagli_fattura: {e}")
        return format_response(
            success=False,
            error="Database error occurred"
        ), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_dettagli_fattura: {e}", exc_info=True)
        return format_response(
            success=False,
            error="An unexpected error occurred"
        ), 500
