import sys
import os
import dbf
import logging
from datetime import datetime

# Add server_v2 root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# FIX: Remove SSLKEYLOGFILE if present
if 'SSLKEYLOGFILE' in os.environ:
    del os.environ['SSLKEYLOGFILE']

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DEBUG_VISITS")

def debug_visits():
    from utils.dbf_utils import get_optimized_reader, COLONNE, clean_dbf_value
    
    reader = get_optimized_reader()
    appointments_path = reader._get_dbf_path('APPUNTA.DBF')
    
    current_year = datetime.now().year
    month = datetime.now().month
    
    logger.info(f"Scanning APPUNTA.DBF for 'V' (First Visits) in {current_year}...")
    
    col_app = COLONNE['appuntamenti']
    data_field = col_app['data'].lower()
    tipo_field = col_app['tipo'].lower()
    
    count_2026 = 0
    count_v_2026 = 0
    
    try:
        with dbf.Table(appointments_path, codepage='cp1252') as table:
            for record in table:
                 try:
                    app_date = getattr(record, data_field)
                    if not app_date or app_date.year != current_year:
                        continue
                    
                    count_2026 += 1
                    tipo = clean_dbf_value(getattr(record, tipo_field))
                    
                    if tipo == 'V':
                        count_v_2026 += 1
                        logger.info(f"FOUND V: Date={app_date}, Tipo={tipo}, Record={record}")
                        
                 except Exception as e:
                     pass
                     
        logger.info(f"Total appointments in {current_year}: {count_2026}")
        logger.info(f"Total 'V' appointments in {current_year}: {count_v_2026}")
        
    except Exception as e:
        logger.error(f"Error reading DBF: {e}")

if __name__ == "__main__":
    debug_visits()
