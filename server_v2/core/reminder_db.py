"""
SQLite schema e helpers per reminder / conferme appuntamenti.
"""

import logging
import sqlite3
from pathlib import Path

from core.paths import STUDIO_DIMA_DB_PATH

logger = logging.getLogger(__name__)

_TABLES_ENSURED = False

_REMINDER_SCHEMA_SQL = """
    CREATE TABLE IF NOT EXISTS patient_communications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT NOT NULL,
        patient_name TEXT,
        phone TEXT,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        appointment_date TEXT,
        appointment_time TEXT,
        stato TEXT DEFAULT 'sent',
        message_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pc_patient_date
        ON patient_communications(patient_id, appointment_date, appointment_time, type);
    CREATE INDEX IF NOT EXISTS idx_pc_phone
        ON patient_communications(phone, appointment_date);
    CREATE TABLE IF NOT EXISTS pazienti_wa_cache (
        patient_id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        has_whatsapp INTEGER DEFAULT NULL,
        wa_jid TEXT,
        checked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS appointment_confirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        phone TEXT NOT NULL,
        appointment_date TEXT,
        appointment_time TEXT,
        response TEXT,
        communication_id INTEGER,
        received_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS studio_opening_hours (
        day_of_week INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        continuous_hours INTEGER DEFAULT 0,
        morning_start TEXT,
        morning_end TEXT,
        afternoon_start TEXT,
        afternoon_end TEXT,
        fascia_unica_start TEXT,
        fascia_unica_end TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
"""


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    except sqlite3.Error:
        return set()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, ddl: str):
    if column not in _table_columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def _migrate_sqlite(conn: sqlite3.Connection):
    """Aggiorna tabelle create da versioni precedenti dello schema."""
    if "patient_communications" in {
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }:
        _add_column_if_missing(conn, "patient_communications", "stato", "stato TEXT DEFAULT 'sent'")
        _add_column_if_missing(conn, "patient_communications", "message_id", "message_id TEXT")
        _add_column_if_missing(conn, "patient_communications", "created_at", "created_at TEXT")

    if "appointment_confirmations" in {
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }:
        _add_column_if_missing(conn, "appointment_confirmations", "response", "response TEXT")
        _add_column_if_missing(
            conn, "appointment_confirmations", "communication_id", "communication_id INTEGER"
        )
        _add_column_if_missing(conn, "appointment_confirmations", "received_at", "received_at TEXT")


def _insert_default_studio_hours(conn: sqlite3.Connection):
    """Inserisce i dati di default per orari studio se tabella è vuota."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM studio_opening_hours")
        if cur.fetchone()[0] > 0:
            return  # Dati già presenti
        
        # Inserisci i tuoi orari
        default_hours = [
            (1, 'Lunedì',    1, 0, '09:00', '13:00', '15:00', '19:00', None, None),
            (2, 'Martedì',   1, 1, None, None, None, None, '09:00', '16:00'),
            (3, 'Mercoledì', 1, 0, '09:00', '13:00', '15:00', '19:00', None, None),
            (4, 'Giovedì',   1, 0, '09:00', '13:00', '15:00', '19:00', None, None),
            (5, 'Venerdì',   1, 1, None, None, None, None, '09:00', '16:00'),
            (6, 'Sabato',    0, 0, '09:00', '13:00', None, None, None, None),
            (7, 'Domenica',  0, 0, None, None, None, None, None, None),
        ]
        
        cur.executemany("""
            INSERT OR IGNORE INTO studio_opening_hours 
            (day_of_week, name, enabled, continuous_hours, morning_start, morning_end, 
             afternoon_start, afternoon_end, fascia_unica_start, fascia_unica_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, default_hours)
        conn.commit()
    except Exception as e:
        logger.warning(f"Errore inserimento default studio hours: {e}")


def ensure_reminder_tables() -> None:
    global _TABLES_ENSURED
    if _TABLES_ENSURED:
        # Anche se già assicurato, verifica che studio_opening_hours esista
        try:
            conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
            existing_tables = {
                r[0] for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            conn.close()
            
            if "studio_opening_hours" not in existing_tables:
                # Tabella manca, creala e popola
                conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS studio_opening_hours (
                        day_of_week INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        enabled INTEGER DEFAULT 1,
                        continuous_hours INTEGER DEFAULT 0,
                        morning_start TEXT,
                        morning_end TEXT,
                        afternoon_start TEXT,
                        afternoon_end TEXT,
                        fascia_unica_start TEXT,
                        fascia_unica_end TEXT,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                _insert_default_studio_hours(conn)
                conn.commit()
                conn.close()
        except Exception as e:
            logger.warning(f"Errore verifica tabella studio_opening_hours: {e}")
        return
    
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.executescript(_REMINDER_SCHEMA_SQL)
        _migrate_sqlite(conn)
        _insert_default_studio_hours(conn)
        conn.commit()
        conn.close()
        _TABLES_ENSURED = True
    except Exception as e:
        logger.error(f"Errore creazione/migrazione tabelle reminder: {e}")


def is_appointment_confirmed(
    patient_id: str, ap_date: str, ap_time: str
) -> bool:
    """True se il paziente ha già confermato (SI) per questo appuntamento."""
    ensure_reminder_tables()
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        cur = conn.cursor()
        pc_cols = _table_columns(conn, "patient_communications")

        if "stato" in pc_cols:
            cur.execute(
                """
                SELECT 1 FROM patient_communications
                WHERE patient_id = ? AND appointment_date = ? AND appointment_time = ?
                  AND stato = 'confirmed'
                LIMIT 1
                """,
                (patient_id, ap_date, ap_time),
            )
            if cur.fetchone():
                conn.close()
                return True

        ac_cols = _table_columns(conn, "appointment_confirmations")
        if "response" in ac_cols:
            cur.execute(
                """
                SELECT 1 FROM appointment_confirmations
                WHERE patient_id = ? AND appointment_date = ? AND appointment_time = ?
                  AND response = 'confirmed'
                LIMIT 1
                """,
                (patient_id, ap_date, ap_time),
            )
            found = cur.fetchone() is not None
            conn.close()
            return found

        conn.close()
        return False
    except Exception as e:
        logger.warning(f"Errore check confirmed: {e}")
        return False


