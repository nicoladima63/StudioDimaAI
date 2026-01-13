import sys
import os
import dbf
import logging
from collections import Counter
from datetime import datetime

# Add server_v2 root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# FIX: Remove SSLKEYLOGFILE if present
if 'SSLKEYLOGFILE' in os.environ:
    del os.environ['SSLKEYLOGFILE']

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ANALYZE_TYPES")

def analyze_types():
    from utils.dbf_utils import get_optimized_reader, COLONNE, clean_dbf_value
    
    reader = get_optimized_reader()
    appointments_path = reader._get_dbf_path('APPUNTA.DBF')
    
    current_year = 2026
    
    col_app = COLONNE['appuntamenti']
    data_field = col_app['data'].lower()
    tipo_field = col_app['tipo'].lower() # DB_GUARDIA
    
    counter = Counter()
    
    try:
        with dbf.Table(appointments_path, codepage='cp1252') as table:
            for record in table:
                 try:
                    app_date = getattr(record, data_field)
                    if not app_date or app_date.year != current_year:
                        continue
                    
                    tipo = clean_dbf_value(getattr(record, tipo_field))
                    counter[tipo] += 1
                        
                 except Exception:
                     pass
                     
        logger.info(f"Appointment Types in {current_year}:")
        for tipo, count in counter.most_common():
            logger.info(f"  '{tipo}': {count}")
            
    except Exception as e:
        logger.error(f"Error reading DBF: {e}")

if __name__ == "__main__":
    analyze_types()
