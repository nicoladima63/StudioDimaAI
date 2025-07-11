import os
import logging
from flask import Flask, jsonify
from server.app.config.config import Config
from server.app.extensions import db, jwt, cors
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

def register_blueprints(app: Flask) -> None:
    from server.app.api import (
        api_auth, api_settings, api_richiami, api_prescrizione,
        api_pazienti, api_network, api_kpi, api_incassi,
        api_fatture, api_calendar
    )

    blueprints = [
        api_auth.auth_bp,
        api_settings.settings_bp,
        api_richiami.recalls_bp,
        api_prescrizione.prescrizione_bp,
        api_pazienti.pazienti_bp,
        api_network.network_bp,
        api_kpi.kpi_bp,
        api_incassi.incassi_bp,
        api_fatture.fatture_bp,
        api_calendar.calendar_bp,
    ]

    for bp in blueprints:
        if bp.name in app.blueprints:
            app.logger.warning(f"Blueprint già registrato: {bp.name}")
        else:
            app.register_blueprint(bp)
            #app.logger.info(f"Blueprint registrato: {bp.name}")

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
    
    register_blueprints(app)
    
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
    logger.info("Applicazione inizializzata")

    print("RUN.PY - Working directory:", os.getcwd())
    print("RUN.PY - DB PATH:", app.config["SQLALCHEMY_DATABASE_URI"])

    return app

if __name__ == "__main__":
    app = create_app()

    # for rule in app.url_map.iter_rules():
    #     print(rule)
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
