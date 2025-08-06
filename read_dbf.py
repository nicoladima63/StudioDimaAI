#!/usr/bin/env python3
"""
Script per leggere tabelle DBF del gestionale
Uso: python read_dbf.py NOME_TABELLA [numero_record]
"""
import sys
import os
from dbfread import DBF

def read_dbf_table(table_name, max_records=5):
    # Percorso base delle tabelle DBF
    base_path = "server/windent/DATI"
    table_path = os.path.join(base_path, f"{table_name}.DBF")
    
    if not os.path.exists(table_path):
        print(f"Errore: tabella {table_path} non trovata")
        return
    
    try:
        print(f"=== {table_name}.DBF ===")
        table = DBF(table_path, encoding='latin1')
        print(f"Campi: {table.field_names}")
        print(f"Totale record: {len(list(table))}")
        print()
        
        # Reset table iterator
        table = DBF(table_path, encoding='latin1')
        
        count = 0
        for record in table:
            if count >= max_records:
                break
                
            print(f"Record {count+1}:")
            for field_name in table.field_names:
                value = record.get(field_name)
                if value is not None and str(value).strip():
                    print(f"  {field_name}: {value}")
            print()
            count += 1
            
        print(f"Mostrati {count} record di {len(list(table))}")
        
    except Exception as e:
        print(f"Errore leggendo {table_name}: {e}")

def search_in_table(table_name, search_term):
    """Cerca un termine in tutti i campi della tabella"""
    base_path = "server/windent/DATI"
    table_path = os.path.join(base_path, f"{table_name}.DBF")
    
    if not os.path.exists(table_path):
        print(f"Errore: tabella {table_path} non trovata")
        return
    
    try:
        table = DBF(table_path, encoding='latin1')
        print(f"=== Cercando '{search_term}' in {table_name}.DBF ===")
        
        found = 0
        count = 0
        for record in table:
            count += 1
            match_found = False
            matched_fields = []
            
            for field_name in table.field_names:
                value = record.get(field_name)
                if value and search_term.lower() in str(value).lower():
                    match_found = True
                    matched_fields.append(f"{field_name}: {value}")
            
            if match_found:
                found += 1
                print(f"Record {count}:")
                for field_info in matched_fields:
                    print(f"  {field_info}")
                print()
                
                if found >= 10:  # Limita risultati
                    print("... (limitato a 10 risultati)")
                    break
        
        print(f"Trovati {found} record con '{search_term}'")
        
    except Exception as e:
        print(f"Errore cercando in {table_name}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python read_dbf.py NOME_TABELLA [numero_record|search:termine]")
        print("Esempi:")
        print("  python read_dbf.py CONTI")
        print("  python read_dbf.py CONTI 10")  
        print("  python read_dbf.py CONTI search:collaboratori")
        sys.exit(1)
    
    table_name = sys.argv[1].upper()
    
    if len(sys.argv) > 2:
        param = sys.argv[2]
        if param.startswith("search:"):
            search_term = param[7:]  # Remove "search:" prefix
            search_in_table(table_name, search_term)
        else:
            try:
                max_records = int(param)
                read_dbf_table(table_name, max_records)
            except ValueError:
                print("Errore: il secondo parametro deve essere un numero o search:termine")
                sys.exit(1)
    else:
        read_dbf_table(table_name)