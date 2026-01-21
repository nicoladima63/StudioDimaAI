"""
Piani di Cura Service - Business Logic Layer

Service READ-ONLY per lettura piani di trattamento pazienti.
"""

import logging
from typing import Dict, Any

from repositories.piani_cura_repository import PianiCuraRepository
from core.database_manager import DatabaseManager
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class PianiCuraService:
    """Service READ-ONLY per piani di cura."""
    
    def __init__(self, db_manager: DatabaseManager):
        self.repository = PianiCuraRepository(db_manager)
    
    def get_piani_paziente(self, paziente_id: str) -> Dict[str, Any]:
        """
        Recupera tutti i piani di cura di un paziente.
        
        Args:
            paziente_id: ID del paziente
            
        Returns:
            Dict con lista piani e statistiche
        """
        try:
            if not paziente_id:
                raise ValidationError("paziente_id è richiesto")
            
            piani = self.repository.get_piani_by_paziente(paziente_id)
            
            # Calcola statistiche
            totale_piani = len(piani)
            piani_attivi = len([p for p in piani if p.get('stato') == 'ATTIVO'])
            importo_totale = sum(p.get('importo_totale', 0) for p in piani)
            saldo_totale = sum(p.get('saldo', 0) for p in piani)
            
            return {
                'success': True,
                'data': {
                    'piani': piani,
                    'statistiche': {
                        'totale_piani': totale_piani,
                        'piani_attivi': piani_attivi,
                        'importo_totale': importo_totale,
                        'saldo_totale': saldo_totale
                    }
                }
            }
            
        except ValidationError as e:
            logger.warning(f"Validation error in get_piani_paziente: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in get_piani_paziente: {e}")
            return {'success': False, 'error': 'Errore recupero piani'}
    
    def get_piano_dettaglio(self, piano_id: str) -> Dict[str, Any]:
        """
        Recupera dettaglio completo di un piano di cura.
        
        Args:
            piano_id: ID del piano
            
        Returns:
            Dict con piano completo e prestazioni
        """
        try:
            if not piano_id:
                raise ValidationError("piano_id è richiesto")
            
            piano = self.repository.get_piano_completo(piano_id)
            
            if not piano:
                return {'success': False, 'error': 'Piano non trovato'}
            
            return {
                'success': True,
                'data': piano
            }
            
        except ValidationError as e:
            logger.warning(f"Validation error in get_piano_dettaglio: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in get_piano_dettaglio: {e}")
            return {'success': False, 'error': 'Errore recupero piano'}
