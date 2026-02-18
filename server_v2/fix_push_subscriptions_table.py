"""
Fix push_subscriptions table - remove foreign key constraint
"""
import sqlite3
import os

# Path al database
db_path = os.path.join('instance', 'studio_dima.db')

# Connect al database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Drop della tabella esistente
    cursor.execute('DROP TABLE IF EXISTS push_subscriptions')

    # Ricrea la tabella SENZA foreign key (users è su db diverso)
    cursor.execute('''
        CREATE TABLE push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Crea indice su user_id per performance
    cursor.execute('CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id)')

    conn.commit()
    print("Tabella push_subscriptions ricreata con successo (senza foreign key)!")

    # Verifica la struttura
    cursor.execute("PRAGMA table_info(push_subscriptions)")
    columns = cursor.fetchall()
    print("\nStruttura della tabella:")
    for col in columns:
        print(f"  {col[1]}: {col[2]}")

except Exception as e:
    print(f"Errore: {e}")
    conn.rollback()
finally:
    conn.close()
