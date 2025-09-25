"""
Base service class for StudioDimaAI Server V2.

Provides common functionality for all service classes including
database access, error handling, and logging.
"""

import logging
from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod

from core.database_manager import DatabaseManager
from core.exceptions import ValidationError, DatabaseError


class BaseService(ABC):
    """
    Abstract base class for all service classes.
    
    Provides common functionality including database access,
    error handling, logging, and transaction management.
    """
    
    def __init__(self, database_manager: DatabaseManager):
        """
        Initialize service with database manager.
        
        Args:
            database_manager: DatabaseManager instance
        """
        self.db_manager = database_manager
        self.logger = logging.getLogger(self.__class__.__name__)
    
    def validate_required_fields(self, data: Dict[str, Any], required_fields: List[str]) -> None:
        """
        Validate that required fields are present in data.
        
        Args:
            data: Data dictionary to validate
            required_fields: List of required field names
            
        Raises:
            ValidationError: If any required field is missing
        """
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")
    
    def clean_dbf_data(self, data: Any) -> Any:
        """
        Clean DBF data for JSON serialization.
        
        Args:
            data: Data to clean
            
        Returns:
            Cleaned data
        """
        from utils.dbf_utils import clean_dbf_value
        
        if isinstance(data, list):
            return [self.clean_dbf_data(item) for item in data]
        elif isinstance(data, dict):
            return {key: self.clean_dbf_data(value) for key, value in data.items()}
        else:
            return clean_dbf_value(data)
    
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """
        Execute a query and return results as list of dictionaries.
        
        Args:
            query: SQL query
            params: Query parameters
            
        Returns:
            List of result dictionaries
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                
                # Get column names
                columns = [description[0] for description in cursor.description] if cursor.description else []
                
                # Fetch results and convert to dictionaries
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
                
        except Exception as e:
            self.logger.error(f"Query execution failed: {e}")
            raise DatabaseError(f"Database query failed: {str(e)}")
    
    def execute_single_query(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """
        Execute a query and return single result as dictionary.
        
        Args:
            query: SQL query
            params: Query parameters
            
        Returns:
            Single result dictionary or None
        """
        results = self.execute_query(query, params)
        return results[0] if results else None
    
    def execute_command(self, command: str, params: tuple = ()) -> int:
        """
        Execute a command (INSERT, UPDATE, DELETE) and return affected rows.
        
        Args:
            command: SQL command
            params: Command parameters
            
        Returns:
            Number of affected rows
        """
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(command, params)
                conn.commit()
                return cursor.rowcount
                
        except Exception as e:
            self.logger.error(f"Command execution failed: {e}")
            raise DatabaseError(f"Database command failed: {str(e)}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get basic statistics for this service.
        
        Returns:
            Statistics dictionary
        """
        return {
            'service_name': self.__class__.__name__,
            'database_stats': self.db_manager.get_statistics()
        }