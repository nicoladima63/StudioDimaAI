"""
Materiali Service for StudioDimaAI Server V2.

Handles business logic for materials management including
classification, search, and CRUD operations.
"""

import logging
from typing import Dict, Any, List, Optional

from .base_service import BaseService
from core.exceptions import ValidationError, DatabaseError


class MaterialiService(BaseService):
    """Service for materials management with optimized queries."""
    
    def get_all_materiali(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Get all materials 
            
        Returns:
            List of all materials
        """
        try:
            # Build base query
            query = """
                SELECT * FROM materiali ORDER BY data_fattura DESC"""
            
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                columns = [description[0] for description in cursor.description]
                materials = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                return materials
                
        except Exception as e:
            logging.error(f"Error getting all materials: {e}")
            raise DatabaseError(f"Failed to get all materials: {str(e)}")

    def get_materiali_paginated(self, page: int = 1, per_page: int = 50, 
                               filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get paginated list of materials with filters.
        
        Args:
            page: Page number
            per_page: Items per page
            filters: Optional filters dictionary
            
        Returns:
            Dictionary with materials and pagination info
        """
        try:
            # Build WHERE clause from filters
            where_conditions = []
            params = []
            
            if filters:
                if filters.get('search'):
                    where_conditions.append("(nome LIKE ? OR codicearticolo LIKE ? OR fornitorenome LIKE ?)")
                    search_term = f"%{filters['search']}%"
                    params.extend([search_term, search_term, search_term])
                
                if filters.get('categoria'):
                    where_conditions.append("categoria_contabile = ?")
                    params.append(filters['categoria'])
                
                if filters.get('fornitore_id'):
                    where_conditions.append("fornitoreid = ?")
                    params.append(filters['fornitore_id'])
            
            where_clause = " WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            # Count total records
            count_query = f"SELECT COUNT(*) as total FROM materiali{where_clause}"
            total_result = self.execute_single_query(count_query, tuple(params))
            total = total_result['total'] if total_result else 0
            
            # Calculate pagination
            offset = (page - 1) * per_page
            pages = (total + per_page - 1) // per_page
            has_next = page < pages
            has_prev = page > 1
            
            # Get materials for current page - select all columns for auto-detect
            query = f"""
                SELECT *
                FROM materiali{where_clause}
                ORDER BY nome
                LIMIT ? OFFSET ?
            """
            
            materiali = self.execute_query(query, tuple(params + [per_page, offset]))
            
            return {
                'materiali': self.clean_dbf_data(materiali),
                'total': total,
                'pages': pages,
                'has_next': has_next,
                'has_prev': has_prev
            }
            
        except Exception as e:
            self.logger.error(f"Error in get_materiali_paginated: {e}")
            raise DatabaseError(f"Failed to retrieve materials: {str(e)}")
    
    def get_materiale_by_id(self, materiale_id: int) -> Optional[Dict[str, Any]]:
        """
        Get specific material by ID.
        
        Args:
            materiale_id: Material ID
            
        Returns:
            Material dictionary or None
        """
        try:
            query = """
                SELECT *
                FROM materiali
                WHERE id = ?
            """
            
            materiale = self.execute_single_query(query, (materiale_id,))
            return self.clean_dbf_data(materiale) if materiale else None
            
        except Exception as e:
            self.logger.error(f"Error in get_materiale_by_id: {e}")
            raise DatabaseError(f"Failed to retrieve material: {str(e)}")
    
    def create_materiale(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """
        Create new material.
        
        Args:
            data: Material data
            created_by: User who created the material
            
        Returns:
            Created material dictionary
        """
        try:
            # Validate required fields
            self.validate_required_fields(data, ['nome'])
            
            # Insert material (simplified for demo)
            query = """
                INSERT INTO materiali (nome, codicearticolo, fornitoreid, fornitorenome, categoria_contabile, costo_unitario)
                VALUES (?, ?, ?, ?, ?, ?)
            """
            
            params = (
                data['nome'],
                data.get('codicearticolo', ''),
                data.get('fornitoreid'),
                data.get('fornitorenome', ''),
                data.get('categoria_contabile', ''),
                data.get('costo_unitario')
            )
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                materiale_id = cursor.lastrowid
                conn.commit()
            
            # Return created material
            return self.get_materiale_by_id(materiale_id)
            
        except Exception as e:
            self.logger.error(f"Error in create_materiale: {e}")
            raise DatabaseError(f"Failed to create material: {str(e)}")
    
    def update_materiale(self, materiale_id: int, data: Dict[str, Any], 
                        updated_by: str) -> Optional[Dict[str, Any]]:
        """
        Update existing material.
        
        Args:
            materiale_id: Material ID
            data: Updated data
            updated_by: User who updated the material
            
        Returns:
            Updated material dictionary or None
        """
        # Simplified implementation for demo
        #return self.get_materiale_by_id(materiale_id)
        try:
            query="""
                UPDATE materiali
                SET nome = ?, codicearticolo = ?, fornitoreid = ?, fornitorenome = ?, categoria_contabile = ?, costo_unitario = ?
                WHERE id = ?
            """
            params = (
                data['nome'],
                data['codicearticolo'],
                data['fornitoreid'],
                data['fornitorenome'],
                data['categoria_contabile'],
                data['costo_unitario'],
                materiale_id
            )
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return self.get_materiale_by_id(materiale_id)
        except Exception as e:
            self.logger.error(f"Error in update_materiale: {e}")
            raise DatabaseError(f"Failed to update material: {str(e)}")
    
    def update_materiale_conti(self, materiale_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Aggiorna solo contoid, contonome, brancaid, brancanome, sottocontoid, sottocontonome
        lasciando invariati gli altri campi del materiale.
        """
        try:
            allowed_fields = {
                'contoid', 'contonome',
                'brancaid', 'brancanome',
                'sottocontoid', 'sottocontonome'
            }

            set_clauses = []
            params = {'id': materiale_id}

            for key, value in data.items():
                if key in allowed_fields:
                    set_clauses.append(f"{key} = :{key}")
                    params[key] = value

            if not set_clauses:
                return self.get_materiale_by_id(materiale_id)

            query = f"UPDATE materiali SET {', '.join(set_clauses)} WHERE id = :id"

            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()

            return self.get_materiale_by_id(materiale_id)

        except Exception as e:
            self.logger.error(f"Error in update_materiale_conti: {e}")
            raise DatabaseError(f"Failed to update conti fields: {str(e)}")

    def delete_materiale(self, materiale_id: int, deleted_by: str) -> bool:
        """
        Delete material (hard delete).
        
        Args:
            materiale_id: Material ID
            deleted_by: User who deleted the material
            
        Returns:
            True if deleted successfully
        """
        try:
            # Hard delete: remove record completely
            query = """
                DELETE FROM materiali 
                WHERE id = ?
            """
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, (materiale_id,))
                conn.commit()
                
                # Check if delete was successful
                if cursor.rowcount > 0:
                    self.logger.info(f"Material {materiale_id} deleted")
                    return True
                else:
                    self.logger.warning(f"No rows deleted for material {materiale_id}")
                    return False
                    
        except Exception as e:
            self.logger.error(f"Error in delete_materiale: {e}")
            raise DatabaseError(f"Failed to delete material: {str(e)}")
    
    def search_materials(self, search_query: str = None, supplier_id: str = None, 
                        classification_filters: Dict[str, Any] = None,
                        page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """
        Search materials with advanced filtering and pagination.
        
        Args:
            search_query: Search term for material description
            supplier_id: Filter by supplier ID
            classification_filters: Filter by classification
            page: Page number
            page_size: Items per page
            
        Returns:
            Search results with pagination
        """
        try:
            # Build WHERE clause
            where_conditions = ["is_active = 1"]
            params = []
            
            if search_query:
                where_conditions.append("(descrizione LIKE ? OR codice_materiale LIKE ? OR nome_fornitore LIKE ?)")
                search_term = f"%{search_query}%"
                params.extend([search_term, search_term, search_term])
            
            if supplier_id:
                where_conditions.append("codice_fornitore = ?")
                params.append(supplier_id)
            
            if classification_filters:
                if classification_filters.get('material_type'):
                    where_conditions.append("material_type = ?")
                    params.append(classification_filters['material_type'])
                
                if classification_filters.get('categoria_materiale'):
                    where_conditions.append("categoria_materiale = ?")
                    params.append(classification_filters['categoria_materiale'])
            
            where_clause = " WHERE " + " AND ".join(where_conditions)
            
            # Count total results
            count_query = f"SELECT COUNT(*) as total FROM materiali{where_clause}"
            total_result = self.execute_single_query(count_query, tuple(params))
            total = total_result['total'] if total_result else 0
            
            # Calculate pagination
            offset = (page - 1) * page_size
            total_pages = (total + page_size - 1) // page_size
            
            # Get materials for current page
            query = f"""
                SELECT id, codice_materiale, descrizione, nome_fornitore,
                       categoria_materiale, material_type, prezzo, costo_unitario,
                       quantita_disponibile, quantita_minima, confidence_score,
                       is_favorite, created_at, updated_at
                FROM materiali{where_clause}
                ORDER BY descrizione
                LIMIT ? OFFSET ?
            """
            
            materials = self.execute_query(query, tuple(params + [page_size, offset]))
            
            return {
                'materials': self.clean_dbf_data(materials) if materials else [],
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_count': total,
                    'total_pages': total_pages,
                    'has_next': page < total_pages,
                    'has_prev': page > 1
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error in search_materials: {e}")
            raise DatabaseError(f"Search failed: {str(e)}")
    
    def get_classification_suggestions(self, material: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get classification suggestions for a material.
        
        Args:
            material: Material dictionary
            
        Returns:
            List of classification suggestions
        """
        # Simplified implementation - could be enhanced with ML
        suggestions = []
        
        descrizione = material.get('descrizione', '').lower()
        
        # Basic keyword-based suggestions
        if 'resina' in descrizione or 'composite' in descrizione:
            suggestions.append({
                'material_type': 'resina',
                'categoria_materiale': 'Materiali da Otturazione',
                'confidence': 85,
                'reason': 'Keyword match: resina/composite'
            })
        elif 'perno' in descrizione or 'post' in descrizione:
            suggestions.append({
                'material_type': 'perni',
                'categoria_materiale': 'Endodonzia',
                'confidence': 80,
                'reason': 'Keyword match: perno/post'
            })
        
        return suggestions[:3]  # Return top 3 suggestions
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get materials statistics."""
        try:
            stats = super().get_statistics()
            
            # Add materials-specific stats
            total_query = "SELECT COUNT(*) as total FROM materiali"
            total_result = self.execute_single_query(total_query)
            
            stats.update({
                'total_materiali': total_result['total'] if total_result else 0,
                'categories': []  # Simplified for demo
            })
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error in get_statistics: {e}")
            return super().get_statistics()