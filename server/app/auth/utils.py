# analytics/app/auth/utils.py

from passlib.hash import bcrypt
from functools import wraps
from flask import request, jsonify
import jwt
import datetime
import os

def hash_password(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.verify(password, password_hash)

def generate_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }
    secret = os.getenv("SECRET_KEY", "sviluppo")
    return jwt.encode(payload, secret, algorithm="HS256")

def token_required(allowed_roles=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token:
                return jsonify({"error": "Token mancante"}), 401

            try:
                token = token.replace("Bearer ", "")
                payload = jwt.decode(token, os.getenv("SECRET_KEY", "sviluppo"), algorithms=["HS256"])
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token scaduto"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Token non valido"}), 401

            if allowed_roles and payload.get("role") not in allowed_roles:
                return jsonify({"error": "Accesso negato: ruolo insufficiente"}), 403

            # Allega payload al request (se serve)
            request.user = payload
            return f(*args, **kwargs)
        return wrapper
    return decorator