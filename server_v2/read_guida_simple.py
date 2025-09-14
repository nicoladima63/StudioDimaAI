"""
Script per leggere GUIDA.DBF usando dbfread
"""

try:
    from dbfread import DBF
    
    print("🔍 Leggendo GUIDA.DBF con dbfread...")
    
    # Leggi il file DBF
    table = DBF('C:/windent/GUIDA.DBF')
    
    print(f"📊 Trovati {len(table)} record")
    print()
    
    # Mostra i primi 10 record
    count = 0
    for record in table:
        if count >= 10:
            break
            
        print(f"--- RECORD {count+1} ---")
        for key, value in record.items():
            if value is not None and str(value).strip():
                print(f"{key}: {value}")
        print()
        count += 1
    
    # Cerca parole chiave
    print("🔍 Cercando parole chiave...")
    keywords = ['path', 'config', 'database', 'appunta', 'user', 'dati', 'windent']
    
    found_anything = False
    for record in table:
        for key, value in record.items():
            if value is not None:
                value_str = str(value).lower()
                for keyword in keywords:
                    if keyword in value_str:
                        print(f"TROVATO '{keyword}' in {key}: {value}")
                        found_anything = True
    
    if not found_anything:
        print("Nessuna parola chiave interessante trovata")
    
except ImportError:
    print("❌ Libreria dbfread non installata")
    print("Installa con: pip install dbfread")
except Exception as e:
    print(f"❌ Errore: {e}")
    import traceback
    traceback.print_exc()
