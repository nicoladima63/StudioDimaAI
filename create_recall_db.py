import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()
DB_PATH = os.getenv('RECALL_DB_PATH', 'recall_db.db')

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Tabella messaggi
c.execute("""
CREATE TABLE IF NOT EXISTS message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL, -- 'richiamo' o 'promemoria'
    titolo TEXT,
    testo TEXT NOT NULL,
    attivo INTEGER DEFAULT 1,
    data_creazione DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_modifica DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")

# Tabella storico invii
c.execute("""
CREATE TABLE IF NOT EXISTS invio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL, -- 'richiamo' o 'promemoria'
    id_paziente TEXT,
    telefono TEXT NOT NULL,
    testo TEXT NOT NULL,
    stato TEXT,
    data_invio DATETIME DEFAULT CURRENT_TIMESTAMP,
    response TEXT
)
""")

conn.commit()
conn.close()

print(f"Database '{DB_PATH}' creato con successo!") 