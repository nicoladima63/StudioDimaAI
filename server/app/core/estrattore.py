#server/app/core/estrattore.py
from typing import List, Dict, Any
from dbfread import DBF
from server.app.config.constants import COLONNE  # importa da dove è definito

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
