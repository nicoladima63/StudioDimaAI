"""
Configurazione per il modulo ricetta elettronica
Gestisce environment switching e configurazioni SSL
"""
import os
from pathlib import Path
from typing import Dict, Any, Optional
from .config import get_config_value

class RicettaConfig:
    """Configurazione per ricetta elettronica"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self._current_env = None
        self._config_cache = {}
    
    def get_environment(self) -> str:
        """Ottiene l'ambiente corrente con fallback chain"""
        if self._current_env:
            return self._current_env
            
        # 1. File mode specifico per ricetta
        mode_file = self.project_root / "server" / "instance" / "ricetta_mode.txt"
        if mode_file.exists():
            try:
                env = mode_file.read_text().strip().lower()
                if env in ['test', 'prod']:
                    self._current_env = env
                    return env
            except Exception:
                pass
        
        # 2. Variabile ambiente specifica
        env = os.getenv('RICETTA_ENV', '').lower()
        if env in ['test', 'prod']:
            self._current_env = env
            return env
        
        # 3. Variabile ambiente generale
        env = os.getenv('ENVIRONMENT', '').lower()
        if env in ['test', 'prod', 'production']:
            self._current_env = 'prod' if env == 'production' else env
            return self._current_env
        
        # 4. Default test
        self._current_env = 'test'
        return 'test'
    
    def set_environment(self, env: str) -> bool:
        """Imposta l'ambiente corrente"""
        if env not in ['test', 'prod']:
            return False
        
        self._current_env = env
        self._config_cache.clear()
        
        # Salva su file per persistenza
        mode_file = self.project_root / "server" / "instance" / "ricetta_mode.txt"
        try:
            mode_file.parent.mkdir(parents=True, exist_ok=True)
            mode_file.write_text(env)
            return True
        except Exception:
            return False
    
    def get_ssl_config(self, env: Optional[str] = None) -> Dict[str, Any]:
        """Configurazione SSL per ambiente"""
        if env is None:
            env = self.get_environment()
        
        cache_key = f"ssl_config_{env}"
        if cache_key in self._config_cache:
            return self._config_cache[cache_key]
        
        certs_dir = self.project_root / "server_v2" / "certs"
        
        if env == 'test':
            config = {
                'client_cert': certs_dir / "test" / "client_cert.pem",
                'client_key': certs_dir / "test" / "client_key.pem",
                'ca_cert': certs_dir / "test" / "ActalisCA.crt",
                'sanitel_cert': certs_dir / "test" / "SanitelCF-2024-2027.cer",
                'p12_cert': certs_dir / "test" / "TestSanitaMir.p12",
                'verify_ssl': False,
                'ssl_version': 'TLSv1_2',
                'cipher_suites': 'DEFAULT:@SECLEVEL=1'
            }
        else:  # prod
            config = {
                'client_cert': certs_dir / "prod" / "demservice.sanita.finanze.it_cert_2020.crt",
                'ca_cert': certs_dir / "prod" / "ActalisCA.crt",
                'p12_cert': certs_dir / "DMRNCL63S21D612I.p12",
                'verify_ssl': True,
                'ssl_version': 'TLSv1_2',
                'cipher_suites': 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
            }
        
        self._config_cache[cache_key] = config
        return config
    
    def get_endpoints_config(self, env: Optional[str] = None) -> Dict[str, str]:
        """Configurazione endpoints per ambiente"""
        if env is None:
            env = self.get_environment()
        
        if env == 'test':
            return {
                'invio': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca',
                'visualizza': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca',
                'annulla': 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
            }
        else:  # prod
            return {
                'invio': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca',
                'visualizza': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca',
                'annulla': 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
            }
    
    def get_credentials_config(self, env: Optional[str] = None) -> Dict[str, str]:
        """Configurazione credenziali per ambiente"""
        if env is None:
            env = self.get_environment()
        
        if env == 'test':
            return {
                'cf_medico': get_config_value('CF_MEDICO_TEST', 'PROVAX00X00X000Y'),
                'password': get_config_value('PASSWORD_TEST', 'Salve123'),
                'pincode': get_config_value('PINCODE_TEST', '1234567890'),
                'regione': get_config_value('REGIONE_TEST', '020'),
                'asl': get_config_value('ASL_TEST', '020001')
            }
        else:  # prod
            return {
                'cf_medico': get_config_value('CF_MEDICO_PROD', ''),
                'password': get_config_value('PASSWORD_PROD', ''),
                'pincode': get_config_value('PINCODE_PROD', ''),
                'regione': get_config_value('REGIONE_PROD', '020'),
                'asl': get_config_value('ASL_PROD', '')
            }
    
    def get_full_config(self, env: Optional[str] = None) -> Dict[str, Any]:
        """Configurazione completa per ambiente"""
        if env is None:
            env = self.get_environment()
        
        return {
            'environment': env,
            'ssl': self.get_ssl_config(env),
            'endpoints': self.get_endpoints_config(env),
            'credentials': self.get_credentials_config(env),
            'timeouts': {
                'connection': 30,
                'read': 60,
                'total': 90
            },
            'retry': {
                'max_attempts': 3,
                'backoff_factor': 1.0,
                'status_forcelist': [502, 503, 504]
            }
        }
    
    def validate_config(self, env: Optional[str] = None) -> Dict[str, Any]:
        """Valida la configurazione per ambiente"""
        if env is None:
            env = self.get_environment()
        
        config = self.get_full_config(env)
        validation = {
            'environment': env,
            'valid': True,
            'errors': [],
            'warnings': [],
            'checks': {}
        }
        
        # Controlla certificati
        ssl_config = config['ssl']
        for cert_name, cert_path in ssl_config.items():
            if cert_name.endswith('_cert') or cert_name.endswith('_key'):
                if isinstance(cert_path, Path):
                    exists = cert_path.exists()
                    validation['checks'][cert_name] = exists
                    if not exists:
                        validation['errors'].append(f"Certificato mancante: {cert_path}")
                        validation['valid'] = False
        
        # Controlla credenziali
        credentials = config['credentials']
        required_creds = ['cf_medico', 'password'] if env == 'prod' else []
        
        for cred in required_creds:
            if not credentials.get(cred):
                validation['errors'].append(f"Credenziale mancante per {env}: {cred}")
                validation['valid'] = False
        
        # Controlla endpoints
        endpoints = config['endpoints']
        for endpoint_name, endpoint_url in endpoints.items():
            if not endpoint_url or not endpoint_url.startswith('https://'):
                validation['errors'].append(f"Endpoint non valido: {endpoint_name}")
                validation['valid'] = False
        
        return validation
    
    def get_environment_info(self) -> Dict[str, Any]:
        """Informazioni complete sull'ambiente"""
        env = self.get_environment()
        config = self.get_full_config(env)
        validation = self.validate_config(env)
        
        return {
            'current_environment': env,
            'configuration': config,
            'validation': validation,
            'switch_available': True,
            'available_environments': ['test', 'prod']
        }

# Instance globale
ricetta_config = RicettaConfig()