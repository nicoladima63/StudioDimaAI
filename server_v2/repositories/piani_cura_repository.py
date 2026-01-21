"""
Piani di Cura Repository - Data Access Layer

Repository per gestione piani di trattamento pazienti.
Accesso a tabelle ELENCO.DBF (piani) e PREVENT.DBF (prestazioni).
"""

import logging
from typing import Dict, List, Any, Optional
from contextlib import contextmanager

from core.database_manager import DatabaseManager
from core.exceptions import DatabaseError

logger = logging.getLogger(__name__)


class PianiCuraRepository:
    """Repository per operazioni su piani di cura."""
    
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
            
            # Query su ELENCO.DBF
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
            
            # Query su PREVENT.DBF linkato tramite DB_PRELCOD
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
    
    def create_piano(self, piano_data: Dict[str, Any]) -> str:
        """
        Crea un nuovo piano di cura.
        
        Args:
            piano_data: Dati del piano
            
        Returns:
            ID del piano creato
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Genera nuovo ID
            cursor.execute("SELECT MAX(CAST(DB_CODE AS INTEGER)) FROM elenco")
            max_id = cursor.fetchone()[0] or 0
            new_id = str(max_id + 1)
            
            query = """
                INSERT INTO elenco (
                    DB_CODE, DB_CODPAZ, DB_DESCRIZ, DB_DATA,
                    DB_TOTALE, DB_ACCONTO, DB_SALDO, DB_STATO, DB_NOTE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.execute(query, (
                new_id,
                piano_data.get('paziente_id'),
                piano_data.get('descrizione', ''),
                piano_data.get('data_creazione'),
                piano_data.get('importo_totale', 0),
                piano_data.get('acconto', 0),
                piano_data.get('saldo', 0),
                piano_data.get('stato', 'ATTIVO'),
                piano_data.get('note', '')
            ))
            
            conn.commit()
            return new_id
    
    def update_piano(self, piano_id: str, piano_data: Dict[str, Any]) -> bool:
        """
        Aggiorna un piano di cura esistente.
        
        Args:
            piano_id: ID del piano
            piano_data: Dati da aggiornare
            
        Returns:
            True se aggiornato con successo
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Build dynamic update
            fields = []
            values = []
            
            field_mapping = {
                'descrizione': 'DB_DESCRIZ',
                'importo_totale': 'DB_TOTALE',
                'acconto': 'DB_ACCONTO',
                'saldo': 'DB_SALDO',
                'stato': 'DB_STATO',
                'note': 'DB_NOTE'
            }
            
            for key, db_field in field_mapping.items():
                if key in piano_data:
                    fields.append(f"{db_field} = ?")
                    values.append(piano_data[key])
            
            if not fields:
                return False
            
            values.append(piano_id)
            query = f"UPDATE elenco SET {', '.join(fields)} WHERE DB_CODE = ?"
            
            cursor.execute(query, values)
            conn.commit()
            
            return cursor.rowcount > 0
    
    def delete_piano(self, piano_id: str) -> bool:
        """
        Elimina un piano di cura (soft delete cambiando stato).
        
        Args:
            piano_id: ID del piano
            
        Returns:
            True se eliminato con successo
        """
        return self.update_piano(piano_id, {'stato': 'ELIMINATO'})
    
    def add_prestazione(self, prestazione_data: Dict[str, Any]) -> str:
        """
        Aggiunge una prestazione a un piano di cura.
        
        Args:
            prestazione_data: Dati della prestazione
            
        Returns:
            ID della prestazione creata
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Genera nuovo ID
            cursor.execute("SELECT MAX(CAST(DB_CODICE AS INTEGER)) FROM preventivi")
            max_id = cursor.fetchone()[0] or 0
            new_id = str(max_id + 1)
            
            query = """
                INSERT INTO preventivi (
                    DB_CODICE, DB_PRELCOD, DB_DESCRIZ, DB_QUANTIT,
                    DB_PREZZO, DB_IMPORTO, DB_ESEGUIT, DB_DATA, DB_NOTE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            quantita = prestazione_data.get('quantita', 1)
            prezzo = prestazione_data.get('prezzo_unitario', 0)
            
            cursor.execute(query, (
                new_id,
                prestazione_data.get('piano_id'),
                prestazione_data.get('descrizione', ''),
                quantita,
                prezzo,
                quantita * prezzo,  # Calcola importo totale
                prestazione_data.get('eseguita', False),
                prestazione_data.get('data_esecuzione'),
                prestazione_data.get('note', '')
            ))
            
            conn.commit()
            return new_id
    
    def update_prestazione(self, prestazione_id: str, prestazione_data: Dict[str, Any]) -> bool:
        """
        Aggiorna una prestazione.
        
        Args:
            prestazione_id: ID della prestazione
            prestazione_data: Dati da aggiornare
            
        Returns:
            True se aggiornata con successo
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            fields = []
            values = []
            
            field_mapping = {
                'descrizione': 'DB_DESCRIZ',
                'quantita': 'DB_QUANTIT',
                'prezzo_unitario': 'DB_PREZZO',
                'eseguita': 'DB_ESEGUIT',
                'data_esecuzione': 'DB_DATA',
                'note': 'DB_NOTE'
            }
            
            for key, db_field in field_mapping.items():
                if key in prestazione_data:
                    fields.append(f"{db_field} = ?")
                    values.append(prestazione_data[key])
            
            # Ricalcola importo se quantità o prezzo cambiano
            if 'quantita' in prestazione_data or 'prezzo_unitario' in prestazione_data:
                # Recupera valori correnti
                cursor.execute(
                    "SELECT DB_QUANTIT, DB_PREZZO FROM preventivi WHERE DB_CODICE = ?",
                    (prestazione_id,)
                )
                current = cursor.fetchone()
                if current:
                    quantita = prestazione_data.get('quantita', current[0])
                    prezzo = prestazione_data.get('prezzo_unitario', current[1])
                    fields.append("DB_IMPORTO = ?")
                    values.append(quantita * prezzo)
            
            if not fields:
                return False
            
            values.append(prestazione_id)
            query = f"UPDATE preventivi SET {', '.join(fields)} WHERE DB_CODICE = ?"
            
            cursor.execute(query, values)
            conn.commit()
            
            return cursor.rowcount > 0
    
    def delete_prestazione(self, prestazione_id: str) -> bool:
        """
        Elimina una prestazione.
        
        Args:
            prestazione_id: ID della prestazione
            
        Returns:
            True se eliminata con successo
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = "DELETE FROM preventivi WHERE DB_CODICE = ?"
            cursor.execute(query, (prestazione_id,))
            conn.commit()
            
            return cursor.rowcount > 0
