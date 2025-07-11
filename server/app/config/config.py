import os

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.abspath(os.path.join(basedir, '../../instance/users.db'))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret")
    # Altre config globali

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
