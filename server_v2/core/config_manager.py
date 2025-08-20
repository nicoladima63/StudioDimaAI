"""
⚙️ Configuration Manager per StudioDimaAI Calendar v2
====================================================

Gestisce la configurazione centralizzata con supporto per:
- File .env per development/production
- Override via environment variables  
- Validazione e fallback values
- Mode-aware path resolution (dev/prod)

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class ConfigManager:
    """
    Configuration manager centralizzato per Calendar System v2.
    
    Gestisce:
    - Caricamento da .env file
    - Override da environment variables
    - Mode detection (dev/prod)
    - Path resolution intelligente
    """
    
    def __init__(self):
        self.config = {}
        self._load_config()
    
    def _load_config(self):
        """Carica configurazione da tutte le fonti."""
        # 1. Load from .env file
        self._load_env_file()
        
        # 2. Override with environment variables
        self._load_environment_overrides()
        
        # 3. Set defaults for missing values
        self._set_defaults()
        
        # 4. Validate configuration
        self._validate_config()
        
        logger.info(f"Configuration loaded: mode={self.get_mode()}")
    
    def _load_env_file(self):
        """Carica variabili da file .env."""
        env_file = Path(__file__).parent.parent / '.env'
        
        if not env_file.exists():
            logger.warning(f".env file not found: {env_file}")
            return
        
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Remove quotes if present
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]
                        
                        self.config[key] = value
            
            logger.debug(f"Loaded {len(self.config)} variables from .env")
            
        except Exception as e:
            logger.error(f"Error loading .env file: {e}")
    
    def _load_environment_overrides(self):
        """Carica override da environment variables."""
        env_vars = [
            'APP_MODE',
            'DEV_DB_BASE_PATH', 'DEV_DBF_APPOINTMENTS_PATH', 'DEV_DBF_PATIENTS_PATH',
            'PROD_DB_BASE_PATH', 'PROD_DBF_APPOINTMENTS_PATH', 'PROD_DBF_PATIENTS_PATH',
            'GOOGLE_CREDENTIALS_PATH', 'GOOGLE_TOKEN_PATH', 'GOOGLE_TIMEZONE',
            'DBF_CACHE_TTL_SECONDS', 'DBF_MAX_CACHE_ITEMS', 'DBF_CHUNK_SIZE', 'DBF_MAX_WORKERS',
            'LOG_LEVEL', 'LOG_FILE_PATH',
            'DEBUG_MODE', 'VERBOSE_LOGGING', 'MOCK_GOOGLE_API'
        ]
        
        override_count = 0
        for var in env_vars:
            env_value = os.getenv(var)
            if env_value is not None:
                self.config[var] = env_value
                override_count += 1
        
        if override_count > 0:
            logger.debug(f"Applied {override_count} environment overrides")
    
    def _set_defaults(self):
        """Imposta valori di default per configurazioni mancanti."""
        defaults = {
            'APP_MODE': 'dev',
            'DEV_DB_BASE_PATH': 'C:\\Users\\gengi\\Desktop\\StudioDimaAI\\server\\windent',
            'PROD_DB_BASE_PATH': '\\\\serverdima\\windent',
            'GOOGLE_TIMEZONE': 'Europe/Rome',
            'DBF_CACHE_TTL_SECONDS': '300',
            'DBF_MAX_CACHE_ITEMS': '1000', 
            'DBF_CHUNK_SIZE': '1000',
            'DBF_MAX_WORKERS': '4',
            'LOG_LEVEL': 'INFO',
            'DEBUG_MODE': 'false',
            'VERBOSE_LOGGING': 'false',
            'MOCK_GOOGLE_API': 'false'
        }
        
        for key, default_value in defaults.items():
            if key not in self.config:
                self.config[key] = default_value
    
    def _validate_config(self):
        """Valida la configurazione."""
        mode = self.get_mode()
        
        if mode not in ['dev', 'prod']:
            logger.warning(f"Invalid APP_MODE: {mode}, defaulting to 'dev'")
            self.config['APP_MODE'] = 'dev'
        
        # Validate paths exist in dev mode
        if mode == 'dev':
            base_path = self.get('DEV_DB_BASE_PATH')
            if base_path and not os.path.exists(base_path):
                logger.warning(f"DEV_DB_BASE_PATH does not exist: {base_path}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Recupera valore di configurazione."""
        return self.config.get(key, default)
    
    def get_mode(self) -> str:
        """Recupera modalità operativa (dev/prod)."""
        return self.config.get('APP_MODE', 'dev').lower()
    
    def get_dbf_path(self, file_type: str) -> str:
        """
        Recupera path DBF basato su modalità operativa.
        
        Args:
            file_type: 'appointments' o 'patients'
            
        Returns:
            Path completo al file DBF
        """
        mode = self.get_mode()
        
        if file_type == 'appointments':
            if mode == 'prod':
                return self.get('PROD_DBF_APPOINTMENTS_PATH', '')
            else:
                return self.get('DEV_DBF_APPOINTMENTS_PATH', 
                              os.path.join(self.get('DEV_DB_BASE_PATH', ''), 'DATI', 'APPUNTA.DBF'))
        
        elif file_type == 'patients':
            if mode == 'prod':
                return self.get('PROD_DBF_PATIENTS_PATH', '')
            else:
                return self.get('DEV_DBF_PATIENTS_PATH',
                              os.path.join(self.get('DEV_DB_BASE_PATH', ''), 'DATI', 'PAZIENTI.DBF'))
        
        else:
            raise ValueError(f"Unknown DBF file type: {file_type}")
    
    def get_google_config(self) -> Dict[str, Any]:
        """Recupera configurazione Google Calendar."""
        return {
            'credentials_path': self.get('GOOGLE_CREDENTIALS_PATH', 'server_v2/instance/credentials.json'),
            'token_path': self.get('GOOGLE_TOKEN_PATH', 'server_v2/instance/token.json'),
            'timezone': self.get('GOOGLE_TIMEZONE', 'Europe/Rome')
        }
    
    def get_performance_config(self) -> Dict[str, Any]:
        """Recupera configurazione performance."""
        return {
            'cache_ttl_seconds': int(self.get('DBF_CACHE_TTL_SECONDS', 300)),
            'max_cache_items': int(self.get('DBF_MAX_CACHE_ITEMS', 1000)),
            'chunk_size': int(self.get('DBF_CHUNK_SIZE', 1000)),
            'max_workers': int(self.get('DBF_MAX_WORKERS', 4))
        }
    
    def is_development(self) -> bool:
        """Verifica se siamo in modalità development."""
        return self.get_mode() == 'dev'
    
    def is_production(self) -> bool:
        """Verifica se siamo in modalità production."""
        return self.get_mode() == 'prod'
    
    def is_debug_enabled(self) -> bool:
        """Verifica se debug mode è attivo."""
        return self.get('DEBUG_MODE', 'false').lower() == 'true'
    
    def get_status(self) -> Dict[str, Any]:
        """Recupera status configurazione per diagnostics."""
        return {
            'mode': self.get_mode(),
            'debug_enabled': self.is_debug_enabled(),
            'dbf_base_path': self.get('DEV_DB_BASE_PATH' if self.is_development() else 'PROD_DB_BASE_PATH'),
            'appointments_path': self.get_dbf_path('appointments'),
            'patients_path': self.get_dbf_path('patients'),
            'google_credentials': self.get('GOOGLE_CREDENTIALS_PATH'),
            'performance': self.get_performance_config(),
            'paths_exist': {
                'appointments': os.path.exists(self.get_dbf_path('appointments')),
                'patients': os.path.exists(self.get_dbf_path('patients')),
                'credentials': os.path.exists(self.get('GOOGLE_CREDENTIALS_PATH', ''))
            }
        }


# Singleton instance
_config_manager = None

def get_config() -> ConfigManager:
    """Get singleton configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager

def get_dbf_path(file_type: str) -> str:
    """Convenience function per path DBF."""
    return get_config().get_dbf_path(file_type)

def get_mode() -> str:
    """Convenience function per modalità operativa."""
    return get_config().get_mode()

def is_development() -> bool:
    """Convenience function per check development mode."""
    return get_config().is_development()

def is_production() -> bool:
    """Convenience function per check production mode."""
    return get_config().is_production()