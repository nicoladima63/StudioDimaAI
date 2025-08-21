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
    
    def get_branca_by_id(self, branca_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a specific branca by ID.
        
        Args:
            branca_id: Branca ID
            
        Returns:
            Branca dictionary or None if not found
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
                    FROM branche b
                    JOIN conti c ON b.contoid = c.id
                    WHERE b.id = ?
                ''', (branca_id,))
                
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                return {
                    'id': row[0],
                    'contoid': row[1],
                    'contoId': row[1],  # Frontend compatibility
                    'nome': row[2],
                    'conto_nome': row[3]
                }
                
        except Exception as e:
            self.logger.error(f"Error getting branca {branca_id}: {e}")
            raise DatabaseError(f"Failed to retrieve branca: {str(e)}")
    
    def create_branca(self, nome: str, contoid: int) -> Dict[str, Any]:
        """
        Create a new branca.
        
        Args:
            nome: Branca name
            contoid: Parent conto ID
            
        Returns:
            Created branca dictionary
            
        Raises:
            ValidationError: If validation fails
            DatabaseError: If database operation fails
        """
        if not nome or not nome.strip():
            raise ValidationError("Nome branca obbligatorio")
        
        if not contoid:
            raise ValidationError("Conto ID obbligatorio")
        
        nome = nome.strip()
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if conto exists
                cursor.execute('SELECT id FROM conti WHERE id = ?', (contoid,))
                if not cursor.fetchone():
                    raise ValidationError("Conto non trovato")
                
                cursor.execute('INSERT INTO branche (nome, contoid) VALUES (?, ?)', (nome, contoid))
                branca_id = cursor.lastrowid
                conn.commit()
                
                return {
                    'id': branca_id,
                    'nome': nome,
                    'contoid': contoid,
                    'contoId': contoid  # Frontend compatibility
                }
                
        except ValidationError:
            raise
        except sqlite3.IntegrityError:
            raise ValidationError("Branca già esistente per questo conto")
        except Exception as e:
            self.logger.error(f"Error creating branca: {e}")
            raise DatabaseError(f"Failed to create branca: {str(e)}")
    
    def update_branca(self, branca_id: int, nome: str) -> Optional[Dict[str, Any]]:
        """
        Update an existing branca.
        
        Args:
            branca_id: Branca ID
            nome: New branca name
            
        Returns:
            Updated branca dictionary or None if not found
            
        Raises:
            ValidationError: If validation fails
            DatabaseError: If database operation fails
        """
        if not nome or not nome.strip():
            raise ValidationError("Nome branca obbligatorio")
        
        nome = nome.strip()
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('UPDATE branche SET nome = ? WHERE id = ?', (nome, branca_id))
                
                if cursor.rowcount == 0:
                    return None
                
                # Get the updated branca with conto info
                cursor.execute('''
                    SELECT b.id, b.contoid, b.nome, c.nome as conto_nome
                    FROM branche b
                    JOIN conti c ON b.contoid = c.id
                    WHERE b.id = ?
                ''', (branca_id,))
                
                row = cursor.fetchone()
                conn.commit()
                
                return {
                    'id': row[0],
                    'contoid': row[1],
                    'contoId': row[1],  # Frontend compatibility
                    'nome': row[2],
                    'conto_nome': row[3]
                }
                
        except sqlite3.IntegrityError:
            raise ValidationError("Nome branca già esistente per questo conto")
        except Exception as e:
            self.logger.error(f"Error updating branca {branca_id}: {e}")
            raise DatabaseError(f"Failed to update branca: {str(e)}")
    
    def delete_branca(self, branca_id: int) -> bool:
        """
        Delete a branca if it has no associated sottoconti.
        
        Args:
            branca_id: Branca ID
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            ValidationError: If branca has associated sottoconti
            DatabaseError: If database operation fails
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if branca has sottoconti
                cursor.execute('SELECT COUNT(*) FROM sottoconti WHERE brancaid = ?', (branca_id,))
                if cursor.fetchone()[0] > 0:
                    raise ValidationError("Impossibile eliminare: branca ha sottoconti associati")
                
                cursor.execute('DELETE FROM branche WHERE id = ?', (branca_id,))
                
                if cursor.rowcount == 0:
                    return False
                
                conn.commit()
                return True
                
        except ValidationError:
            raise
        except Exception as e:
            self.logger.error(f"Error deleting branca {branca_id}: {e}")
            raise DatabaseError(f"Failed to delete branca: {str(e)}")
    
    def get_sottoconto_by_id(self, sottoconto_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a specific sottoconto by ID.
        
        Args:
            sottoconto_id: Sottoconto ID
            
        Returns:
            Sottoconto dictionary or None if not found
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT s.id, s.contoid, s.brancaid, s.nome, 
                           c.nome as conto_nome, b.nome as branca_nome
                    FROM sottoconti s
                    JOIN conti c ON s.contoid = c.id
                    JOIN branche b ON s.brancaid = b.id
                    WHERE s.id = ?
                ''', (sottoconto_id,))
                
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                return {
                    'id': row[0],
                    'contoid': row[1],
                    'contoId': row[1],  # Frontend compatibility
                    'brancaid': row[2],
                    'brancaId': row[2],  # Frontend compatibility
                    'nome': row[3],
                    'conto_nome': row[4],
                    'branca_nome': row[5]
                }
                
        except Exception as e:
            self.logger.error(f"Error getting sottoconto {sottoconto_id}: {e}")
            raise DatabaseError(f"Failed to retrieve sottoconto: {str(e)}")
    
    def create_sottoconto(self, nome: str, brancaid: int) -> Dict[str, Any]:
        """
        Create a new sottoconto.
        
        Args:
            nome: Sottoconto name
            brancaid: Parent branca ID
            
        Returns:
            Created sottoconto dictionary
            
        Raises:
            ValidationError: If validation fails
            DatabaseError: If database operation fails
        """
        if not nome or not nome.strip():
            raise ValidationError("Nome sottoconto obbligatorio")
        
        if not brancaid:
            raise ValidationError("Branca ID obbligatorio")
        
        nome = nome.strip()
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if branca exists and get contoid
                cursor.execute('SELECT contoid FROM branche WHERE id = ?', (brancaid,))
                branca_row = cursor.fetchone()
                if not branca_row:
                    raise ValidationError("Branca non trovata")
                
                contoid = branca_row[0]
                
                cursor.execute('''
                    INSERT INTO sottoconti (nome, brancaid, contoid) 
                    VALUES (?, ?, ?)
                ''', (nome, brancaid, contoid))
                sottoconto_id = cursor.lastrowid
                conn.commit()
                
                return {
                    'id': sottoconto_id,
                    'nome': nome,
                    'brancaid': brancaid,
                    'brancaId': brancaid,  # Frontend compatibility
                    'contoid': contoid,
                    'contoId': contoid  # Frontend compatibility
                }
                
        except ValidationError:
            raise
        except sqlite3.IntegrityError:
            raise ValidationError("Sottoconto già esistente per questa branca")
        except Exception as e:
            self.logger.error(f"Error creating sottoconto: {e}")
            raise DatabaseError(f"Failed to create sottoconto: {str(e)}")
    
    def update_sottoconto(self, sottoconto_id: int, nome: str) -> Optional[Dict[str, Any]]:
        """
        Update an existing sottoconto.
        
        Args:
            sottoconto_id: Sottoconto ID
            nome: New sottoconto name
            
        Returns:
            Updated sottoconto dictionary or None if not found
            
        Raises:
            ValidationError: If validation fails
            DatabaseError: If database operation fails
        """
        if not nome or not nome.strip():
            raise ValidationError("Nome sottoconto obbligatorio")
        
        nome = nome.strip()
        
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('UPDATE sottoconti SET nome = ? WHERE id = ?', (nome, sottoconto_id))
                
                if cursor.rowcount == 0:
                    return None
                
                # Get the updated sottoconto with related info
                cursor.execute('''
                    SELECT s.id, s.contoid, s.brancaid, s.nome, 
                           c.nome as conto_nome, b.nome as branca_nome
                    FROM sottoconti s
                    JOIN conti c ON s.contoid = c.id
                    JOIN branche b ON s.brancaid = b.id
                    WHERE s.id = ?
                ''', (sottoconto_id,))
                
                row = cursor.fetchone()
                conn.commit()
                
                return {
                    'id': row[0],
                    'contoid': row[1],
                    'contoId': row[1],  # Frontend compatibility
                    'brancaid': row[2],
                    'brancaId': row[2],  # Frontend compatibility
                    'nome': row[3],
                    'conto_nome': row[4],
                    'branca_nome': row[5]
                }
                
        except sqlite3.IntegrityError:
            raise ValidationError("Nome sottoconto già esistente per questa branca")
        except Exception as e:
            self.logger.error(f"Error updating sottoconto {sottoconto_id}: {e}")
            raise DatabaseError(f"Failed to update sottoconto: {str(e)}")
    
    def delete_sottoconto(self, sottoconto_id: int) -> bool:
        """
        Delete a sottoconto if it has no associated classificazioni.
        
        Args:
            sottoconto_id: Sottoconto ID
            
        Returns:
            True if deleted, False if not found
            
        Raises:
            ValidationError: If sottoconto has associated classificazioni
            DatabaseError: If database operation fails
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if sottoconto has classificazioni (if table exists)
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='classificazioni_costi'
                """)
                
                if cursor.fetchone():
                    cursor.execute('SELECT COUNT(*) FROM classificazioni_costi WHERE sottocontoid = ?', (sottoconto_id,))
                    if cursor.fetchone()[0] > 0:
                        raise ValidationError("Impossibile eliminare: sottoconto ha classificazioni associate")
                
                cursor.execute('DELETE FROM sottoconti WHERE id = ?', (sottoconto_id,))
                
                if cursor.rowcount == 0:
                    return False
                
                conn.commit()
                return True
                
        except ValidationError:
            raise
        except Exception as e:
            self.logger.error(f"Error deleting sottoconto {sottoconto_id}: {e}")
            raise DatabaseError(f"Failed to delete sottoconto: {str(e)}")
    
    def get_struttura_completa(self) -> Dict[str, Any]:
        """
        Get complete conti structure with branche and sottoconti.
        
        Returns:
            Dictionary with complete structure
        """
        try:
            conti = self.get_all_conti()
            
            for conto in conti:
                branche = self.get_branche(conto['id'])
                conto['branche'] = branche
                
                for branca in branche:
                    sottoconti = self.get_sottoconti(branca['id'])
                    branca['sottoconti'] = sottoconti
            
            return {
                'conti': conti,
                'total_conti': len(conti),
                'total_branche': sum(len(c.get('branche', [])) for c in conti),
                'total_sottoconti': sum(
                    sum(len(b.get('sottoconti', [])) for b in c.get('branche', []))
                    for c in conti
                )
            }
            
        except Exception as e:
            self.logger.error(f"Error getting struttura completa: {e}")
            raise DatabaseError(f"Failed to retrieve complete structure: {str(e)}")