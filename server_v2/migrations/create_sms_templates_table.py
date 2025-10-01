import sqlite3
import os
from datetime import datetime

# Percorso al database (assumendo che lo script sia nella root del progetto)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance', 'studio_dima.db')

def create_sms_templates_table():
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sms_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("Tabella 'sms_templates' creata o già esistente.")

        # Inserisci i template predefiniti se non esistono già
        default_templates = [
            ('appointment_reminder', 'Gentile {nome}, ricordiamo il suo appuntamento del {data} alle ore {ora}. Studio Dima', 'Promemoria appuntamento'),
            ('appointment_confirmation', 'Gentile {nome}, confermiamo il suo appuntamento del {data} alle ore {ora}. Studio Dima', 'Conferma appuntamento'),
            ('appointment_cancellation', 'Gentile {nome}, il suo appuntamento del {data} alle ore {ora} è stato annullato. Studio Dima', 'Cancellazione appuntamento'),
            ('recall_reminder', 'Gentile {nome}, è tempo per il suo {tipo_richiamo}. Contatti lo studio per fissare un appuntamento. Studio Dima', 'Promemoria richiamo'),
            ('treatment_reminder', 'Gentile {nome}, ricordiamo di completare il trattamento come concordato. Studio Dima', 'Promemoria trattamento'),
            ('send_link', 'Ciao {nome_completo}, informazioni utili: {url}', 'Invio link generico') # Il template che ci serviva!
        ]

        for name, content, description in default_templates:
            try:
                cursor.execute("INSERT INTO sms_templates (name, content, description) VALUES (?, ?, ?)", (name, content, description))
                print(f"Template '{name}' inserito.")
            except sqlite3.IntegrityError:
                print(f"Template '{name}' già esistente, saltato.")
        conn.commit()

    except sqlite3.Error as e:
        print(f"Errore SQLite: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_sms_templates_table()
