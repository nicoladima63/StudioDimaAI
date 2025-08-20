"""
API V2 per amministrazione ricetta elettronica
Gestisce environment switching e configurazioni
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from ..config.ricetta_config import ricetta_config
from ..core.exceptions import ValidationError, ConfigurationError

logger = logging.getLogger(__name__)

ricetta_admin_bp = Blueprint("ricetta_admin_v2", __name__, url_prefix="/api/v2/ricetta/admin")

@ricetta_admin_bp.route("/environment", methods=['GET'])
@jwt_required()
def get_environment_info():
    """Ottiene informazioni complete sull'ambiente corrente"""
    try:
        info = ricetta_config.get_environment_info()
        
        return jsonify({
            'success': True,
            'data': info
        }), 200
        
    except Exception as e:
        logger.error(f"Errore info ambiente: {e}")
        return jsonify({
            'success': False,
            'error': 'ENVIRONMENT_INFO_FAILED',
            'message': f'Errore caricamento informazioni: {e}'
        }), 500

@ricetta_admin_bp.route("/environment", methods=['POST'])
@jwt_required()
def switch_environment():
    """Cambia ambiente (test/prod)"""
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
        
        data = request.get_json()
        new_env = data.get('environment')
        
        if not new_env:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'Parametro environment obbligatorio'
            }), 400
        
        if new_env not in ['test', 'prod']:
            return jsonify({
                'success': False,
                'error': 'INVALID_ENVIRONMENT',
                'message': 'Ambiente deve essere test o prod'
            }), 400
        
        # Effettua switch
        success = ricetta_config.set_environment(new_env)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'SWITCH_FAILED',
                'message': 'Impossibile cambiare ambiente'
            }), 500
        
        # Valida nuovo ambiente
        validation = ricetta_config.validate_config(new_env)
        
        return jsonify({
            'success': True,
            'data': {
                'environment': new_env,
                'validation': validation,
                'message': f'Ambiente cambiato a {new_env}'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore switch ambiente: {e}")
        return jsonify({
            'success': False,
            'error': 'SWITCH_ERROR',
            'message': f'Errore durante il cambio: {e}'
        }), 500

@ricetta_admin_bp.route("/validate", methods=['GET'])
@jwt_required()
def validate_configuration():
    """Valida configurazione ambiente corrente"""
    try:
        env = request.args.get('environment')
        validation = ricetta_config.validate_config(env)
        
        status_code = 200 if validation['valid'] else 422
        
        return jsonify({
            'success': validation['valid'],
            'data': validation,
            'message': 'Configurazione valida' if validation['valid'] else 'Configurazione non valida'
        }), status_code
        
    except Exception as e:
        logger.error(f"Errore validazione: {e}")
        return jsonify({
            'success': False,
            'error': 'VALIDATION_FAILED',
            'message': f'Errore durante la validazione: {e}'
        }), 500

@ricetta_admin_bp.route("/configuration", methods=['GET'])
@jwt_required()
def get_configuration():
    """Ottiene configurazione dettagliata"""
    try:
        env = request.args.get('environment')
        
        # Configurazione completa (senza credenziali sensibili)
        config = ricetta_config.get_full_config(env)
        
        # Rimuovi credenziali sensibili dalla risposta
        safe_config = config.copy()
        credentials = safe_config.get('credentials', {})
        
        # Mostra solo se le credenziali sono configurate, non i valori
        safe_credentials = {}
        for key, value in credentials.items():
            safe_credentials[f"{key}_configured"] = bool(value and value.strip())
        
        safe_config['credentials'] = safe_credentials
        
        return jsonify({
            'success': True,
            'data': safe_config
        }), 200
        
    except Exception as e:
        logger.error(f"Errore configurazione: {e}")
        return jsonify({
            'success': False,
            'error': 'CONFIGURATION_FAILED',
            'message': f'Errore caricamento configurazione: {e}'
        }), 500

@ricetta_admin_bp.route("/certificates", methods=['GET'])
@jwt_required()
def check_certificates():
    """Controlla stato certificati"""
    try:
        env = request.args.get('environment')
        ssl_config = ricetta_config.get_ssl_config(env)
        
        certificate_status = {}
        
        for cert_name, cert_path in ssl_config.items():
            if cert_name.endswith('_cert') or cert_name.endswith('_key'):
                if hasattr(cert_path, 'exists'):
                    certificate_status[cert_name] = {
                        'path': str(cert_path),
                        'exists': cert_path.exists(),
                        'readable': cert_path.exists() and cert_path.is_file()
                    }
                    
                    # Informazioni aggiuntive se esiste
                    if cert_path.exists():
                        try:
                            stat = cert_path.stat()
                            certificate_status[cert_name].update({
                                'size': stat.st_size,
                                'modified': stat.st_mtime
                            })
                        except Exception:
                            pass
        
        return jsonify({
            'success': True,
            'data': {
                'environment': env or ricetta_config.get_environment(),
                'certificates': certificate_status
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore controllo certificati: {e}")
        return jsonify({
            'success': False,
            'error': 'CERTIFICATES_CHECK_FAILED',
            'message': f'Errore controllo certificati: {e}'
        }), 500

@ricetta_admin_bp.route("/reload", methods=['POST'])
@jwt_required()
def reload_configuration():
    """Ricarica configurazione e cache"""
    try:
        # Clear cache
        ricetta_config._config_cache.clear()
        ricetta_config._current_env = None
        
        # Ricarica configurazione
        env = ricetta_config.get_environment()
        config = ricetta_config.get_full_config(env)
        validation = ricetta_config.validate_config(env)
        
        return jsonify({
            'success': True,
            'data': {
                'environment': env,
                'configuration_reloaded': True,
                'validation': validation,
                'message': 'Configurazione ricaricata'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore reload configurazione: {e}")
        return jsonify({
            'success': False,
            'error': 'RELOAD_FAILED',
            'message': f'Errore durante il reload: {e}'
        }), 500

@ricetta_admin_bp.route("/logs", methods=['GET'])
@jwt_required()
def get_ricetta_logs():
    """Ottiene ultimi log relativi alla ricetta elettronica"""
    try:
        # Placeholder - implementare lettura log se necessario
        return jsonify({
            'success': True,
            'data': {
                'logs': [],
                'message': 'Funzionalità log non ancora implementata'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore lettura log: {e}")
        return jsonify({
            'success': False,
            'error': 'LOGS_FAILED',
            'message': f'Errore lettura log: {e}'
        }), 500

# Error handlers per il blueprint
@ricetta_admin_bp.errorhandler(ValidationError)
def handle_validation_error(e):
    return jsonify({
        'success': False,
        'error': 'VALIDATION_ERROR',
        'message': str(e)
    }), 400

@ricetta_admin_bp.errorhandler(ConfigurationError)
def handle_configuration_error(e):
    return jsonify({
        'success': False,
        'error': 'CONFIGURATION_ERROR',
        'message': str(e)
    }), 500