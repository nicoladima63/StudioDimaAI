"""
Script per leggere il file GUIDA.DBF e analizzare il contenuto
per capire la configurazione del gestionale Windent.
"""

import os
import sys
from pathlib import Path

# Aggiungi il path del progetto
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.dbf_utils import get_optimized_reader


def read_guida_dbf():
    """Legge e analizza il file GUIDA.DBF."""
    
    guida_path = Path("C:/windent/GUIDA.DBF")
    
    if not guida_path.exists():
        print(f"❌ File non trovato: {guida_path}")
        return
    
    print(f"📖 Leggendo file: {guida_path}")
    print("=" * 60)
    
    try:
        # Usa il reader ottimizzato
        reader = get_optimized_reader()
        
        # Leggi il file GUIDA.DBF
        records = reader.read_dbf_file(str(guida_path))
        
        print(f"📊 Trovati {len(records)} record")
        print()
        
        # Analizza i record
        for i, record in enumerate(records):
            print(f"--- RECORD {i+1} ---")
            
            # Stampa tutte le chiavi e valori
            for key, value in record.items():
                if value is not None and str(value).strip():
                    print(f"{key}: {value}")
            
            print()
            
            # Limita a 20 record per evitare output troppo lungo
            if i >= 19:
                print(f"... (mostrati solo i primi 20 record su {len(records)})")
                break
        
        # Cerca parole chiave interessanti
        print("🔍 RICERCA PAROLE CHIAVE:")
        print("=" * 40)
        
        keywords = [
            'path', 'percorso', 'cartella', 'directory', 'database', 'dbf',
            'appunta', 'appuntamenti', 'config', 'configurazione', 'settings',
            'server', 'remoto', 'locale', 'work', 'data', 'dati',
            'sync', 'sincronizzazione', 'backup', 'temp', 'temporaneo'
        ]
        
        found_keywords = {}
        
        for record in records:
            for key, value in record.items():
                if value is not None:
                    value_str = str(value).lower()
                    for keyword in keywords:
                        if keyword in value_str:
                            if keyword not in found_keywords:
                                found_keywords[keyword] = []
                            found_keywords[keyword].append(f"{key}: {value}")
        
        if found_keywords:
            for keyword, matches in found_keywords.items():
                print(f"\n🔑 '{keyword.upper()}':")
                for match in matches[:3]:  # Mostra max 3 match per keyword
                    print(f"  - {match}")
                if len(matches) > 3:
                    print(f"  ... e altri {len(matches) - 3} match")
        else:
            print("Nessuna parola chiave interessante trovata")
        
        # Cerca campi che potrebbero contenere path
        print("\n📁 POSSIBILI PATH/CONFIGURAZIONI:")
        print("=" * 40)
        
        path_fields = []
        for record in records:
            for key, value in record.items():
                if value is not None:
                    value_str = str(value)
                    # Cerca pattern che sembrano path
                    if any(pattern in value_str.lower() for pattern in ['c:\\', 'd:\\', '/', '\\', 'path', 'dir']):
                        path_fields.append(f"{key}: {value}")
        
        if path_fields:
            for path_field in path_fields[:10]:  # Mostra max 10
                print(f"  - {path_field}")
        else:
            print("Nessun path identificato")
            
    except Exception as e:
        print(f"❌ Errore durante la lettura: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Funzione principale."""
    print("🔍 ANALISI FILE GUIDA.DBF")
    print("=" * 60)
    print("Obiettivo: Trovare informazioni sulla configurazione del gestionale")
    print()
    
    read_guida_dbf()
    
    print("\n" + "=" * 60)
    print("✅ Analisi completata")


if __name__ == "__main__":
    main()
