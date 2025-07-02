# server/app/run.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from .config import Config
from .extensions import db, jwt
import logging
from typing import Optional
from .calendar.routes import calendar_bp
from .recalls.recall_db_controller import recall_db_bp
from .pazienti.controller import pazienti_bp
from dotenv import load_dotenv

load_dotenv()

def configure_logging() -> None:
    """Configura il logging per l'applicazione Flask."""
    logging.basicConfig(
        level=logging.DEBUG,
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
    from .recalls.controller import recalls_bp
    from .recalls.recall_db_controller import recall_db_bp
    from .pazienti.controller import pazienti_bp
    from .routes.settings import settings_bp
    from .routes.fatture import fatture_bp
    
    # Blueprint principali
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tests_bp, url_prefix="/api/tests")
    app.register_blueprint(calendar_bp, url_prefix="/api/calendar")
    app.register_blueprint(recalls_bp, url_prefix="/api/recalls")
    app.register_blueprint(recall_db_bp)
    app.register_blueprint(pazienti_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(fatture_bp, url_prefix="/api/fatture")
    
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
        logger.info(f"SQLALCHEMY_DATABASE_URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
        
        # Configurazione CORS più sicura
        CORS(app, resources={r"/api/*": {
            "origins": "http://localhost:5173",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }})
        
        # Inizializzazione database
        db.init_app(app)
        jwt.init_app(app)
        
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
