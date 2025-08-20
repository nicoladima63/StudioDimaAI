"""
StudioDimaAI Server V2 - Modern Flask Application.

This module provides the main Flask application for the modernized
StudioDimaAI server with improved architecture, performance, and maintainability.
"""

import os
import logging
from datetime import datetime
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt_identity, verify_jwt_in_request
from typing import Optional

from config.flask_config import get_config
from core.database_manager import get_database_manager
from core.exceptions import StudioDimaError
from utils.dbf_utils import convert_bytes_to_string, clean_dbf_value


def create_app_v2(config_name: Optional[str] = None) -> Flask:
    """
    Create and configure the Flask application for Server V2.
    
    Args:
        config_name: Configuration environment name
        
    Returns:
        Configured Flask application
    """
    app = Flask(__name__)
    
    # Load configuration
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    
    # Configure logging
    setup_logging(app)
    logger = logging.getLogger(__name__)
    logger.info("Initializing StudioDimaAI Server V2")
    
    # Initialize extensions
    init_extensions(app)
    
    # Initialize database manager
    init_database_manager(app)
    
    # Register blueprints
    register_blueprints(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register request handlers
    register_request_handlers(app)
    
    # Health check endpoint
    register_health_check(app)
    
    logger.info(f"Server V2 initialized successfully on port {app.config.get('PORT', 5001)}")
    return app


def setup_logging(app: Flask) -> None:
    """Configure application logging."""
    log_level = getattr(logging, app.config.get('LOG_LEVEL', 'INFO'))
    
    # Create logs directory
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging format
    formatter = logging.Formatter(
        '%(asctime)s %(levelname)s [%(name)s] %(message)s'
    )
    
    # File handler
    file_handler = logging.FileHandler(os.path.join(log_dir, 'server_v2.log'))
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(file_handler)
    
    if app.config.get('LOG_TO_STDOUT', False) or app.debug:
        root_logger.addHandler(console_handler)


def init_extensions(app: Flask) -> None:
    """Initialize Flask extensions."""
    # CORS
    CORS(app, resources={
        f"{app.config['API_PREFIX']}/*": {
            'origins': app.config['CORS_ORIGINS'],
            'methods': app.config['CORS_METHODS'],
            'allow_headers': app.config['CORS_ALLOW_HEADERS']
        }
    })
    
    # JWT Manager
    jwt = JWTManager(app)
    
    # JWT Error Handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token expired', 'message': 'Please login again'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token', 'message': 'Please provide a valid token'}), 422
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Token required', 'message': 'Authorization token is required'}), 401


def init_database_manager(app: Flask) -> None:
    """Initialize the database manager."""
    # Database manager will be initialized per request
    pass


def register_blueprints(app: Flask) -> None:
    """Register API blueprints."""
    from api.v2_auth import auth_v2_bp
    from api.v2_materiali import materiali_v2_bp
    from api.v2_fornitori import fornitori_v2_bp
    from api.v2_statistiche import statistiche_v2_bp
    from api.v2_classificazioni import classificazioni_v2_bp
    
    # Register all V2 blueprints
    blueprints = [
        auth_v2_bp,
        materiali_v2_bp,
        fornitori_v2_bp,
        statistiche_v2_bp,
        classificazioni_v2_bp
    ]
    
    for blueprint in blueprints:
        app.register_blueprint(blueprint, url_prefix=app.config['API_PREFIX'])
    
    logging.getLogger(__name__).info(f"Registered {len(blueprints)} API blueprints")


def register_error_handlers(app: Flask) -> None:
    """Register global error handlers."""
    
    @app.errorhandler(StudioDimaError)
    def handle_studio_dima_error(error: StudioDimaError):
        """Handle custom StudioDimaAI errors."""
        return jsonify({
            'success': False,
            'error': error.message,
            'error_code': error.error_code,
            'details': error.details
        }), error.status_code
    
    @app.errorhandler(404)
    def handle_not_found(error):
        """Handle 404 errors."""
        return jsonify({
            'success': False,
            'error': 'Endpoint not found',
            'message': f'The requested endpoint {request.path} was not found'
        }), 404
    
    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        """Handle 405 errors."""
        return jsonify({
            'success': False,
            'error': 'Method not allowed',
            'message': f'Method {request.method} not allowed for {request.path}'
        }), 405
    
    @app.errorhandler(500)
    def handle_internal_error(error):
        """Handle 500 errors."""
        logger = logging.getLogger(__name__)
        logger.error(f"Internal server error: {error}", exc_info=True)
        
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': 'An unexpected error occurred. Please try again later.'
        }), 500


def register_request_handlers(app: Flask) -> None:
    """Register request lifecycle handlers."""
    
    @app.before_request
    def before_request():
        """Initialize request context."""
        g.start_time = datetime.utcnow()
        g.database_manager = get_database_manager()
    
    @app.after_request
    def after_request(response):
        """Process response and log request."""
        # Calculate request duration
        if hasattr(g, 'start_time'):
            duration = (datetime.utcnow() - g.start_time).total_seconds()
            response.headers['X-Response-Time'] = f"{duration:.3f}s"
        
        # Add server version header
        response.headers['X-Server-Version'] = 'StudioDima-V2'
        
        # Log request (only for non-health check endpoints)
        if not request.path.endswith('/health'):
            logger = logging.getLogger('request')
            logger.info(f"{request.method} {request.path} - {response.status_code} - {duration:.3f}s")
        
        return response
    
    @app.teardown_appcontext
    def cleanup_request(error):
        """Cleanup request resources."""
        # Database connections are managed by DatabaseManager
        pass


def register_health_check(app: Flask) -> None:
    """Register health check endpoint."""
    
    @app.route(f"{app.config['API_PREFIX']}/health")
    def health_check():
        """
        Health check endpoint for monitoring and load balancing.
        
        Returns:
            JSON response with health status and system information
        """
        try:
            # Initialize database manager with local config
            from core.database_manager import initialize_database_manager
            from core.config import Config
            local_config = Config(db_path="instance/studio_dima.db")
            initialize_database_manager(local_config)
            
            # Check database connectivity
            db_manager = get_database_manager()
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
                table_count = cursor.fetchone()[0]
            
            # Get database statistics
            stats = db_manager.get_statistics()
            
            return jsonify({
                'status': 'healthy',
                'version': 'v2',
                'timestamp': datetime.utcnow().isoformat(),
                'database': {
                    'status': 'connected',
                    'tables': table_count,
                    'connection_pool': {
                        'size': stats.get('pool_size', 0),
                        'active': stats.get('active_connections', 0),
                        'hits': stats.get('pool_hits', 0),
                        'misses': stats.get('pool_misses', 0)
                    }
                },
                'performance': {
                    'connections_created': stats.get('connections_created', 0),
                    'queries_executed': stats.get('queries_executed', 0),
                    'transactions_committed': stats.get('transactions_committed', 0)
                }
            }), 200
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Health check failed: {e}")
            
            return jsonify({
                'status': 'unhealthy',
                'version': 'v2',
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }), 503


# Authentication utility for blueprints
def require_auth():
    """
    Utility function to require authentication in endpoints.
    
    Returns:
        Current user identity from JWT token
    """
    verify_jwt_in_request()
    return get_jwt_identity()


# Global utilities for blueprints
def format_response(data=None, success=True, message=None, error=None, **kwargs):
    """
    Standardize API response format.
    
    Args:
        data: Response data
        success: Success status
        message: Success message
        error: Error message
        **kwargs: Additional response fields
        
    Returns:
        Formatted JSON response
    """
    response = {
        'success': success,
        'timestamp': datetime.utcnow().isoformat(),
        **kwargs
    }
    
    if data is not None:
        response['data'] = data
    
    if message:
        response['message'] = message
    
    if error:
        response['error'] = error
    
    return jsonify(response)


def handle_dbf_data(data):
    """
    Clean and process DBF data for JSON response.
    
    Args:
        data: Raw data that may contain DBF artifacts
        
    Returns:
        Cleaned data suitable for JSON serialization
    """
    if isinstance(data, list):
        return [handle_dbf_data(item) for item in data]
    elif isinstance(data, dict):
        return {key: handle_dbf_data(value) for key, value in data.items()}
    else:
        return clean_dbf_value(data)