import sqlite3

# Controlla tutti i fornitori classificati
conn = sqlite3.connect('instance/studio_dima.db')
cursor = conn.execute('''
    SELECT codice_riferimento, tipo_di_costo, contoid, brancaid, sottocontoid 
    FROM classificazioni_costi 
    WHERE tipo_entita = 'fornitore'
    ORDER BY codice_riferimento
''')

rows = cursor.fetchall()
print(f'Tutti i fornitori classificati ({len(rows)}):')
for row in rows:
    print(f'  {row[0]} -> tipo_di_costo: {row[1]}, contoid: {row[2]}, brancaid: {row[3]}, sottocontoid: {row[4]}')

# Controlla se esiste una tabella fornitori
try:
    cursor = conn.execute('SELECT name FROM sqlite_master WHERE type="table" AND name LIKE "%fornitore%"')
    tables = cursor.fetchall()
    print(f'\nTabelle fornitori trovate: {[t[0] for t in tables]}')
except:
    print('\nNessuna tabella fornitori trovata')

conn.close()
