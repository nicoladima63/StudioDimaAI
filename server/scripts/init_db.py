import sys
import os
import sqlite3

# Aggiungi la directory principale del progetto al PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

def create_database_with_sqlite():
    """Crea il database usando SQLite direttamente, senza SQLAlchemy"""
    
    # Percorso del database
    db_path = os.path.join(os.getcwd(), 'instance', 'users.db')
    
    # Crea la directory se non esiste
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    print(f"Creando database in: {db_path}")
    
    # Connessione diretta a SQLite
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Elimina tabella se esiste
        cursor.execute("DROP TABLE IF EXISTS user")
        
        # Crea tabella user
        cursor.execute("""
            CREATE TABLE user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(80) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Hash della password (semplificato per il test)
        from werkzeug.security import generate_password_hash
        password_hash = generate_password_hash("admin123")
        
        # Inserisci utente admin
        cursor.execute("""
            INSERT INTO user (username, password_hash, role)
            VALUES (?, ?, ?)
        """, ("admin", password_hash, "admin"))
        
        # Commit delle modifiche
        conn.commit()
        
        # Verifica
        cursor.execute("SELECT * FROM user")
        users = cursor.fetchall()
        
        print("✅ Database creato con successo!")
        print(f"📊 Utenti nel database: {len(users)}")
        for user in users:
            print(f"   - ID: {user[0]}, Username: {user[1]}, Role: {user[3]}")
        
        print(f"✅ File database: {db_path}")
        print(f"📏 Dimensione: {os.path.getsize(db_path)} bytes")
        
    except Exception as e:
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        conn.close()

def test_with_sqlalchemy():
    """Test se ora SQLAlchemy funziona con il database creato"""
    try:
        from server.app.run import create_app
        from server.app.extensions import db
        from server.app.models.user import User
        
        app = create_app()
        
        with app.app_context():
            # Prova a interrogare il database
            users = User.query.all()
            print(f"🔍 Test SQLAlchemy: {len(users)} utenti trovati")
            for user in users:
                print(f"   - {user.username} ({user.role})")
                
    except Exception as e:
        print(f"⚠️  Test SQLAlchemy fallito: {e}")

def create_table_acquisti_materiali(db_path: str):
    """Crea la tabella acquisti_materiali se non esiste già."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS acquisti_materiali (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        materiale_id INTEGER NOT NULL,
        data_acquisto DATE NOT NULL,
        quantita REAL,
        prezzo_unitario REAL,
        fornitore_id INTEGER,
        numero_fattura TEXT,
        UNIQUE(materiale_id, data_acquisto, numero_fattura)
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    print("=== Creazione database con SQLite puro ===")
    create_database_with_sqlite()
    
    print("\n=== Test con SQLAlchemy ===")
    test_with_sqlalchemy()