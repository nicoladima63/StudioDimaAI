"""
Migration Script 001: Add SMS Tracking Tables

This script creates the necessary tables for the SMS link tracking feature:
- tipi_di_messaggi: Stores the types of messages that can be sent.
- sms_tracked_links: Stores unique, trackable links sent via SMS.

This script is idempotent and can be run multiple times safely.
"""

import os
import sys
import logging

# Aggiungi la root del progetto V2 al PYTHONPATH
#sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.database_manager import get_database_manager, DatabaseError

# Configura il logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def run_migration():
    """
    Executes the migration to create the SMS tracking tables.
    """
    logging.info("Starting migration: 001_add_sms_tracking_tables")

    db_manager = get_database_manager()

    logging.info(f"Database config: {vars(db_manager.config)}")
    conn_test = db_manager.get_connection()
    logging.info(f"Connected to: {getattr(conn_test, 'database', 'unknown path')}")
    conn_test.close()


    # SQL per creare la tabella tipi_di_messaggi
    create_tipi_messaggi_sql = """
    CREATE TABLE IF NOT EXISTS tipi_di_messaggi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codice TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        descrizione TEXT
    );
    """

    # SQL per creare le tabelle allineate al codice (tracked_links / tracked_clicks)
    create_tracked_links_sql = """
    CREATE TABLE IF NOT EXISTS tracked_links (
        id TEXT PRIMARY KEY,
        original_url TEXT NOT NULL,
        context_data TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """

    create_tracked_clicks_sql = """
    CREATE TABLE IF NOT EXISTS tracked_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (link_id) REFERENCES tracked_links (id)
    );
    """

    try:
        with db_manager.transaction() as conn:
            cursor = conn.cursor()

            logging.info("Creating table 'tipi_di_messaggi' if not exists...")
            cursor.execute(create_tipi_messaggi_sql)

            logging.info("Creating table 'tracked_links' if not exists...")
            cursor.execute(create_tracked_links_sql)

            logging.info("Creating table 'tracked_clicks' if not exists...")
            cursor.execute(create_tracked_clicks_sql)

            # Inserimento dei tipi di messaggio di default se non esistono già
            default_message_types = [
                ('PRIMA_VISITA_ANAGRAFICA', 'Prima Visita - Dati Anagrafici', 'Link per compilazione dati anagrafici pre-visita.'),
                ('ISTRUZIONI_ORTODONZIA', 'Istruzioni Ortodonzia', 'Istruzioni post-trattamento ortodontico.'),
                ('ISTRUZIONI_PROTESI', 'Istruzioni Manutenzione Protesi', 'Istruzioni per la manutenzione delle protesi.'),
                ('ISTRUZIONI_IGIENE', 'Istruzioni Igiene Orale', 'Consigli e istruzioni per una corretta igiene orale.'),
                ('PROMEMORIA_RICHIAMO', 'Promemoria Richiamo', 'Promemoria generico per il richiamo periodico.'),
                ('INVIO_RICETTA', 'Invio Ricetta', 'Invio di una ricetta medica.'),
            ]

            for codice, nome, descrizione in default_message_types:
                # Controlla se il tipo di messaggio esiste già per evitare duplicati
                cursor.execute("SELECT id FROM tipi_di_messaggi WHERE codice = ?", (codice,))
                if cursor.fetchone() is None:
                    logging.info(f"Inserting default message type: {nome}")
                    cursor.execute("INSERT INTO tipi_di_messaggi (codice, nome, descrizione) VALUES (?, ?, ?)",
                                   (codice, nome, descrizione))

        logging.info("✅ Migration 001 completed successfully.")

    except DatabaseError as e:
        logging.error(f"❌ Database error during migration: {e}")
        # La transazione verrà automaticamente annullata dal context manager
    except Exception as e:
        logging.error(f"❌ An unexpected error occurred during migration: {e}")

if __name__ == "__main__":
    run_migration()