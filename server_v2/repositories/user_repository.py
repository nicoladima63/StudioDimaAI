"""
User Repository for StudioDimaAI Server V2.

Handles all database operations related to the User model.
Connects to the dedicated 'users.db' database.
"""

import sqlite3
import logging
import os
from werkzeug.security import generate_password_hash, check_password_hash
from contextlib import contextmanager
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Construct an absolute path to the database file to make the connection robust
_current_dir = os.path.dirname(__file__)
DB_PATH = os.path.abspath(os.path.join(_current_dir, '..', 'instance', 'users.db'))

@contextmanager
def get_db_connection():
    """Provides a database connection context."""
    conn = None
    try:
        logger.debug(f"Connecting to user database at: {DB_PATH}")
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        yield conn
    except sqlite3.Error as e:
        logger.error(f"Database connection error to {DB_PATH}: {e}")
        raise
    finally:
        if conn:
            conn.close()

class UserRepository:
    """
    Manages User data persistence in the users.db database.
    """

    def find_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Finds a user by their username.

        Args:
            username: The username to search for.

        Returns:
            A dictionary representing the user, or None if not found.
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM user WHERE username = ?", (username,))
                user_row = cursor.fetchone()
                return dict(user_row) if user_row else None
        except sqlite3.Error as e:
            logger.error(f"Error finding user by username '{username}': {e}")
            return None

    def find_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Finds a user by their ID.

        Args:
            user_id: The ID of the user to search for.

        Returns:
            A dictionary representing the user, or None if not found.
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM user WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                return dict(user_row) if user_row else None
        except sqlite3.Error as e:
            logger.error(f"Error finding user by id {user_id}: {e}")
            return None

    def get_all(self) -> List[Dict[str, Any]]:
        """
        Retrieves all users from the database.

        Returns:
            A list of dictionaries, where each dictionary represents a user.
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, username, role, created_at FROM user ORDER BY username")
                users = cursor.fetchall()
                return [dict(row) for row in users]
        except sqlite3.Error as e:
            logger.error(f"Error getting all users: {e}")
            return []

    def create(self, username: str, password: str, role: str) -> Optional[Dict[str, Any]]:
        """
        Creates a new user in the database.

        Args:
            username: The username for the new user.
            password: The plain-text password for the new user.
            role: The role for the new user ('admin' or 'user').

        Returns:
            A dictionary representing the newly created user, or None on failure.
        """
        password_hash = generate_password_hash(password)
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO user (username, password_hash, role, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                    (username, password_hash, role)
                )
                conn.commit()
                new_user_id = cursor.lastrowid
                return self.find_by_id(new_user_id)
        except sqlite3.IntegrityError:
            logger.warning(f"Attempted to create a user with an existing username: {username}")
            return None
        except sqlite3.Error as e:
            logger.error(f"Error creating user '{username}': {e}")
            return None

    def update(self, user_id: int, username: Optional[str] = None, password: Optional[str] = None, role: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Updates an existing user's information.

        Args:
            user_id: The ID of the user to update.
            username: The new username (if changing).
            password: The new plain-text password (if changing).
            role: The new role (if changing).

        Returns:
            The updated user dictionary, or None if the user was not found or on failure.
        """
        fields = []
        params = []

        if username:
            fields.append("username = ?")
            params.append(username)
        if password:
            fields.append("password_hash = ?")
            params.append(generate_password_hash(password))
        if role:
            fields.append("role = ?")
            params.append(role)

        if not fields:
            return self.find_by_id(user_id) # No update to perform

        sql = f"UPDATE user SET {', '.join(fields)} WHERE id = ?"
        params.append(user_id)

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, tuple(params))
                conn.commit()
                if cursor.rowcount == 0:
                    return None # User not found
                return self.find_by_id(user_id)
        except sqlite3.Error as e:
            logger.error(f"Error updating user {user_id}: {e}")
            return None

    def delete(self, user_id: int) -> bool:
        """
        Deletes a user from the database.

        Args:
            user_id: The ID of the user to delete.

        Returns:
            True if the user was deleted, False otherwise.
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                # Also delete related credentials to maintain integrity
                cursor.execute("DELETE FROM google_credentials WHERE user_id = ?", (user_id,))
                cursor.execute("DELETE FROM user WHERE id = ?", (user_id,))
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.Error as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            return False
