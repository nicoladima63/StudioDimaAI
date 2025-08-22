"""
Utilities per la gestione di diagnosi, farmaci e protocolli terapeutici
"""
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)

class RicettaDataManager:
    """Gestisce i dati statici per la ricetta elettronica"""
    
    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / "data" / "ricetta"
        self._cache = {}
        self._load_data()
    
    def _load_data(self):
        """Carica tutti i file di dati"""
        try:
            # Carica diagnosi ICD9
            icd9_path = self.data_dir / "icd9_odontoiatria.json"
            if icd9_path.exists():
                with open(icd9_path, 'r', encoding='utf-8') as f:
                    self._cache['diagnosi'] = json.load(f)
                logger.info(f"Caricate {len(self._cache['diagnosi'])} diagnosi ICD9")
            
            # Carica farmaci ATC
            atc_path = self.data_dir / "atc_farmaci.json"
            if atc_path.exists():
                with open(atc_path, 'r', encoding='utf-8') as f:
                    self._cache['farmaci'] = json.load(f)
                logger.info(f"Caricati {len(self._cache['farmaci'])} farmaci ATC")
            
            # Carica farmaci AIC validi
            aic_path = self.data_dir / "farmaci_aic_validi.json"
            if aic_path.exists():
                with open(aic_path, 'r', encoding='utf-8') as f:
                    self._cache['farmaci_aic'] = json.load(f)
                logger.info(f"Caricati {len(self._cache['farmaci_aic'])} farmaci AIC")
            
            # Carica mapping diagnosi-farmaco
            mapping_path = self.data_dir / "mapping_diagnosi_farmaco.json"
            if mapping_path.exists():
                with open(mapping_path, 'r', encoding='utf-8') as f:
                    self._cache['mapping'] = json.load(f)
                logger.info("Caricato mapping diagnosi-farmaco")
            
            # Carica protocolli terapeutici
            protocolli_path = self.data_dir / "protocolli_terapeutici.json"
            if protocolli_path.exists():
                with open(protocolli_path, 'r', encoding='utf-8') as f:
                    self._cache['protocolli'] = json.load(f)
                logger.info(f"Caricati {len(self._cache['protocolli'])} protocolli terapeutici")
            
            # Carica farmaci test sicuri
            test_farmaci_path = self.data_dir / "farmaci_test_sicuri.json"
            if test_farmaci_path.exists():
                with open(test_farmaci_path, 'r', encoding='utf-8') as f:
                    self._cache['farmaci_test'] = json.load(f)
                logger.info(f"Caricati {len(self._cache['farmaci_test'])} farmaci test sicuri")
            
            # Carica ricette funzionanti test
            ricette_test_path = self.data_dir / "ricette_funzionanti_test.json"
            if ricette_test_path.exists():
                with open(ricette_test_path, 'r', encoding='utf-8') as f:
                    self._cache['ricette_test'] = json.load(f)
                logger.info(f"Caricate {len(self._cache['ricette_test'])} ricette test")
                    
        except Exception as e:
            logger.error(f"Errore caricamento dati ricetta: {e}")
    
    def cerca_diagnosi(self, query: str, limit: int = 20) -> List[Dict[str, str]]:
        """Cerca diagnosi ICD9 per query"""
        if not query or len(query) < 2:
            return []
        
        query_lower = query.lower()
        diagnosi = self._cache.get('diagnosi', [])
        
        risultati = []
        for diagnosi_item in diagnosi:
            if (query_lower in diagnosi_item.get('descrizione', '').lower() or 
                query_lower in diagnosi_item.get('codice', '').lower()):
                risultati.append({
                    'codice': diagnosi_item.get('codice', ''),
                    'descrizione': diagnosi_item.get('descrizione', '')
                })
                
                if len(risultati) >= limit:
                    break
        
        return risultati
    
    def cerca_farmaci(self, query: str, limit: int = 20) -> List[Dict[str, str]]:
        """Cerca farmaci ATC per query"""
        if not query or len(query) < 2:
            return []
        
        query_lower = query.lower()
        farmaci = self._cache.get('farmaci', [])
        
        risultati = []
        for farmaco in farmaci:
            if (query_lower in farmaco.get('descrizione', '').lower() or 
                query_lower in farmaco.get('principio_attivo', '').lower() or
                query_lower in farmaco.get('codice', '').lower()):
                risultati.append({
                    'codice': farmaco.get('codice', ''),
                    'descrizione': farmaco.get('descrizione', ''),
                    'principio_attivo': farmaco.get('principio_attivo', '')
                })
                
                if len(risultati) >= limit:
                    break
        
        return risultati
    
    def get_farmaci_per_diagnosi(self, codice_diagnosi: str) -> List[Dict[str, str]]:
        """Ottiene farmaci suggeriti per una diagnosi"""
        mapping = self._cache.get('mapping', {})
        farmaci_codes = mapping.get(codice_diagnosi, [])
        
        if not farmaci_codes:
            return []
        
        farmaci = self._cache.get('farmaci', [])
        risultati = []
        
        for farmaco in farmaci:
            if farmaco.get('codice') in farmaci_codes:
                risultati.append({
                    'codice': farmaco.get('codice', ''),
                    'descrizione': farmaco.get('descrizione', ''),
                    'principio_attivo': farmaco.get('principio_attivo', '')
                })
        
        return risultati
    
    def get_protocolli_terapeutici(self) -> List[Dict[str, Any]]:
        """Ottiene tutti i protocolli terapeutici"""
        return self._cache.get('protocolli', [])
    
    def get_protocollo_by_id(self, protocollo_id: str) -> Optional[Dict[str, Any]]:
        """Ottiene protocollo terapeutico per ID"""
        protocolli = self._cache.get('protocolli', [])
        for protocollo in protocolli:
            if protocollo.get('id') == protocollo_id:
                return protocollo
        return None
    
    def get_farmaci_test_sicuri(self) -> List[Dict[str, str]]:
        """Ottiene farmaci sicuri per test"""
        return self._cache.get('farmaci_test', [])
    
    def get_ricette_test_funzionanti(self) -> List[Dict[str, Any]]:
        """Ottiene ricette test già funzionanti"""
        return self._cache.get('ricette_test', [])
    
    def validate_farmaco(self, codice_farmaco: str) -> bool:
        """Valida se un farmaco esiste nei database"""
        # Cerca in farmaci ATC
        farmaci_atc = self._cache.get('farmaci', [])
        for farmaco in farmaci_atc:
            if farmaco.get('codice') == codice_farmaco:
                return True
        
        # Cerca in farmaci AIC
        farmaci_aic = self._cache.get('farmaci_aic', [])
        for farmaco in farmaci_aic:
            if farmaco.get('codice') == codice_farmaco:
                return True
        
        return False
    
    def validate_diagnosi(self, codice_diagnosi: str) -> bool:
        """Valida se una diagnosi esiste nel database ICD9"""
        diagnosi = self._cache.get('diagnosi', [])
        for diagnosi_item in diagnosi:
            if diagnosi_item.get('codice') == codice_diagnosi:
                return True
        return False
    
    def get_posologie_comuni(self) -> List[str]:
        """Ottiene posologie più comuni"""
        return [
            "1 compressa 2 volte al giorno",
            "1 compressa 3 volte al giorno",
            "2 compresse 2 volte al giorno",
            "1 compressa al mattino",
            "1 compressa alla sera",
            "1 compressa ogni 8 ore",
            "1 compressa ogni 12 ore",
            "1 bustina 2 volte al giorno",
            "10 ml 3 volte al giorno",
            "Secondo necessità"
        ]
    
    def get_durate_comuni(self) -> List[str]:
        """Ottiene durate terapia più comuni"""
        return [
            "3 giorni",
            "5 giorni", 
            "7 giorni",
            "10 giorni",
            "14 giorni",
            "21 giorni",
            "30 giorni",
            "Fino a guarigione"
        ]
    
    def get_note_frequenti(self) -> List[str]:
        """Ottiene note più frequenti"""
        return [
            "Assumere a stomaco pieno",
            "Assumere a stomaco vuoto",
            "Non superare la dose indicata",
            "Evitare alcol durante il trattamento",
            "Completare il ciclo anche se i sintomi migliorano",
            "In caso di effetti collaterali sospendere e consultare il medico"
        ]
    
    def reload_data(self):
        """Ricarica tutti i dati"""
        self._cache.clear()
        self._load_data()
        logger.info("Dati ricetta ricaricati")

# Instance globale
ricetta_data_manager = RicettaDataManager()

# Funzioni di utilità per backward compatibility
def cerca_diagnosi(query: str, limit: int = 20) -> List[Dict[str, str]]:
    return ricetta_data_manager.cerca_diagnosi(query, limit)

def cerca_farmaci(query: str, limit: int = 20) -> List[Dict[str, str]]:
    return ricetta_data_manager.cerca_farmaci(query, limit)

def get_farmaci_per_diagnosi(codice_diagnosi: str) -> List[Dict[str, str]]:
    return ricetta_data_manager.get_farmaci_per_diagnosi(codice_diagnosi)

def get_protocolli_terapeutici() -> List[Dict[str, Any]]:
    return ricetta_data_manager.get_protocolli_terapeutici()

def get_posologie_per_farmaco(codice_farmaco: str) -> List[str]:
    """Placeholder - da implementare logica specifica"""
    return ricetta_data_manager.get_posologie_comuni()

def get_durate_standard() -> List[str]:
    return ricetta_data_manager.get_durate_comuni()

def get_note_frequenti() -> List[str]:
    return ricetta_data_manager.get_note_frequenti()