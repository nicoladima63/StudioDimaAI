# analytics/app/auth/routes.py

from flask import Blueprint, request, jsonify
from ..extensions import db
from .models import User
from .utils import hash_password, verify_password, generate_token, token_required

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

