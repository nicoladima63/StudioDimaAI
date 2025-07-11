import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from dbfread import DBF
from server.app.core.mode_manager import get_mode
from server.app.config.constants import COLONNE
from server.app.utils.db_utils import get_dbf_path
from server.app.core.utils import (
    normalizza_numero_telefono,
    costruisci_messaggio_richiamo
    # formatta_richiamo_per_frontend,  # NON ESISTE PIÙ
    # calcola_data_richiamo  # NON ESISTE PIÙ
)

class RecallService:
    """
    Service per la gestione dei richiami dei pazienti
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        mode = get_mode('database')
        self.dbf_path = get_dbf_path('pazienti', mode)
    
    def get_all_recalls(self, days_threshold: int = 90) -> List[Dict[str, Any]]:
        try:
            pazienti_dbf = DBF(self.dbf_path, encoding='latin-1')
            col = COLONNE['richiami']
            col_paz = COLONNE['pazienti']
            oggi = date.today()
            entro = oggi + timedelta(days=days_threshold)
            richiami = []
            debug_count = 0
            for record in pazienti_dbf:
                da_richiamare = str(record.get(col['da_richiamare'], '')).strip().upper()
                if da_richiamare != 'S':
                    continue
                if debug_count < 3:
                    logging.debug(f"[RECORD GREZZO] {dict(record)}")
                    debug_count += 1
                data_richiamo = record.get(col['data1'])
                tipo_richiamo = record.get(col['tipo'], '')
                mesi_richiamo = record.get(col['mesi'], 0)
                ultima_visita = record.get(col['ultima_visita'])
                if not data_richiamo or not isinstance(data_richiamo, date):
                    if ultima_visita and isinstance(ultima_visita, date) and mesi_richiamo > 0:
                        data_richiamo = calcola_data_richiamo(ultima_visita, mesi_richiamo)
                if not data_richiamo or not isinstance(data_richiamo, date):
                    continue
                if data_richiamo > entro:
                    continue
                richiami.append(record)
            richiami_formattati = [formatta_richiamo_per_frontend(r) for r in richiami]
            self.logger.info(f"Trovati {len(richiami_formattati)} richiami entro {days_threshold} giorni")
            return richiami_formattati
        except Exception as e:
            self.logger.error(f"Errore nel recupero richiami: {str(e)}")
            return []
    
    def get_recalls_by_status(self, status: str, days_threshold: int = 90) -> List[Dict[str, Any]]:
        richiami = self.get_all_recalls(days_threshold)
        return [r for r in richiami if r['stato'] == status]
    
    def get_recalls_by_type(self, tipo_codice: str, days_threshold: int = 90) -> List[Dict[str, Any]]:
        richiami = self.get_all_recalls(days_threshold)
        return [r for r in richiami if r['tipo_codice'] == tipo_codice]
    
    def get_recall_statistics(self, days_threshold: int = 90) -> Dict[str, Any]:
        richiami = self.get_all_recalls(days_threshold)
        stats = {
            'totale': len(richiami),
            'scaduti': len([r for r in richiami if r['stato'] == 'scaduto']),
            'in_scadenza': len([r for r in richiami if r['stato'] == 'in_scadenza']),
            'futuri': len([r for r in richiami if r['stato'] == 'futuro']),
            'per_tipo': {}
        }
        for richiamo in richiami:
            for tipo in richiamo['tipi_descrizione']:
                if tipo not in stats['per_tipo']:
                    stats['per_tipo'][tipo] = 0
                stats['per_tipo'][tipo] += 1
        return stats
    
    def prepare_recall_message(self, richiamo_id: str) -> Optional[Dict[str, Any]]:
        richiami = self.get_all_recalls()
        richiamo = next((r for r in richiami if r['id_paziente'] == richiamo_id), None)
        if not richiamo:
            return None
        messaggio = costruisci_messaggio_richiamo(richiamo)
        return {
            'richiamo': richiamo,
            'messaggio': messaggio,
            'telefono': richiamo['telefono']
        }
    
    def update_recall_dates(self) -> Dict[str, Any]:
        try:
            pazienti_dbf = DBF(self.dbf_path, encoding='latin-1')
            col = COLONNE['richiami']
            aggiornati = 0
            errori = 0
            # ... implementazione ...
            return {'aggiornati': aggiornati, 'errori': errori}
        except Exception as e:
            self.logger.error(f"Errore aggiornamento richiami: {str(e)}")
            return {'aggiornati': 0, 'errori': 1} 