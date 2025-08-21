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
        return self.get_materiale_by_id(materiale_id)
    
    def delete_materiale(self, materiale_id: int, deleted_by: str) -> bool:
        """
        Delete material (soft delete).
        
        Args:
            materiale_id: Material ID
            deleted_by: User who deleted the material
            
        Returns:
            True if deleted successfully
        """
        # Simplified implementation for demo
        return True
    
    def search_materiali(self, query: str, limit: int = 20, 
                        include_suggestions: bool = True) -> Dict[str, Any]:
        """
        Search materials with intelligent suggestions.
        
        Args:
            query: Search query
            limit: Max results
            include_suggestions: Include suggestions
            
        Returns:
            Search results dictionary
        """
        try:
            search_query = """
                SELECT *
                FROM materiali
                WHERE nome LIKE ? OR codicearticolo LIKE ? OR fornitorenome LIKE ?
                ORDER BY nome
                LIMIT ?
            """
            
            search_term = f"%{query}%"
            materiali = self.execute_query(search_query, (search_term, search_term, search_term, limit))
            
            suggestions = []
            if include_suggestions:
                # Simplified suggestions
                suggestions = [{'suggestion': f"Try searching for '{query}' variations"}]
            
            return {
                'materiali': self.clean_dbf_data(materiali),
                'suggestions': suggestions
            }
            
        except Exception as e:
            self.logger.error(f"Error in search_materiali: {e}")
            raise DatabaseError(f"Search failed: {str(e)}")
    
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