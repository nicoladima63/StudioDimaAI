"""
Authentication and Authorization Utilities for StudioDimaAI Server V2.
"""

from functools import wraps
from flask_jwt_extended import get_jwt
from app_v2 import format_response

def roles_required(*required_roles):
    """
    Decorator to ensure a user has at least one of the required roles.
    Assumes that the user's role is stored in the 'role' claim of the JWT.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            user_roles = claims.get('sub', {}).get('role')

            if user_roles is None:
                return format_response(success=False, error="Missing role in token"), 403

            # In our case, role is a single string, not a list
            if isinstance(user_roles, str):
                user_roles = [user_roles]

            # Check for intersection of roles
            if not any(role in user_roles for role in required_roles):
                return format_response(
                    success=False, 
                    error=f"Access forbidden: Requires one of the following roles: {', '.join(required_roles)}"
                ), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator
