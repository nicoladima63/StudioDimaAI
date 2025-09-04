#!/usr/bin/env python3
"""
Verifica struttura delle tabelle DBF per il mapping corretto
"""

import os
from dbfread import DBF

def check_dbf_structure():
    """Verifica struttura delle tabelle DBF"""
    
    dbf_files = {
        'VOCISPES.DBF': '../windent/DATI/VOCISPES.DBF',
        'SPESAFOR.DBF': '../windent/DATI/SPESAFOR.DBF', 
        'FORNITOR.DBF': '../windent/DATI/FORNITOR.DBF'
    }
    
    print("🔍 STRUTTURA TABELLE DBF")
    print("=" * 50)
    
    for table_name, file_path in dbf_files.items():
        print(f"\n📋 {table_name}")
        print("-" * 30)
        
        if not os.path.exists(file_path):
            print(f"❌ File non trovato: {file_path}")
            continue
        
        try:
            with DBF(file_path, encoding='latin-1') as table:
                print(f"Record totali: {len(table)}")
                print(f"Campi disponibili ({len(table.field_names)}):")
                
                for i, field in enumerate(table.field_names):
                    print(f"  {i+1:2d}. {field}")
                
                # Mostra primo record
                print(f"\nPrimo record:")
                first_record = next(iter(table))
                if first_record:
                    for field_name in table.field_names[:10]:  # Solo primi 10 campi
                        value = first_record.get(field_name)
                        if isinstance(value, bytes):
                            try:
                                decoded = value.decode('latin-1')
                                print(f"  {field_name}: {decoded}")
                            except:
                                print(f"  {field_name}: [errore decodifica]")
                        else:
                            print(f"  {field_name}: {value}")
                
        except Exception as e:
            print(f"❌ Errore lettura {table_name}: {e}")

if __name__ == "__main__":
    check_dbf_structure()
