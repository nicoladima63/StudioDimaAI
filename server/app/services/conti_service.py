"""
Servizio per la gestione delle categorie contabili da CONTI.DBF
"""

import logging
from typing import List, Dict, Optional
from dbfread import DBF
from server.app.core.db_utils import get_dbf_path

logger = logging.getLogger(__name__)

class ContiService:
    """Servizio per la lettura delle categorie contabili"""
    
    def __init__(self):
        self.conti_cache = None
    
    def get_categorie_spesa(self) -> List[Dict[str, str]]:
        """
        Ottiene tutte le categorie di spesa (conti di tipo 'A' - Attivi) da CONTI.DBF
        
        Returns:
            Lista di dizionari con codice e descrizione delle categorie
        """
        if self.conti_cache is not None:
            return self.conti_cache
            
        try:
            path_conti = get_dbf_path('conti')
            categorie = []
            
            for record in DBF(path_conti, encoding='latin-1'):
                codice = str(record.get('DB_CODE', '')).strip()
                descrizione = str(record.get('DB_CODESCR', '')).strip()
                tipo = str(record.get('DB_COTIPO', '')).strip()
                
                # Solo conti Attivi (spese) con codice e descrizione validi
                if codice and descrizione and tipo == 'A':
                    # Pulisci descrizioni troncate
                    if descrizione.startswith('ntali'):
                        descrizione = 'Materiali Dentali'
                    elif len(descrizione) < 3:  # Descrizioni troppo corte
                        continue
                        
                    categorie.append({
                        'codice_conto': codice,
                        'descrizione': descrizione,
                        'tipo': tipo
                    })
            
            # Ordina per descrizione per la select
            categorie.sort(key=lambda x: x['descrizione'])
            
            self.conti_cache = categorie
            logger.info(f"Caricate {len(categorie)} categorie di spesa da CONTI.DBF")
            return categorie
            
        except Exception as e:
            logger.error(f"Errore lettura CONTI.DBF: {e}")
            return []
    
    def get_categoria_by_codice(self, codice_conto: str) -> Optional[Dict[str, str]]:
        """
        Ottiene una categoria specifica per codice conto
        
        Args:
            codice_conto: Codice del conto (es: ZZZZZZ)
            
        Returns:
            Dizionario con i dati della categoria o None se non trovata
        """
        categorie = self.get_categorie_spesa()
        
        for categoria in categorie:
            if categoria['codice_conto'] == codice_conto:
                return categoria
        
        return None
    
    def clear_cache(self):
        """Pulisce la cache per ricaricare i dati"""
        self.conti_cache = None

# Istanza globale del service
conti_service = ContiService()