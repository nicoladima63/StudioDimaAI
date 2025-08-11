#!/usr/bin/env python3
"""
Script per analizzare i pattern attuali nella tabella categorizzazione_dettaglio_fattura
"""

import sqlite3
import pandas as pd
from pathlib import Path

# Connessione al database
db_path = 'server/instance/studio_dima.db'
conn = sqlite3.connect(db_path)

print("=== ANALISI PATTERN ATTUALI ===")

# 1. Visualizza struttura tabella
print("\n1. STRUTTURA TABELLA:")
cursor = conn.execute("PRAGMA table_info(categorizzazione_dettaglio_fattura)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]} ({col[2]}) - {col[3]}")

# 2. Conta tutti i pattern
print("\n2. CONTATORI:")
cursor = conn.execute("SELECT COUNT(*) FROM categorizzazione_dettaglio_fattura")
total = cursor.fetchone()[0]
print(f"  Totale pattern: {total}")

cursor = conn.execute("SELECT COUNT(*) FROM categorizzazione_dettaglio_fattura WHERE attivo = 1")
active = cursor.fetchone()[0]
print(f"  Pattern attivi: {active}")

# 3. Analizza conto_codice problematici
print("\n3. CONTO_CODICE PROBLEMATICI:")
cursor = conn.execute("""
    SELECT conto_codice, COUNT(*) as count
    FROM categorizzazione_dettaglio_fattura 
    WHERE conto_codice LIKE '%Z%' AND attivo = 1
    GROUP BY conto_codice 
    ORDER BY count DESC
""")
problematic_codes = cursor.fetchall()
for code, count in problematic_codes:
    print(f"  {code}: {count} pattern")

# 4. Esempi di pattern con ZZZZZZ
print("\n4. ESEMPI PATTERN CON ZZZZZZ:")
cursor = conn.execute("""
    SELECT pattern_descrizione, conto_codice, sottoconto_codice, categoria_contabile, priorita
    FROM categorizzazione_dettaglio_fattura 
    WHERE conto_codice LIKE '%Z%' AND attivo = 1
    LIMIT 10
""")
examples = cursor.fetchall()
for pattern, conto, sotto, cat, prio in examples:
    print(f"  '{pattern}' -> {conto}/{sotto} ({cat}) [prio: {prio}]")

# 5. Verifica conti reali disponibili
print("\n5. CONTI REALI DISPONIBILI:")
cursor = conn.execute("SELECT id, nome FROM conti ORDER BY nome LIMIT 10")
real_accounts = cursor.fetchall()
for acc_id, nome in real_accounts:
    print(f"  ID {acc_id}: {nome}")

# 6. Pattern più usati per categoria
print("\n6. CATEGORIE PIÙ COMUNI:")
cursor = conn.execute("""
    SELECT categoria_contabile, COUNT(*) as count
    FROM categorizzazione_dettaglio_fattura 
    WHERE attivo = 1
    GROUP BY categoria_contabile 
    ORDER BY count DESC
    LIMIT 10
""")
categories = cursor.fetchall()
for cat, count in categories:
    print(f"  {cat}: {count} pattern")

conn.close()
print("\n=== ANALISI COMPLETATA ===")