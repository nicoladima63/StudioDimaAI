"""
Authentication API V2 for StudioDimaAI.

Simple authentication system for testing V2 APIs with JWT tokens.
"""

import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity

from app_v2 import format_response
from core.exceptions import ValidationError


logger = logging.getLogger(__name__)

# Create blueprint con url_prefix per auth endpoints
auth_v2_bp = Blueprint('auth_v2', __name__, url_prefix='/auth')

# Test users for demo (in production this would be from database)
TEST_USERS = {
    'admin': {
        'password': 'password',
        'role': 'admin',
        'name': 'Administrator',
        'id': 1
    },
    'user': {
        'password': 'test123',
        'role': 'user', 
        'name': 'Test User',
        'id': 2
    },
    'demo': {
        'password': 'demo',
        'role': 'user',
        'name': 'Demo User',
        'id': 3
    }
}


@auth_v2_bp.route('/login', methods=['POST'])
def login():
    """
    Login endpoint to generate JWT tokens.
    
    Request Body:
        username (str): Username (required)
        password (str): Password (required)
        
    Returns:
        JSON response with access and refresh tokens
    """
    try:
        # Validate request data
        if not request.is_json:
            return format_response(
                success=False,
                error="Content-Type must be application/json"
            ), 400
        
        data = request.get_json()
        
        # Required fields validation
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not username or not password:
            return format_response(
                success=False,
                error="Username and password are required"
            ), 400
        
        # Authenticate user
        user = TEST_USERS.get(username)
        if not user or user['password'] != password:
            logger.warning(f"Failed login attempt for username: {username}")
            return format_response(
                success=False,
                error="Invalid credentials"
            ), 401
        
        # Create JWT tokens
        user_identity = {
            'id': user['id'],
            'username': username,
            'role': user['role'],
            'name': user['name']
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
                    'username': username,
                    'name': user['name'],
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


@auth_v2_bp.route('/refresh', methods=['POST'])
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


@auth_v2_bp.route('/me', methods=['GET'])
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


@auth_v2_bp.route('/logout', methods=['POST'])
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


@auth_v2_bp.route('/test-users', methods=['GET'])
def get_test_users():
    """
    Get list of test users for development/testing.
    
    Returns:
        JSON response with available test users
    """
    try:
        test_users_info = []
        for username, user_data in TEST_USERS.items():
            test_users_info.append({
                'username': username,
                'password': user_data['password'],
                'role': user_data['role'],
                'name': user_data['name']
            })
        
        return format_response(
            data={
                'test_users': test_users_info,
                'note': 'These are test credentials for V2 API development'
            },
            message="Test users information retrieved"
        ), 200
        
    except Exception as e:
        logger.error(f"Get test users error: {e}")
        return format_response(
            success=False,
            error="Failed to get test users"
        ), 500