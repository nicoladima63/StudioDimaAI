# server/app/run.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from .config import Config
from .extensions import db
import logging
from typing import Optional

def configure_logging() -> None:
    """Configura il logging per l'applicazione Flask."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('app.log')
        ]
    )

def register_blueprints(app: Flask) -> None:
    """Registra tutti i blueprint dell'applicazione."""
    from .auth.routes import auth_bp
    from .routes.tests import tests_bp
    
    # Blueprint principali
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tests_bp, url_prefix="/api/tests")
    
    # Aggiungi qui altri blueprint

def create_app(config_class: Optional[object] = Config) -> Flask:
    """Factory per creare e configurare l'applicazione Flask."""
    
    # Configurazione logging
    configure_logging()
    logger = logging.getLogger(__name__)
    
    # Creazione app Flask
    app = Flask(__name__)
    
    try:
        # Configurazione
        app.config.from_object(config_class)
        logger.info("Configurazione applicazione caricata con successo")
        
        # Configurazione CORS più sicura
        CORS(
            app,
            resources={r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "https://tuodominio.com"  # Aggiungi altri domini se necessario
                ],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 86400
            }},
            expose_headers=["X-Custom-Header"]
        )
        
        # Inizializzazione database
        db.init_app(app)
        
        # Registrazione blueprint
        register_blueprints(app)
        
        # Health check endpoint
        @app.route('/health')
        def health_check():
            return {'status': 'healthy'}, 200
            
        logger.info("Applicazione inizializzata con successo")
        
    except Exception as e:
        logger.error(f"Errore durante l'inizializzazione dell'app: {str(e)}")
        raise
    
    return app

if __name__ == "__main__":
    app = create_app()
    
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
