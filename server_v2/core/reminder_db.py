"""
SQLite schema e connessione PostgreSQL bot per reminder / conferme appuntamenti.
"""

import logging
import os
import sqlite3
import time
from pathlib import Path

from core.paths import STUDIO_DIMA_DB_PATH

logger = logging.getLogger(__name__)

_TABLES_ENSURED = False
_bot_db_cooldown_until = 0.0

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


def ensure_reminder_tables() -> None:
    global _TABLES_ENSURED
    if _TABLES_ENSURED:
        return
    try:
        conn = sqlite3.connect(str(STUDIO_DIMA_DB_PATH))
        conn.executescript(_REMINDER_SCHEMA_SQL)
        _migrate_sqlite(conn)
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


def get_bot_db_conn():
    """Connessione PostgreSQL studiobot con host primario + fallback e cooldown su errore."""
    import psycopg2

    global _bot_db_cooldown_until
    if time.time() < _bot_db_cooldown_until:
        raise psycopg2.OperationalError("BOT DB in cooldown (connessione recente fallita)")

    hosts: list[str] = []
    for key in ("BOT_DB_HOST", "BOT_DB_HOST_FALLBACK"):
        host = os.getenv(key, "").strip()
        if host and host not in hosts:
            hosts.append(host)
    if not hosts:
        hosts.append("127.0.0.1")

    port = int(os.getenv("BOT_DB_PORT", "5432"))
    database = os.getenv("BOT_DB_NAME", "studiobot")
    user = os.getenv("BOT_DB_USER", "studiobot")
    password = os.getenv("BOT_DB_PASSWORD", "")
    timeout = int(os.getenv("BOT_DB_CONNECT_TIMEOUT", "3"))

    last_err = None
    for host in hosts:
        try:
            return psycopg2.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                connect_timeout=timeout,
            )
        except Exception as e:
            last_err = e
            logger.debug(f"BOT DB non raggiungibile su {host}: {e}")

    _bot_db_cooldown_until = time.time() + int(os.getenv("BOT_DB_COOLDOWN_SEC", "300"))
    raise last_err
