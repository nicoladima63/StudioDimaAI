"""
Base repository pattern for StudioDimaAI Server V2.

Provides a standardized abstract base class for all data access repositories,
with common CRUD operations, query building utilities, and proper error handling.
"""

import sqlite3
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple, Union, Type, Generic, TypeVar
from dataclasses import dataclass
from .database_manager import DatabaseManager, get_database_manager
from .exceptions import RepositoryError, ValidationError, DatabaseError


logger = logging.getLogger(__name__)

# Generic type for entity models
T = TypeVar('T')


@dataclass
class QueryResult:
    """
    Container for query results with metadata.
    """
    data: List[Dict[str, Any]]
    total_count: int
    page: Optional[int] = None
    page_size: Optional[int] = None
    
    @property
    def has_more(self) -> bool:
        """Check if there are more results beyond current page."""
        if self.page is None or self.page_size is None:
            return False
        return (self.page * self.page_size) < self.total_count


@dataclass
class QueryOptions:
    """
    Options for customizing repository queries.
    """
    page: Optional[int] = None
    page_size: Optional[int] = None
    order_by: Optional[str] = None
    order_direction: str = 'ASC'
    filters: Optional[Dict[str, Any]] = None
    include_deleted: bool = False
    
    def __post_init__(self):
        """Validate query options."""
        if self.order_direction not in ('ASC', 'DESC'):
            self.order_direction = 'ASC'
        
        if self.page is not None and self.page < 1:
            self.page = 1
        
        if self.page_size is not None and self.page_size < 1:
            self.page_size = 10


class BaseRepository(ABC, Generic[T]):
    """
    Abstract base repository providing standardized data access patterns.
    
    This class establishes common patterns for:
    - CRUD operations (Create, Read, Update, Delete)
    - Query building and execution
    - Pagination and filtering
    - Error handling and logging
    - Transaction management
    - Data validation
    
    Subclasses must implement table_name and entity-specific methods.
    """
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        """
        Initialize repository with database manager.
        
        Args:
            db_manager: Database manager instance, uses global if None
        """
        self.db_manager = db_manager or get_database_manager()
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @property
    @abstractmethod
    def table_name(self) -> str:
        """
        Get the database table name for this repository.
        
        Returns:
            Table name as string
        """
        pass
    
    @property
    def primary_key(self) -> str:
        """
        Get the primary key column name.
        
        Returns:
            Primary key column name (default: 'id')
        """
        return 'id'
    
    def _build_select_query(
        self, 
        options: Optional[QueryOptions] = None,
        additional_joins: Optional[str] = None,
        additional_conditions: Optional[str] = None
    ) -> Tuple[str, Tuple]:
        """
        Build a SELECT query with options.
        
        Args:
            options: Query options for pagination, filtering, etc.
            additional_joins: Additional JOIN clauses
            additional_conditions: Additional WHERE conditions
            
        Returns:
            Tuple of (query_string, parameters)
        """
        options = options or QueryOptions()
        
        # Base query
        query = f"SELECT * FROM {self.table_name}"
        params = []
        conditions = []
        
        # Add joins
        if additional_joins:
            query += f" {additional_joins}"
        
        # Build WHERE conditions
        if options.filters:
            for field, value in options.filters.items():
                if value is not None:
                    if isinstance(value, (list, tuple)):
                        placeholders = ','.join(['?' for _ in value])
                        conditions.append(f"{field} IN ({placeholders})")
                        params.extend(value)
                    else:
                        conditions.append(f"{field} = ?")
                        params.append(value)
        
        # Add soft delete filter
        if not options.include_deleted:
            conditions.append("(deleted_at IS NULL OR deleted_at = '')")
        
        # Add additional conditions
        if additional_conditions:
            conditions.append(additional_conditions)
        
        # Add WHERE clause
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        # Add ORDER BY
        if options.order_by:
            query += f" ORDER BY {options.order_by} {options.order_direction}"
        
        # Add pagination
        if options.page_size:
            query += " LIMIT ?"
            params.append(options.page_size)
            
            if options.page and options.page > 1:
                offset = (options.page - 1) * options.page_size
                query += " OFFSET ?"
                params.append(offset)
        
        return query, tuple(params)
    
    def _build_insert_query(self, data: Dict[str, Any]) -> Tuple[str, Tuple]:
        """
        Build an INSERT query from data dictionary.
        
        Args:
            data: Dictionary of field values
            
        Returns:
            Tuple of (query_string, parameters)
        """
        # Filter out None values and primary key if auto-increment
        filtered_data = {
            key: value for key, value in data.items() 
            if value is not None and key != self.primary_key
        }
        
        if not filtered_data:
            raise ValidationError("No valid data provided for insert")
        
        fields = list(filtered_data.keys())
        placeholders = ['?' for _ in fields]
        values = list(filtered_data.values())
        
        query = f"""
            INSERT INTO {self.table_name} ({', '.join(fields)})
            VALUES ({', '.join(placeholders)})
        """
        
        return query, tuple(values)
    
    def _build_update_query(
        self, 
        entity_id: Any, 
        data: Dict[str, Any]
    ) -> Tuple[str, Tuple]:
        """
        Build an UPDATE query from data dictionary.
        
        Args:
            entity_id: ID of entity to update
            data: Dictionary of field values to update
            
        Returns:
            Tuple of (query_string, parameters)
        """
        # Filter out None values and primary key
        filtered_data = {
            key: value for key, value in data.items() 
            if key != self.primary_key
        }
        
        if not filtered_data:
            raise ValidationError("No valid data provided for update")
        
        set_clauses = [f"{field} = ?" for field in filtered_data.keys()]
        values = list(filtered_data.values())
        values.append(entity_id)
        
        query = f"""
            UPDATE {self.table_name} 
            SET {', '.join(set_clauses)}
            WHERE {self.primary_key} = ?
        """
        
        return query, tuple(values)
    
    def _validate_entity_data(self, data: Dict[str, Any], is_update: bool = False) -> None:
        """
        Validate entity data before database operations.
        
        Subclasses should override this method to implement specific validation.
        
        Args:
            data: Entity data to validate
            is_update: True if this is an update operation
            
        Raises:
            ValidationError: If validation fails
        """
        # Base validation - ensure data is not empty
        if not data:
            raise ValidationError("Entity data cannot be empty")
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new entity.
        
        Args:
            data: Entity data dictionary
            
        Returns:
            Created entity with ID
            
        Raises:
            RepositoryError: If creation fails
            ValidationError: If data validation fails
        """
        try:
            # Validate data
            self._validate_entity_data(data, is_update=False)
            
            # Build and execute insert query
            query, params = self._build_insert_query(data)
            
            entity_id = None
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                
                # Get the inserted ID
                entity_id = cursor.lastrowid
                cursor.close()
                
            # Return the created entity (fetched after commit)
            created_entity = self.get_by_id(entity_id)
            if created_entity is None:
                raise RepositoryError(
                    f"Failed to retrieve created entity",
                    entity_type=self.table_name,
                    entity_id=entity_id
                )
            
            self.logger.info(f"Created {self.table_name} entity with ID {entity_id}")
            return created_entity
                
        except ValidationError:
            raise
        except Exception as e:
            self.logger.error(f"Failed to create {self.table_name} entity: {e}")
            raise RepositoryError(
                f"Failed to create {self.table_name} entity: {str(e)}",
                entity_type=self.table_name,
                cause=e
            )
    
    def get_by_id(self, entity_id: Any) -> Optional[Dict[str, Any]]:
        """
        Get entity by ID.
        
        Args:
            entity_id: Entity ID
            
        Returns:
            Entity dictionary or None if not found
            
        Raises:
            RepositoryError: If query fails
        """
        try:
            query = f"SELECT * FROM {self.table_name} WHERE {self.primary_key} = ?"
            result = self.db_manager.execute_query(
                query, 
                (entity_id,), 
                fetch_one=True
            )
            
            if result:
                return dict(result)
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to get {self.table_name} by ID {entity_id}: {e}")
            raise RepositoryError(
                f"Failed to get {self.table_name} by ID: {str(e)}",
                entity_type=self.table_name,
                entity_id=entity_id,
                cause=e
            )
    
    def update(self, entity_id: Any, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing entity.
        
        Args:
            entity_id: ID of entity to update
            data: Updated field values
            
        Returns:
            Updated entity dictionary
            
        Raises:
            RepositoryError: If update fails or entity not found
            ValidationError: If data validation fails
        """
        try:
            # Check if entity exists
            existing = self.get_by_id(entity_id)
            if existing is None:
                raise RepositoryError(
                    f"Entity not found",
                    entity_type=self.table_name,
                    entity_id=entity_id
                )
            
            # Validate data
            self._validate_entity_data(data, is_update=True)
            
            # Build and execute update query
            query, params = self._build_update_query(entity_id, data)
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                rows_affected = cursor.rowcount
                cursor.close()
                
                if rows_affected == 0:
                    raise RepositoryError(
                        f"No rows updated",
                        entity_type=self.table_name,
                        entity_id=entity_id
                    )
                
                # Return updated entity
                updated_entity = self.get_by_id(entity_id)
                self.logger.info(f"Updated {self.table_name} entity with ID {entity_id}")
                return updated_entity
                
        except (RepositoryError, ValidationError):
            raise
        except Exception as e:
            self.logger.error(f"Failed to update {self.table_name} entity {entity_id}: {e}")
            raise RepositoryError(
                f"Failed to update {self.table_name} entity: {str(e)}",
                entity_type=self.table_name,
                entity_id=entity_id,
                cause=e
            )
    
    def delete(self, entity_id: Any, soft_delete: bool = True) -> bool:
        """
        Delete an entity.
        
        Args:
            entity_id: ID of entity to delete
            soft_delete: If True, use soft delete (set deleted_at), otherwise hard delete
            
        Returns:
            True if deleted successfully
            
        Raises:
            RepositoryError: If deletion fails
        """
        try:
            # Check if entity exists
            existing = self.get_by_id(entity_id)
            if existing is None:
                raise RepositoryError(
                    f"Entity not found",
                    entity_type=self.table_name,
                    entity_id=entity_id
                )
            
            if soft_delete:
                # Soft delete - set deleted_at timestamp
                import datetime
                query = f"""
                    UPDATE {self.table_name} 
                    SET deleted_at = ? 
                    WHERE {self.primary_key} = ?
                """
                params = (datetime.datetime.now().isoformat(), entity_id)
            else:
                # Hard delete
                query = f"DELETE FROM {self.table_name} WHERE {self.primary_key} = ?"
                params = (entity_id,)
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                rows_affected = cursor.rowcount
                cursor.close()
                
                if rows_affected == 0:
                    raise RepositoryError(
                        f"No rows deleted",
                        entity_type=self.table_name,
                        entity_id=entity_id
                    )
                
                delete_type = "soft" if soft_delete else "hard"
                self.logger.info(f"Performed {delete_type} delete of {self.table_name} entity with ID {entity_id}")
                return True
                
        except RepositoryError:
            raise
        except Exception as e:
            self.logger.error(f"Failed to delete {self.table_name} entity {entity_id}: {e}")
            raise RepositoryError(
                f"Failed to delete {self.table_name} entity: {str(e)}",
                entity_type=self.table_name,
                entity_id=entity_id,
                cause=e
            )
    
    def list(self, options: Optional[QueryOptions] = None) -> QueryResult:
        """
        List entities with optional filtering and pagination.
        
        Args:
            options: Query options for filtering, pagination, etc.
            
        Returns:
            QueryResult with entities and metadata
            
        Raises:
            RepositoryError: If query fails
        """
        try:
            options = options or QueryOptions()
            
            # Get total count for pagination
            count_query, count_params = self._build_select_query(
                QueryOptions(filters=options.filters, include_deleted=options.include_deleted)
            )
            count_query = f"SELECT COUNT(*) as total FROM ({count_query})"
            
            total_count = self.db_manager.execute_query(
                count_query, 
                count_params, 
                fetch_one=True
            )['total']
            
            # Get actual data
            query, params = self._build_select_query(options)
            results = self.db_manager.execute_query(query, params, fetch_all=True)
            
            # Convert to dictionaries
            data = [dict(row) for row in results] if results else []
            
            self.logger.debug(f"Listed {len(data)} {self.table_name} entities (total: {total_count})")
            
            return QueryResult(
                data=data,
                total_count=total_count,
                page=options.page,
                page_size=options.page_size
            )
            
        except Exception as e:
            self.logger.error(f"Failed to list {self.table_name} entities: {e}")
            raise RepositoryError(
                f"Failed to list {self.table_name} entities: {str(e)}",
                entity_type=self.table_name,
                cause=e
            )
    
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities with optional filters.
        
        Args:
            filters: Optional filters to apply
            
        Returns:
            Count of matching entities
        """
        try:
            options = QueryOptions(filters=filters)
            query, params = self._build_select_query(options)
            count_query = f"SELECT COUNT(*) as total FROM ({query})"
            
            result = self.db_manager.execute_query(
                count_query, 
                params, 
                fetch_one=True
            )
            
            return result['total']
            
        except Exception as e:
            self.logger.error(f"Failed to count {self.table_name} entities: {e}")
            raise RepositoryError(
                f"Failed to count {self.table_name} entities: {str(e)}",
                entity_type=self.table_name,
                cause=e
            )
    
    def exists(self, entity_id: Any) -> bool:
        """
        Check if entity exists.
        
        Args:
            entity_id: Entity ID to check
            
        Returns:
            True if entity exists
        """
        try:
            entity = self.get_by_id(entity_id)
            return entity is not None
        except RepositoryError:
            return False
    
    def execute_custom_query(
        self, 
        query: str, 
        params: Optional[Tuple] = None,
        fetch_one: bool = False,
        fetch_all: bool = True
    ) -> Any:
        """
        Execute a custom query with repository error handling.
        
        Args:
            query: SQL query to execute
            params: Query parameters
            fetch_one: Return single result
            fetch_all: Return all results
            
        Returns:
            Query results
            
        Raises:
            RepositoryError: If query fails
        """
        try:
            return self.db_manager.execute_query(
                query, params, fetch_one, fetch_all
            )
        except Exception as e:
            self.logger.error(f"Custom query failed for {self.table_name}: {e}")
            raise RepositoryError(
                f"Custom query failed: {str(e)}",
                entity_type=self.table_name,
                cause=e
            )