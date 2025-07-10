import dbf
import os
import logging
from server.app.utils.db_utils import get_dbf_path

logger = logging.getLogger(__name__)

def get_fatture(path_fatture, mode):
    """Restituisce tutte le fatture dal DBF."""
    if not path_fatture:
        path_fatture = get_dbf_path('fatture', mode)
    if not path_fatture or not os.path.exists(path_fatture):
        logger.error(f"File fatture non trovato: {path_fatture}")
        return []
    try:
        with dbf.Table(path_fatture, codepage='cp1252') as table:
            records = []
            for r in table:
                try:
                    records.append({
                        'id': str(r['DB_FACODICE']).strip() if 'DB_FACODICE' in table.field_names else '',
                        'data_incasso': r['DB_FADATA'],
                        'importo': float(r['DB_FAINCAS'] or 0),
                        'metodo': r['DB_FAPAGAM'].strip() if r['DB_FAPAGAM'] else '',
                        'banca_cassa': r['DB_FABANCA'].strip() if r['DB_FABANCA'] else '',
                        'esenzione_iva': bool(r['DB_FAESIVA']) if 'DB_FAESIVA' in table.field_names else False,
                        'marca_bollo': float(r['DB_FAIVA'] or 0) if 'DB_FAIVA' in table.field_names else 0.0
                    })
                except Exception as e:
                    logger.warning(f"Errore lettura record fattura: {e}")
            logger.info(f"Letti {len(records)} record fatture da {path_fatture}")
            return records
    except Exception as e:
        logger.error(f"Errore lettura DBF fatture: {e}")
        return [] 