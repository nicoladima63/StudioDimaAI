import os
from typing import List, Dict, Any
from dbfread import DBF
from server.app.config.constants import DBF_TABLES, COLONNE

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_dbf_path(nome_logico, mode):
    if mode == 'prod':
        base = r'\\SERVERDIMA\Pixel\WINDENT'
    else:
        base = os.path.join(BACKEND_DIR, 'windent')
    if nome_logico not in DBF_TABLES:
        raise ValueError(f"Tabella DBF logica '{nome_logico}' non trovata nel mapping. Aggiorna DBF_TABLES in constants.py.")
    info = DBF_TABLES[nome_logico]
    return os.path.join(base, info["categoria"], info["file"])

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