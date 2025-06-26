# analytics/app/auth/routes.py

import re
from flask import Blueprint, request, jsonify
from ..extensions import db
from .models import User
from .utils import hash_password, verify_password, generate_token, token_required

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()

    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Credenziali non valide"}), 401

    token = generate_token(user.id, user.username, user.role)
    return jsonify({"token": token, "role": user.role, "username": user.username})

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    # Validazione base
    if not username or not password:
        return jsonify({"error": "Username, password e email sono obbligatori"}), 400

    # Validazione email
    if not EMAIL_REGEX.match(username):
        return jsonify({"error": "Email non valida"}), 400

    # Controllo username/email esistenti
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username già utilizzato"}), 409

    # Hash della password
    password_hash = hash_password(password)

    # Crea nuovo utente
    new_user = User(username=username, password_hash=password_hash)

    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Errore interno, riprova"}), 500

    return jsonify({"message": "Registrazione avvenuta con successo"}), 201