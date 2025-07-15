from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    
    # Configuration
    app.config.from_mapping(
        SECRET_KEY='dev', # Sostituisci con una chiave sicura in produzione
        JWT_SECRET_KEY='super-secret', # Sostituisci con una chiave sicura
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=1),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=30),
    )
    
    # Initialize extensions
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    jwt = JWTManager(app)

    with app.app_context():
        # Import and register blueprints
        from .api.api_auth import auth_bp
        from .api.api_fatture import fatture_bp
        from .api.api_incassi import incassi_bp
        from .api.api_kpi import kpi_bp
        from .api.api_network import network_bp
        from .api.api_pazienti import pazienti_bp
        from .api.api_prescrizione import prescrizione_bp
        from .api.api_richiami import richiami_bp
        from .api.api_settings import settings_bp
        from .api.api_appointments import appointments_bp

        app.register_blueprint(auth_bp)
        app.register_blueprint(appointments_bp)
        app.register_blueprint(fatture_bp)
        app.register_blueprint(incassi_bp)
        app.register_blueprint(kpi_bp)
        app.register_blueprint(network_bp)
        app.register_blueprint(pazienti_bp)
        app.register_blueprint(prescrizione_bp)
        app.register_blueprint(richiami_bp)
        app.register_blueprint(settings_bp)

        return app