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
logger = logging.getLogger("DEEP_ANALYZE")

def analyze_deep():
    from utils.dbf_utils import get_optimized_reader, COLONNE, clean_dbf_value
    
    reader = get_optimized_reader()
    appointments_path = reader._get_dbf_path('APPUNTA.DBF')
    
    col_app = COLONNE['appuntamenti']
    data_field = col_app['data'].lower()
    tipo_field = col_app['tipo'].lower() # DB_GUARDIA
    desc_field = col_app['descrizione'].lower()
    
    counter_2025 = Counter()
    none_records_2026 = []
    
    try:
        with dbf.Table(appointments_path, codepage='cp1252') as table:
            for record in table:
                 try:
                    app_date = getattr(record, data_field)
                    if not app_date:
                        continue
                        
                    tipo = clean_dbf_value(getattr(record, tipo_field))
                    
                    if app_date.year == 2025:
                        counter_2025[tipo] += 1
                    
                    elif app_date.year == 2026:
                        if tipo == 'None' or not tipo:
                            desc = clean_dbf_value(getattr(record, desc_field))
                            none_records_2026.append(f"Date={app_date} Desc={desc}")
                        
                 except Exception:
                     pass
                     
        logger.info("=== 2025 Analysis ===")
        logger.info(f"Total 'V' in 2025: {counter_2025['V']}")
        logger.info(f"Top types 2025: {counter_2025.most_common(5)}")
        
        logger.info("\n=== 2026 'None' Records Analysis ===")
        logger.info(f"Found {len(none_records_2026)} records with empty type in 2026. Examples:")
        for r in none_records_2026[:10]:
            logger.info(r)

    except Exception as e:
        logger.error(f"Error reading DBF: {e}")

if __name__ == "__main__":
    analyze_deep()
