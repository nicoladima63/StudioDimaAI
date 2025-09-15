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

@materiali_v2_bp.route('/materiali/ricerca-classificati', methods=['GET'])
@jwt_required()
def ricerca_materiali_classificati():
    """
    Ricerca materiali già classificati nella tabella materiali
    
    Query Parameters:
        q (str): Search query (required)
        limit (int): Max results (default: 20, max: 100)
        
    Returns:
        JSON response with classified materials
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
        
        # Usa il database manager esistente
        db_manager = get_database_manager()
        
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Cerca materiali classificati
            search_query_lower = query.lower()
            cursor.execute('''
                SELECT id, codicearticolo, nome, fornitoreid, fornitorenome,
                       contoid, contonome, brancaid, brancanome, 
                       sottocontoid, sottocontonome, confermato, 
                       metodo_classificazione, fattura_id, data_fattura, costo_unitario
                FROM materiali 
                WHERE (LOWER(codicearticolo) LIKE ? OR LOWER(nome) LIKE ?)
                AND confermato = 1
                ORDER BY nome
                LIMIT ?
            ''', (f'%{search_query_lower}%', f'%{search_query_lower}%', limit))
            
            materiali = cursor.fetchall()
            
            # Trasforma i risultati
            materiali_list = []
            for materiale in materiali:
                materiale_dict = {
                    'id': materiale[0],
                    'codice_articolo': materiale[1],
                    'descrizione': materiale[2],
                    'fornitore_id': materiale[3],
                    'nome_fornitore': materiale[4],
                    'contoid': materiale[5],
                    'contonome': materiale[6],
                    'brancaid': materiale[7],
                    'brancanome': materiale[8],
                    'sottocontoid': materiale[9],
                    'sottocontonome': materiale[10],
                    'confermato': materiale[11],
                    'metodo_classificazione': materiale[12],
                    'fattura_id': materiale[13],
                    'data_fattura': materiale[14],
                    'costo_unitario': materiale[15]
                }
                materiali_list.append(materiale_dict)
            
            return format_response(
                data={
                    'materiali': materiali_list,
                    'total_found': len(materiali_list),
                    'query': query
                },
                message=f"Found {len(materiali_list)} classified materials"
            )
            
    except Exception as e:
        logger.error(f"Errore ricerca materiali classificati: {e}")
        return format_response(
            success=False,
            error=str(e)
        ), 500


@materiali_v2_bp.route('/materiali/classificazione/<codice_articolo>/<fattura_id>', methods=['GET'])
@jwt_required()
def get_classificazione_materiale(codice_articolo, fattura_id):
    """
    Recupera la classificazione esistente di un materiale dalla tabella materiali
    
    Args:
        codice_articolo (str): Codice articolo
        fattura_id (str): ID fattura
        
    Returns:
        JSON response with existing classification
    """
    try:
        user_id = require_auth()
        
        # Usa il database manager esistente
        db_manager = get_database_manager()
        
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Cerca il materiale nella tabella materiali (anche quelli cancellati per recuperare la classificazione)
            cursor.execute('''
                SELECT id, codicearticolo, nome, fornitoreid, fornitorenome,
                       contoid, contonome, brancaid, brancanome, 
                       sottocontoid, sottocontonome, confermato, 
                       metodo_classificazione, fattura_id, data_fattura, costo_unitario
                FROM materiali 
                WHERE codicearticolo = ? AND fattura_id = ?
            ''', (codice_articolo, fattura_id))
            
            materiale = cursor.fetchone()
            
            if not materiale:
                return jsonify({
                    'success': False,
                    'error': 'Materiale non trovato nella tabella materiali'
                }), 404
            
            # Trasforma il risultato in dizionario
            materiale_dict = {
                'id': materiale[0],
                'codice_articolo': materiale[1],
                'descrizione': materiale[2],
                'fornitore_id': materiale[3],
                'nome_fornitore': materiale[4],
                'contoid': materiale[5],
                'contonome': materiale[6],
                'brancaid': materiale[7],
                'brancanome': materiale[8],
                'sottocontoid': materiale[9],
                'sottocontonome': materiale[10],
                'confermato': materiale[11],
                'metodo_classificazione': materiale[12],
                'fattura_id': materiale[13],
                'data_fattura': materiale[14],
                'costo_unitario': materiale[15]
            }
            
            return jsonify({
                'success': True,
                'data': materiale_dict,
                'message': 'Classificazione esistente trovata'
            })
            
    except Exception as e:
        logger.error(f"Errore recupero classificazione materiale: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@materiali_v2_bp.route('/materiali/classificazione', methods=['POST'])
@jwt_required()
def salva_classificazione_materiale():
    """
    Salva la classificazione di un materiale nella tabella materiali
    
    Body: {
        "codice_articolo": "REF V04025202502S", 
        "descrizione": "RECIPROC BLUE FILES",
        "codice_fornitore": "ZZZZZZO",
        "nome_fornitore": "Dentsply Sirona Italia Srl",
        "contoid": 18,
        "contonome": "MATERIALI DENTALI",
        "brancaid": 3,
        "brancanome": "CONSERVATIVA", 
        "sottocontoid": 7,
        "sottocontonome": "COMPOSITI"
    }
    """
    try:
        data = request.get_json()
        logger.info(f"MATERIALI: Ricevuta richiesta salvataggio classificazione: {data}")
        
        # Debug dettagliato del payload
        logger.info(f"MATERIALI: Payload ricevuto - contoid: {data.get('contoid')}, contonome: '{data.get('contonome')}', brancaid: {data.get('brancaid')}, brancanome: '{data.get('brancanome')}', sottocontoid: {data.get('sottocontoid')}, sottocontonome: '{data.get('sottocontonome')}'")
        
        # Debug completo del payload
        logger.info(f"MATERIALI: Payload completo: {data}")
        
        # Validazione campi obbligatori
        required_fields = ['descrizione', 'fornitore_id', 'nome_fornitore', 'contoid']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        # Estrai dati dal payload
        #{"codice_articolo":"","descrizione":"AGHI INJECT+ 30GA 0,3X16MM.","fattura_id":"ZZZWHC","fornitore_id":"ZZZZZZ","classificazione":{"contoid":18,"brancaid":1,"sottocontoid":1,"tipo_di_costo":1}}

        codicearticolo = data.get('codice_articolo', '').strip()
        nome = data.get('descrizione', '').strip()
        fornitoreid = data.get('fornitore_id', '').strip()
        fornitorenome = data.get('nome_fornitore', '').strip()
        contoid = int(data.get('contoid'))
        contonome = data.get('contonome', '').strip() if data.get('contonome') else ''
        brancaid = int(data.get('brancaid')) if data.get('brancaid') else None
        brancanome = data.get('brancanome', '').strip() if data.get('brancanome') else ''
        sottocontoid = int(data.get('sottocontoid')) if data.get('sottocontoid') else None
        sottocontonome = data.get('sottocontonome', '').strip() if data.get('sottocontonome') else ''
        fattura_id = data.get('fattura_id', '').strip() if data.get('fattura_id') else None
        riga_fattura_id = data.get('riga_fattura_id', '').strip() if data.get('riga_fattura_id') else None
        data_fattura = data.get('data_fattura', '').strip() if data.get('data_fattura') else None
        costo_unitario = data.get('costo_unitario')

        # Usa il database manager esistente
        db_manager = get_database_manager()
        
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            # Verifica se esiste già il materiale per questa fattura
            cursor.execute('''
                SELECT id FROM materiali 
                WHERE codicearticolo = ? AND nome = ? AND fornitoreid = ? AND fattura_id = ?
            ''', (codicearticolo, nome, fornitoreid, fattura_id))
            
            existing = cursor.fetchone()
            
            if existing:
                # Aggiorna solo la classificazione del materiale esistente
                cursor.execute('''
                    UPDATE materiali 
                    SET codicearticolo = ?, contoid = ?, contonome = ?, brancaid = ?, brancanome = ?, 
                        sottocontoid = ?, sottocontonome = ?, confermato = 1,
                        metodo_classificazione = 'update'
                    WHERE id = ?
                ''', (codicearticolo, contoid, contonome, brancaid, brancanome, sottocontoid, sottocontonome, existing[0]))
                
                operazione = 'aggiornata'
            else:
                # Inserisci nuovo materiale
                cursor.execute('''
                    INSERT INTO materiali 
                    (codicearticolo, nome, fornitoreid, fornitorenome, 
                     contoid, contonome, brancaid, brancanome, 
                     sottocontoid, sottocontonome, confidence, confermato,
                     occorrenze, metodo_classificazione, fattura_id, riga_fattura_id, 
                     data_fattura, costo_unitario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1, 1, 'manuale', ?, ?, ?, ?)
                ''', (codicearticolo, nome, fornitoreid, fornitorenome,
                      contoid, contonome, brancaid, brancanome,
                      sottocontoid, sottocontonome, fattura_id, riga_fattura_id, 
                      data_fattura, costo_unitario))
                
                operazione = 'inserita'
            
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Classificazione materiale {operazione} correttamente',
            'data': {
                'codicearticolo': codicearticolo,
                'nome': nome,
                'contoid': contoid,
                'brancaid': brancaid,
                'sottocontoid': sottocontoid,
                'operazione': operazione
            }
        })
        
    except Exception as e:
        logger.error(f"Errore salvataggio classificazione materiale: {e}")
        logger.error(f"Errore dettagliato: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Stack trace: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@materiali_v2_bp.route('/materiali/classificazione/bulk', methods=['POST'])
@jwt_required()
def salva_classificazione_materiali_bulk():
    """
    Salva classificazioni multiple di materiali nella tabella materiali
    
    Body: {
        "materiali": [
            {
                "codice_articolo": "REF V04025202502S", 
                "descrizione": "RECIPROC BLUE FILES",
                "fornitore_id": "ZZZZZZO",
                "nome_fornitore": "Dentsply Sirona Italia Srl",
                "contoid": 18,
                "contonome": "MATERIALI DENTALI",
                "brancaid": 3,
                "brancanome": "CONSERVATIVA", 
                "sottocontoid": 7,
                "sottocontonome": "COMPOSITI",
                "fattura_id": "ZZZWHC",
                "data_fattura": "2025-05-31",
                "costo_unitario": 16.4
            }
        ]
    }
    """
    try:
        data = request.get_json()
        
        # Validazione
        if not data.get('materiali') or not isinstance(data['materiali'], list):
            return jsonify({
                'success': False,
                'error': 'Campo "materiali" obbligatorio e deve essere un array'
            }), 400
        
        materiali = data['materiali']
        if not materiali:
            return jsonify({
                'success': False,
                'error': 'Array materiali non può essere vuoto'
            }), 400
        
        # Validazione campi obbligatori per ogni materiale
        for i, materiale in enumerate(materiali):
            required_fields = ['descrizione', 'fornitore_id', 'nome_fornitore', 'contoid']
            for field in required_fields:
                if not materiale.get(field):
                    return jsonify({
                        'success': False,
                        'error': f'Materiale {i+1}: Campo obbligatorio mancante: {field}'
                    }), 400
        
        # Usa il database manager esistente
        db_manager = get_database_manager()
        
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            
            inseriti = 0
            aggiornati = 0
            risultati_dettagliati = []
            
            for i, materiale in enumerate(materiali):
                try:
                    # Estrai dati dal materiale
                    codicearticolo = materiale.get('codice_articolo', '').strip()
                    nome = materiale.get('descrizione', '').strip()
                    fornitoreid = materiale.get('fornitore_id', '').strip()
                    fornitorenome = materiale.get('nome_fornitore', '').strip()
                    contoid = int(materiale.get('contoid'))
                    contonome = materiale.get('contonome', '').strip() if materiale.get('contonome') else ''
                    brancaid = int(materiale.get('brancaid')) if materiale.get('brancaid') else None
                    brancanome = materiale.get('brancanome', '').strip() if materiale.get('brancanome') else ''
                    sottocontoid = int(materiale.get('sottocontoid')) if materiale.get('sottocontoid') else None
                    sottocontonome = materiale.get('sottocontonome', '').strip() if materiale.get('sottocontonome') else ''
                    fattura_id = materiale.get('fattura_id', '').strip() if materiale.get('fattura_id') else None
                    riga_fattura_id = materiale.get('riga_fattura_id', '').strip() if materiale.get('riga_fattura_id') else None
                    data_fattura = materiale.get('data_fattura', '').strip() if materiale.get('data_fattura') else None
                    costo_unitario = materiale.get('costo_unitario')
                    
                    # Verifica se esiste già il materiale per questa fattura
                    cursor.execute('''
                        SELECT id FROM materiali 
                        WHERE codicearticolo = ? AND nome = ? AND fornitoreid = ? AND fattura_id = ?
                    ''', (codicearticolo, nome, fornitoreid, fattura_id))
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Aggiorna solo la classificazione del materiale esistente
                        cursor.execute('''
                            UPDATE materiali 
                            SET codicearticolo = ?, contoid = ?, contonome = ?, brancaid = ?, brancanome = ?, 
                                sottocontoid = ?, sottocontonome = ?, confermato = 1,
                                metodo_classificazione = 'bulk_update'
                            WHERE id = ?
                        ''', (codicearticolo, contoid, contonome, brancaid, brancanome, sottocontoid, sottocontonome, existing[0]))
                        
                        aggiornati += 1
                        risultati_dettagliati.append({
                            'indice': i,
                            'codice_articolo': codicearticolo,
                            'descrizione': nome,
                            'fornitore_id': fornitoreid,
                            'successo': True,
                            'operazione': 'aggiornato',
                            'materiale_id': existing[0]
                        })
                    else:
                        # Inserisci nuovo materiale
                        cursor.execute('''
                            INSERT INTO materiali 
                            (codicearticolo, nome, fornitoreid, fornitorenome, 
                             contoid, contonome, brancaid, brancanome, 
                             sottocontoid, sottocontonome, confidence, confermato,
                             occorrenze, metodo_classificazione, fattura_id, riga_fattura_id, 
                             data_fattura, costo_unitario)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 1, 1, 'bulk_insert', ?, ?, ?, ?)
                        ''', (codicearticolo, nome, fornitoreid, fornitorenome,
                              contoid, contonome, brancaid, brancanome,
                              sottocontoid, sottocontonome, fattura_id, riga_fattura_id, 
                              data_fattura, costo_unitario))
                        
                        # Ottieni l'ID del materiale appena inserito
                        materiale_id = cursor.lastrowid
                        inseriti += 1
                        risultati_dettagliati.append({
                            'indice': i,
                            'codice_articolo': codicearticolo,
                            'descrizione': nome,
                            'fornitore_id': fornitoreid,
                            'successo': True,
                            'operazione': 'inserito',
                            'materiale_id': materiale_id
                        })
                        
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Errore nel salvataggio materiale {i+1}: {e}")
                    risultati_dettagliati.append({
                        'indice': i,
                        'codice_articolo': materiale.get('codice_articolo', ''),
                        'descrizione': materiale.get('descrizione', 'N/A'),
                        'fornitore_id': materiale.get('fornitore_id', ''),
                        'successo': False,
                        'operazione': 'errore',
                        'errore': error_msg
                    })
            
            conn.commit()
        
        # Calcola errori
        errori = [r for r in risultati_dettagliati if not r['successo']]
        
        return jsonify({
            'success': True,
            'message': f'Bulk classificazione completata: {inseriti} inseriti, {aggiornati} aggiornati, {len(errori)} errori',
            'data': {
                'inseriti': inseriti,
                'aggiornati': aggiornati,
                'errori': len(errori),
                'total_processed': len(materiali),
                'risultati_dettagliati': risultati_dettagliati,
                'materiali_da_rimuovere': [r for r in risultati_dettagliati if r['successo']]
            }
        })
        
    except Exception as e:
        logger.error(f"Errore salvataggio bulk classificazione materiali: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@materiali_v2_bp.route('/materiali/ricerca-articoli', methods=['GET'])
@jwt_required()
def ricerca_articoli():
    """
    Ricerca articoli: PRIMA controlla tabella materiali, POI cerca in DBF.
    
    Query Parameters:
        q (str): Search query (required)
        limit (int): Max results (default: 20, max: 100)
        
    Returns:
        JSON response with search results (classificati + non classificati)
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
        
        db_manager = get_database_manager()
        migration_service = MaterialiMigrationService(g.database_manager)
        
        # PRIMA: Cerca nella tabella materiali (già classificati)
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            search_query_lower = query.lower()
            
            # Cerca materiali già classificati
            cursor.execute('''
                SELECT id, codicearticolo, nome, fornitoreid, fornitorenome,
                       contoid, contonome, brancaid, brancanome, 
                       sottocontoid, sottocontonome, confermato, 
                       metodo_classificazione, fattura_id, data_fattura, costo_unitario
                FROM materiali 
                WHERE (LOWER(codicearticolo) LIKE ? OR LOWER(nome) LIKE ?)
                AND confermato = 1
                ORDER BY nome
                LIMIT ?
            ''', (f'%{search_query_lower}%', f'%{search_query_lower}%', limit))
            
            materiali_classificati = cursor.fetchall()
        
        # Trasforma materiali classificati
        materiali_list = []
        for materiale in materiali_classificati:
            materiale_dict = {
                'id': materiale[0],
                'codice_articolo': materiale[1],
                'descrizione': materiale[2],
                'fornitore_id': materiale[3],
                'nome_fornitore': materiale[4],
                'contoid': materiale[5],
                'contonome': materiale[6],
                'brancaid': materiale[7],
                'brancanome': materiale[8],
                'sottocontoid': materiale[9],
                'sottocontonome': materiale[10],
                'confermato': materiale[11],
                'metodo_classificazione': materiale[12],
                'fattura_id': materiale[13],
                'data_fattura': materiale[14],
                'costo_unitario': materiale[15],
                'già_classificato': True,
                'materiale_id': materiale[0]
            }
            materiali_list.append(materiale_dict)
        
        # Se non abbiamo raggiunto il limite, cerca in DBF
        if len(materiali_list) < limit:
            # SECONDA: Cerca nelle fatture DBF
            materials_data = migration_service.read_spesafo_data()
            
            # Filtra materiali DBF
            filtered_materials = []
            for material in materials_data:
                descrizione = material.get('nome', '').lower()
                codice_articolo = material.get('codicearticolo', '').lower()
                
                if (search_query_lower in descrizione or 
                    search_query_lower in codice_articolo):
                    filtered_materials.append(material)
            
            # Aggiungi materiali DBF non ancora classificati
            remaining_limit = limit - len(materiali_list)
            for material in filtered_materials[:remaining_limit]:
                # Controlla se non è già presente nei classificati (per descrizione)
                descrizione_materiale = material.get('nome', '').lower()
                
                already_classified = any(
                    m['descrizione'].lower() == descrizione_materiale
                    for m in materiali_list
                )
                
                if not already_classified:
                    materiale_dict = {
                        'id': None,
                        'codice_articolo': codice_articolo,
                        'descrizione': material.get('nome', ''),
                        'fornitore_id': material.get('fornitoreid', ''),
                        'nome_fornitore': material.get('fornitorenome', ''),
                        'contoid': None,
                        'contonome': None,
                        'brancaid': None,
                        'brancanome': None,
                        'sottocontoid': None,
                        'sottocontonome': None,
                        'confermato': 0,
                        'metodo_classificazione': None,
                        'fattura_id': material.get('id_fattura', ''),
                        'data_fattura': material.get('data_fattura', ''),
                        'costo_unitario': material.get('costo_unitario', 0),
                        'già_classificato': False,
                        'materiale_id': None
                    }
                    materiali_list.append(materiale_dict)
        
        # Transform to API format
        articoli = []
        for material in materiali_list:
            articolo = {
                'codice_articolo': material.get('codice_articolo', ''),
                'descrizione': material.get('descrizione', ''),
                'quantita': 1,  # Default per materiali classificati
                'prezzo_unitario': material.get('costo_unitario', 0),
                'fattura': {
                    'id': material.get('fattura_id', ''),
                    'numero_documento': material.get('fattura_id', ''),
                    'codice_fornitore': material.get('fornitore_id', ''),
                    'nome_fornitore': material.get('nome_fornitore', ''),
                    'data_spesa': material.get('data_fattura', ''),
                    'costo_totale': material.get('costo_unitario', 0)
                },
                # Aggiungi informazioni classificazione
                'classificazioneEsistente': {
                    'contoid': material.get('contoid'),
                    'brancaid': material.get('brancaid'),
                    'sottocontoid': material.get('sottocontoid'),
                    'contonome': material.get('contonome'),
                    'brancanome': material.get('brancanome'),
                    'sottocontonome': material.get('sottocontonome'),
                } if material.get('già_classificato') else None,
                'materiale_id': material.get('materiale_id'),
                'già_classificato': material.get('già_classificato', False)
            }
            articoli.append(articolo)
        
        return format_response(
            data={
                'articoli': articoli,
                'total_found': len(materiali_list),
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
        logger.error(f"=== RICERCA ARTICOLI ERROR ===")
        logger.error(f"Unexpected error in ricerca_articoli: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        logger.error(f"Unexpected error in ricerca_articoli: {e}")
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

