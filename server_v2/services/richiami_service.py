"""
Richiami Service for StudioDimaAI Server V2.

Service for managing patient recalls in separate SQLite table.
"""

import sqlite3
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from core.exceptions import DatabaseError, ValidationError

logger = logging.getLogger(__name__)

class RichiamiService:
    """Service for managing patient recalls."""
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.db_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'instance', 
            'studio_dima.db'
        )
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        if not os.path.exists(self.db_path):
            raise DatabaseError(f"Database not found: {self.db_path}")
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def create_richiamo(self, paziente_id: str, nome: str, data_ultima_visita: Optional[str] = None,
                       tipo_richiamo: Optional[str] = None, tempo_richiamo: Optional[int] = None) -> Dict[str, Any]:
        """Create a new richiamo for a patient."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Calcola data richiamo se abbiamo i dati necessari
            data_richiamo = None
            if data_ultima_visita and tempo_richiamo:
                try:
                    ultima = datetime.fromisoformat(data_ultima_visita.replace('Z', '+00:00'))
                    richiamo_date = ultima + timedelta(days=tempo_richiamo * 30)  # approssimazione mesi
                    data_richiamo = richiamo_date.isoformat()[:10]  # solo data YYYY-MM-DD
                except ValueError:
                    self.logger.warning(f"Invalid date format: {data_ultima_visita}")
            
            cursor.execute("""
                INSERT INTO richiami (
                    paziente_id, nome, data_ultima_visita, data_richiamo,
                    tipo_richiamo, tempo_richiamo, da_richiamare
                ) VALUES (?, ?, ?, ?, ?, ?, 'S')
            """, (paziente_id, nome, data_ultima_visita, data_richiamo, 
                  tipo_richiamo, tempo_richiamo))
            
            richiamo_id = cursor.lastrowid
            conn.commit()
            
            # Recupera il record creato
            richiamo = self.get_richiamo_by_id(richiamo_id)
            
            return {
                'success': True,
                'data': richiamo['data'] if richiamo['success'] else None,
                'message': 'Richiamo creato con successo'
            }
            
        except Exception as e:
            if conn:
                conn.rollback()
            self.logger.error(f"Error creating richiamo: {e}")
            raise DatabaseError(f"Failed to create richiamo: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def update_richiamo_status(self, paziente_id: str, da_richiamare: str, 
                              data_richiamo: Optional[str] = None) -> Dict[str, Any]:
        """Update richiamo status for a patient."""
        try:
            if da_richiamare not in ['S', 'N', 'R']:
                raise ValidationError("da_richiamare must be S, N, or R")
            
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Trova richiamo esistente per paziente
            cursor.execute("""
                SELECT id FROM richiami 
                WHERE paziente_id = ? AND da_richiamare != 'R'
                ORDER BY created_at DESC LIMIT 1
            """, (paziente_id,))
            
            existing = cursor.fetchone()
            
            if existing:
                # Aggiorna record esistente
                if da_richiamare == 'R':
                    # Segnato come richiamato
                    richiamato_il = data_richiamo or datetime.now().isoformat()[:10]
                    cursor.execute("""
                        UPDATE richiami 
                        SET da_richiamare = ?, richiamato_il = ?
                        WHERE id = ?
                    """, (da_richiamare, richiamato_il, existing['id']))
                else:
                    # Cambia solo stato
                    cursor.execute("""
                        UPDATE richiami 
                        SET da_richiamare = ?, richiamato_il = NULL
                        WHERE id = ?
                    """, (da_richiamare, existing['id']))
                
                richiamo_id = existing['id']
            else:
                # Nessun richiamo esistente - crea nuovo
                cursor.execute("""
                    INSERT INTO richiami (
                        paziente_id, nome, data_ultima_visita, data_richiamo,
                        tipo_richiamo, tempo_richiamo, da_richiamare
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (paziente_id, f'Paziente {paziente_id}', None, None, '1', 6, da_richiamare))
                
                richiamo_id = cursor.lastrowid
            
            conn.commit()
            
            # Recupera il record aggiornato
            richiamo = self.get_richiamo_by_id(richiamo_id)
            
            return {
                'success': True,
                'data': richiamo['data'] if richiamo['success'] else None,
                'message': 'Stato richiamo aggiornato con successo'
            }
            
        except Exception as e:
            if conn:
                conn.rollback()
            self.logger.error(f"Error updating richiamo status: {e}")
            raise DatabaseError(f"Failed to update richiamo status: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def update_richiamo_config(self, paziente_id: str, tipo_richiamo: str, 
                              tempo_richiamo: int, paziente_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Update richiamo configuration (tipo and tempo) for a patient."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Trova richiamo attivo per paziente
            cursor.execute("""
                SELECT id, data_ultima_visita FROM richiami 
                WHERE paziente_id = ? AND da_richiamare = 'S'
                ORDER BY created_at DESC LIMIT 1
            """, (paziente_id,))
            
            existing = cursor.fetchone()
            
            if existing:
                # Ricalcola data richiamo se abbiamo ultima visita
                data_richiamo = None
                data_ultima_visita = existing['data_ultima_visita']
                
                # Se abbiamo dati del paziente, usa quelli più freschi
                if paziente_data and paziente_data.get('ultima_visita'):
                    data_ultima_visita = paziente_data['ultima_visita']
                
                if data_ultima_visita:
                    try:
                        ultima = datetime.fromisoformat(data_ultima_visita.replace('Z', '+00:00'))
                        richiamo_date = ultima + timedelta(days=tempo_richiamo * 30)
                        data_richiamo = richiamo_date.isoformat()[:10]
                    except ValueError:
                        pass
                
                # Aggiorna con tutti i dati disponibili
                cursor.execute("""
                    UPDATE richiami 
                    SET tipo_richiamo = ?, tempo_richiamo = ?, data_richiamo = ?, data_ultima_visita = ?
                    WHERE id = ?
                """, (tipo_richiamo, tempo_richiamo, data_richiamo, data_ultima_visita, existing['id']))
                
                richiamo_id = existing['id']
            else:
                # Crea nuovo richiamo con tutti i dati
                nome = paziente_data.get('nome', f'Paziente {paziente_id}') if paziente_data else f'Paziente {paziente_id}'
                data_ultima_visita = paziente_data.get('ultima_visita') if paziente_data else None
                
                # Calcola data richiamo se possibile
                data_richiamo = None
                if data_ultima_visita:
                    try:
                        ultima = datetime.fromisoformat(data_ultima_visita.replace('Z', '+00:00'))
                        richiamo_date = ultima + timedelta(days=tempo_richiamo * 30)
                        data_richiamo = richiamo_date.isoformat()[:10]
                    except ValueError:
                        pass
                
                cursor.execute("""
                    INSERT INTO richiami (
                        paziente_id, nome, data_ultima_visita, data_richiamo,
                        tipo_richiamo, tempo_richiamo, da_richiamare
                    ) VALUES (?, ?, ?, ?, ?, ?, 'S')
                """, (paziente_id, nome, data_ultima_visita, data_richiamo, 
                      tipo_richiamo, tempo_richiamo))
                
                richiamo_id = cursor.lastrowid
            
            conn.commit()
            
            # Recupera il record aggiornato
            richiamo = self.get_richiamo_by_id(richiamo_id)
            
            return {
                'success': True,
                'data': richiamo['data'] if richiamo['success'] else None,
                'message': 'Configurazione richiamo aggiornata con successo'
            }
            
        except Exception as e:
            if conn:
                conn.rollback()
            self.logger.error(f"Error updating richiamo config: {e}")
            raise DatabaseError(f"Failed to update richiamo config: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_richiamo_by_id(self, richiamo_id: int) -> Dict[str, Any]:
        """Get richiamo by ID."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM richiami WHERE id = ?", (richiamo_id,))
            row = cursor.fetchone()
            
            if row:
                return {
                    'success': True,
                    'data': dict(row)
                }
            else:
                return {
                    'success': False,
                    'error': 'RICHIAMO_NOT_FOUND',
                    'message': f'Richiamo {richiamo_id} non trovato'
                }
                
        except Exception as e:
            self.logger.error(f"Error getting richiamo {richiamo_id}: {e}")
            raise DatabaseError(f"Failed to get richiamo: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_richiami_paziente(self, paziente_id: str) -> Dict[str, Any]:
        """Get all richiami for a patient."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT * FROM richiami 
                WHERE paziente_id = ?
                ORDER BY created_at DESC
            """, (paziente_id,))
            
            rows = cursor.fetchall()
            richiami = [dict(row) for row in rows]
            
            return {
                'success': True,
                'data': richiami,
                'count': len(richiami)
            }
            
        except Exception as e:
            self.logger.error(f"Error getting richiami for paziente {paziente_id}: {e}")
            raise DatabaseError(f"Failed to get richiami: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_richiami_da_fare(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """Get list of richiami that need to be done (scaduti or da fare oggi)."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            oggi = datetime.now().isoformat()[:10]
            
            query = """
                SELECT * FROM richiami 
                WHERE da_richiamare = 'S' 
                AND (data_richiamo IS NULL OR data_richiamo <= ?)
                ORDER BY data_richiamo ASC, created_at ASC
            """
            
            params = [oggi]
            if limit:
                query += " LIMIT ?"
                params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            richiami = [dict(row) for row in rows]
            
            return {
                'success': True,
                'data': richiami,
                'count': len(richiami)
            }
            
        except Exception as e:
            self.logger.error(f"Error getting richiami da fare: {e}")
            raise DatabaseError(f"Failed to get richiami da fare: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_statistiche_richiami(self) -> Dict[str, Any]:
        """Get richiami statistics."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            oggi = datetime.now().isoformat()[:10]
            
            # Contatori
            cursor.execute("SELECT COUNT(*) as da_fare FROM richiami WHERE da_richiamare = 'S' AND (data_richiamo IS NULL OR data_richiamo <= ?)", (oggi,))
            da_fare = cursor.fetchone()['da_fare']
            
            cursor.execute("SELECT COUNT(*) as scaduti FROM richiami WHERE da_richiamare = 'S' AND data_richiamo < ?", (oggi,))
            scaduti = cursor.fetchone()['scaduti']
            
            cursor.execute("SELECT COUNT(*) as completati FROM richiami WHERE da_richiamare = 'R'")
            completati = cursor.fetchone()['completati']
            
            cursor.execute("SELECT COUNT(*) as totale FROM richiami")
            totale = cursor.fetchone()['totale']
            
            return {
                'success': True,
                'data': {
                    'da_fare': da_fare,
                    'scaduti': scaduti,
                    'completati': completati,
                    'totale': totale
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error getting richiami statistics: {e}")
            raise DatabaseError(f"Failed to get statistics: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def mark_sms_sent(self, richiamo_id: int) -> Dict[str, Any]:
        """Mark SMS as sent for a richiamo."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE richiami 
                SET sms_sent = 1
                WHERE id = ?
            """, (richiamo_id,))
            
            if cursor.rowcount == 0:
                return {
                    'success': False,
                    'error': 'RICHIAMO_NOT_FOUND',
                    'message': f'Richiamo {richiamo_id} non trovato'
                }
            
            conn.commit()
            
            return {
                'success': True,
                'message': 'SMS contrassegnato come inviato'
            }
            
        except Exception as e:
            if conn:
                conn.rollback()
            self.logger.error(f"Error marking SMS sent: {e}")
            raise DatabaseError(f"Failed to mark SMS sent: {str(e)}")
        finally:
            if conn:
                conn.close()