# server/app/config.py
import os
from dotenv import load_dotenv

load_dotenv()  # Carica le variabili da .env nella root del progetto

    
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "sviluppo")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.abspath(os.path.join(basedir, '../instance/users.db'))}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
