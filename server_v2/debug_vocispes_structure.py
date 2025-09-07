#!/usr/bin/env python3
"""
Debug per controllare la struttura della tabella VOCISPES.DBF
"""

import os
from dbfread import DBF

def debug_vocispes_structure():
    """Debug della struttura VOCISPES.DBF"""
    
    print("STRUTTURA VOCISPES.DBF")
    print("=" * 50)
    
    # Percorso del file DBF
    vocispes_path = os.path.join('..', 'windent', 'DATI', 'VOCISPES.DBF')
    
    try:
        with DBF(vocispes_path, encoding='latin-1') as vocispes_table:
            print(f"File: {vocispes_path}")
            print(f"Numero record: {len(vocispes_table)}")
            print()
            
            # Prendi il primo record per vedere la struttura
            first_record = None
            for record in vocispes_table:
                if record is not None:
                    first_record = record
                    break
            
            if first_record:
                print("CAMPI DISPONIBILI:")
                print("-" * 30)
                for field_name, value in first_record.items():
                    print(f"  {field_name}: {value} ({type(value).__name__})")
                
                print()
                print("PRIMI 5 RECORD:")
                print("-" * 30)
                
                # Mostra i primi 5 record
                count = 0
                for record in vocispes_table:
                    if record is None:
                        continue
                    
                    count += 1
                    if count > 5:
                        break
                    
                    print(f"RECORD {count}:")
                    for field_name, value in record.items():
                        if value and str(value).strip():
                            print(f"  {field_name}: {value}")
                    print()
                
                # Cerca record con ZZZWOI
                print("RICERCA FATTURA ZZZWOI:")
                print("-" * 30)
                found_records = 0
                for record in vocispes_table:
                    if record is None:
                        continue
                    
                    # Controlla tutti i campi per ZZZWOI
                    for field_name, value in record.items():
                        if str(value).strip() == 'ZZZWOI':
                            found_records += 1
                            print(f"TROVATO in campo {field_name}: {value}")
                            print("Record completo:")
                            for fname, fvalue in record.items():
                                if fvalue and str(fvalue).strip():
                                    print(f"  {fname}: {fvalue}")
                            print()
                            break
                
                if found_records == 0:
                    print("❌ Nessun record trovato con ZZZWOI")
                else:
                    print(f"✅ Trovati {found_records} record con ZZZWOI")
                    
            else:
                print("❌ Nessun record trovato nel file")
                
    except Exception as e:
        print(f"❌ Errore: {e}")

if __name__ == "__main__":
    debug_vocispes_structure()
