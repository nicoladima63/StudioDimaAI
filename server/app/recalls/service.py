import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from dbfread import DBF
import sys
import os

# Aggiungi il path per gli import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.config.constants import PATH_ANAGRAFICA_DBF, COLONNE
    from app.recalls.utils import (
        normalizza_numero_telefono,
        costruisci_messaggio_richiamo,
        formatta_richiamo_per_frontend,
        calcola_data_richiamo
    )
except ImportError:
    # Fallback per esecuzione diretta
    from config.constants import PATH_ANAGRAFICA_DBF, COLONNE
    from recalls.utils import (
        normalizza_numero_telefono,
        costruisci_messaggio_richiamo,
        formatta_richiamo_per_frontend,
        calcola_data_richiamo
    )


class RecallService:
    """
    Service per la gestione dei richiami dei pazienti
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def get_all_recalls(self, days_threshold: int = 90) -> List[Dict[str, Any]]:
        """
        Ottiene tutti i richiami dal DBF, filtrati per soglia giorni
        
        Args:
            days_threshold: giorni entro cui considerare i richiami (default 90)
            
        Returns:
            Lista di richiami formattati per il frontend
        """
        try:
            # Legge i dati dal DBF
            pazienti_dbf = DBF(PATH_ANAGRAFICA_DBF, encoding='latin-1')
            col = COLONNE['richiami']
            col_paz = COLONNE['pazienti']
            
            oggi = date.today()
            entro = oggi + timedelta(days=days_threshold)
            
            richiami = []
            
            debug_count = 0
            for record in pazienti_dbf:
                # Verifica se il paziente ha richiami configurati (DB_PARICHI = 'S')
                da_richiamare = str(record.get(col['da_richiamare'], '')).strip().upper()
                if da_richiamare != 'S':
                    continue
                if debug_count < 3:
                    logging.debug(f"[RECORD GREZZO] {dict(record)}")
                    debug_count += 1
                
                # Ottiene i dati del richiamo
                data_richiamo = record.get(col['data1'])
                tipo_richiamo = record.get(col['tipo'], '')
                mesi_richiamo = record.get(col['mesi'], 0)
                ultima_visita = record.get(col['ultima_visita'])
                
                # Se non c'è data richiamo, prova a calcolarla dall'ultima visita
                if not data_richiamo or not isinstance(data_richiamo, date):
                    if ultima_visita and isinstance(ultima_visita, date) and mesi_richiamo > 0:
                        data_richiamo = calcola_data_richiamo(ultima_visita, mesi_richiamo)
                
                # Se ancora non c'è data, salta questo record
                if not data_richiamo or not isinstance(data_richiamo, date):
                    continue
                
                # Filtra per soglia giorni
                if data_richiamo > entro:
                    continue
                
                # Costruisce il record del richiamo
                # Passa direttamente il record DBF grezzo
                richiami.append(record)
            
            # Formatta per il frontend
            richiami_formattati = [formatta_richiamo_per_frontend(r) for r in richiami]
            
            self.logger.info(f"Trovati {len(richiami_formattati)} richiami entro {days_threshold} giorni")
            return richiami_formattati
            
        except Exception as e:
            self.logger.error(f"Errore nel recupero richiami: {str(e)}")
            return []
    
    def get_recalls_by_status(self, status: str, days_threshold: int = 90) -> List[Dict[str, Any]]:
        """
        Ottiene richiami filtrati per stato
        
        Args:
            status: 'scaduto', 'in_scadenza', 'futuro'
            days_threshold: soglia giorni
            
        Returns:
            Lista di richiami filtrati
        """
        richiami = self.get_all_recalls(days_threshold)
        return [r for r in richiami if r['stato'] == status]
    
    def get_recalls_by_type(self, tipo_codice: str, days_threshold: int = 90) -> List[Dict[str, Any]]:
        """
        Ottiene richiami filtrati per tipo
        
        Args:
            tipo_codice: codice del tipo di richiamo
            days_threshold: soglia giorni
            
        Returns:
            Lista di richiami filtrati
        """
        richiami = self.get_all_recalls(days_threshold)
        return [r for r in richiami if r['tipo_codice'] == tipo_codice]
    
    def get_recall_statistics(self, days_threshold: int = 90) -> Dict[str, Any]:
        """
        Ottiene statistiche sui richiami
        
        Args:
            days_threshold: soglia giorni
            
        Returns:
            Dizionario con statistiche
        """
        richiami = self.get_all_recalls(days_threshold)
        stats = {
            'totale': len(richiami),
            'scaduti': len([r for r in richiami if r['stato'] == 'scaduto']),
            'in_scadenza': len([r for r in richiami if r['stato'] == 'in_scadenza']),
            'futuri': len([r for r in richiami if r['stato'] == 'futuro']),
            'per_tipo': {}
        }
        # Statistiche flat: ogni tipo viene contato separatamente
        for richiamo in richiami:
            for tipo in richiamo['tipi_descrizione']:
                if tipo not in stats['per_tipo']:
                    stats['per_tipo'][tipo] = 0
                stats['per_tipo'][tipo] += 1
        return stats
    
    def prepare_recall_message(self, richiamo_id: str) -> Optional[Dict[str, Any]]:
        """
        Prepara il messaggio per un richiamo specifico
        
        Args:
            richiamo_id: ID del paziente
            
        Returns:
            Dizionario con messaggio e dati del richiamo
        """
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
        """
        Aggiorna le date dei richiami basandosi sull'ultima visita e i mesi di richiamo
        
        Returns:
            Statistiche dell'aggiornamento
        """
        try:
            pazienti_dbf = DBF(PATH_ANAGRAFICA_DBF, encoding='latin-1')
            col = COLONNE['richiami']
            
            aggiornati = 0
            errori = 0
            
            # Nota: Questo è solo per calcolo, non modifica il DBF
            # In un'implementazione reale, dovresti avere un database per salvare le modifiche
            
            for record in pazienti_dbf:
                try:
                    da_richiamare = record.get(col['da_richiamare'], False)
                    if not da_richiamare:
                        continue
                    
                    ultima_visita = record.get(col['ultima_visita'])
                    mesi_richiamo = record.get(col['mesi'], 0)
                    
                    if ultima_visita and mesi_richiamo:
                        nuova_data = calcola_data_richiamo(ultima_visita, mesi_richiamo)
                        if nuova_data:
                            aggiornati += 1
                        else:
                            errori += 1
                    else:
                        errori += 1
                        
                except Exception as e:
                    self.logger.error(f"Errore aggiornamento richiamo: {str(e)}")
                    errori += 1
            
            return {
                'aggiornati': aggiornati,
                'errori': errori,
                'totale_processati': aggiornati + errori
            }
            
        except Exception as e:
            self.logger.error(f"Errore nell'aggiornamento date richiami: {str(e)}")
            return {'aggiornati': 0, 'errori': 1, 'totale_processati': 1} 