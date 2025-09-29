#!/usr/bin/env python
import sys
import os
import json

# Add server_v2 to the python path to allow imports
server_v2_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'server_v2'))
if server_v2_path not in sys.path:
    sys.path.insert(0, server_v2_path)

# Now we can import the service
from services.automation_service import get_automation_service

def inspect_rules():
    """Fetches and prints all automation rules."""
    print("--- Inizio Ispezione Regole di Automazione ---")
    
    try:
        automation_service = get_automation_service()
        # Passing no filters to get all rules
        all_rules = automation_service.get_all_rules()
        
        if not all_rules:
            print("RISULTATO: Nessuna regola di automazione trovata nel database.")
        else:
            print(f"RISULTATO: Trovate {len(all_rules)} regole.")
            # Pretty print the JSON result
            print(json.dumps(all_rules, indent=2, ensure_ascii=False))
            
    except Exception as e:
        print(f"ERRORE: Si è verificato un errore durante il recupero delle regole: {e}")

    print("\n--- Fine Ispezione Regole ---")

if __name__ == "__main__":
    inspect_rules()
