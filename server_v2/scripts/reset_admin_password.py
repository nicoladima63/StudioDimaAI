import sqlite3
import sys
from werkzeug.security import generate_password_hash

DB_PATH = 'server_v2/instance/users.db'
ADMIN_USERNAME = 'admin'

def reset_admin_password(new_password):
    """Resets the password for the admin user."""
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Check if admin user exists
        cursor.execute("SELECT id FROM user WHERE username = ?", (ADMIN_USERNAME,))
        user = cursor.fetchone()

        if not user:
            print(f"Errore: L'utente '{ADMIN_USERNAME}' non è stato trovato nel database.")
            return

        # Generate new password hash
        password_hash = generate_password_hash(new_password)

        # Update the password
        cursor.execute("UPDATE user SET password_hash = ? WHERE username = ?", (password_hash, ADMIN_USERNAME))
        conn.commit()

        if cursor.rowcount > 0:
            print(f"Password per l'utente '{ADMIN_USERNAME}' aggiornata con successo.")
            print(f"La nuova password è: {new_password}")
        else:
            print("Errore: Impossibile aggiornare la password.")

    except sqlite3.Error as e:
        print(f"Errore del database: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Default password is 'password' if not provided as an argument
    new_pass = sys.argv[1] if len(sys.argv) > 1 else 'password'
    reset_admin_password(new_pass)
