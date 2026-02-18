"""
Verifica contenuto tabella push_subscriptions
"""
import sqlite3
import os

db_path = os.path.join('instance', 'studio_dima.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Verifica se la tabella esiste
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'")
    table_exists = cursor.fetchone()

    if not table_exists:
        print("ERRORE: Tabella push_subscriptions non esiste!")
    else:
        print("Tabella push_subscriptions esiste.\n")

        # Conta record
        cursor.execute("SELECT COUNT(*) FROM push_subscriptions")
        count = cursor.fetchone()[0]
        print(f"Numero di sottoscrizioni: {count}\n")

        # Mostra tutti i record
        cursor.execute("SELECT * FROM push_subscriptions")
        rows = cursor.fetchall()

        if rows:
            print("Sottoscrizioni trovate:")
            print("-" * 80)
            for row in rows:
                print(f"ID: {row[0]}")
                print(f"User ID: {row[1]}")
                print(f"Endpoint: {row[2][:50]}...")
                print(f"Created: {row[5]}")
                print("-" * 80)
        else:
            print("Nessuna sottoscrizione trovata nella tabella.")
            print("\nPossibili cause:")
            print("1. L'utente non ha ancora cliccato sul toggle per sottoscriversi")
            print("2. La sottoscrizione non è stata salvata correttamente")
            print("3. C'è stato un errore durante il salvataggio")
            print("\nControlla i log del server per eventuali errori.")

except Exception as e:
    print(f"Errore durante la verifica: {e}")
finally:
    conn.close()
