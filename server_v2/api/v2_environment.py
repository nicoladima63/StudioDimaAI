"""
API V2 per gestione ambienti
Endpoints moderni per switching e gestione configurazioni ambienti
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from typing import Dict, Any
from core.environment_manager import environment_manager, ServiceType, Environment
from core.exceptions import ValidationError, ConfigurationError

logger = logging.getLogger(__name__)

environment_bp = Blueprint("environment_v2", __name__, url_prefix='/api/v2')

@environment_bp.route("/environment/status", methods=['GET'])
@jwt_required()
def get_environment_status():
    """Ottiene stato completo di tutti gli ambienti"""
    try:
        status = environment_manager.get_all_services_status()
        
        # Converte enum in stringhe per JSON
        serialized_status = {}
        for service_type, service_data in status.items():
            serialized_status[service_type.value] = service_data
        
        return jsonify({
            'success': True,
            'data': {
                'services': serialized_status,
                'system_info': {
                    'instance_dir': str(environment_manager.instance_dir),
                    'cache_size': len(environment_manager._cache),
                    'initialized': getattr(environment_manager, '_initialized', False)
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore stato ambienti: {e}")
        return jsonify({
            'success': False,
            'error': 'STATUS_FAILED',
            'message': f'Errore recupero stato: {e}'
        }), 500

@environment_bp.route("/environment/<service>/current", methods=['GET'])
@jwt_required()
def get_service_environment(service):
    """Ottiene ambiente corrente per un servizio specifico"""
    try:
        # Valida servizio
        try:
            service_type = ServiceType(service)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'INVALID_SERVICE',
                'message': f'Servizio {service} non supportato'
            }), 400
        
        current_env = environment_manager.get_environment(service_type)
        service_config = environment_manager.get_service_config(service_type)
        validation = environment_manager.validate_service_config(service_type)
        
        return jsonify({
            'success': True,
            'data': {
                'service': service,
                'current_environment': current_env.value,
                'available_environments': [env.value for env in environment_manager._services[service_type].available_environments],
                'configuration': service_config,
                'validation': {
                    'valid': validation.valid,
                    'errors': validation.errors,
                    'warnings': validation.warnings,
                    'checks': validation.checks
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore ambiente servizio {service}: {e}")
        return jsonify({
            'success': False,
            'error': 'SERVICE_ENVIRONMENT_FAILED',
            'message': f'Errore recupero ambiente {service}: {e}'
        }), 500

@environment_bp.route("/environment/<service>/switch", methods=['POST'])
@jwt_required()
def switch_service_environment(service):
    """Cambia ambiente per un servizio specifico"""
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
        
        data = request.get_json()
        new_environment = data.get('environment')
        
        if not new_environment:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'Parametro environment obbligatorio'
            }), 400
        
        # Valida servizio
        try:
            service_type = ServiceType(service)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'INVALID_SERVICE',
                'message': f'Servizio {service} non supportato'
            }), 400
        
        # Valida ambiente
        try:
            environment = Environment(new_environment)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'INVALID_ENVIRONMENT',
                'message': f'Ambiente {new_environment} non valido'
            }), 400
        
        # Controlla se ambiente è supportato per il servizio
        if service_type in environment_manager._services:
            available_envs = environment_manager._services[service_type].available_environments
            if environment not in available_envs:
                return jsonify({
                    'success': False,
                    'error': 'ENVIRONMENT_NOT_SUPPORTED',
                    'message': f'Ambiente {environment.value} non supportato per {service}'
                }), 400
        
        # Validazioni specifiche pre-switch
        validation_result = _validate_environment_switch(service_type, environment)
        if not validation_result['success']:
            return jsonify(validation_result), validation_result.get('status_code', 422)
        
        # Effettua switch
        success = environment_manager.set_environment(service_type, environment)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'SWITCH_FAILED',
                'message': f'Impossibile cambiare ambiente {service} a {environment.value}'
            }), 500
        
        # Valida nuovo ambiente
        post_validation = environment_manager.validate_service_config(service_type)
        
        return jsonify({
            'success': True,
            'data': {
                'service': service,
                'previous_environment': validation_result.get('previous_environment'),
                'current_environment': environment.value,
                'validation': {
                    'valid': post_validation.valid,
                    'errors': post_validation.errors,
                    'warnings': post_validation.warnings,
                    'checks': post_validation.checks
                },
                'message': f'Ambiente {service} cambiato a {environment.value}'
            }
        }), 200
        
    except ValidationError as e:
        return jsonify({
            'success': False,
            'error': 'VALIDATION_ERROR',
            'message': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Errore switch ambiente {service}: {e}")
        return jsonify({
            'success': False,
            'error': 'SWITCH_ERROR',
            'message': f'Errore durante il cambio: {e}'
        }), 500

@environment_bp.route("/environment/bulk-switch", methods=['POST'])
@jwt_required()
def bulk_switch_environments():
    """Cambia ambiente per più servizi contemporaneamente"""
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
        
        data = request.get_json()
        changes = data.get('changes', {})
        
        if not changes:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'Parametro changes obbligatorio'
            }), 400
        
        # Valida e converte input
        validated_changes = {}
        validation_errors = []
        
        for service_str, environment_str in changes.items():
            try:
                service_type = ServiceType(service_str)
                environment = Environment(environment_str)
                validated_changes[service_type] = environment
            except ValueError as e:
                validation_errors.append(f"Valore non valido per {service_str}: {e}")
        
        if validation_errors:
            return jsonify({
                'success': False,
                'error': 'VALIDATION_ERRORS',
                'message': 'Errori validazione input',
                'details': validation_errors
            }), 400
        
        # Effettua switch bulk
        results = environment_manager.switch_environment_bulk(validated_changes)
        
        # Prepara risposta
        response_data = {
            'total_changes': len(validated_changes),
            'successful_changes': sum(1 for success in results.values() if success),
            'failed_changes': sum(1 for success in results.values() if not success),
            'results': {}
        }
        
        for service_type, success in results.items():
            response_data['results'][service_type.value] = {
                'success': success,
                'environment': validated_changes[service_type].value,
                'message': 'Cambiato con successo' if success else 'Errore durante il cambio'
            }
        
        # Determina status code
        if all(results.values()):
            status_code = 200
            overall_success = True
        elif any(results.values()):
            status_code = 207  # Multi-Status
            overall_success = True
        else:
            status_code = 500
            overall_success = False
        
        return jsonify({
            'success': overall_success,
            'data': response_data
        }), status_code
        
    except Exception as e:
        logger.error(f"Errore bulk switch: {e}")
        return jsonify({
            'success': False,
            'error': 'BULK_SWITCH_ERROR',
            'message': f'Errore durante il cambio bulk: {e}'
        }), 500

@environment_bp.route("/environment/<service>/validate", methods=['GET'])
@jwt_required()
def validate_service_configuration(service):
    """Valida configurazione di un servizio"""
    try:
        # Valida servizio
        try:
            service_type = ServiceType(service)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'INVALID_SERVICE',
                'message': f'Servizio {service} non supportato'
            }), 400
        
        # Parametro opzionale per ambiente specifico
        environment_param = request.args.get('environment')
        environment = None
        
        if environment_param:
            try:
                environment = Environment(environment_param)
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'INVALID_ENVIRONMENT',
                    'message': f'Ambiente {environment_param} non valido'
                }), 400
        
        validation = environment_manager.validate_service_config(service_type, environment)
        
        status_code = 200 if validation.valid else 422
        
        return jsonify({
            'success': validation.valid,
            'data': {
                'service': service,
                'environment': (environment or environment_manager.get_environment(service_type)).value,
                'validation': {
                    'valid': validation.valid,
                    'errors': validation.errors,
                    'warnings': validation.warnings,
                    'checks': validation.checks
                },
                'message': 'Configurazione valida' if validation.valid else 'Configurazione non valida'
            }
        }), status_code
        
    except Exception as e:
        logger.error(f"Errore validazione {service}: {e}")
        return jsonify({
            'success': False,
            'error': 'VALIDATION_FAILED',
            'message': f'Errore durante la validazione: {e}'
        }), 500

@environment_bp.route("/environment/<service>/test", methods=['POST'])
@jwt_required()
def test_service_connection(service):
    """Testa connessione per un servizio specifico"""
    try:
        # Valida servizio
        try:
            service_type = ServiceType(service)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'INVALID_SERVICE',
                'message': f'Servizio {service} non supportato'
            }), 400
        
        # Parametro opzionale per ambiente specifico
        data = request.get_json() if request.is_json else {}
        environment_param = data.get('environment')
        environment = None
        
        if environment_param:
            try:
                environment = Environment(environment_param)
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'INVALID_ENVIRONMENT',
                    'message': f'Ambiente {environment_param} non valido'
                }), 400
        
        # Esegue test specifici per servizio
        test_result = _perform_service_test(service_type, environment)
        
        return jsonify({
            'success': test_result['success'],
            'data': {
                'service': service,
                'environment': (environment or environment_manager.get_environment(service_type)).value,
                'test_result': test_result,
                'message': test_result.get('message', 'Test completato')
            }
        }), 200 if test_result['success'] else 422
        
    except Exception as e:
        logger.error(f"Errore test {service}: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_FAILED',
            'message': f'Errore durante il test: {e}'
        }), 500

@environment_bp.route("/environment/cache/clear", methods=['POST'])
@jwt_required()
def clear_environment_cache():
    """Pulisce cache configurazioni"""
    try:
        cache_size_before = len(environment_manager._cache)
        environment_manager.clear_cache()
        
        return jsonify({
            'success': True,
            'data': {
                'cache_cleared': True,
                'entries_removed': cache_size_before,
                'message': 'Cache pulita con successo'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore pulizia cache: {e}")
        return jsonify({
            'success': False,
            'error': 'CACHE_CLEAR_FAILED',
            'message': f'Errore pulizia cache: {e}'
        }), 500

@environment_bp.route("/environment/reload", methods=['POST'])
@jwt_required()
def reload_configurations():
    """Ricarica tutte le configurazioni"""
    try:
        environment_manager.reload_all_configurations()
        
        # Ottieni stato aggiornato
        status = environment_manager.get_all_services_status()
        serialized_status = {}
        for service_type, service_data in status.items():
            serialized_status[service_type.value] = service_data
        
        return jsonify({
            'success': True,
            'data': {
                'reloaded': True,
                'services': serialized_status,
                'message': 'Configurazioni ricaricate con successo'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore reload configurazioni: {e}")
        return jsonify({
            'success': False,
            'error': 'RELOAD_FAILED',
            'message': f'Errore reload configurazioni: {e}'
        }), 500

# === Helper Functions ===

def _validate_environment_switch(service_type: ServiceType, new_environment: Environment) -> Dict[str, Any]:
    """Validazioni specifiche pre-switch"""
    current_env = environment_manager.get_environment(service_type)
    
    # Validazioni specifiche per servizio
    if service_type == ServiceType.DATABASE and new_environment == Environment.PROD:
        # Controlla connettività rete studio
        import subprocess
        try:
            result = subprocess.run(['ping', '-n', '1', 'SERVERDIMA'], 
                                 capture_output=True, timeout=5)
            if result.returncode != 0:
                return {
                    'success': False,
                    'error': 'NETWORK_UNREACHABLE',
                    'message': 'Server SERVERDIMA non raggiungibile. Assicurati di essere connesso alla rete studio.',
                    'status_code': 503
                }
        except Exception:
            return {
                'success': False,
                'error': 'NETWORK_TEST_FAILED',
                'message': 'Impossibile testare connettività rete',
                'status_code': 503
            }
    
    elif service_type == ServiceType.SMS and new_environment in [Environment.PROD, Environment.TEST]:
        # Controlla credenziali Brevo
        from ..core.config import get_config_value
        api_key = get_config_value('BREVO_API_KEY', '')
        if not api_key:
            return {
                'success': False,
                'error': 'MISSING_CREDENTIALS',
                'message': 'Credenziali Brevo mancanti. Configura BREVO_API_KEY nel file .env',
                'status_code': 400
            }
    
    return {
        'success': True,
        'previous_environment': current_env.value
    }

def _perform_service_test(service_type: ServiceType, environment: Environment = None) -> Dict[str, Any]:
    """Esegue test specifici per servizio"""
    if environment is None:
        environment = environment_manager.get_environment(service_type)
    
    config = environment_manager.get_service_config(service_type, environment)
    
    if service_type == ServiceType.DATABASE:
        return _test_database_connection(config, environment)
    elif service_type == ServiceType.RICETTA:
        return _test_ricetta_connection(config, environment)
    elif service_type == ServiceType.SMS:
        return _test_sms_connection(config, environment)
    elif service_type == ServiceType.RENTRI:
        return _test_rentri_connection(config, environment)
    else:
        return {'success': True, 'message': 'Test non implementato per questo servizio'}

def _test_database_connection(config: Dict[str, Any], environment: Environment) -> Dict[str, Any]:
    """Test connessione database"""
    try:
        if environment == Environment.PROD:
            # Test rete e cartella condivisa
            import subprocess
            from pathlib import Path
            
            # Test ping
            result = subprocess.run(['ping', '-n', '1', 'SERVERDIMA'], 
                                 capture_output=True, timeout=5)
            network_ok = (result.returncode == 0)
            
            # Test cartella condivisa
            path = Path(config.get('path', ''))
            share_ok = path.exists()
            
            return {
                'success': network_ok and share_ok,
                'details': {
                    'network_connectivity': network_ok,
                    'shared_folder_access': share_ok,
                    'path_tested': str(path)
                },
                'message': 'Database rete accessibile' if (network_ok and share_ok) else 'Problemi accesso database rete'
            }
        else:
            # Test database locale
            from pathlib import Path
            path = Path(config.get('path', ''))
            exists = path.exists()
            
            return {
                'success': exists,
                'details': {
                    'file_exists': exists,
                    'path_tested': str(path)
                },
                'message': 'Database locale accessibile' if exists else 'Database locale non trovato'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Errore test database'
        }

def _test_ricetta_connection(config: Dict[str, Any], environment: Environment) -> Dict[str, Any]:
    """Test connessione ricetta elettronica"""
    try:
        # Importa e usa il test del sistema ricetta esistente
        from ..services.ricetta_service import ricetta_service
        return ricetta_service.test_connection()
    except ImportError:
        return {
            'success': False,
            'message': 'Servizio ricetta non disponibile - environment'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Errore test ricetta elettronica'
        }

def _test_sms_connection(config: Dict[str, Any], environment: Environment) -> Dict[str, Any]:
    """Test connessione SMS"""
    try:
        import requests
        
        api_key = config.get('api_key', '')
        if not api_key:
            return {
                'success': False,
                'message': 'API key mancante'
            }
        
        # Test con endpoint Brevo account info
        headers = {
            'api-key': api_key,
            'Content-Type': 'application/json'
        }
        
        response = requests.get(
            'https://api.brevo.com/v3/account',
            headers=headers,
            timeout=10
        )
        
        success = response.status_code == 200
        
        return {
            'success': success,
            'details': {
                'status_code': response.status_code,
                'api_key_configured': bool(api_key),
                'sender': config.get('sender', '')
            },
            'message': 'Connessione SMS OK' if success else f'Errore connessione SMS: {response.status_code}'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Errore test SMS'
        }

def _test_rentri_connection(config: Dict[str, Any], environment: Environment) -> Dict[str, Any]:
    """Test connessione Rentri"""
    try:
        from pathlib import Path
        
        # Controlla file chiave privata
        private_key_path = config.get('private_key_path', '')
        key_exists = Path(private_key_path).exists() if private_key_path else False
        
        # Controlla configurazione
        client_id = config.get('client_id', '')
        client_audience = config.get('client_audience', '')
        
        config_ok = bool(private_key_path and client_id and client_audience)
        
        return {
            'success': key_exists and config_ok,
            'details': {
                'private_key_exists': key_exists,
                'client_id_configured': bool(client_id),
                'client_audience_configured': bool(client_audience),
                'token_url': config.get('token_url', '')
            },
            'message': 'Configurazione Rentri OK' if (key_exists and config_ok) else 'Problemi configurazione Rentri'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Errore test Rentri'
        }

# Error handlers per il blueprint
@environment_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return jsonify({
        'success': False,
        'error': 'VALIDATION_ERROR',
        'message': str(e)
    }), 400

@environment_bp.errorhandler(ConfigurationError)
def handle_configuration_error(e):
    return jsonify({
        'success': False,
        'error': 'CONFIGURATION_ERROR',
        'message': str(e)
    }), 500