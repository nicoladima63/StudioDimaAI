import os
import dbf
from datetime import datetime, date

# Prendi il percorso dal file env o usa un default
path = os.environ.get('PATH_APPUNTAMENTI_DBF', r'\\SERVERDIMA\Pixel\WINDENT\USER\APPUNTA.DBF')

print(f"Percorso usato: {path}")

try:
    table = dbf.Table(path, codepage='cp1252')
    table.open()
    count = 0
    for record in table:
        try:
            data = record['DB_APDATA']
            # Gestione tipo date, datetime o stringa
            if isinstance(data, (datetime, date)):
                if data.month == 7 and data.year == 2025:
                    count += 1
            elif isinstance(data, str):
                try:
                    d = datetime.strptime(data, "%Y-%m-%d")
                    if d.month == 7 and d.year == 2025:
                        count += 1
                except Exception:
                    pass
        except Exception as e:
            print("Errore su record:", e)
    print("Appuntamenti luglio 2025:", count)
    table.close()
except Exception as e:
    print(f"Errore nell'apertura o lettura del file: {e}") 