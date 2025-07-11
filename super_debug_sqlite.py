import os
import sys
import getpass
import sqlite3
from pathlib import Path

print("=== SUPER DEBUG SQLITE ===")

# Working directory
print(f"Working directory: {os.getcwd()}")

# Utente
try:
    print(f"Utente di sistema: {getpass.getuser()}")
except Exception as e:
    print(f"Utente di sistema: errore ({e})")

# Ambiente virtuale
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"Virtual env: {os.environ.get('VIRTUAL_ENV', 'None')}")

# Path del database
project_root = os.path.abspath(os.path.dirname(__file__))
db_rel_path = os.path.join('instance', 'users.db')
db_abs_path = os.path.join(project_root, db_rel_path)
print(f"Percorso relativo DB: {db_rel_path}")
print(f"Percorso assoluto DB: {db_abs_path}")

# Controllo esistenza file e permessi
if os.path.exists(db_abs_path):
    print(f"[OK] Il file esiste: {db_abs_path}")
    try:
        with open(db_abs_path, 'rb'): pass
        print("[OK] Permessi di lettura OK")
        with open(db_abs_path, 'ab'): pass
        print("[OK] Permessi di scrittura OK")
    except Exception as e:
        print(f"[ERRORE] Permessi file: {e}")
else:
    print(f"[ERRORE] Il file NON esiste: {db_abs_path}")

# Test creazione file temporaneo
try:
    test_path = os.path.join(project_root, 'instance', 'test_debug.txt')
    with open(test_path, 'w') as f:
        f.write('test')
    print(f"[OK] Creato file temporaneo: {test_path}")
    os.remove(test_path)
except Exception as e:
    print(f"[ERRORE] Creazione file temporaneo: {e}")

# Test apertura con sqlite3
try:
    conn = sqlite3.connect(db_abs_path)
    print("[OK] Connessione sqlite3 riuscita")
    conn.execute('SELECT name FROM sqlite_master WHERE type="table"')
    print("[OK] Query sqlite3 riuscita")
    conn.close()
except Exception as e:
    print(f"[ERRORE] sqlite3: {e}")

# Test apertura con SQLAlchemy
try:
    from sqlalchemy import create_engine, text
    engine = create_engine(f'sqlite:///{db_abs_path}')
    with engine.connect() as connection:
        print("[OK] Connessione SQLAlchemy riuscita")
        result = connection.execute(text('SELECT name FROM sqlite_master WHERE type="table"'))
        print("[OK] Query SQLAlchemy riuscita. Tabelle:", [row[0] for row in result])
except Exception as e:
    print(f"[ERRORE] SQLAlchemy: {e}")

print("=== FINE SUPER DEBUG ===") 