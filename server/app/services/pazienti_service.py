import logging

logger = logging.getLogger(__name__)

from dbfread import DBF
from datetime import date
from typing import List, Dict, Any
from server.app.utils.db_utils import get_dbf_path
from server.app.core.mode_manager import get_mode

PAZIENTI_FIELDS = [
    'DB_CODE', 'DB_PANOME', 'DB_PAINDIR', 'DB_PACITTA', 'DB_PACAP', 'DB_PAPROVI',
    'DB_PATELEF', 'DB_PACELLU', 'DB_PADANAS', 'DB_PAULTVI', 'DB_PARICHI',
    'DB_PARITAR', 'DB_PARIMOT', 'DB_PANONCU', 'DB_PAEMAIL', 'DB_PACODFI'
]

class PazientiService:
    def __init__(self):
        mode = get_mode('database')
        self.dbf_path = get_dbf_path('pazienti', mode)

    def get_all_pazienti(self) -> List[Dict[str, Any]]:
        pazienti = []
        for record in DBF(self.dbf_path, encoding='latin-1'):
            paz = {field: record.get(field, '') for field in PAZIENTI_FIELDS}
            pazienti.append(paz)
        return pazienti

    def get_stats(self) -> Dict[str, int]:
        tot = 0
        in_cura = 0
        non_in_cura = 0
        for record in DBF(self.dbf_path, encoding='latin-1'):
            tot += 1
            if str(record.get('DB_PANONCU', '')).strip().upper() == 'S':
                non_in_cura += 1
            else:
                in_cura += 1
        return {
            'totale': tot,
            'in_cura': in_cura,
            'non_in_cura': non_in_cura
        } 