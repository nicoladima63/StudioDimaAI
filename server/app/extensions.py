from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# Inizializzazione delle estensioni (senza bind all'app)
db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
