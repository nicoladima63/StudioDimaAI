"""
🔧 Servizio Callback Preparate - Gestione delle configurazioni di callback
=========================================================================

Servizio per gestire le configurazioni di callback salvate dagli utenti.

Author: Gemini Code Assist
Version: 1.0.0
"""

import json
import logging
from typing import Dict, Any, List, Optional
from .base_service import BaseService
from core.exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)

class CallbackPreparateService(BaseService):
    """
    Servizio per la gestione CRUD delle callback preparate.
    """
    
    def __init__(self, database_manager=None):
        from core.database_manager import get_database_manager
        super().__init__(database_manager or get_database_manager())

    def get_all(self) -> List[Dict[str, Any]]:
        """Recupera tutte le callback preparate."""
        try:
            query = "SELECT * FROM callback_preparate ORDER BY nome ASC"
            callbacks = self.execute_query(query)
            # Esegui il parsing dei parametri JSON
            for cb in callbacks:
                if cb.get('parametri'):
                    try:
                        cb['parametri'] = json.loads(cb['parametri'])
                    except json.JSONDecodeError:
                        cb['parametri'] = {} # Fallback in caso di JSON non valido
            return callbacks
        except Exception as e:
            logger.error(f"Errore recupero callback preparate: {e}")
            raise DatabaseError(f"Errore recupero callback preparate: {e}")

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Crea una nuova callback preparata."""
        required_fields = ['nome', 'callback_function', 'parametri']
        if not all(field in data for field in required_fields):
            raise ValidationError("Campi obbligatori mancanti: nome, callback_function, parametri")

        try:
            query = """
                INSERT INTO callback_preparate (nome, descrizione, callback_function, parametri, created_by)
                VALUES (?, ?, ?, ?, ?)
            """
            params = (
                data['nome'],
                data.get('descrizione', ''),
                data['callback_function'],
                json.dumps(data['parametri']),
                data.get('created_by', 'frontend_user')
            )
            new_id = self.execute_command(query, params, return_last_id=True)
            
            # Recupera l'oggetto appena creato
            new_callback = self.execute_query("SELECT * FROM callback_preparate WHERE id = ?", (new_id,))[0]
            new_callback['parametri'] = json.loads(new_callback['parametri']) # Parse per il ritorno
            return new_callback
        except Exception as e:
            logger.error(f"Errore creazione callback preparata: {e}")
            raise DatabaseError(f"Errore creazione callback preparata: {e}")

    def delete(self, callback_id: int) -> bool:
        """Elimina una callback preparata."""
        rows_affected = self.execute_command("DELETE FROM callback_preparate WHERE id = ?", (callback_id,))
        if rows_affected == 0:
            raise DatabaseError("Callback non trovata o errore durante l'eliminazione.")
        return True

# Istanza singleton
callback_preparate_service = CallbackPreparateService()