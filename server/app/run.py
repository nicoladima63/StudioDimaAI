import os
import logging
from flask import Flask, jsonify
from server.app.config.config import Config
from server.app.extensions import db, jwt, cors
from typing import Optional
from dotenv import load_dotenv

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
    from server.app.api.api_auth import auth_bp
    from server.app.api.api_settings import settings_bp
    from server.app.api.api_richiami import recalls_bp
    from server.app.api.api_prescrizione import prescrizione_bp
    from server.app.api.api_pazienti import pazienti_bp
    from server.app.api.api_network import network_bp
    from server.app.api.api_kpi import kpi_bp
    from server.app.api.api_incassi import incassi_bp
    from server.app.api.api_fatture import fatture_bp
    from server.app.api.api_calendar import calendar_bp
    blueprints = [
        auth_bp, settings_bp, recalls_bp, prescrizione_bp, pazienti_bp, network_bp,
        kpi_bp, incassi_bp, fatture_bp, calendar_bp
    ]
    for bp in blueprints:
        app.register_blueprint(bp)

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
            db.session.execute('SELECT 1')
            db_status = 'ok'
        except Exception:
            db_status = 'error'
        return {'status': 'healthy', 'db': db_status}, 200
    logger.info("Applicazione inizializzata")
    return app

if __name__ == "__main__":
    app = create_app()
    print("ROUTES DISPONIBILI:")
    for rule in app.url_map.iter_rules():
        print(rule)
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
