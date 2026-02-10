"""
Migration: Add 'type' field to sms_templates table.
Consente di categorizzare templates per uso: promemoria, richiami, social, newsletter, email_team.
"""
import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def run_migration(db_path: str = "instance/studio_dima.db"):
    """
    Aggiunge il campo 'type' alla tabella sms_templates.

    Valori possibili:
    - 'promemoria': Templates per SMS promemoria appuntamenti
    - 'richiami': Templates per SMS richiami pazienti
    - 'social': Templates per contenuti social media
    - 'newsletter': Templates per newsletter
    - 'email_team': Templates per email interne team
    """
    db_file = Path(db_path)
    if not db_file.exists():
        logger.error(f"Database not found: {db_path}")
        raise FileNotFoundError(f"Database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Verifica se la colonna esiste già
        cursor.execute("PRAGMA table_info(sms_templates)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'type' in columns:
            logger.info("Column 'type' already exists in sms_templates. Skipping migration.")
            return

        # Aggiungi colonna type con default 'promemoria'
        logger.info("Adding 'type' column to sms_templates table...")
        cursor.execute("""
            ALTER TABLE sms_templates
            ADD COLUMN type TEXT DEFAULT 'promemoria'
        """)

        # Crea indice per performance
        logger.info("Creating index on 'type' column...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sms_templates_type
            ON sms_templates(type)
        """)

        conn.commit()
        logger.info("Migration completed successfully!")

        # Log summary
        cursor.execute("SELECT COUNT(*) FROM sms_templates")
        total_count = cursor.fetchone()[0]
        logger.info(f"Updated {total_count} existing templates with default type='promemoria'")

    except Exception as e:
        conn.rollback()
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migration()
