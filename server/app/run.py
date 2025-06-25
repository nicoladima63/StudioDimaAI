# analytics/app/run.py

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from .config import Config
from .extensions import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    #CORS(app)  # abilita CORS
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)

    db.init_app(app)

    # Importa e registra blueprint
    from .auth.routes import auth_bp
    from .routes.tests import tests_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tests_bp, url_prefix="/api/tests")

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
