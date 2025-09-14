"""
Script semplice per leggere GUIDA.DBF
"""

import os
import sys

# Aggiungi il path del progetto
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from utils.dbf_utils import DbfProcessor
    
    print("🔍 Leggendo GUIDA.DBF...")
    
    processor = DbfProcessor()
    df = processor.load_data("C:/windent/GUIDA.DBF")
    records = df.to_dict('records')
    
    print(f"📊 Trovati {len(records)} record")
    print()
    
    # Mostra i primi 10 record
    for i, record in enumerate(records[:10]):
        print(f"--- RECORD {i+1} ---")
        for key, value in record.items():
            if value is not None and str(value).strip():
                print(f"{key}: {value}")
        print()
    
    # Cerca parole chiave
    print("🔍 Cercando parole chiave...")
    keywords = ['path', 'config', 'database', 'appunta', 'user', 'dati']
    
    for record in records:
        for key, value in record.items():
            if value is not None:
                value_str = str(value).lower()
                for keyword in keywords:
                    if keyword in value_str:
                        print(f"TROVATO '{keyword}' in {key}: {value}")
    
except Exception as e:
    print(f"Errore: {e}")
    import traceback
    traceback.print_exc()
