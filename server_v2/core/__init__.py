"""
Core infrastructure components for StudioDimaAI Server V2.

This module contains the foundational components:
- DatabaseManager: Centralized connection pooling and transaction management
- BaseRepository: Abstract repository pattern for data access
- Custom exceptions for proper error handling
- Configuration management
"""

from .database_manager import DatabaseManager
from .base_repository import BaseRepository
from .exceptions import (
    StudioDimaError,
    DatabaseError,
    ConnectionPoolError,
    RepositoryError,
    ValidationError
)
from .config import Config

__all__ = [
    'DatabaseManager',
    'BaseRepository', 
    'StudioDimaError',
    'DatabaseError',
    'ConnectionPoolError',
    'RepositoryError',
    'ValidationError',
    'Config'
]