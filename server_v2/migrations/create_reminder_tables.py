"""
Migration: crea tabelle per il sistema reminder appuntamenti.

Tabelle create:
- patient_communications: log di tutti i reminder inviati (WA e SMS)
- pazienti_wa_cache: cache stato WhatsApp per paziente
- appointment_confirmations: risposte SI/NO dei pazienti
"""

import sqlite3
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'instance',
    'studio_dima.db'
)


def run():
    print(f"Database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.executescript("""
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
    """)

    conn.commit()
    conn.close()
    print("Tabelle create: patient_communications, pazienti_wa_cache, appointment_confirmations")


if __name__ == '__main__':
    run()
