"""
Configuration management for StudioDimaAI Server V2.

Centralizes all configuration settings for database connections,
logging, connection pooling, environment management and other system parameters.
"""

import os
import logging
from typing import Optional, Dict, Any, List, Union
from pathlib import Path


class Config:
    """
    Configuration class for StudioDimaAI Server V2.
    
    Handles database paths, connection pool settings, logging configuration,
    and other system parameters with environment-specific overrides.
    """
    
    # Database Configuration
    DEFAULT_DB_PATH = "studio_dima.db"
    DEFAULT_INSTANCE_DB_PATH = "instance/studio_dima.db"
    
    # Connection Pool Settings
    DEFAULT_POOL_SIZE = 10
    DEFAULT_MAX_OVERFLOW = 20
    DEFAULT_POOL_TIMEOUT = 30
    DEFAULT_POOL_RECYCLE = 3600  # 1 hour
    
    # Query timeouts (seconds)
    DEFAULT_QUERY_TIMEOUT = 30
    DEFAULT_TRANSACTION_TIMEOUT = 60
    
    # Logging Configuration
    DEFAULT_LOG_LEVEL = logging.INFO
    DEFAULT_LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Performance Settings
    DEFAULT_CACHE_SIZE = 2000
    DEFAULT_PAGE_SIZE = 4096
    DEFAULT_JOURNAL_MODE = "WAL"
    DEFAULT_SYNCHRONOUS = "NORMAL"
    
    def __init__(self, db_path: Optional[str] = None, environment: str = "production"):
        """
        Initialize configuration with optional database path override.
        
        Args:
            db_path: Custom database path, if None will use default paths
            environment: Environment name (production, development, test)
        """
        self.environment = environment
        self._setup_database_path(db_path)
        self._setup_connection_pool()
        self._setup_logging()
        self._setup_performance()
    
    def _setup_database_path(self, db_path: Optional[str]) -> None:
        """Setup database path with fallback logic."""
        if db_path:
            self.db_path = db_path
        else:
            # Try instance path first, then root path
            instance_path = Path(self.DEFAULT_INSTANCE_DB_PATH)
            root_path = Path(self.DEFAULT_DB_PATH)
            
            if instance_path.exists():
                self.db_path = str(instance_path)
            elif root_path.exists():
                self.db_path = str(root_path)
            else:
                # Default to instance path for new installations
                self.db_path = self.DEFAULT_INSTANCE_DB_PATH
        
        # Ensure parent directory exists
        db_dir = Path(self.db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
    
    def _setup_connection_pool(self) -> None:
        """Setup connection pool configuration."""
        self.pool_size = int(os.getenv("STUDIO_POOL_SIZE", self.DEFAULT_POOL_SIZE))
        self.max_overflow = int(os.getenv("STUDIO_MAX_OVERFLOW", self.DEFAULT_MAX_OVERFLOW))
        self.pool_timeout = int(os.getenv("STUDIO_POOL_TIMEOUT", self.DEFAULT_POOL_TIMEOUT))
        self.pool_recycle = int(os.getenv("STUDIO_POOL_RECYCLE", self.DEFAULT_POOL_RECYCLE))
        
        # Adjust pool size based on environment
        if self.environment == "test":
            self.pool_size = 2
            self.max_overflow = 5
        elif self.environment == "development":
            self.pool_size = 5
            self.max_overflow = 10
    
    def _setup_logging(self) -> None:
        """Setup logging configuration."""
        log_level_str = os.getenv("STUDIO_LOG_LEVEL", "INFO")
        self.log_level = getattr(logging, log_level_str.upper(), self.DEFAULT_LOG_LEVEL)
        self.log_format = os.getenv("STUDIO_LOG_FORMAT", self.DEFAULT_LOG_FORMAT)
        
        # Determine log file path
        if self.environment == "test":
            self.log_file = None  # No file logging in tests
        else:
            log_dir = Path("logs")
            log_dir.mkdir(exist_ok=True)
            self.log_file = str(log_dir / f"studio_dima_v2_{self.environment}.log")
    
    def _setup_performance(self) -> None:
        """Setup performance-related configuration."""
        self.query_timeout = int(os.getenv("STUDIO_QUERY_TIMEOUT", self.DEFAULT_QUERY_TIMEOUT))
        self.transaction_timeout = int(os.getenv("STUDIO_TRANSACTION_TIMEOUT", self.DEFAULT_TRANSACTION_TIMEOUT))
        
        # SQLite-specific performance settings
        self.cache_size = int(os.getenv("STUDIO_CACHE_SIZE", self.DEFAULT_CACHE_SIZE))
        self.page_size = int(os.getenv("STUDIO_PAGE_SIZE", self.DEFAULT_PAGE_SIZE))
        self.journal_mode = os.getenv("STUDIO_JOURNAL_MODE", self.DEFAULT_JOURNAL_MODE)
        self.synchronous = os.getenv("STUDIO_SYNCHRONOUS", self.DEFAULT_SYNCHRONOUS)
    
    def get_connection_string(self) -> str:
        """
        Get SQLite connection string with optimized parameters.
        
        Returns:
            Optimized SQLite connection string
        """
        return f"file:{self.db_path}?cache=shared&_journal_mode={self.journal_mode}"
    
    def get_pragma_statements(self) -> list[str]:
        """
        Get list of PRAGMA statements for SQLite optimization.
        
        Returns:
            List of PRAGMA statements to execute on new connections
        """
        return [
            f"PRAGMA cache_size = -{self.cache_size}",  # Negative = KB
            f"PRAGMA page_size = {self.page_size}",
            f"PRAGMA journal_mode = {self.journal_mode}",
            f"PRAGMA synchronous = {self.synchronous}",
            "PRAGMA foreign_keys = ON",
            "PRAGMA temp_store = MEMORY",
            "PRAGMA mmap_size = 268435456",  # 256MB
        ]
    
    def setup_logging(self) -> None:
        """
        Configure the logging system with the current settings.
        """
        # Remove existing handlers to avoid duplicates
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Create formatter
        formatter = logging.Formatter(self.log_format)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(self.log_level)
        root_logger.addHandler(console_handler)
        
        # File handler (if specified)
        if self.log_file:
            file_handler = logging.FileHandler(self.log_file)
            file_handler.setFormatter(formatter)
            file_handler.setLevel(self.log_level)
            root_logger.addHandler(file_handler)
        
        # Set root logger level
        root_logger.setLevel(self.log_level)
    
    def __repr__(self) -> str:
        """String representation of configuration."""
        return (
            f"Config(environment={self.environment}, "
            f"db_path={self.db_path}, "
            f"pool_size={self.pool_size}, "
            f"log_level={logging.getLevelName(self.log_level)})"
        )


# === Environment Management Functions ===

class ConfigManager:
    """Manager esteso per configurazioni e variabili ambiente"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self._load_env_file()
    
    def _load_env_file(self):
        """Carica file .env se presente"""
        env_files = [
            self.project_root / ".env",
            self.project_root / "server" / ".env", 
            self.project_root / "server_v2" / ".env"
        ]
        
        for env_file in env_files:
            if env_file.exists():
                try:
                    self._parse_env_file(env_file)
                    logging.info(f"Caricato file ambiente: {env_file}")
                    break
                except Exception as e:
                    logging.warning(f"Errore caricamento {env_file}: {e}")
    
    def _parse_env_file(self, env_file: Path):
        """Parser semplificato per file .env"""
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                
                # Ignora commenti e righe vuote
                if not line or line.startswith('#'):
                    continue
                
                # Cerca pattern KEY=VALUE
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    # Rimuovi virgolette se presenti
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    
                    # Imposta variabile ambiente se non già presente
                    if key not in os.environ:
                        os.environ[key] = value

def get_config_value(key: str, default: Any = None, required: bool = False) -> Any:
    """
    Ottiene valore configurazione con fallback
    
    Args:
        key: Chiave configurazione
        default: Valore default se non trovato
        required: Se True, solleva eccezione se mancante
        
    Returns:
        Valore configurazione
        
    Raises:
        EnvironmentError: Se required=True e valore mancante
    """
    value = os.getenv(key, default)
    
    if required and not value:
        raise EnvironmentError(f"Variabile '{key}' obbligatoria non trovata")
    
    return value

def get_config_bool(key: str, default: bool = False) -> bool:
    """Ottiene valore booleano da configurazione"""
    value = get_config_value(key, str(default)).lower()
    return value in ('true', '1', 'yes', 'on', 'enabled')

def get_config_int(key: str, default: int = 0) -> int:
    """Ottiene valore intero da configurazione"""
    try:
        return int(get_config_value(key, str(default)))
    except ValueError:
        logging.warning(f"Valore non valido per {key}, uso default {default}")
        return default

def get_config_float(key: str, default: float = 0.0) -> float:
    """Ottiene valore float da configurazione"""
    try:
        return float(get_config_value(key, str(default)))
    except ValueError:
        logging.warning(f"Valore non valido per {key}, uso default {default}")
        return default

def get_config_list(key: str, separator: str = ",", default: Optional[List] = None) -> List:
    """Ottiene lista da configurazione"""
    if default is None:
        default = []
    
    value = get_config_value(key, "")
    if not value:
        return default
    
    return [item.strip() for item in value.split(separator) if item.strip()]

def get_ssl_config() -> Dict[str, Any]:
    """Configurazione SSL/TLS"""
    return {
        'verify_ssl': get_config_bool('SSL_VERIFY', True),
        'ca_bundle': get_config_value('SSL_CA_BUNDLE', ''),
        'client_cert': get_config_value('SSL_CLIENT_CERT', ''),
        'client_key': get_config_value('SSL_CLIENT_KEY', ''),
        'ssl_version': get_config_value('SSL_VERSION', 'TLSv1_2'),
        'ciphers': get_config_value('SSL_CIPHERS', 'HIGH:!aNULL:!eNULL:!EXPORT')
    }

def get_api_config() -> Dict[str, Any]:
    """Configurazione API generiche"""
    return {
        'timeout_connect': get_config_int('API_TIMEOUT_CONNECT', 30),
        'timeout_read': get_config_int('API_TIMEOUT_READ', 60),
        'max_retries': get_config_int('API_MAX_RETRIES', 3),
        'retry_backoff': get_config_float('API_RETRY_BACKOFF', 1.0),
        'user_agent': get_config_value('API_USER_AGENT', 'StudioDimaAI/2.0')
    }

def get_security_config() -> Dict[str, Any]:
    """Configurazione sicurezza"""
    return {
        'cors_origins': get_config_list('CORS_ORIGINS', default=['http://localhost:3000']),
        'csrf_enabled': get_config_bool('CSRF_ENABLED', True),
        'session_timeout': get_config_int('SESSION_TIMEOUT', 3600),
        'max_login_attempts': get_config_int('MAX_LOGIN_ATTEMPTS', 5),
        'lockout_duration': get_config_int('LOCKOUT_DURATION', 300)
    }

def get_feature_flags() -> Dict[str, bool]:
    """Feature flags per abilitare/disabilitare funzionalità"""
    return {
        'ricetta_elettronica': get_config_bool('FEATURE_RICETTA_ELETTRONICA', True),
        'sms_notifications': get_config_bool('FEATURE_SMS_NOTIFICATIONS', True),
        'calendar_sync': get_config_bool('FEATURE_CALENDAR_SYNC', True),
        'rentri_integration': get_config_bool('FEATURE_RENTRI_INTEGRATION', True),
        'audit_logging': get_config_bool('FEATURE_AUDIT_LOGGING', False),
        'performance_monitoring': get_config_bool('FEATURE_PERFORMANCE_MONITORING', False)
    }

def validate_required_config() -> Dict[str, bool]:
    """Valida configurazioni obbligatorie"""
    required_vars = [
        'SECRET_KEY',
        'JWT_SECRET_KEY'
    ]
    
    validation = {}
    for var in required_vars:
        try:
            get_config_value(var, required=True)
            validation[var] = True
        except EnvironmentError:
            validation[var] = False
            logging.error(f"Variabile obbligatoria mancante: {var}")
    
    return validation

def get_environment_info() -> Dict[str, Any]:
    """Informazioni ambiente corrente"""
    return {
        'python_version': os.environ.get('PYTHON_VERSION', 'unknown'),
        'environment': get_config_value('ENVIRONMENT', 'development'),
        'debug_mode': get_config_bool('DEBUG', False),
        'feature_flags': get_feature_flags(),
        'config_validation': validate_required_config()
    }

# Global configuration instances
config = Config()
config_manager = ConfigManager()