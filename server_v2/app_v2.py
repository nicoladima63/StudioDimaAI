"""
StudioDimaAI Server V2 - Modern Flask Application.

This module provides the main Flask application for the modernized
StudioDimaAI server with improved architecture, performance, and maintainability.
"""

import os
import logging
from datetime import datetime
from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt_identity, verify_jwt_in_request
from typing import Optional
from pathlib import Path
from core.google_calendar_client import GoogleCalendarClient

from config.flask_config import get_config

# Determine base path for Google Calendar credentials
# app_v2.py is in server_v2/ root
_BASE_DIR = Path(__file__).parent  # server_v2/
_CREDENTIALS_PATH = _BASE_DIR / "instance" / "credentials.json"
_TOKEN_PATH = _BASE_DIR / "tokens" / "token.json"
from core.database_manager import get_database_manager
from core.exceptions import StudioDimaError
from utils.dbf_utils import convert_bytes_to_string, clean_dbf_value

# Importa i moduli delle azioni per attivare la registrazione
from services.actions import system_actions

# WebSocket support
from flask_socketio import SocketIO

logger = logging.getLogger(__name__)

# Global SocketIO instance (will be initialized in create_app_v2)
socketio = None
websocket_service = None

# Global Push Notification service (will be initialized in create_app_v2)
push_service = None
vapid_public_key = None

def create_app_v2(config_name: Optional[str] = None) -> Flask:
    """
    Create and configure the Flask application for Server V2.
    
    Args:
        config_name: Configuration environment name
        
    Returns:
        Configured Flask application
    """
    app = Flask(__name__, static_folder='static', static_url_path='/')
    #app = Flask(__name__, static_folder=r'C:\StudioDimaAi\static', static_url_path='/')

    
    # Load configuration
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    
    # Configure logging
    setup_logging(app)
    
    # Disabilita tutti i logger
    #logging.disable(logging.CRITICAL)
    # Oppure disabilita solo i logger più rumorosi:
    # logging.getLogger('werkzeug').setLevel(logging.ERROR)
    # app.logger.setLevel(logging.ERROR)

    # Server V2 initialization
    # Initialize extensions
    init_extensions(app)
    
    # Initialize SocketIO
    init_socketio(app)

    # Initialize Push Notifications
    init_push_service(app)

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

 # Serve React frontend for all non-API routes
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react_app(path):
        # Evita di interferire con le API
        if path.startswith(app.config.get('API_PREFIX', '/api').lstrip('/')):
            return jsonify({
                'success': False,
                'error': 'Endpoint not found',
                'message': f'The requested endpoint {request.path} was not found'
            }), 404

        # Percorso assoluto del file statico
        static_path = os.path.join(app.static_folder, path)
        
        # Se esiste un file statico, lo serve normalmente (es. asset o favicon)
        if os.path.exists(static_path):
            return send_from_directory(app.static_folder, path)

        # Altrimenti React gestisce la route → restituisce index.html
        return send_from_directory(app.static_folder, 'index.html')
    
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
    
    # Disabilita completamente log delle richieste HTTP
    logging.getLogger('werkzeug').disabled = True
    logging.getLogger('request').disabled = True
    
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
        logger.warning(f"JWT token expired: {jwt_payload}")
        return jsonify({'error': 'Token expired', 'message': 'Please login again'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        logger.warning(f"JWT invalid token: {error}")
        return jsonify({'error': 'Invalid token', 'message': 'Please provide a valid token'}), 422
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        logger.warning(f"JWT missing token: {error}")
        return jsonify({'error': 'Token required', 'message': 'Authorization token is required'}), 401


def init_socketio(app: Flask) -> None:
    """Initialize Flask-SocketIO for real-time notifications."""
    global socketio, websocket_service
    
    # Initialize SocketIO with CORS support
    socketio = SocketIO(
        app,
        cors_allowed_origins=app.config['CORS_ORIGINS'],
        async_mode='threading',  # Use threading for compatibility with Waitress
        logger=False,  # Disable SocketIO logging to reduce noise
        engineio_logger=False
    )
    
    # Initialize WebSocket service
    from services.websocket_service import WebSocketService
    websocket_service = WebSocketService(socketio)
    
    logger.info("WebSocket service initialized")


def init_push_service(app: Flask) -> None:
    """Initialize Push Notification service for browser push."""
    global push_service, vapid_public_key

    try:
        # Read configuration from environment variables
        push_enabled = os.environ.get('PUSH_NOTIFICATIONS_ENABLED', 'false').lower() == 'true'

        if not push_enabled:
            logger.info("Push notifications disabled in config (PUSH_NOTIFICATIONS_ENABLED=false)")
            return

        vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY')
        # Use standard base64 version for frontend (with padding)
        vapid_public_key_base64 = os.environ.get('VAPID_PUBLIC_KEY_BASE64')
        vapid_claims_email = os.environ.get('VAPID_CLAIMS_EMAIL', 'admin@studiodima.com')

        # Validate required keys
        if not vapid_private_key or not vapid_public_key_base64:
            logger.warning("VAPID keys not found in environment. Push notifications disabled.")
            logger.warning("Run: python generate_vapid_keys.py and add keys to .env file")
            return

        # Initialize push service
        from services.push_notification_service import PushNotificationService
        db_manager = get_database_manager()

        push_service = PushNotificationService(
            db_manager=db_manager,
            vapid_private_key=vapid_private_key,
            vapid_claims={"sub": f"mailto:{vapid_claims_email}"}
        )
        # Store base64 version for frontend
        vapid_public_key = vapid_public_key_base64

        logger.info("Push notification service initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize push service: {e}")
        logger.warning("Push notifications will be disabled")


def init_database_manager(app: Flask) -> None:
    """Initialize the database manager."""
    # Database manager will be initialized per request
    pass


def register_blueprints(app: Flask) -> None:
    """Register API blueprints."""
    from api.v2_auth import auth_v2_bp
    from api.v2_materiali import materiali_v2_bp
    from api.v2_fornitori import fornitori_v2_bp
    from api.v2_pazienti import pazienti_v2_bp
    from api.v2_richiami import richiami_v2_bp
    from api.v2_piani_cura import piani_cura_v2_bp
    from api.v2_spese_fornitori import spese_fornitori_v2_bp
    from api.v2_statistiche import statistiche_v2_bp
    from api.v2_classificazioni import classificazioni_v2_bp
    from api.v2_conti import conti_v2_bp
    from api.v2_ricetta import ricetta_bp
    from api.v2_sms import sms_v2_bp
    from api.v2_users import users_v2_bp

    from api.v2_calendar import calendar_v2_bp
    from api.v2_scheduler import scheduler_v2_bp
    from api.v2_environment import environment_bp
    from api.api_monitoring import monitoring_bp
    from api.v2_monitoring_changes import monitoring_changes_bp
    from api.v2_prestazioni import prestazioni_bp
    from api.v2_automation_rules import automation_bp
    from api.v2_templates import templates_v2_bp
    from api.v2_tables import tables_bp
    from api.v2_tipi_messaggi import tipi_messaggi_bp
    from api.v2_sms_tracking import sms_tracking_bp
    from api.v2_tracker import tracker_bp
    from api.v2_automation_settings import automation_settings_bp
    from api.v2_works import works_bp
    from api.v2_tasks import tasks_bp
    from api.v2_steps import steps_bp
    from api.v2_todos import todos_bp
    from api.v2_providers import providers_bp
    from api.v2_notifications import notifications_bp
    from api.v2_prestazione_work_mapping import prestazione_mapping_bp
    from api.v2_push import push_bp

    # Register all V2 blueprints
    blueprints = [
        auth_v2_bp,
        materiali_v2_bp,
        fornitori_v2_bp,
        pazienti_v2_bp,
        richiami_v2_bp,
        piani_cura_v2_bp,
        spese_fornitori_v2_bp,
        statistiche_v2_bp,
        classificazioni_v2_bp,
        conti_v2_bp,
        ricetta_bp,
        sms_v2_bp,
        scheduler_v2_bp,
        environment_bp,
        monitoring_bp,
        prestazioni_bp,
        automation_bp,
        tables_bp,
        templates_v2_bp,
        tipi_messaggi_bp,
        sms_tracking_bp,
        tracker_bp,
        automation_settings_bp,
        users_v2_bp,
        works_bp,
        tasks_bp,
        steps_bp,
        todos_bp,
        providers_bp,
        notifications_bp,
        prestazione_mapping_bp,
        push_bp
    ]
    
    # Register standard blueprints with API prefix only
    for i, blueprint in enumerate(blueprints):
        try:
            app.register_blueprint(blueprint, url_prefix=app.config['API_PREFIX'])
            logger = logging.getLogger(__name__)
            # Blueprint registered
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to register blueprint {blueprint.name}: {e}")
    
    # Register calendar blueprint with specific prefix
    try:
        app.register_blueprint(calendar_v2_bp, url_prefix=app.config['API_PREFIX'] + '/calendar')
        logger = logging.getLogger(__name__)
        # Calendar blueprint registered
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to register calendar blueprint: {e}")
    
    # Register monitoring changes blueprint with specific prefix
    try:
        app.register_blueprint(monitoring_changes_bp, url_prefix=app.config['API_PREFIX'] + '/monitoring/changes')
        logger = logging.getLogger(__name__)
        # Monitoring changes blueprint registered
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to register monitoring changes blueprint: {e}")
    
    logger = logging.getLogger(__name__)
    # All blueprints registered

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
        
        # Log JWT token presence for debugging
        #if request.path.startswith(app.config['API_PREFIX']):
        #    auth_header = request.headers.get('Authorization', '')
        #    logger = logging.getLogger(__name__)
        #    if auth_header:
        #        logger.debug(f"Request to {request.path} - Authorization header present: {auth_header[:20]}...")
        #    else:
        #        logger.debug(f"Request to {request.path} - No Authorization header")
    
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
    
    @app.route(f"{app.config['API_PREFIX']}/debug-routes")
    def debug_routes():
        """Debug endpoint to list all routes."""
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods),
                'rule': str(rule)
            })
        return jsonify({'routes': routes})

    @app.route(f"{app.config['API_PREFIX']}/test-main")
    def test_main():
        return "MAIN SERVER OK"
    
    @app.route("/oauth/callback")
    def oauth_callback():
        """Handle OAuth callback from Google Calendar."""
        try:
            from flask import request, redirect
            
            # Get authorization code and state from callback URL
            code = request.args.get('code')
            state = request.args.get('state') 
            error = request.args.get('error')

            if error:
                logger.error(f"OAuth error from Google: {error}")
                return redirect(f"/oauth-result?success=false&error={error}")
            
            if not code or not state:
                logger.error("Missing authorization code or state in OAuth callback.")
                return redirect("/oauth-result?success=false&error=missing_code_or_state")
            
            # Instantiate client
            client = GoogleCalendarClient(
                credentials_path=_CREDENTIALS_PATH,
                token_path=_TOKEN_PATH,
            )
            
            # Define the redirect URI used to generate the auth URL
            redirect_uri = 'http://localhost:5001/oauth/callback'

            # Handle the callback
            client.handle_web_auth_callback(
                code=code, 
                state=state, 
                redirect_uri=redirect_uri
            )
            
            logger.info("OAuth callback completed successfully")
            return redirect("/oauth-result?success=true")
                
        except Exception as e:
            logger.error(f"Error in OAuth callback: {e}", exc_info=True)
            return redirect(f"/oauth-result?success=false&error=callback_error&details={str(e)}")

    @app.route("/oauth-result")
    def oauth_result():
        """OAuth result page for Google Calendar authentication."""
        from flask import request
        
        success = request.args.get('success', 'false').lower() == 'true'
        error = request.args.get('error', '')
        
        if success:
            return """
            <html>
                <head><title>OAuth Success</title></head>
                <body style="font-family: Arial; padding: 40px; text-align: center;">
                    <h2 style="color: #28a745;">✓ Autenticazione Google completata!</h2>
                    <p>L'autorizzazione è stata completata con successo.</p>
                    <p><strong>Ora puoi chiudere questa finestra e tornare all'applicazione.</strong></p>
                    <script>
                        setTimeout(() => window.close(), 3000);
                    </script>
                </body>
            </html>
            """
        else:
            error_messages = {
                'access_denied': 'Accesso negato dall\'utente',
                'missing_code': 'Codice di autorizzazione mancante',
                'missing_state': 'Parametro di stato mancante',
                'state_mismatch': 'Stato OAuth non corrispondente (possibile attacco)',
                'callback_error': 'Errore durante il callback',
                'callback_failed': 'Callback fallito'
            }
            
            error_msg = error_messages.get(error, f'Errore sconosciuto: {error}')
            
            return f"""
            <html>
                <head><title>OAuth Error</title></head>
                <body style="font-family: Arial; padding: 40px; text-align: center;">
                    <h2 style="color: #dc3545;">✗ Errore di autenticazione</h2>
                    <p><strong>Errore:</strong> {error_msg}</p>
                    <p>Riprova l'autenticazione dall'applicazione.</p>
                    <p><a href="javascript:window.close()">Chiudi questa finestra</a></p>
                </body>
            </html>
            """

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