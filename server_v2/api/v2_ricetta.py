"""
API V2 per la gestione delle ricette elettroniche
Implementa endpoint modernizzati con architettura repository/service
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from typing import Dict, Any, Optional
from ..services.ricetta_service import ricetta_service
from ..utils.ricetta_utils import ricetta_data_manager
from ..core.exceptions import RicettaServiceError, ValidationError

logger = logging.getLogger(__name__)

ricetta_bp = Blueprint("ricetta_v2", __name__, url_prefix="/api/v2/ricetta")

@ricetta_bp.route("/health", methods=['GET'])
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

@ricetta_bp.route("/test-connection", methods=['GET'])
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

@ricetta_bp.route("/diagnosi", methods=['GET'])
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

@ricetta_bp.route("/farmaci", methods=['GET'])
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

@ricetta_bp.route("/farmaci/per-diagnosi/<codice_diagnosi>", methods=['GET'])
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

@ricetta_bp.route("/protocolli", methods=['GET'])
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

@ricetta_bp.route("/protocolli/<protocollo_id>", methods=['GET'])
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

@ricetta_bp.route("/suggestions/posologie", methods=['GET'])
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

@ricetta_bp.route("/suggestions/durate", methods=['GET'])
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

@ricetta_bp.route("/suggestions/note", methods=['GET'])
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

@ricetta_bp.route("/invio", methods=['POST'])
@jwt_required()
def invia_ricetta():
    """Invia ricetta elettronica al Sistema TS"""
    try:
        # Validazione request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
        
        dati_ricetta = request.get_json()
        if not dati_ricetta:
            return jsonify({
                'success': False,
                'error': 'EMPTY_REQUEST',
                'message': 'Dati ricetta non presenti'
            }), 400
        
        # Validazione dati
        try:
            _validate_ricetta_request(dati_ricetta)
        except ValidationError as e:
            return jsonify({
                'success': False,
                'error': 'VALIDATION_ERROR',
                'message': str(e)
            }), 400
        
        # Invio ricetta
        try:
            risultato = ricetta_service.invia_ricetta(dati_ricetta)
            
            status_code = 200 if risultato['success'] else 422
            return jsonify(risultato), status_code
            
        except RicettaServiceError as e:
            logger.error(f"Errore servizio ricetta: {e}")
            return jsonify({
                'success': False,
                'error': 'SERVICE_ERROR',
                'message': str(e)
            }), 502
        
    except Exception as e:
        logger.error(f"Errore invio ricetta: {e}")
        return jsonify({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': f'Errore interno: {e}'
        }), 500

@ricetta_bp.route("/test/farmaci-sicuri", methods=['GET'])
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

@ricetta_bp.route("/test/ricette-funzionanti", methods=['GET'])
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

@ricetta_bp.route("/environment", methods=['GET'])
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

def _validate_ricetta_request(dati: Dict[str, Any]) -> None:
    """Valida i dati della richiesta ricetta"""
    required_fields = [
        'paziente',
        'diagnosi', 
        'farmaco'
    ]
    
    for field in required_fields:
        if field not in dati:
            raise ValidationError(f"Campo obbligatorio mancante: {field}")
    
    # Valida paziente
    paziente = dati['paziente']
    required_paziente = ['nome', 'cognome', 'codice_fiscale']
    for field in required_paziente:
        if field not in paziente or not paziente[field]:
            raise ValidationError(f"Campo paziente obbligatorio: {field}")
    
    # Valida diagnosi
    diagnosi = dati['diagnosi']
    if 'codice' not in diagnosi or not diagnosi['codice']:
        raise ValidationError("Codice diagnosi obbligatorio")
    
    # Valida farmaco
    farmaco = dati['farmaco']
    required_farmaco = ['codice', 'descrizione', 'principio_attivo']
    for field in required_farmaco:
        if field not in farmaco or not farmaco[field]:
            raise ValidationError(f"Campo farmaco obbligatorio: {field}")

# Error handlers specifici per il blueprint
@ricetta_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return jsonify({
        'success': False,
        'error': 'VALIDATION_ERROR',
        'message': str(e)
    }), 400

@ricetta_bp.errorhandler(RicettaServiceError)
def handle_ricetta_service_error(e):
    return jsonify({
        'success': False,
        'error': 'SERVICE_ERROR',
        'message': str(e)
    }), 502