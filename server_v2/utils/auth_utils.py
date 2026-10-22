"""
Authentication and Authorization Utilities for StudioDimaAI Server V2.
"""

import threading
import time
from functools import wraps
from flask_jwt_extended import get_jwt
from app_v2 import format_response

VALID_ROLES = ('admin', 'segreteria', 'aso', 'dottore', 'user')

# shortcut: contatore in memoria, vale per un solo processo e si azzera al riavvio; passare al DB se i processi diventano piu' di uno
MAX_FAILED_LOGINS = 5
LOGIN_WINDOW_SECONDS = 300
_failed_logins = {}
_failed_logins_lock = threading.Lock()


def login_blocked(username, now=None):
    """True se l'utente ha gia' MAX_FAILED_LOGINS login falliti negli ultimi LOGIN_WINDOW_SECONDS."""
    now = time.time() if now is None else now
    with _failed_logins_lock:
        recent = [t for t in _failed_logins.get(username.lower(), []) if now - t < LOGIN_WINDOW_SECONDS]
    return len(recent) >= MAX_FAILED_LOGINS


def record_failed_login(username, now=None):
    now = time.time() if now is None else now
    with _failed_logins_lock:
        _failed_logins.setdefault(username.lower(), []).append(now)
        # pota le voci scadute di tutti: username casuali non devono far crescere il dizionario
        for name in list(_failed_logins):
            _failed_logins[name] = [t for t in _failed_logins[name] if now - t < LOGIN_WINDOW_SECONDS]
            if not _failed_logins[name]:
                del _failed_logins[name]


def clear_failed_logins(username):
    with _failed_logins_lock:
        _failed_logins.pop(username.lower(), None)


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
