import os
import sys
from datetime import datetime
import pandas as pd
import dbf
import logging

# Percorsi hardcoded (modifica se necessario)
PATH_APPUNTAMENTI = r'\\SERVERDIMA\Pixel\WINDENT\USER\APPUNTA.DBF'
PATH_ANAGRAFICA = r'\\SERVERDIMA\Pixel\WINDENT\DATI\PAZIENTI.DBF'

# Colonne (modifica se necessario)
COL_DATA = 'DB_APDATA'
COL_ID_PAZ = 'DB_APPACOD'
COL_ORA_INIZIO = 'DB_APOREIN'
COL_ORA_FINE = 'DB_APOREOU'
COL_TIPO = 'DB_GUARDIA'
COL_NOTE = 'DB_NOTE'
COL_DESCRIZIONE = 'DB_APDESCR'

COL_NOME = 'DB_PANOME'

logger = logging.getLogger(__name__)

def leggi_tabella_dbf(percorso_file):
    with dbf.Table(percorso_file, codepage='cp1252') as table:
        records = []
        for record in table:
            record_dict = {field: record[field] for field in table.field_names}
            records.append(record_dict)
        return pd.DataFrame(records)

def estrai_appuntamenti_per_mese(mese, anno):
    df = leggi_tabella_dbf(PATH_APPUNTAMENTI)
    if COL_DATA not in df.columns:
        print('Colonna data non trovata!')
        return []
    df[COL_DATA] = pd.to_datetime(df[COL_DATA], errors='coerce')
    filtrati = df[(df[COL_DATA].dt.month == mese) & (df[COL_DATA].dt.year == anno)]
    return filtrati

def main():
    mese = int(input('Inserisci il mese (numero 1-12): '))
    anno = int(input('Inserisci l\'anno (es: 2025): '))
    appuntamenti = estrai_appuntamenti_per_mese(mese, anno)
    if appuntamenti.empty:
        print('Nessun appuntamento trovato per questo mese.')
        return
    print(f"Trovati {len(appuntamenti)} appuntamenti:")
    for idx, row in appuntamenti.iterrows():
        data_str = row.get(COL_DATA).strftime('%d/%m/%Y') if pd.notnull(row.get(COL_DATA)) else ''
        print(f"- Data: {data_str}, Ora: {row.get(COL_ORA_INIZIO)}-{row.get(COL_ORA_FINE)}, Paziente ID: {row.get(COL_ID_PAZ)}, Tipo: {row.get(COL_TIPO)}, Note: {row.get(COL_NOTE)}, Descrizione: {row.get(COL_DESCRIZIONE)}")

if __name__ == '__main__':
    logger.info(f"PATH_APPUNTAMENTI_DBF env: {os.environ.get('PATH_APPUNTAMENTI_DBF')}")
    logger.info(f"PATH_ANAGRAFICA_DBF env: {os.environ.get('PATH_ANAGRAFICA_DBF')}")
    main() 