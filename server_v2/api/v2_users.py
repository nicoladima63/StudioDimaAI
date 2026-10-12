"""
API for User Management in StudioDimaAI Server V2.
"""

import logging
import re
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt

from app_v2 import format_response
from repositories.user_repository import UserRepository
from utils.auth_utils import roles_required, VALID_ROLES

logger = logging.getLogger(__name__)
users_v2_bp = Blueprint('users_v2', __name__)
user_repo = UserRepository()

# Cellulare per i richiami WhatsApp/SMS: cifre, spazi e un + iniziale opzionale
_PHONE_RE = re.compile(r'^\+?[0-9 ]{8,16}$')


def _invalid_phone(phone):
    """Messaggio di errore se il numero non e' valido, altrimenti None. Vuoto = nessun numero (ammesso)."""
    if phone is None or str(phone).strip() == '':
        return None
    if not _PHONE_RE.match(str(phone).strip()):
        return "Numero di telefono non valido: usa solo cifre, spazi e un + iniziale (8-16 caratteri)"
    return None

@users_v2_bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    """
    Get a list of all users.
    Accessible by all authenticated users (needed for work assignment UI).
    """
    try:
        users = user_repo.get_all()
        is_admin = get_jwt().get('sub', {}).get('role') == 'admin'
        # Remove password hashes from response for security
        for user in users:
            if 'password_hash' in user:
                del user['password_hash']
            # La lista serve a tutti per assegnare i lavori: il cellulare e' solo per l'admin
            if not is_admin:
                user.pop('phone', None)
        return format_response(data=users), 200
    except Exception as e:
        logger.error(f"Error getting all users: {e}", exc_info=True)
        return format_response(success=False, error="Failed to retrieve users"), 500

@users_v2_bp.route('/users', methods=['POST'])
@jwt_required()
@roles_required('admin')
def create_user():
    """
    Create a new user.
    Accessible only by admins.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    phone = data.get('phone')

    if not username or not password:
        return format_response(success=False, error="Username and password are required"), 400

    phone_error = _invalid_phone(phone)
    if phone_error:
        return format_response(success=False, error=phone_error), 400
    
    if role not in VALID_ROLES:
        return format_response(success=False, error=f"Ruolo non valido. Valori ammessi: {', '.join(VALID_ROLES)}"), 400

    try:
        existing_user = user_repo.find_by_username(username)
        if existing_user:
            return format_response(success=False, error="Username already exists"), 409

        new_user = user_repo.create(username, password, role, phone)
        if not new_user:
            return format_response(success=False, error="Failed to create user"), 500
        
        # Do not return password hash
        del new_user['password_hash']

        return format_response(data=new_user, message="User created successfully"), 201
    except Exception as e:
        logger.error(f"Error creating user '{username}': {e}", exc_info=True)
        return format_response(success=False, error="An internal error occurred"), 500

@users_v2_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
@roles_required('admin')
def get_user_by_id(user_id):
    """
    Get a single user by their ID.
    Accessible only by admins.
    """
    try:
        user = user_repo.find_by_id(user_id)
        if not user:
            return format_response(success=False, error="User not found"), 404
        
        del user['password_hash']
        return format_response(data=user), 200
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}", exc_info=True)
        return format_response(success=False, error="Failed to retrieve user"), 500

@users_v2_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@roles_required('admin')
def update_user(user_id):
    """
    Update a user's details.
    Accessible only by admins.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    phone = data.get('phone')  # None = invariato, stringa vuota = rimuovi

    if role and role not in VALID_ROLES:
        return format_response(success=False, error=f"Ruolo non valido. Valori ammessi: {', '.join(VALID_ROLES)}"), 400

    phone_error = _invalid_phone(phone)
    if phone_error:
        return format_response(success=False, error=phone_error), 400

    try:
        # Check if user exists
        if not user_repo.find_by_id(user_id):
            return format_response(success=False, error="User not found"), 404

        # Check for username conflict if username is being changed
        if username:
            existing_user = user_repo.find_by_username(username)
            if existing_user and existing_user['id'] != user_id:
                return format_response(success=False, error="Username already in use"), 409

        updated_user = user_repo.update(user_id, username, password, role, phone)
        if not updated_user:
            return format_response(success=False, error="Failed to update user"), 500
            
        del updated_user['password_hash']
        return format_response(data=updated_user, message="User updated successfully"), 200
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}", exc_info=True)
        return format_response(success=False, error="An internal error occurred"), 500

@users_v2_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@roles_required('admin')
def delete_user(user_id):
    """
    Delete a user.
    Accessible only by admins.
    """
    # Prevent admin from deleting themselves
    claims = get_jwt()
    current_user_id = claims['sub']['id']
    if current_user_id == user_id:
        return format_response(success=False, error="Admins cannot delete themselves"), 403

    try:
        if not user_repo.find_by_id(user_id):
            return format_response(success=False, error="User not found"), 404

        if user_repo.delete(user_id):
            return format_response(message="User deleted successfully"), 200
        else:
            return format_response(success=False, error="Failed to delete user"), 500
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}", exc_info=True)
        return format_response(success=False, error="An internal error occurred"), 500

@users_v2_bp.route('/users/test', methods=['GET'])
@jwt_required()
@roles_required('admin')
def test_protected_route():
    """
    Test route to verify JWT authentication and admin role authorization.
    Accessible only by authenticated admins.
    """
    claims = get_jwt()
    current_user_id = claims['sub']['id']
    current_username = claims['sub']['username']
    current_role = claims['sub']['role']

    return format_response(
        data={
            "message": "Accesso alla route protetta riuscito!",
            "user_id": current_user_id,
            "username": current_username,
            "role": current_role
        },
        message="Protected route accessed successfully"
    ), 200
