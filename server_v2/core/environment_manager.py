"""
Environment Manager V2
Sistema unificato per la gestione degli ambienti di sviluppo/produzione/test
Modernizzazione e unificazione del sistema v1
"""
import os
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class Environment(str, Enum):
    """Enumerazione ambienti supportati"""
    DEV = "dev"
    TEST = "test" 
    PROD = "prod"

class ServiceType(str, Enum):
    """Servizi supportati dal sistema"""
    DATABASE = "database"
    RICETTA = "ricetta"
    SMS = "sms"
    RENTRI = "rentri"
    CALENDAR = "calendar"

@dataclass
class ServiceConfig:
    """Configurazione per un servizio specifico"""
    service_type: ServiceType
    current_environment: Environment
    available_environments: List[Environment]
    config_data: Dict[str, Any] = field(default_factory=dict)
    last_validation: Optional[datetime] = None
    validation_status: bool = False
    validation_errors: List[str] = field(default_factory=list)

@dataclass
class EnvironmentValidation:
    """Risultato validazione ambiente"""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    checks: Dict[str, bool] = field(default_factory=dict)

class EnvironmentManager:
    """Manager centrale per gestione ambienti"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
            
        self.project_root = Path(__file__).parent.parent.parent
        self.instance_dir = self.project_root / "server_v2" / "instance"
        self.instance_dir.mkdir(parents=True, exist_ok=True)
        
        # Cache configurazioni con TTL
        self._cache: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, datetime] = {}
        self._cache_ttl = timedelta(minutes=5)
        
        # Configurazioni servizi
        self._services: Dict[ServiceType, ServiceConfig] = {}
        
        # File mapping per persistenza
        self._mode_files = {
            ServiceType.DATABASE: "database_mode.txt",
            ServiceType.RICETTA: "ricetta_mode.txt", 
            ServiceType.SMS: "sms_mode.txt",
            ServiceType.RENTRI: "rentri_mode.txt",
            ServiceType.CALENDAR: "calendar_mode.txt"
        }
        
        self._automation_config_file = self.instance_dir / "automation_settings.json"
        
        # Inizializza servizi
        self._initialize_services()
        self._initialized = True
        
    def _initialize_services(self):
        """Inizializza configurazioni servizi"""
        service_configs = {
            ServiceType.DATABASE: {
                'available_environments': [Environment.DEV, Environment.PROD],
                'default_environment': Environment.DEV
            },
            ServiceType.RICETTA: {
                'available_environments': [Environment.TEST, Environment.PROD], 
                'default_environment': Environment.TEST
            },
            ServiceType.SMS: {
                'available_environments': [Environment.TEST, Environment.PROD],
                'default_environment': Environment.TEST
            },
            ServiceType.RENTRI: {
                'available_environments': [Environment.DEV, Environment.PROD],
                'default_environment': Environment.DEV
            },
            ServiceType.CALENDAR: {
                'available_environments': [Environment.DEV, Environment.PROD],
                'default_environment': Environment.DEV
            }
        }
        
        for service_type, config in service_configs.items():
            current_env = self._load_environment_from_file(service_type)
            if current_env not in config['available_environments']:
                current_env = config['default_environment']
                
            self._services[service_type] = ServiceConfig(
                service_type=service_type,
                current_environment=current_env,
                available_environments=config['available_environments']
            )
    
    def _load_environment_from_file(self, service: ServiceType) -> Environment:
        """Carica ambiente da file con fallback chain"""
        # 1. File specifico servizio
        mode_file = self.instance_dir / self._mode_files[service]
        if mode_file.exists():
            try:
                env_str = mode_file.read_text().strip().lower()
                if env_str in [e.value for e in Environment]:
                    return Environment(env_str)
            except Exception as e:
                logger.warning(f"Errore lettura file modalità {service}: {e}")
        
        # 2. Variabile ambiente specifica
        env_var = f"{service.value.upper()}_ENV"
        env_str = os.getenv(env_var, '').lower()
        if env_str in [e.value for e in Environment]:
            return Environment(env_str)
            
        # 3. Variabile ambiente generale
        env_str = os.getenv('ENVIRONMENT', '').lower()
        if env_str == 'production':
            env_str = 'prod'
        if env_str in [e.value for e in Environment]:
            return Environment(env_str)
            
        # 4. Default per servizio
        defaults = {
            ServiceType.DATABASE: Environment.DEV,
            ServiceType.RICETTA: Environment.TEST,
            ServiceType.SMS: Environment.TEST, 
            ServiceType.RENTRI: Environment.DEV,
            ServiceType.CALENDAR: Environment.DEV
        }
        return defaults.get(service, Environment.DEV)
    
    def old_save_environment_to_file(self, service: ServiceType, environment: Environment) -> bool:
        """Salva ambiente su file per persistenza"""
        try:
            mode_file = self.instance_dir / self._mode_files[service]
            mode_file.write_text(environment.value)
            return True
        except Exception as e:
            logger.error(f"Errore salvataggio modalità {service}: {e}")
            return False
    

    #deepseek 
    def _save_environment_to_file(self, service: ServiceType, environment: Environment) -> bool:
        """Salva ambiente su file per persistenza con verifica"""
        try:
            mode_file = self.instance_dir / self._mode_files[service]
            
            # Scrittura del file
            mode_file.write_text(environment.value)
            
            # Verifica immediata: il file esiste?
            if not mode_file.exists():
                logger.error(f"File {mode_file} non creato dopo scrittura")
                return False
            
            # Verifica contenuto: leggiamo ciò che abbiamo scritto
            written_content = mode_file.read_text().strip()
            if written_content != environment.value:
                logger.error(f"Contenuto file non corrisponde: atteso '{environment.value}', ottenuto '{written_content}'")
                return False
            
            # Verifica permessi (opzionale)
            if not mode_file.is_file():
                logger.error(f"{mode_file} non è un file regolare")
                return False
                
            logger.info(f"Ambiente {environment.value} salvato correttamente per {service}")
            return True
            
        except PermissionError as e:
            logger.error(f"Permesso negato per salvare {mode_file}: {e}")
            return False
        except IOError as e:
            logger.error(f"Errore I/O durante salvataggio {mode_file}: {e}")
            return False
        except Exception as e:
            logger.error(f"Errore imprevisto salvataggio modalità {service}: {e}")
            return False


    def _is_cache_valid(self, cache_key: str) -> bool:
        """Verifica validità cache"""
        if cache_key not in self._cache_timestamps:
            return False
        return datetime.now() - self._cache_timestamps[cache_key] < self._cache_ttl
    
    def _set_cache(self, cache_key: str, value: Any):
        """Imposta cache con timestamp"""
        self._cache[cache_key] = value
        self._cache_timestamps[cache_key] = datetime.now()
    
    def _get_cache(self, cache_key: str) -> Optional[Any]:
        """Recupera da cache se valido"""
        if self._is_cache_valid(cache_key):
            return self._cache.get(cache_key)
        return None
    
    def get_environment(self, service: ServiceType) -> Environment:
        """Ottiene ambiente corrente per servizio"""
        if service not in self._services:
            return Environment.DEV
        return self._services[service].current_environment
    



    #deepseek support
    def set_environment(self, service: ServiceType, environment: Environment) -> bool:
        """Imposta l'ambiente per un servizio con verifica"""
        try:
            # ... codice esistente ...
            
            # Salva su file
            file_saved = self._save_environment_to_file(service, environment)
            if not file_saved:
                logger.error(f"Salvataggio file fallito per {service}")
                return False
            
            # Verifica aggiuntiva: controlla che il valore sia effettivamente cambiato
            current_env = self._load_environment_from_file(service)
            if current_env != environment:
                logger.error(f"Disallineamento: ambiente impostato a {environment} ma file contiene {current_env}")
                return False
            
            # Aggiorna cache
            self.get_environment[service] = environment
            return True
            
        except Exception as e:
            logger.error(f"Errore in set_environment per {service}: {e}")
            return False



    def old_set_environment(self, service: ServiceType, environment: Environment) -> bool:
        """Imposta ambiente per servizio"""
        if service not in self._services:
            logger.error(f"Servizio {service} non supportato")
            return False
            
        service_config = self._services[service]
        if environment not in service_config.available_environments:
            logger.error(f"Ambiente {environment} non supportato per {service}")
            return False
        
        # Aggiorna configurazione
        service_config.current_environment = environment
        
        # Persisti su file
        success = self._save_environment_to_file(service, environment)
        
        if success:
            # Invalida cache correlate
            self._invalidate_service_cache(service)
            logger.info(f"Ambiente {service} cambiato a {environment}")
        
        return success
    
    def _invalidate_service_cache(self, service: ServiceType):
        """Invalida cache per un servizio"""
        cache_keys_to_remove = [
            key for key in self._cache.keys() 
            if key.startswith(f"{service.value}_")
        ]
        for key in cache_keys_to_remove:
            self._cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
    
    def get_service_config(self, service: ServiceType, environment: Optional[Environment] = None) -> Dict[str, Any]:
        """Ottiene configurazione completa per servizio"""
        if environment is None:
            environment = self.get_environment(service)
            
        cache_key = f"{service.value}_{environment.value}_config"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
            
        config = self._build_service_config(service, environment)
        self._set_cache(cache_key, config)
        return config
    
    def _build_service_config(self, service: ServiceType, environment: Environment) -> Dict[str, Any]:
        """Costruisce configurazione per servizio specifico"""
        if service == ServiceType.DATABASE:
            return self._get_database_config(environment)
        elif service == ServiceType.RICETTA:
            return self._get_ricetta_config(environment)
        elif service == ServiceType.SMS:
            return self._get_sms_config(environment)
        elif service == ServiceType.RENTRI:
            return self._get_rentri_config(environment)
        elif service == ServiceType.CALENDAR:
            return self._get_calendar_config(environment)
        else:
            return {}
    
    def _get_database_config(self, environment: Environment) -> Dict[str, Any]:
        """Configurazione database"""
        if environment == Environment.PROD:
            return {
                'type': 'network',
                'path': r'\\SERVERDIMA\Pixel\WINDENT',
                'host': 'SERVERDIMA',
                'validation_required': True,
                'network_check': True
            }
        else:  # DEV
            return {
                'type': 'local',
                'path': str(self.project_root / 'studio_dima.db'),
                'validation_required': False,
                'network_check': False
            }
    
    def _get_ricetta_config(self, environment: Environment) -> Dict[str, Any]:
        """Configurazione ricetta elettronica - integrazione con sistema esistente"""
        # Importa la configurazione dal sistema ricetta già migrato
        try:
            from ..config.ricetta_config import ricetta_config
            return ricetta_config.get_full_config(environment.value)
        except ImportError:
            logger.warning("Sistema ricetta non disponibile, uso configurazione base")
            return self._get_ricetta_config_fallback(environment)
    
    def _get_ricetta_config_fallback(self, environment: Environment) -> Dict[str, Any]:
        """Configurazione ricetta fallback"""
        certs_dir = self.project_root / "server_v2" / "certs"
        
        if environment == Environment.TEST:
            return {
                'endpoints': {
                    'invio': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
                },
                'ssl': {
                    'client_cert': certs_dir / "test" / "client_cert.pem",
                    'verify_ssl': False
                }
            }
        else:  # PROD
            return {
                'endpoints': {
                    'invio': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
                },
                'ssl': {
                    'client_cert': certs_dir / "prod" / "demservice.sanita.finanze.it_cert_2020.crt",
                    'verify_ssl': True
                }
            }
    
    def _get_sms_config(self, environment: Environment) -> Dict[str, Any]:
        """Configurazione SMS"""
        from .config import get_config_value
        
        if environment == Environment.PROD:
            return {
                'api_key': get_config_value('BREVO_API_KEY', ''),
                'sender': get_config_value('SMS_SENDER_PROD', 'StudioDima'),
                'enabled': True,
                'url': 'https://api.brevo.com/v3/transactionalSMS/sms'
            }
        else:  # TEST
            return {
                'api_key': get_config_value('BREVO_API_KEY', ''),
                'sender': get_config_value('SMS_SENDER_TEST', 'TestSMS'),
                'enabled': True,
                'url': 'https://api.brevo.com/v3/transactionalSMS/sms'
            }
    
    def _get_rentri_config(self, environment: Environment) -> Dict[str, Any]:
        """Configurazione Rentri"""
        from .config import get_config_value
        
        if environment == Environment.PROD:
            return {
                'private_key_path': get_config_value('RENTRI_PRIVATE_KEY_PATH_PROD', ''),
                'client_id': get_config_value('RENTRI_CLIENT_ID_PROD', ''),
                'client_audience': get_config_value('RENTRI_CLIENT_AUDIENCE_PROD', ''),
                'token_url': get_config_value('RENTRI_TOKEN_URL_PROD', 'https://api.rentri.gov.it/auth/token'),
                'api_base': 'https://api.rentri.gov.it'
            }
        else:  # DEV
            return {
                'private_key_path': get_config_value('RENTRI_PRIVATE_KEY_PATH_TEST', ''),
                'client_id': get_config_value('RENTRI_CLIENT_ID_TEST', ''),
                'client_audience': get_config_value('RENTRI_CLIENT_AUDIENCE_TEST', ''),
                'token_url': get_config_value('RENTRI_TOKEN_URL_TEST', 'https://demoapi.rentri.gov.it/token'),
                'api_base': 'https://demoapi.rentri.gov.it'
            }
    
    def _get_calendar_config(self, environment: Environment) -> Dict[str, Any]:
        """Configurazione Calendar"""
        if environment == Environment.PROD:
            return {
                'credentials_path': self.instance_dir / 'credentials.json',
                'token_path': self.instance_dir / 'token.json',
                'scopes': ['https://www.googleapis.com/auth/calendar'],
                'enabled': True
            }
        else:  # DEV
            return {
                'credentials_path': self.instance_dir / 'credentials.json',
                'token_path': self.instance_dir / 'token.json',
                'scopes': ['https://www.googleapis.com/auth/calendar'],
                'enabled': True
            }
    
    def validate_service_config(self, service: ServiceType, environment: Optional[Environment] = None) -> EnvironmentValidation:
        """Valida configurazione servizio"""
        if environment is None:
            environment = self.get_environment(service)
            
        config = self.get_service_config(service, environment)
        validation = EnvironmentValidation(valid=True)
        
        # Validazioni specifiche per servizio
        if service == ServiceType.DATABASE:
            validation = self._validate_database_config(config, environment)
        elif service == ServiceType.RICETTA:
            validation = self._validate_ricetta_config(config, environment)
        elif service == ServiceType.SMS:
            validation = self._validate_sms_config(config, environment)
        elif service == ServiceType.RENTRI:
            validation = self._validate_rentri_config(config, environment)
        elif service == ServiceType.CALENDAR:
            validation = self._validate_calendar_config(config, environment)
        
        # Aggiorna stato validazione
        if service in self._services:
            service_config = self._services[service]
            service_config.last_validation = datetime.now()
            service_config.validation_status = validation.valid
            service_config.validation_errors = validation.errors
        
        return validation
    
    def _validate_database_config(self, config: Dict[str, Any], environment: Environment) -> EnvironmentValidation:
        """Valida configurazione database"""
        validation = EnvironmentValidation(valid=True)
        
        if environment == Environment.PROD:
            # Controlla connettività rete
            if config.get('network_check', False):
                import subprocess
                try:
                    result = subprocess.run(['ping', '-n', '1', 'SERVERDIMA'], 
                                         capture_output=True, timeout=5)
                    network_ok = (result.returncode == 0)
                    validation.checks['network_connectivity'] = network_ok
                    
                    if not network_ok:
                        validation.valid = False
                        validation.errors.append('Server SERVERDIMA non raggiungibile')
                except Exception as e:
                    validation.valid = False
                    validation.errors.append(f'Errore test rete: {e}')
            
            # Controlla esistenza cartella condivisa
            path = Path(config.get('path', ''))
            if path.exists():
                validation.checks['shared_folder'] = True
            else:
                validation.valid = False
                validation.errors.append(f'Cartella condivisa non accessibile: {path}')
        
        return validation
    
    def _validate_ricetta_config(self, config: Dict[str, Any], environment: Environment) -> EnvironmentValidation:
        """Valida configurazione ricetta"""
        validation = EnvironmentValidation(valid=True)
        
        # Controlla certificati SSL
        ssl_config = config.get('ssl', {})
        for cert_name, cert_path in ssl_config.items():
            if cert_name.endswith('_cert') and cert_path:
                cert_file = Path(cert_path)
                exists = cert_file.exists()
                validation.checks[f'certificate_{cert_name}'] = exists
                
                if not exists:
                    validation.valid = False
                    validation.errors.append(f'Certificato mancante: {cert_path}')
        
        # Controlla endpoints
        endpoints = config.get('endpoints', {})
        for endpoint_name, endpoint_url in endpoints.items():
            if not endpoint_url or not endpoint_url.startswith('https://'):
                validation.valid = False
                validation.errors.append(f'Endpoint non valido: {endpoint_name}')
        
        return validation
    
    def _validate_sms_config(self, config: Dict[str, Any], environment: Environment) -> EnvironmentValidation:
        """Valida configurazione SMS"""
        validation = EnvironmentValidation(valid=True)
        
        # Controlla API key
        api_key = config.get('api_key', '')
        validation.checks['api_key_configured'] = bool(api_key and api_key.strip())
        
        if not api_key:
            validation.valid = False
            validation.errors.append('API key Brevo mancante')
        
        # Controlla sender
        sender = config.get('sender', '')
        validation.checks['sender_configured'] = bool(sender and sender.strip())
        
        if not sender:
            validation.warnings.append('Sender SMS non configurato')
        
        return validation
    
    def _validate_rentri_config(self, config: Dict[str, Any], environment: Environment) -> EnvironmentValidation:
        """Valida configurazione Rentri"""
        validation = EnvironmentValidation(valid=True)
        
        required_fields = ['private_key_path', 'client_id', 'client_audience']
        
        for field in required_fields:
            value = config.get(field, '')
            configured = bool(value and value.strip())
            validation.checks[f'{field}_configured'] = configured
            
            if not configured:
                validation.valid = False
                validation.errors.append(f'Campo obbligatorio mancante: {field}')
        
        # Controlla esistenza chiave privata
        private_key_path = config.get('private_key_path', '')
        if private_key_path:
            key_file = Path(private_key_path)
            exists = key_file.exists()
            validation.checks['private_key_exists'] = exists
            
            if not exists:
                validation.valid = False
                validation.errors.append(f'Chiave privata non trovata: {private_key_path}')
        
        return validation
    
    def _validate_calendar_config(self, config: Dict[str, Any], environment: Environment) -> EnvironmentValidation:
        """Valida configurazione Calendar"""
        validation = EnvironmentValidation(valid=True)
        
        # Controlla credenziali Google
        credentials_path = config.get('credentials_path', '')
        token_path = config.get('token_path', '')
        
        if credentials_path:
            cred_file = Path(credentials_path)
            exists = cred_file.exists()
            validation.checks['credentials_exists'] = exists
            
            if not exists:
                validation.valid = False
                validation.errors.append(f'File credenziali non trovato: {credentials_path}')
        
        if token_path:
            token_file = Path(token_path)
            exists = token_file.exists()
            validation.checks['token_exists'] = exists
            
            if not exists:
                validation.warnings.append(f'Token di accesso non trovato: {token_path}')
        
        # Controlla configurazione automazione
        automation_settings = self.get_automation_settings()
        calendar_sync_enabled = automation_settings.get('calendar_sync_enabled', False)
        validation.checks['sync_enabled'] = calendar_sync_enabled
        
        if calendar_sync_enabled:
            studio_blu_id = automation_settings.get('calendar_studio_blu_id', '')
            studio_giallo_id = automation_settings.get('calendar_studio_giallo_id', '')
            
            validation.checks['studio_blu_configured'] = bool(studio_blu_id)
            validation.checks['studio_giallo_configured'] = bool(studio_giallo_id)
            
            if not studio_blu_id or not studio_giallo_id:
                validation.warnings.append('ID calendari studio non configurati')
        
        return validation
    
    def get_all_services_status(self) -> Dict[ServiceType, Dict[str, Any]]:
        """Ottiene stato di tutti i servizi"""
        status = {}
        
        for service_type in ServiceType:
            if service_type in self._services:
                service_config = self._services[service_type]
                validation = self.validate_service_config(service_type)
                
                status[service_type] = {
                    'current_environment': service_config.current_environment.value,
                    'available_environments': [env.value for env in service_config.available_environments],
                    'validation': {
                        'valid': validation.valid,
                        'errors': validation.errors,
                        'warnings': validation.warnings,
                        'checks': validation.checks,
                        'last_check': service_config.last_validation.isoformat() if service_config.last_validation else None
                    }
                }
        
        return status
    
    def switch_environment_bulk(self, changes: Dict[ServiceType, Environment]) -> Dict[ServiceType, bool]:
        """Cambia ambiente per più servizi contemporaneamente"""
        results = {}
        
        for service, environment in changes.items():
            try:
                success = self.set_environment(service, environment)
                results[service] = success
                
                if success:
                    logger.info(f"Ambiente {service} cambiato a {environment}")
                else:
                    logger.error(f"Errore cambio ambiente {service} a {environment}")
                    
            except Exception as e:
                logger.error(f"Errore cambio ambiente {service}: {e}")
                results[service] = False
        
        return results
    
    def get_automation_settings(self) -> Dict[str, Any]:
        """Ottiene impostazioni automazione - compatibilità con v1"""
        defaults = {
            'reminder_enabled': True,
            'reminder_hour': 15,
            'reminder_minute': 0,
            'sms_promemoria_mode': 'prod',
            'sms_richiami_mode': 'prod',
            'recall_enabled': True,
            'recall_hour': 16,
            'recall_minute': 0,
            'calendar_sync_enabled': True,
            'calendar_sync_hour': 21,
            'calendar_sync_minute': 0
        }
        
        if not self._automation_config_file.exists():
            self.set_automation_settings(defaults)
            return defaults.copy()
            
        try:
            with open(self._automation_config_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                
            # Merge con defaults per nuove chiavi
            updated = False
            for key, value in defaults.items():
                if key not in settings:
                    settings[key] = value
                    updated = True
                    
            if updated:
                self.set_automation_settings(settings)
                
            return settings
            
        except Exception as e:
            logger.error(f"Errore lettura automation settings: {e}")
            return defaults.copy()
    
    def set_automation_settings(self, settings: Dict[str, Any]):
        """Imposta impostazioni automazione"""
        try:
            current_settings = self.get_automation_settings()
            current_settings.update(settings)
            
            with open(self._automation_config_file, 'w', encoding='utf-8') as f:
                json.dump(current_settings, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"Errore salvataggio automation settings: {e}")
    
    def clear_cache(self):
        """Pulisce cache configurazioni"""
        self._cache.clear()
        self._cache_timestamps.clear()
        logger.info("Cache configurazioni pulita")
    
    def reload_all_configurations(self):
        """Ricarica tutte le configurazioni"""
        self.clear_cache()
        self._initialize_services()
        logger.info("Tutte le configurazioni ricaricate")

# Instance globale singleton
environment_manager = EnvironmentManager()