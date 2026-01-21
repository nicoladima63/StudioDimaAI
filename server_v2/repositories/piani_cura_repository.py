"""
Piani di Cura Repository - Data Access Layer

Repository per lettura piani di trattamento pazienti.
Accesso READ-ONLY a tabelle ELENCO.DBF (piani) e PREVENT.DBF (prestazioni).
Il gestionale si occupa della scrittura.
"""

import logging
from typing import Dict, List, Any, Optional
from contextlib import contextmanager

from core.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


class PianiCuraRepository:
    """Repository READ-ONLY per piani di cura."""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    @contextmanager
    def _get_connection(self):
        """Context manager per gestione connessioni."""
        conn = None
        try:
            conn = self.db_manager.get_connection()
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                self.db_manager.return_connection(conn)
    
    def get_piani_by_paziente(self, paziente_id: str) -> List[Dict[str, Any]]:
        """
        Recupera tutti i piani di cura di un paziente.
        
        Args:
            paziente_id: ID del paziente
            
        Returns:
            Lista di piani di cura
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT 
                    DB_CODE as piano_id,
                    DB_DESCRIZ as descrizione,
                    DB_DATA as data_creazione,
                    DB_TOTALE as importo_totale,
                    DB_ACCONTO as acconto,
                    DB_SALDO as saldo,
                    DB_STATO as stato
                FROM elenco
                WHERE DB_CODPAZ = ?
                ORDER BY DB_DATA DESC
            """
            
            cursor.execute(query, (paziente_id,))
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            return [dict(zip(columns, row)) for row in rows]
    
    def get_piano_by_id(self, piano_id: str) -> Optional[Dict[str, Any]]:
        """
        Recupera un piano di cura specifico.
        
        Args:
            piano_id: ID del piano (DB_CODE)
            
        Returns:
            Dati del piano o None
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT 
                    DB_CODE as piano_id,
                    DB_CODPAZ as paziente_id,
                    DB_DESCRIZ as descrizione,
                    DB_DATA as data_creazione,
                    DB_TOTALE as importo_totale,
                    DB_ACCONTO as acconto,
                    DB_SALDO as saldo,
                    DB_STATO as stato,
                    DB_NOTE as note
                FROM elenco
                WHERE DB_CODE = ?
            """
            
            cursor.execute(query, (piano_id,))
            row = cursor.fetchone()
            
            if row:
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))
            
            return None
    
    def get_prestazioni_by_piano(self, piano_id: str) -> List[Dict[str, Any]]:
        """
        Recupera tutte le prestazioni di un piano di cura.
        
        Args:
            piano_id: ID del piano (DB_PRELCOD in PREVENT.DBF)
            
        Returns:
            Lista di prestazioni
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT 
                    DB_CODICE as prestazione_id,
                    DB_PRELCOD as piano_id,
                    DB_DESCRIZ as descrizione,
                    DB_QUANTIT as quantita,
                    DB_PREZZO as prezzo_unitario,
                    DB_IMPORTO as importo_totale,
                    DB_ESEGUIT as eseguita,
                    DB_DATA as data_esecuzione,
                    DB_NOTE as note
                FROM preventivi
                WHERE DB_PRELCOD = ?
                ORDER BY DB_CODICE
            """
            
            cursor.execute(query, (piano_id,))
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            return [dict(zip(columns, row)) for row in rows]
    
    def get_piano_completo(self, piano_id: str) -> Optional[Dict[str, Any]]:
        """
        Recupera piano di cura con tutte le prestazioni associate.
        
        Args:
            piano_id: ID del piano
            
        Returns:
            Piano completo con prestazioni o None
        """
        piano = self.get_piano_by_id(piano_id)
        
        if not piano:
            return None
        
        # Aggiungi prestazioni
        piano['prestazioni'] = self.get_prestazioni_by_piano(piano_id)
        
        # Calcola statistiche
        prestazioni = piano['prestazioni']
        piano['statistiche'] = {
            'totale_prestazioni': len(prestazioni),
            'prestazioni_eseguite': len([p for p in prestazioni if p.get('eseguita')]),
            'prestazioni_da_eseguire': len([p for p in prestazioni if not p.get('eseguita')]),
            'importo_eseguito': sum(p.get('importo_totale', 0) for p in prestazioni if p.get('eseguita')),
            'importo_da_eseguire': sum(p.get('importo_totale', 0) for p in prestazioni if not p.get('eseguita'))
        }
        
        return piano

