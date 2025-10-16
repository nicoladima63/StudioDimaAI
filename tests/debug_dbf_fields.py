"""
Debug script per vedere i field names effettivi nei file DBF.
"""

import sys
import os

# Aggiunge il path per importare i moduli
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

import dbf
from core.config_manager import get_config

def debug_dbf_structure():
    """Debug struttura file DBF."""
    
    config = get_config()
    
    # Test file pazienti
    patients_path = config.get_dbf_path('patients')
    print(f"=== Patients DBF Structure ===")
    print(f"File: {patients_path}")
    
    try:
        with dbf.Table(patients_path, codepage='cp1252') as table:
            print(f"Field names: {table.field_names}")
            print(f"Field count: {len(table.field_names)}")
            print(f"Record count: {len(table)}")
            
            if len(table) > 0:
                print("\nFirst record:")
                first_record = table[0]
                for field_name in table.field_names[:10]:  # Prime 10 fields
                    try:
                        value = first_record[field_name]
                        print(f"  {field_name}: {repr(value)}")
                    except Exception as e:
                        print(f"  {field_name}: ERROR - {e}")
    
    except Exception as e:
        print(f"Error reading patients: {e}")
    
    # Test file appuntamenti
    appointments_path = config.get_dbf_path('appointments')
    print(f"\n=== Appointments DBF Structure ===")
    print(f"File: {appointments_path}")
    
    try:
        with dbf.Table(appointments_path, codepage='cp1252') as table:
            print(f"Field names: {table.field_names}")
            print(f"Field count: {len(table.field_names)}")
            print(f"Record count: {len(table)}")
            
            if len(table) > 0:
                print("\nFirst record:")
                first_record = table[0]
                for field_name in table.field_names[:10]:  # Prime 10 fields
                    try:
                        value = first_record[field_name]
                        print(f"  {field_name}: {repr(value)}")
                    except Exception as e:
                        print(f"  {field_name}: ERROR - {e}")
    
    except Exception as e:
        print(f"Error reading appointments: {e}")

if __name__ == "__main__":
    debug_dbf_structure()