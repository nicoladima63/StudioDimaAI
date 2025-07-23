import os
import logging
from flask import Flask, jsonify
from server.app.config.config import Config
from server.app.extensions import db, jwt, cors
from server.app.routes import register_routes
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

def configure_logging() -> None:
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'app.log')
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format='%(asctime)s %(levelname)s %(name)s %(message)s',
        handlers=[logging.StreamHandler(), logging.FileHandler(log_file)]
    )

def check_critical_config(app: Flask) -> None:
    for key in ['SQLALCHEMY_DATABASE_URI', 'JWT_SECRET_KEY']:
        if not app.config.get(key):
            raise RuntimeError(f"Config mancante: {key}")

def create_app(config_class: Optional[object] = Config) -> Flask:
    configure_logging()
    logger = logging.getLogger(__name__)
    app = Flask(__name__)
    app.config.from_object(config_class)

    check_critical_config(app)
    cors.init_app(app, resources={r"/api/*": {
        "origins": os.getenv("CORS_ORIGINS", "http://localhost:5173"),
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }})
    db.init_app(app)
    jwt.init_app(app)

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        logger.error(f"Token non valido: {error}")
        return jsonify({'success': False, 'error': f'Token non valido: {error}'}), 422
    
    # Test routes BEFORE blueprint registration
    @app.route('/test-before-bp')
    def test_before_blueprints():
        return {'message': 'Route added BEFORE blueprints!'}, 200

    register_routes(app)
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        print(f"Internal server error: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error', 'details': str(error)}), 500
    
    # Test routes AFTER blueprint registration
    @app.route('/api/rentri-test')
    def rentri_direct_test():
        return {'message': 'Direct route works!'}, 200

    @app.route('/test-direct')
    def simple_direct_test():
        return {'message': 'Simple direct route works!'}, 200

    @app.route('/health')
    def health_check():
        try:
            # Verifica connessione DB
            db.session.execute(text('SELECT 1'))
            # Verifica presenza tabella user e conta utenti
            result = db.session.execute(text('SELECT COUNT(*) FROM user'))
            user_count = result.scalar()
            db_status = 'ok'
            details = {'user_count': user_count}
        except Exception as e:
            db_status = 'error'
            details = {'error': str(e)}
            app.logger.error(f"Health check DB error: {e}")
        return {'status': 'healthy', 'db': db_status, **details}, 200
    # logger.info("Applicazione inizializzata")

    return app

if __name__ == "__main__":
    app = create_app()

    # print("DEBUG: Lista completa delle regole registrate:")
    # for rule in app.url_map.iter_rules():
    #     print(f"  {rule} -> {rule.endpoint}")
    #     if 'rentri' in str(rule):
    #         print(f"    RENTRI route found: {rule.methods} {rule}")
    
    # print(f"DEBUG: Blueprints registrati: {list(app.blueprints.keys())}")
    # if 'rentri' in app.blueprints:
    #     print(f"SUCCESS: Blueprint RENTRI trovato in app.blueprints")
    # else:
    #     print(f"ERROR: Blueprint RENTRI NON trovato in app.blueprints")
    try:
        app.run(
            host=app.config.get("HOST", "0.0.0.0"),
            port=app.config.get("PORT", 5000),
            debug=app.config.get("DEBUG", True),
            threaded=True
        )
    except Exception as e:
        logging.error(f"Errore durante l'esecuzione del server: {str(e)}")
        raise
