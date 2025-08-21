"""
Conti Service for StudioDimaAI.

Service layer for accounts management (conti, branche, sottoconti) 
with modern database access patterns and validation.
"""

import logging
import sqlite3
from typing import List, Dict, Any, Optional

from services.base_service import BaseService
from core.exceptions import ValidationError, DatabaseError


class ContiService(BaseService):
    """
    Service class for managing conti (accounts) operations.
    
    Provides methods for CRUD operations on conti, branche, and sottoconti
    with proper validation and error handling.
    """

    # ===================== CONTI =====================
    
    def get_all_conti(self) -> List[Dict[str, Any]]:
        """
        Get all conti ordered by name.
        
        Returns:
            List of conti dictionaries
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, nome FROM conti ORDER BY nome')
                
                conti = []
                for row in cursor.fetchall():
                    conti.append({
                        'id': row[0],
                        'nome': row[1]
                    })
                
                return conti
                
        except Exception as e:
            self.logger.error(f"Error getting all conti: {e}")
            raise DatabaseError(f"Failed to retrieve conti: {str(e)}")
    
    def get_conto_by_id(self, conto_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a specific conto by ID.
        
        Args:
            conto_id: Conto ID
            
        Returns:
            Conto dictionary or None if not found
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT id, nome FROM conti WHERE id = ?', (conto_id,))
                
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                return {
                    'id': row[0],
                    'nome': row[1]
                }
                
        except Exception as e:
            self.logger.error(f"Error getting conto {conto_id}: {e}")
            raise DatabaseError(f"Failed to retrieve conto: {str(e)}")
    
    def create_conto(self, nome: str) -> Dict[str, Any]:
        """
        Create a new conto.
        
        Args:
            nome: Conto name
            
        Returns:
            Created conto dictionary
            
        Raises:
            ValidationError: If validation fails
            DatabaseError: If database operation fails
        """
        if not nome or not nome.strip():
            raise ValidationError("Nome conto obbligatorio")
        
        nome = nome.strip()
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('INSERT INTO conti (nome) VALUES (?)', (nome,))
                conto_id = cursor.lastrowid
                conn.commit()
                
                return {
                    'id': conto_id,
                    'nome': nome
                }
                
        except sqlite3.IntegrityError:
            raise ValidationError("Conto già esistente")
        except Exception as e:
            self.logger.error(f"Error creating conto: {e}")
            raise DatabaseError(f"Failed to create conto: {str(e)}")
    
    def update_conto(self, conto_id: int, nome: str) -> Optional[Dict[str, Any]]:
        """
        Update an existing conto.
        
        Args:
            conto_id: Conto ID
            nome: New conto name
            
        Returns:
            Updated conto dictionary or None if not found
            
        Raises:
            ValidationError: If validation fails
            DatabaseError: If database operation fails
        """
        if not nome or not nome.strip():
            raise ValidationError("Nome conto obbligatorio")
        
        nome = nome.strip()
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('UPDATE conti SET nome = ? WHERE id = ?', (nome, conto_id))
                
                if cursor.rowcount == 0:
                    return None
                
                conn.commit()
                
                return {
                    'id': conto_id,
                    'nome': nome
                }
                
        except sqlite3.IntegrityError:
            raise ValidationError("Nome conto già esistente")
        except Exception as e:
            self.logger.error(f"Error updating conto {conto_id}: {e}")
            raise DatabaseError(f"Failed to update conto: {str(e)}")
    
    def delete_conto(self, conto_id: int) -> bool:
        """
        Delete a conto if it has no associated branche.
        
        Args:
            conto_id: Conto ID
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            ValidationError: If conto has associated branche
            DatabaseError: If database operation fails
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if conto has branche
                cursor.execute('SELECT COUNT(*) FROM branche WHERE contoid = ?', (conto_id,))
                if cursor.fetchone()[0] > 0:
                    raise ValidationError("Impossibile eliminare: conto ha branche associate")
                
                cursor.execute('DELETE FROM conti WHERE id = ?', (conto_id,))
                
                if cursor.rowcount == 0:
                    return False
                
                conn.commit()
                return True
                
        except ValidationError:
            raise
        except Exception as e:
            self.logger.error(f"Error deleting conto {conto_id}: {e}")
            raise DatabaseError(f"Failed to delete conto: {str(e)}")

    # ===================== BRANCHE =====================
    
    def get_branche(self, conto_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get branche, optionally filtered by conto.
        
        Args:
            conto_id: Optional conto ID filter
            
        Returns:
            List of branche dictionaries
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                if conto_id:
                    cursor.execute('''
                        SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
                        FROM branche b
                        JOIN conti c ON b.contoid = c.id
                        WHERE b.contoid = ?
                        ORDER BY b.nome
                    ''', (conto_id,))
                else:
                    cursor.execute('''
                        SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
                        FROM branche b
                        JOIN conti c ON b.contoid = c.id
                        ORDER BY c.nome, b.nome
                    ''')
                
                branche = []
                for row in cursor.fetchall():
                    branche.append({
                        'id': row[0],
                        'contoid': row[1],
                        'nome': row[2],
                        'conto_nome': row[3]
                    })
                
                return branche
                
        except Exception as e:
            self.logger.error(f"Error getting branche: {e}")
            raise DatabaseError(f"Failed to retrieve branche: {str(e)}")
    
    # ===================== SOTTOCONTI =====================
    
    def get_sottoconti(self, branca_id: Optional[int] = None, conto_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get sottoconti, optionally filtered by branca or conto.
        
        Args:
            branca_id: Optional branca ID filter
            conto_id: Optional conto ID filter
            
        Returns:
            List of sottoconti dictionaries
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                if branca_id:
                    cursor.execute('''
                        SELECT s.id, s.contoid, s.brancaid, s.nome, 
                               c.nome as conto_nome, b.nome as branca_nome
                        FROM sottoconti s
                        JOIN conti c ON s.contoid = c.id
                        JOIN branche b ON s.brancaid = b.id
                        WHERE s.brancaid = ?
                        ORDER BY s.nome
                    ''', (branca_id,))
                elif conto_id:
                    cursor.execute('''
                        SELECT s.id, s.contoid, s.brancaid, s.nome, 
                               c.nome as conto_nome, b.nome as branca_nome
                        FROM sottoconti s
                        JOIN conti c ON s.contoid = c.id
                        JOIN branche b ON s.brancaid = b.id
                        WHERE s.contoid = ?
                        ORDER BY b.nome, s.nome
                    ''', (conto_id,))
                else:
                    cursor.execute('''
                        SELECT s.id, s.contoid, s.brancaid, s.nome, 
                               c.nome as conto_nome, b.nome as branca_nome
                        FROM sottoconti s
                        JOIN conti c ON s.contoid = c.id
                        JOIN branche b ON s.brancaid = b.id
                        ORDER BY c.nome, b.nome, s.nome
                    ''')
                
                sottoconti = []
                for row in cursor.fetchall():
                    sottoconti.append({
                        'codice': str(row[0]),
                        'descrizione': row[3],
                        'label': f"{row[0]} - {row[3]}",
                        'fonte': 'sqlite',
                        'id': row[0],
                        'contoid': row[1],
                        'brancaid': row[2],
                        'nome': row[3],
                        'conto_nome': row[4],
                        'branca_nome': row[5]
                    })
                
                return sottoconti
                
        except Exception as e:
            self.logger.error(f"Error getting sottoconti: {e}")
            raise DatabaseError(f"Failed to retrieve sottoconti: {str(e)}")