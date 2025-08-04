#!/usr/bin/env python3
"""
Script temporaneo per analizzare la struttura dei file VOCISPES.DBF e CONTI.DBF
"""

import sys
import os
import pandas as pd

# Aggiungi il path del progetto per importare le funzioni
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.app.core.db_calendar import _get_dbf_path, _leggi_tabella_dbf

def analyze_dbf_structure(file_name, table_type):
    """Analizza la struttura di un file DBF"""
    print(f"\n=== ANALISI {file_name.upper()} ===")
    
    try:
        if table_type == 'vocispes':
            path = _get_dbf_path('dettagli_spese_fornitori')
        elif table_type == 'conti':
            # Dobbiamo controllare se esiste una configurazione per CONTI.DBF
            path = os.path.join(os.path.dirname(_get_dbf_path('spese_fornitori')), 'CONTI.DBF')
        else:
            print(f"Tipo tabella non riconosciuto: {table_type}")
            return
        
        print(f"Percorso file: {path}")
        
        if not os.path.exists(path):
            print(f"ERRORE: File {path} non trovato!")
            return
        
        # Leggi la tabella
        df = _leggi_tabella_dbf(path)
        
        if df.empty:
            print("La tabella è vuota!")
            return
        
        print(f"Numero di record: {len(df)}")
        print(f"Numero di colonne: {len(df.columns)}")
        
        print("\n--- STRUTTURA COLONNE ---")
        for i, col in enumerate(df.columns):
            dtype = df[col].dtype
            non_null_count = df[col].count()
            print(f"{i+1:2d}. {col:<15} | Tipo: {dtype} | Non-null: {non_null_count}")
        
        print("\n--- PRIMI 5 RECORD ---")
        for i, (_, row) in enumerate(df.head(5).iterrows()):
            print(f"\nRecord {i+1}:")
            for col in df.columns:
                val = row[col]
                if pd.isna(val):
                    val_str = "NULL"
                elif isinstance(val, bytes):
                    val_str = val.decode('latin-1', errors='ignore').strip()[:50]
                else:
                    val_str = str(val)[:50]
                print(f"  {col:<15}: {val_str}")
        
        # Analisi categorie per VOCISPES
        if table_type == 'vocispes':
            print("\n--- ANALISI DESCRIZIONI ARTICOLI (primi 20) ---")
            descrizioni = df['DB_VODESCR'].dropna()
            for i, desc in enumerate(descrizioni.head(20)):
                if isinstance(desc, bytes):
                    desc_str = desc.decode('latin-1', errors='ignore').strip()
                else:
                    desc_str = str(desc).strip()
                if desc_str:
                    print(f"{i+1:2d}. {desc_str}")
        
        # Analisi per CONTI
        if table_type == 'conti':
            print("\n--- ANALISI CONTI (primi 20) ---")
            # Cerchiamo una colonna che contenga la descrizione del conto
            for col in df.columns:
                if 'DESC' in col.upper() or 'NOME' in col.upper():
                    print(f"Colonna possibile descrizione: {col}")
                    descrizioni = df[col].dropna()
                    for i, desc in enumerate(descrizioni.head(20)):
                        if isinstance(desc, bytes):
                            desc_str = desc.decode('latin-1', errors='ignore').strip()
                        else:
                            desc_str = str(desc).strip()
                        if desc_str:
                            print(f"{i+1:2d}. {desc_str}")
                    break
        
    except Exception as e:
        print(f"ERRORE durante l'analisi: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("=== ANALISI STRUTTURA FILE DBF PER CATEGORIZZAZIONE SPESE ===")
    
    # Analizza VOCISPES.DBF
    analyze_dbf_structure('VOCISPES.DBF', 'vocispes')
    
    # Analizza CONTI.DBF
    analyze_dbf_structure('CONTI.DBF', 'conti')
    
    print("\n=== CONFRONTO E RACCOMANDAZIONI ===")
    print("""
    VOCISPES.DBF contiene i dettagli delle voci di spesa delle fatture fornitori.
    Ogni record rappresenta una riga di fattura con descrizione specifica dell'articolo/servizio.
    
    CONTI.DBF contiene il piano dei conti contabile.
    Ogni record rappresenta un conto contabile con codice e descrizione.
    
    Per la categorizzazione automatica delle spese:
    - VOCISPES.DBF è più utile per categorizzare in base al CONTENUTO specifico
    - CONTI.DBF è più utile per la STRUTTURA CONTABILE finale
    
    Strategia raccomandata:
    1. Usare VOCISPES.DBF per analizzare le descrizioni degli articoli/servizi
    2. Creare regole di categorizzazione basate sui pattern trovati
    3. Mappare le categorie ai conti di CONTI.DBF per la contabilità
    """)

if __name__ == "__main__":
    main()