"""
API V2 per la gestione delle ricette elettroniche
Implementa endpoint modernizzati con architettura repository/service
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from typing import Dict, Any, Optional
from services.ricetta_service import ricetta_service
from utils.ricetta_utils import ricetta_data_manager

logger = logging.getLogger(__name__)
print("DEBUG: v2_ricetta.py caricato")
ricetta_bp = Blueprint("ricetta_bp", __name__)

@ricetta_bp.route("/ricetta/health", methods=['GET'])
def health_check():
    """Health check per il servizio ricetta"""
    try:
        info = ricetta_service.get_environment_info()
        return jsonify({
            'success': True,
            'service': 'ricetta_elettronica_v2',
            'environment': info['environment'],
            'certificates_valid': all(info['certificates'].values()),
            'credentials_configured': info['credentials_configured']
        }), 200
    except Exception as e:
        logger.error(f"Errore health check: {e}")
        return jsonify({
            'success': False,
            'error': 'HEALTH_CHECK_FAILED',
            'message': str(e)
        }), 500

@ricetta_bp.route("/ricetta/test-connection", methods=['GET'])
@jwt_required()
def test_connection():
    """Testa la connessione al Sistema Tessera Sanitaria"""
    try:
        result = ricetta_service.test_connection()
        
        status_code = 200 if result['success'] else 502
        return jsonify({
            'success': result['success'],
            'data': result,
            'message': result.get('message', 'Test completato')
        }), status_code
        
    except Exception as e:
        logger.error(f"Errore test connessione: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_CONNECTION_FAILED',
            'message': f'Errore durante il test: {e}'
        }), 500

@ricetta_bp.route("/ricetta/diagnosi", methods=['GET'])
@jwt_required()
def search_diagnosi():
    """Ricerca diagnosi ICD9"""
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))
        
        if not query or len(query) < 2:
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Query troppo breve'
            }), 200
        
        risultati = ricetta_data_manager.cerca_diagnosi(query, limit)
        
        return jsonify({
            'success': True,
            'data': risultati,
            'count': len(risultati),
            'query': query
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'INVALID_PARAMETERS',
            'message': f'Parametri non validi: {e}'
        }), 400
    except Exception as e:
        logger.error(f"Errore ricerca diagnosi: {e}")
        return jsonify({
            'success': False,
            'error': 'SEARCH_FAILED',
            'message': f'Errore durante la ricerca: {e}'
        }), 500

@ricetta_bp.route("/ricetta/farmaci", methods=['GET'])
@jwt_required()
def search_farmaci():
    """Ricerca farmaci ATC"""
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))
        
        if not query or len(query) < 2:
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Query troppo breve'
            }), 200
        
        risultati = ricetta_data_manager.cerca_farmaci(query, limit)
        
        return jsonify({
            'success': True,
            'data': risultati,
            'count': len(risultati),
            'query': query
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'INVALID_PARAMETERS',
            'message': f'Parametri non validi: {e}'
        }), 400
    except Exception as e:
        logger.error(f"Errore ricerca farmaci: {e}")
        return jsonify({
            'success': False,
            'error': 'SEARCH_FAILED',
            'message': f'Errore durante la ricerca: {e}'
        }), 500

@ricetta_bp.route("/ricetta/farmaci/per-diagnosi/<codice_diagnosi>", methods=['GET'])
@jwt_required()
def get_farmaci_per_diagnosi(codice_diagnosi: str):
    """Ottiene farmaci suggeriti per una diagnosi"""
    try:
        if not codice_diagnosi:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'Codice diagnosi obbligatorio'
            }), 400
        
        # Valida diagnosi
        if not ricetta_data_manager.validate_diagnosi(codice_diagnosi):
            return jsonify({
                'success': False,
                'error': 'INVALID_DIAGNOSIS',
                'message': f'Diagnosi {codice_diagnosi} non valida'
            }), 400
        
        farmaci = ricetta_data_manager.get_farmaci_per_diagnosi(codice_diagnosi)
        
        return jsonify({
            'success': True,
            'data': farmaci,
            'count': len(farmaci),
            'diagnosi': codice_diagnosi
        }), 200
        
    except Exception as e:
        logger.error(f"Errore farmaci per diagnosi: {e}")
        return jsonify({
            'success': False,
            'error': 'LOOKUP_FAILED',
            'message': f'Errore durante la ricerca: {e}'
        }), 500

@ricetta_bp.route("/ricetta/protocolli", methods=['GET'])
@jwt_required()
def get_protocolli():
    """Ottiene protocolli terapeutici"""
    try:
        protocolli = ricetta_data_manager.get_protocolli_terapeutici()
        
        return jsonify({
            'success': True,
            'data': protocolli,
            'count': len(protocolli)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore protocolli: {e}")
        return jsonify({
            'success': False,
            'error': 'PROTOCOLS_FAILED',
            'message': f'Errore caricamento protocolli: {e}'
        }), 500

@ricetta_bp.route("/ricetta/protocolli/<protocollo_id>", methods=['GET'])
@jwt_required()
def get_protocollo_by_id(protocollo_id: str):
    """Ottiene protocollo terapeutico per ID"""
    try:
        protocollo = ricetta_data_manager.get_protocollo_by_id(protocollo_id)
        
        if not protocollo:
            return jsonify({
                'success': False,
                'error': 'PROTOCOL_NOT_FOUND',
                'message': f'Protocollo {protocollo_id} non trovato'
            }), 404
        
        return jsonify({
            'success': True,
            'data': protocollo
        }), 200
        
    except Exception as e:
        logger.error(f"Errore protocollo {protocollo_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'PROTOCOL_FAILED',
            'message': f'Errore caricamento protocollo: {e}'
        }), 500

@ricetta_bp.route("/ricetta/suggestions/posologie", methods=['GET'])
@jwt_required()
def get_posologie_suggestions():
    """Ottiene suggerimenti posologie"""
    try:
        posologie = ricetta_data_manager.get_posologie_comuni()
        
        return jsonify({
            'success': True,
            'data': posologie,
            'count': len(posologie)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore posologie: {e}")
        return jsonify({
            'success': False,
            'error': 'SUGGESTIONS_FAILED',
            'message': f'Errore caricamento posologie: {e}'
        }), 500

@ricetta_bp.route("/ricetta/suggestions/durate", methods=['GET'])
@jwt_required()
def get_durate_suggestions():
    """Ottiene suggerimenti durate terapia"""
    try:
        durate = ricetta_data_manager.get_durate_comuni()
        
        return jsonify({
            'success': True,
            'data': durate,
            'count': len(durate)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore durate: {e}")
        return jsonify({
            'success': False,
            'error': 'SUGGESTIONS_FAILED',
            'message': f'Errore caricamento durate: {e}'
        }), 500

@ricetta_bp.route("/ricetta/suggestions/note", methods=['GET'])
@jwt_required()
def get_note_suggestions():
    """Ottiene suggerimenti note"""
    try:
        note = ricetta_data_manager.get_note_frequenti()
        
        return jsonify({
            'success': True,
            'data': note,
            'count': len(note)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore note: {e}")
        return jsonify({
            'success': False,
            'error': 'SUGGESTIONS_FAILED',
            'message': f'Errore caricamento note: {e}'
        }), 500

@ricetta_bp.route("/ricetta/invio", methods=['POST'])
def invia_ricetta():
    """Invia ricetta elettronica al Sistema TS"""
    logger.info("=== DEBUG: Richiesta invio ricetta ricevuta ===")
    try:
        # Validazione request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
        dati = request.get_json()
        if not dati:
            return jsonify({
                'success': False,
                'error': 'EMPTY_REQUEST',
                'message': 'Dati ricetta non presenti'
            }), 400

        # --- MAPPING COME V1: payload -> formato interno ---
        # V1 mappa payload a formato flat con cf_assistito
        dati_ricetta = {
            'cf_assistito': dati['paziente']['codiceFiscale'],
            'nome_assistito': dati['paziente']['nome'],
            'cognome_assistito': dati['paziente']['cognome'],
            'codice_diagnosi': dati['diagnosi']['codice'],
            'descrizione_diagnosi': dati['diagnosi']['descrizione'],
            'codice_farmaco': dati['farmaco']['codice'],
            'denominazione_farmaco': dati['farmaco']['descrizione'],
            'principio_attivo': dati['farmaco']['principio_attivo'],
            'posologia': dati['posologia'],
            'durata': dati['durata'],
            'note': dati.get('note', ''),
            'num_iscrizione': dati.get('medico', {}).get('iscrizione', '591')
        }

        # Validazione base come V1
        required_fields = ['cf_assistito', 'codice_diagnosi', 'descrizione_diagnosi', 
                          'codice_farmaco', 'denominazione_farmaco', 'principio_attivo',
                          'posologia', 'durata']
        
        for field in required_fields:
            if field not in dati_ricetta:
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        logger.info(f"Invio ricetta per CF: {dati_ricetta['cf_assistito']}")
        
        # === USA IL SERVIZIO V1 DIRETTAMENTE ===
        # Importa e usa il servizio V1 che funziona
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '../../server'))
        
        try:
            from server.app.ricetta_elettronica.ricetta_service import ricetta_service as v1_ricetta_service
            
            # Usa il servizio V1 direttamente
            result = v1_ricetta_service.invia_ricetta(dati_ricetta)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': 'Ricetta inviata con successo al Sistema TS',
                    'data': result
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Errore invio ricetta al Sistema TS',
                    'details': result
                }), 400
                
        except ImportError as e:
            logger.error(f"Impossibile importare servizio V1: {e}")
            return jsonify({
                'success': False,
                'error': 'SERVICE_UNAVAILABLE',
                'message': f'Servizio ricetta non disponibile: {e}'
            }), 503
        except Exception as e:
            logger.error(f"Errore servizio V1: {e}")
            return jsonify({
                'success': False,
                'error': 'SERVICE_ERROR',
                'message': f'Errore durante l\'invio: {e}'
            }), 500
    except Exception as e:
        logger.error(f"Errore invio ricetta: {e}")
        return jsonify({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': f'Errore interno: {e}'
        }), 500

@ricetta_bp.route("/ricetta/test/farmaci-sicuri", methods=['GET'])
@jwt_required()
def get_farmaci_test_sicuri():
    """Ottiene farmaci sicuri per test"""
    try:
        farmaci = ricetta_data_manager.get_farmaci_test_sicuri()
        
        return jsonify({
            'success': True,
            'data': farmaci,
            'count': len(farmaci),
            'message': 'Farmaci sicuri per ambiente test'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore farmaci test: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_DATA_FAILED',
            'message': f'Errore caricamento farmaci test: {e}'
        }), 500

@ricetta_bp.route("/ricetta/test/ricette-funzionanti", methods=['GET'])
@jwt_required()
def get_ricette_test_funzionanti():
    """Ottiene ricette test già funzionanti"""
    try:
        ricette = ricetta_data_manager.get_ricette_test_funzionanti()
        
        return jsonify({
            'success': True,
            'data': ricette,
            'count': len(ricette),
            'message': 'Ricette test funzionanti'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore ricette test: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_DATA_FAILED',
            'message': f'Errore caricamento ricette test: {e}'
        }), 500

@ricetta_bp.route("/ricetta/environment", methods=['GET'])
@jwt_required()
def get_environment_info():
    """Informazioni ambiente corrente"""
    try:
        info = ricetta_service.get_environment_info()
        
        return jsonify({
            'success': True,
            'data': info
        }), 200
        
    except Exception as e:
        logger.error(f"Errore info ambiente: {e}")
        return jsonify({
            'success': False,
            'error': 'ENVIRONMENT_INFO_FAILED',
            'message': f'Errore informazioni ambiente: {e}'
        }), 500

@ricetta_bp.route("/ricetta/test-endpoint", methods=['GET'])
def test_simple():
    return jsonify({"success": True, "message": "Test OK"}), 200

@ricetta_bp.route("/ricetta/database/list", methods=['GET'])
#@jwt_required()
def list_ricette_database():
    """Recupera le ricette dal Sistema TS - Replica V1"""
    try:
        # Parametri opzionali dalla query string
        data_da = request.args.get('data_da')
        data_a = request.args.get('data_a')
        cf_assistito = request.args.get('cf_assistito')
        
        logger.info("Richiesta lista ricette dal Sistema TS")
        
        # === MOCK TEMPORANEO PER TEST ===
        # Dati mock per evitare problemi SOAP
        ricette_mock = [
            {
                'id': 'R001',
                'cf_paziente': 'RSSMRA80A01H501U',
                'data': '2025-01-15',
                'stato': 'Inviata',
                'numero_ricetta': 'RIC20250115001',
                'farmaco': 'Amoxicillina 500mg',
                'diagnosi': 'J06.9 - Infezione acuta delle vie respiratorie superiori'
            },
            {
                'id': 'R002', 
                'cf_paziente': 'VRDGNN75M15F205Z',
                'data': '2025-01-14',
                'stato': 'Elaborata',
                'numero_ricetta': 'RIC20250114002',
                'farmaco': 'Ibuprofene 600mg',
                'diagnosi': 'M79.1 - Mialgia'
            }
        ]
        
        # Filtra per parametri se presenti
        ricette_filtrate = ricette_mock
        if cf_assistito:
            ricette_filtrate = [r for r in ricette_filtrate if r['cf_paziente'] == cf_assistito]
            
        logger.info(f"Ritornate {len(ricette_filtrate)} ricette mock")
        
        return jsonify({
            'success': True,
            'source': 'mock_data',
            'count': len(ricette_filtrate),
            'data': ricette_filtrate
        }), 200
        
    except Exception as e:
        logger.error(f"Errore lista ricette: {e}")
        return jsonify({
            'success': False,
            'error': 'INTERNAL_ERROR', 
            'message': f'Errore interno: {e}'
        }), 500

# Validazione rimossa - ora usa formato flat come V1

