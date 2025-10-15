"""
Flask configuration for StudioDimaAI Server V2.

Provides Flask-specific configuration that extends the core Config class
with Flask app settings, JWT configuration, and CORS settings.
"""

import os
from datetime import timedelta
from core.config import Config


class FlaskConfig(Config):
    """
    Flask-specific configuration extending core Config.
    
    Provides all Flask app configuration including JWT, CORS,
    database settings, and development/production overrides.
    """
    
    # Flask Core Settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'studio-dima-v2-dev-secret-key-fixed'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    TESTING = False
    
    # Server Settings
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5001))  # V2 server on different port
    THREADED = True
    
    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'studio-dima-v2-jwt-secret-key-fixed'
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # CORS Configuration
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3001,http://localhost:5173').split(',')
    CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    CORS_ALLOW_HEADERS = ['Content-Type', 'Authorization']
    
    # Database Configuration (use instance database for V2)
    SQLALCHEMY_DATABASE_URI = f'sqlite:///instance/studio_dima.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_timeout': 20,
        'pool_recycle': 3600,
        'pool_pre_ping': True
    }
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT', 'False').lower() == 'true'
    
    # API Configuration
    API_VERSION = 'v2'
    API_PREFIX = f'/api/{API_VERSION}'

    # Tracked Link URL
    TRACKED_LINK_BASE_URL = os.environ.get('TRACKED_LINK_BASE_URL')
    
    # Performance Settings
    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = DEBUG
    
    # Security Settings
    WTF_CSRF_ENABLED = False  # Disabled for API
    PROPAGATE_EXCEPTIONS = True
    
    @classmethod
    def get_cors_config(cls):
        """Get CORS configuration for Flask-CORS."""
        return {
            'origins': cls.CORS_ORIGINS,
            'methods': cls.CORS_METHODS,
            'allow_headers': cls.CORS_ALLOW_HEADERS
        }
    
    @classmethod
    def get_jwt_config(cls):
        """Get JWT configuration dictionary."""
        return {
            'JWT_SECRET_KEY': cls.JWT_SECRET_KEY,
            'JWT_TOKEN_LOCATION': cls.JWT_TOKEN_LOCATION,
            'JWT_HEADER_NAME': cls.JWT_HEADER_NAME,
            'JWT_HEADER_TYPE': cls.JWT_HEADER_TYPE,
            'JWT_ACCESS_TOKEN_EXPIRES': cls.JWT_ACCESS_TOKEN_EXPIRES,
            'JWT_REFRESH_TOKEN_EXPIRES': cls.JWT_REFRESH_TOKEN_EXPIRES
        }


class DevelopmentConfig(FlaskConfig):
    """Development configuration with debug enabled."""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'
    # In sviluppo, possiamo usare un URL di ngrok o un altro tunnel
    TRACKED_LINK_BASE_URL = os.environ.get('TRACKED_LINK_BASE_URL_DEV') or 'http://localhost:3001/r'


class ProductionConfig(FlaskConfig):
    """Production configuration with security hardening."""
    DEBUG = False
    TESTING = False
    LOG_LEVEL = 'WARNING'
    
    # Override with environment variables for production
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    
    def __init__(self):
        super().__init__()
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set in production")
        if not self.JWT_SECRET_KEY:
            raise ValueError("JWT_SECRET_KEY must be set in production")
        if not self.TRACKED_LINK_BASE_URL:
            raise ValueError("TRACKED_LINK_BASE_URL must be set in production")


class TestingConfig(FlaskConfig):
    """Testing configuration for unit tests."""
    TESTING = True
    DEBUG = True
    WTF_CSRF_ENABLED = False
    
    # Use in-memory database for tests
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


# Configuration selector
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(config_name=None):
    """
    Get configuration class by name.
    
    Args:
        config_name: Configuration name ('development', 'production', 'testing')
        
    Returns:
        Configuration class
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    return config_by_name.get(config_name, DevelopmentConfig)