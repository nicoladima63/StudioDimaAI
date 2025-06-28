# analytics/app/auth/routes.py

import re
from flask import Blueprint, request, jsonify
from ..extensions import db
from .models import User
from .utils import hash_password, verify_password
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)

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

    # L'identità può essere un oggetto complesso, se necessario
    identity = {"id": user.id, "role": user.role}
    access_token = create_access_token(identity=identity, fresh=True)
    refresh_token = create_refresh_token(identity=identity)
    return jsonify(
        access_token=access_token,
        refresh_token=refresh_token,
        username=user.username,
        role=user.role,
    )

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


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity, fresh=False)
    return jsonify(access_token=access_token)