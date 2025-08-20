"""
Rentri Service V2
Servizio per integrazione API Rentri con gestione ambienti
"""
import requests
import logging
import jwt
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List
from ..core.environment_manager import environment_manager, ServiceType, Environment
from ..core.config import get_config_value
from ..core.exceptions import ValidationError, ServiceError

logger = logging.getLogger(__name__)

class RentriService:
    """Servizio Rentri con environment switching"""
    
    def __init__(self):
        self.service_type = ServiceType.RENTRI
        self._current_config = None
        self._current_environment = None
        self._access_token = None
        self._token_expires_at = None
        self._reload_configuration()
    
    def _reload_configuration(self):
        """Ricarica configurazione basata su ambiente corrente"""
        self._current_environment = environment_manager.get_environment(self.service_type)
        self._current_config = environment_manager.get_service_config(self.service_type)
        
        # Invalida token esistente quando cambia configurazione
        self._access_token = None
        self._token_expires_at = None
        
        logger.info(f"Rentri Service configurato per ambiente: {self._current_environment.value}")
    
    def get_current_environment(self) -> Environment:
        """Ottiene ambiente corrente"""
        return self._current_environment
    
    def get_current_config(self) -> Dict[str, Any]:
        """Ottiene configurazione corrente"""
        if self._current_environment != environment_manager.get_environment(self.service_type):
            self._reload_configuration()
        return self._current_config.copy()
    
    def is_configured(self) -> bool:
        """Verifica se servizio è configurato"""
        config = self.get_current_config()
        required_fields = ['private_key_path', 'client_id', 'client_audience']
        
        for field in required_fields:
            if not config.get(field):
                return False
        
        # Verifica esistenza file chiave privata
        private_key_path = config.get('private_key_path', '')
        if private_key_path and not Path(private_key_path).exists():
            return False
        
        return True
    
    def get_service_status(self) -> Dict[str, Any]:
        """Ottiene stato completo del servizio"""
        config = self.get_current_config()
        validation = environment_manager.validate_service_config(self.service_type)
        
        return {
            'environment': self._current_environment.value,
            'configured': self.is_configured(),
            'api_base': config.get('api_base', ''),
            'token_url': config.get('token_url', ''),
            'client_id_configured': bool(config.get('client_id')),
            'private_key_exists': Path(config.get('private_key_path', '')).exists() if config.get('private_key_path') else False,
            'has_valid_token': self._has_valid_token(),
            'validation': {
                'valid': validation.valid,
                'errors': validation.errors,
                'warnings': validation.warnings,
                'checks': validation.checks
            }
        }
    
    def test_connection(self) -> Dict[str, Any]:
        """Testa connessione al servizio Rentri"""
        try:
            if not self.is_configured():
                return {
                    'success': False,
                    'error': 'SERVICE_NOT_CONFIGURED',
                    'message': 'Servizio Rentri non configurato correttamente'
                }
            
            # Test ottenimento token
            token_result = self._get_access_token()
            
            if not token_result['success']:
                return {
                    'success': False,
                    'error': 'TOKEN_FAILED',
                    'message': f"Errore ottenimento token: {token_result.get('message', 'Errore sconosciuto')}"
                }
            
            # Test chiamata API base
            config = self.get_current_config()
            api_test_result = self._test_api_call()
            
            return {
                'success': api_test_result['success'],
                'environment': self._current_environment.value,
                'token_obtained': True,
                'api_base': config.get('api_base', ''),
                'api_test': api_test_result,
                'message': 'Connessione Rentri OK' if api_test_result['success'] else 'Problemi connessione API Rentri'
            }
            
        except Exception as e:
            logger.error(f"Errore test Rentri: {e}")
            return {
                'success': False,
                'error': 'TEST_ERROR',
                'message': f'Errore test connessione: {e}'
            }
    
    def _get_access_token(self) -> Dict[str, Any]:
        """Ottiene access token JWT per API Rentri"""
        try:
            # Controlla se token esistente è ancora valido
            if self._has_valid_token():
                return {
                    'success': True,
                    'token': self._access_token,
                    'message': 'Token esistente valido'
                }
            
            config = self.get_current_config()
            
            # Carica chiave privata
            private_key_path = config.get('private_key_path', '')
            if not private_key_path or not Path(private_key_path).exists():
                return {
                    'success': False,
                    'error': 'PRIVATE_KEY_NOT_FOUND',
                    'message': 'File chiave privata non trovato'
                }
            
            with open(private_key_path, 'r') as f:
                private_key = f.read()
            
            # Crea JWT assertion
            now = datetime.utcnow()
            expires_at = now + timedelta(minutes=5)  # Token temporaneo per richiesta
            
            jwt_payload = {
                'iss': config.get('client_id'),
                'sub': config.get('client_id'),
                'aud': config.get('client_audience'),
                'iat': int(now.timestamp()),
                'exp': int(expires_at.timestamp()),
                'jti': f"{config.get('client_id')}_{int(now.timestamp())}"
            }
            
            assertion = jwt.encode(jwt_payload, private_key, algorithm='RS256')
            
            # Richiesta token access
            token_data = {
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': assertion
            }
            
            response = requests.post(
                config.get('token_url'),
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=30
            )
            
            if response.status_code == 200:
                token_response = response.json()
                self._access_token = token_response.get('access_token')
                
                # Calcola scadenza token
                expires_in = token_response.get('expires_in', 3600)
                self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)  # Buffer 1 minuto
                
                return {
                    'success': True,
                    'token': self._access_token,
                    'expires_in': expires_in,
                    'message': 'Token ottenuto con successo'
                }
            else:
                error_data = response.json() if response.content else {}
                return {
                    'success': False,
                    'error': 'TOKEN_REQUEST_FAILED',
                    'status_code': response.status_code,
                    'api_error': error_data.get('error_description', error_data.get('error', 'Errore sconosciuto')),
                    'message': f'Errore richiesta token: {response.status_code}'
                }
                
        except jwt.InvalidKeyError:
            return {
                'success': False,
                'error': 'INVALID_PRIVATE_KEY',
                'message': 'Chiave privata non valida o formato errato'
            }
        except requests.RequestException as e:
            return {
                'success': False,
                'error': 'NETWORK_ERROR',
                'message': f'Errore di rete: {e}'
            }
        except Exception as e:
            logger.error(f"Errore ottenimento token Rentri: {e}")
            return {
                'success': False,
                'error': 'TOKEN_ERROR',
                'message': f'Errore ottenimento token: {e}'
            }
    
    def _has_valid_token(self) -> bool:
        """Verifica se token access è valido"""
        if not self._access_token or not self._token_expires_at:
            return False
        
        return datetime.utcnow() < self._token_expires_at
    
    def _test_api_call(self) -> Dict[str, Any]:
        """Test chiamata API base"""
        try:
            config = self.get_current_config()
            
            if not self._has_valid_token():
                return {
                    'success': False,
                    'error': 'NO_VALID_TOKEN',
                    'message': 'Token access non disponibile'
                }
            
            # Test con endpoint base (es. info utente o servizi disponibili)
            headers = {
                'Authorization': f'Bearer {self._access_token}',
                'Content-Type': 'application/json'
            }
            
            # Endpoint di test - potrebbe variare per ambiente
            test_endpoint = f"{config.get('api_base', '')}/services"  # Esempio endpoint
            
            response = requests.get(
                test_endpoint,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'status_code': response.status_code,
                    'message': 'API accessibile'
                }
            elif response.status_code == 401:
                return {
                    'success': False,
                    'status_code': response.status_code,
                    'error': 'UNAUTHORIZED',
                    'message': 'Token non autorizzato'
                }
            else:
                return {
                    'success': False,
                    'status_code': response.status_code,
                    'error': 'API_ERROR',
                    'message': f'Errore API: {response.status_code}'
                }
                
        except requests.RequestException as e:
            return {
                'success': False,
                'error': 'NETWORK_ERROR',
                'message': f'Errore connessione API: {e}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': 'API_TEST_ERROR',
                'message': f'Errore test API: {e}'
            }
    
    def make_api_request(self, 
                        endpoint: str, 
                        method: str = 'GET',
                        data: Optional[Dict[str, Any]] = None,
                        params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Effettua richiesta API Rentri autenticata
        
        Args:
            endpoint: Endpoint API (relativo al base URL)
            method: Metodo HTTP (GET, POST, PUT, DELETE)
            data: Dati body request (per POST/PUT)
            params: Parametri query string
            
        Returns:
            Risposta API con metadati
        """
        try:
            if not self.is_configured():
                raise ServiceError("Servizio Rentri non configurato")
            
            # Ottieni token valido
            token_result = self._get_access_token()
            if not token_result['success']:
                raise ServiceError(f"Errore ottenimento token: {token_result.get('message')}")
            
            config = self.get_current_config()
            url = f"{config.get('api_base', '')}/{endpoint.lstrip('/')}"
            
            headers = {
                'Authorization': f'Bearer {self._access_token}',
                'Content-Type': 'application/json',
                'User-Agent': 'StudioDimaAI/2.0'
            }
            
            # Effettua richiesta
            response = requests.request(
                method=method.upper(),
                url=url,
                headers=headers,
                json=data if data else None,
                params=params if params else None,
                timeout=60
            )
            
            # Processa risposta
            response_data = response.json() if response.content else {}
            
            return {
                'success': response.status_code < 400,
                'status_code': response.status_code,
                'data': response_data,
                'headers': dict(response.headers),
                'environment': self._current_environment.value,
                'endpoint': endpoint,
                'method': method.upper()
            }
            
        except requests.RequestException as e:
            logger.error(f"Errore richiesta API Rentri: {e}")
            raise ServiceError(f"Errore rete API Rentri: {e}")
        except Exception as e:
            logger.error(f"Errore API Rentri: {e}")
            raise ServiceError(f"Errore API Rentri: {e}")
    
    def get_available_services(self) -> Dict[str, Any]:
        """Ottiene lista servizi disponibili"""
        try:
            result = self.make_api_request('/services')
            
            if result['success']:
                return {
                    'success': True,
                    'services': result['data'],
                    'environment': self._current_environment.value
                }
            else:
                return {
                    'success': False,
                    'error': 'SERVICES_REQUEST_FAILED',
                    'message': f"Errore richiesta servizi: {result['status_code']}"
                }
                
        except ServiceError as e:
            return {
                'success': False,
                'error': 'SERVICE_ERROR',
                'message': str(e)
            }
    
    def search_properties(self, 
                         search_params: Dict[str, Any],
                         limit: int = 50) -> Dict[str, Any]:
        """
        Ricerca immobili nel sistema Rentri
        
        Args:
            search_params: Parametri ricerca (comune, via, etc.)
            limit: Limite risultati
            
        Returns:
            Risultati ricerca immobili
        """
        try:
            params = {**search_params, 'limit': limit}
            result = self.make_api_request('/properties/search', params=params)
            
            if result['success']:
                properties = result['data'].get('properties', [])
                return {
                    'success': True,
                    'properties': properties,
                    'total_count': result['data'].get('total', len(properties)),
                    'environment': self._current_environment.value,
                    'search_params': search_params
                }
            else:
                return {
                    'success': False,
                    'error': 'SEARCH_FAILED',
                    'message': f"Errore ricerca: {result['status_code']}",
                    'details': result.get('data', {})
                }
                
        except ServiceError as e:
            return {
                'success': False,
                'error': 'SERVICE_ERROR',
                'message': str(e)
            }
    
    def get_property_details(self, property_id: str) -> Dict[str, Any]:
        """Ottiene dettagli completi di un immobile"""
        try:
            result = self.make_api_request(f'/properties/{property_id}')
            
            if result['success']:
                return {
                    'success': True,
                    'property': result['data'],
                    'environment': self._current_environment.value
                }
            else:
                return {
                    'success': False,
                    'error': 'PROPERTY_NOT_FOUND',
                    'message': f"Immobile non trovato: {result['status_code']}"
                }
                
        except ServiceError as e:
            return {
                'success': False,
                'error': 'SERVICE_ERROR',
                'message': str(e)
            }
    
    def invalidate_token(self):
        """Invalida token corrente forzando refresh"""
        self._access_token = None
        self._token_expires_at = None
        logger.info("Token Rentri invalidato")

# Instance globale singleton
rentri_service = RentriService()