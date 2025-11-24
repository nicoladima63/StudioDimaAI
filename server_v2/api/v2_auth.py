"""
Authentication API V2 for StudioDimaAI.

Simple authentication system for testing V2 APIs with JWT tokens.
"""

import logging
from datetime import datetime, timedelta
from flask import Blueprint, request
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash

from app_v2 import format_response
from core.exceptions import ValidationError
from repositories.user_repository import UserRepository


logger = logging.getLogger(__name__)

# Create blueprint (url_prefix will be added at registration)
auth_v2_bp = Blueprint('auth_v2', __name__)

@auth_v2_bp.route('/auth/register', methods=['POST'])
def register():
    """
    Register a new user.
    
    Request Body:
        username (str): Username (required)
        password (str): Password (required)
        
    Returns:
        JSON response confirming registration
    """
    try:
        if not request.is_json:
            return format_response(success=False, error="Content-Type must be application/json"), 400
        
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        if not username or not password:
            return format_response(success=False, error="Username and password are required"), 400
        
        if len(password) < 6:
            return format_response(success=False, error="Password must be at least 6 characters long"), 400

        user_repo = UserRepository()

        # Check if user already exists
        if user_repo.find_by_username(username):
            return format_response(success=False, error="Username already exists"), 409

        # Create new user with 'user' role by default
        new_user = user_repo.create(username, password, 'user')

        if not new_user:
            return format_response(success=False, error="Failed to create user due to a server error"), 500

        logger.info(f"New user registered: {username}")
        return format_response(message="User registered successfully. You can now log in."), 201

    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        return format_response(success=False, error="Registration failed due to a server error"), 500


@auth_v2_bp.route('/auth/login', methods=['POST'])
def login():
    """
    Login endpoint to generate JWT tokens.
    """
    try:
        if not request.is_json:
            return format_response(
                success=False,
                error="Content-Type must be application/json"
            ), 400
        
        data = request.get_json()
        
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not username or not password:
            return format_response(
                success=False,
                error="Username and password are required"
            ), 400
        
        # Authenticate user against the database
        user_repo = UserRepository()
        user = user_repo.find_by_username(username)
        
        # --- DETAILED DEBUG LOGGING ---
        if user:
            logger.info(f"DEBUG: Password ricevuta: '{password}'")
            logger.info(f"DEBUG: Hash dal DB: '{user['password_hash']}'")
            is_password_correct = check_password_hash(user['password_hash'], password)
            logger.info(f"DEBUG: check_password_hash ha restituito: {is_password_correct}")
        else:
            logger.warning(f"DEBUG: Utente '{username}' non trovato nel database.")
        # --- END DETAILED DEBUG LOGGING ---

        if not user or not check_password_hash(user['password_hash'], password):
            logger.warning(f"Failed login attempt for username: {username}")
            return format_response(
                success=False,
                error="Invalid credentials"
            ), 401
        
        # Create JWT tokens
        user_identity = {
            'id': user['id'],
            'username': user['username'],
            'role': user['role']
        }
        
        access_token = create_access_token(
            identity=user_identity,
            expires_delta=timedelta(hours=24)
        )
        
        refresh_token = create_refresh_token(
            identity=user_identity,
            expires_delta=timedelta(days=30)
        )
        
        logger.info(f"Successful login for user: {username}")
        
        return format_response(
            data={
                'access_token': access_token,
                'refresh_token': refresh_token,
                'token_type': 'Bearer',
                'expires_in': 24 * 3600,  # 24 hours in seconds
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'role': user['role']
                }
            },
            message="Login successful"
        ), 200
        
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return format_response(
            success=False,
            error="Login failed due to server error"
        ), 500


@auth_v2_bp.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token.
    
    Returns:
        JSON response with new access token
    """
    try:
        current_user = get_jwt_identity()
        
        # Create new access token
        new_access_token = create_access_token(
            identity=current_user,
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"Token refreshed for user: {current_user.get('username')}")
        
        return format_response(
            data={
                'access_token': new_access_token,
                'token_type': 'Bearer',
                'expires_in': 24 * 3600
            },
            message="Token refreshed successfully"
        ), 200
        
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return format_response(
            success=False,
            error="Token refresh failed"
        ), 500


@auth_v2_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get current user information from JWT token.
    
    Returns:
        JSON response with user information
    """
    try:
        current_user = get_jwt_identity()
        
        return format_response(
            data={
                'user': current_user,
                'authenticated': True
            },
            message="User information retrieved successfully"
        ), 200
        
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        return format_response(
            success=False,
            error="Failed to get user information"
        ), 500


@auth_v2_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout endpoint (for completeness - JWT is stateless).
    
    Returns:
        JSON response confirming logout
    """
    try:
        current_user = get_jwt_identity()
        username = current_user.get('username', 'unknown')
        
        logger.info(f"User logged out: {username}")
        
        return format_response(
            message="Logout successful"
        ), 200
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return format_response(
            success=False,
            error="Logout failed"
        ), 500