import sqlite3

# Controlla le classificazioni per UMBRA
conn = sqlite3.connect('instance/studio_dima.db')
cursor = conn.execute('''
    SELECT codice_riferimento, tipo_di_costo, contoid, brancaid, sottocontoid 
    FROM classificazioni_costi 
    WHERE tipo_entita = 'fornitore' AND codice_riferimento LIKE '%UMBRA%'
''')

rows = cursor.fetchall()
print('Classificazioni UMBRA:')
for row in rows:
    print(f'  {row[0]} -> tipo_di_costo: {row[1]}, contoid: {row[2]}, brancaid: {row[3]}, sottocontoid: {row[4]}')

# Controlla tutti i fornitori classificati
cursor = conn.execute('''
    SELECT codice_riferimento, tipo_di_costo, contoid, brancaid, sottocontoid 
    FROM classificazioni_costi 
    WHERE tipo_entita = 'fornitore'
    ORDER BY codice_riferimento
''')

rows = cursor.fetchall()
print(f'\nTutti i fornitori classificati ({len(rows)}):')
for row in rows:
    print(f'  {row[0]} -> tipo_di_costo: {row[1]}, contoid: {row[2]}, brancaid: {row[3]}, sottocontoid: {row[4]}')

conn.close()
