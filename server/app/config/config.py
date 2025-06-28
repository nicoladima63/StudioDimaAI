import os
from datetime import timedelta
from dotenv import load_dotenv
from .constants import TWILIO, GOOGLE

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.abspath(os.path.join(basedir, '../../instance/users.db'))

class Config:
    DEBUG = True
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    HOST = "0.0.0.0"
    PORT = 5000
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "maremmamaialaimpestataladradelcazzoribellecomeuncinghiale")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    TWILIO = TWILIO
    GOOGLE = GOOGLE
