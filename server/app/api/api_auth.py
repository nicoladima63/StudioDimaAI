import re
from flask import Blueprint, request, jsonify
from server.app.extensions import db
from server.app.models.user import User
from server.app.utils.auth_utils import hash_password, verify_password
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

auth_bp = Blueprint("auth", __name__, url_prefix='/api/auth')


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()

    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Credenziali non valide"}), 401

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

    if not username or not password:
        return jsonify({"error": "Username, password e email sono obbligatori"}), 400

    if not EMAIL_REGEX.match(username):
        return jsonify({"error": "Email non valida"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username già utilizzato"}), 409

    password_hash = hash_password(password)
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