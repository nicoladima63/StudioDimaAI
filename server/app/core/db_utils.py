# server/app/core/db_utils.py
import os
from typing import List, Dict, Any
from dbfread import DBF
from server.app.config.constants import DBF_TABLES, COLONNE
from server.app.core.mode_manager import get_mode  # ← se usi il sistema "get_mode" da settings

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Cache per evitare messaggi ripetuti
_fallback_warned = False

def get_dbf_path(table_name: str) -> str:
    """
    Costruisce il percorso completo per un file DBF in base alla modalità corrente e alla configurazione.
    """
    mode = get_mode('database')  # Usa la modalità configurata
    table_info = DBF_TABLES.get(table_name)

    if not table_info:
        raise ValueError(f"Tabella '{table_name}' non definita in DBF_TABLES.")

    if mode == 'prod':
        base_path = r'\\SERVERDIMA\Pixel\WINDENT'
        final_path = os.path.join(base_path, table_info['categoria'], table_info['file'])
        
        # Rilevamento automatico ambiente: se rete studio non disponibile, usa dev
        if not os.path.exists(final_path):
            global _fallback_warned
            if not _fallback_warned:
                print(f"⚠️  Rete studio non disponibile, fallback automatico a modalità DEV")
                _fallback_warned = True
            # Fallback automatico a dev
            base_path = os.path.join(BACKEND_DIR, 'windent')
            final_path = os.path.join(base_path, table_info['categoria'], table_info['file'])
            if not os.path.exists(final_path):
                raise FileNotFoundError(f"File non trovato anche in ambiente DEV: '{final_path}'")
        
        return final_path

    else:
        # dev o test
        base_path = os.path.join(BACKEND_DIR, 'windent')
        final_path = os.path.join(base_path, table_info['categoria'], table_info['file'])
        if not os.path.exists(final_path):
            raise FileNotFoundError(f"File non trovato in ambiente DEV: '{final_path}'")
        return final_path

def estrai_dati(dbf_path: str, tabella: str) -> List[Dict[str, Any]]:
    """Estrae dati da un file .DBF secondo la mappatura di COLONNE[tabella]."""
    colonne_tabella = COLONNE.get(tabella)
    if not colonne_tabella:
        raise ValueError(f"Tabella '{tabella}' non trovata in COLONNE")
    return [
        {
            nome_logico: record.get(nome_dbf, '')
            for nome_logico, nome_dbf in colonne_tabella.items()
        }
        for record in DBF(dbf_path, encoding='latin-1')
    ] 