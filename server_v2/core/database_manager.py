"""
Centralized database connection management for StudioDimaAI Server V2.

This module provides a thread-safe connection pool manager that replaces
the 40+ hardcoded SQLite connections throughout the codebase with a
centralized, optimized solution.
"""

import sqlite3
import threading
import time
import logging
import uuid
from contextlib import contextmanager
from queue import Queue, Empty
from typing import Optional, Generator, Any, Dict, List, Tuple
from dataclasses import dataclass
from .config import Config
from .exceptions import DatabaseError, ConnectionPoolError, TransactionError

# Configura logger per rispettare il livello globale
logger = logging.getLogger(__name__)

# Global database manager instance
_db_manager = None


@dataclass
class ConnectionInfo:
    """Information about a database connection."""
    connection: sqlite3.Connection
    created_at: float
    last_used: float
    transaction_id: Optional[str] = None
    is_busy: bool = False


class DatabaseManager:
    """
    Thread-safe database connection pool manager.
    
    Provides centralized connection pooling, transaction management,
    and query execution with proper error handling and logging.
    
    Features:
    - Connection pooling with configurable size limits
    - Automatic connection recycling and cleanup
    - Transaction management with rollback on errors
    - Query timeout handling
    - Thread-safe operations
    - Connection health monitoring
    - Performance optimization with SQLite PRAGMAs
    """
    
    def __init__(self, config: Optional[Config] = None):
        """
        Initialize the database manager.
        
        Args:
            config: Configuration object, uses global config if None
        """
        from .config import config as default_config
        self.config = config or default_config
        
        # Connection pool
        self._pool: Queue[ConnectionInfo] = Queue(maxsize=self.config.pool_size)
        self._overflow_connections: Dict[str, ConnectionInfo] = {}
        self._pool_lock = threading.RLock()
        self._connection_counter = 0
        
        # Transaction tracking
        self._active_transactions: Dict[str, ConnectionInfo] = {}
        self._transaction_lock = threading.RLock()
        
        # Statistics
        self._stats = {
            'connections_created': 0,
            'connections_closed': 0,
            'pool_hits': 0,
            'pool_misses': 0,
            'overflow_reuses': 0,
            'transactions_committed': 0,
            'transactions_rolled_back': 0,
            'queries_executed': 0,
            'errors_occurred': 0
        }
        self._stats_lock = threading.Lock()
        
        # Initialize pool
        self._initialize_pool()
        
        # Start cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_running = True
        self._cleanup_thread.start()
        
        logger.info(f"DatabaseManager initialized with pool_size={self.config.pool_size}")
    
    def _initialize_pool(self) -> None:
        """Initialize the connection pool with minimum connections."""
        try:
            for _ in range(min(2, self.config.pool_size)):  # Start with 2 connections
                connection_info = self._create_connection()
                self._pool.put_nowait(connection_info)
        except Exception as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            raise ConnectionPoolError(
                "Failed to initialize connection pool",
                cause=e,
                details={'config_path': self.config.db_path}
            )
    
    def _create_connection(self) -> ConnectionInfo:
        """
        Create a new database connection with optimizations.
        
        Returns:
            ConnectionInfo object with new connection
        """
        try:
            # Create connection with optimizations
            conn = sqlite3.connect(
                self.config.db_path,
                timeout=self.config.query_timeout,
                check_same_thread=False,
                isolation_level=None  # Autocommit mode for better control
            )
            
            # Enable row factory for dict-like access
            conn.row_factory = sqlite3.Row
            
            # Apply performance PRAGMAs
            cursor = conn.cursor()
            for pragma in self.config.get_pragma_statements():
                cursor.execute(pragma)
            cursor.close()
            
            connection_info = ConnectionInfo(
                connection=conn,
                created_at=time.time(),
                last_used=time.time()
            )
            
            with self._stats_lock:
                self._stats['connections_created'] += 1
                self._connection_counter += 1
            
            logger.debug(f"Created new database connection #{self._connection_counter}")
            return connection_info
            
        except Exception as e:
            with self._stats_lock:
                self._stats['errors_occurred'] += 1
            
            logger.error(f"Failed to create database connection: {e}")
            raise DatabaseError(
                "Failed to create database connection",
                cause=e,
                details={'db_path': self.config.db_path}
            )
    
    def _get_connection_from_pool(self) -> Optional[ConnectionInfo]:
        """
        Get a connection from the pool if available.
        
        Returns:
            ConnectionInfo if available, None otherwise
        """
        try:
            connection_info = self._pool.get_nowait()
            connection_info.last_used = time.time()
            connection_info.is_busy = True
            
            with self._stats_lock:
                self._stats['pool_hits'] += 1
            
            return connection_info
        except Empty:
            return None
    
    def _return_connection_to_pool(self, connection_info: ConnectionInfo) -> None:
        """
        Return a connection to the pool.
        
        Args:
            connection_info: Connection to return
        """
        connection_info.is_busy = False
        connection_info.last_used = time.time()
        
        try:
            # Reset connection state
            connection_info.connection.rollback()
            self._pool.put_nowait(connection_info)
        except Exception as e:
            logger.warning(f"Failed to return connection to pool, closing: {e}")
            self._close_connection(connection_info)
    
    def _close_connection(self, connection_info: ConnectionInfo) -> None:
        """
        Close a database connection.
        
        Args:
            connection_info: Connection to close
        """
        try:
            connection_info.connection.close()
            with self._stats_lock:
                self._stats['connections_closed'] += 1
            logger.debug("Closed database connection")
        except Exception as e:
            logger.warning(f"Error closing connection: {e}")
    
    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """
        Get a database connection from the pool.
        
        This is a context manager that ensures proper connection handling.
        The connection is automatically returned to the pool when done.
        
        Yields:
            sqlite3.Connection: Database connection
            
        Raises:
            ConnectionPoolError: If unable to acquire connection
        """
        connection_info = None
        overflow_id = None
        
        try:
            # Try to get from pool first
            with self._pool_lock:
                connection_info = self._get_connection_from_pool()
            
            # If pool is empty, try overflow
            if connection_info is None:
                # First, try to reuse existing overflow connections
                if self._overflow_connections:
                    # Get the least recently used overflow connection
                    oldest_id = min(self._overflow_connections.keys(), 
                                  key=lambda k: self._overflow_connections[k].last_used)
                    connection_info = self._overflow_connections[oldest_id]
                    overflow_id = oldest_id
                    connection_info.is_busy = True
                    connection_info.last_used = time.time()
                    
                    with self._stats_lock:
                        self._stats['overflow_reuses'] += 1
                elif len(self._overflow_connections) < self.config.max_overflow:
                    connection_info = self._create_connection()
                    overflow_id = str(uuid.uuid4())
                    self._overflow_connections[overflow_id] = connection_info
                    
                    with self._stats_lock:
                        self._stats['pool_misses'] += 1
                else:
                    # Wait for a connection to become available
                    start_time = time.time()
                    while time.time() - start_time < self.config.pool_timeout:
                        with self._pool_lock:
                            connection_info = self._get_connection_from_pool()
                        if connection_info:
                            break
                        time.sleep(0.1)
                    
                    if connection_info is None:
                        raise ConnectionPoolError(
                            "Connection pool exhausted and timeout reached",
                            pool_size=self.config.pool_size,
                            active_connections=len(self._overflow_connections)
                        )
            
            yield connection_info.connection
            
        except Exception as e:
            if connection_info and hasattr(connection_info.connection, 'rollback'):
                try:
                    connection_info.connection.rollback()
                except:
                    pass  # Connection might be closed
            raise
            
        finally:
            if connection_info:
                if overflow_id:
                    # Try to return overflow connection to pool instead of closing
                    with self._pool_lock:
                        if self._pool.qsize() < self.config.pool_size:
                            # Pool has space, return connection to pool
                            self._overflow_connections.pop(overflow_id, None)
                            self._return_connection_to_pool(connection_info)
                        else:
                            # Pool full, keep in overflow for reuse
                            connection_info.last_used = time.time()
                else:
                    # Return to pool
                    self._return_connection_to_pool(connection_info)
    
    @contextmanager
    def transaction(self) -> Generator[sqlite3.Connection, None, None]:
        """
        Execute operations within a database transaction.
        
        Automatically commits on success or rolls back on exception.
        
        Yields:
            sqlite3.Connection: Database connection in transaction
            
        Raises:
            TransactionError: If transaction fails
        """
        transaction_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            try:
                # Begin transaction
                conn.execute("BEGIN")
                
                # Track transaction
                with self._transaction_lock:
                    connection_info = ConnectionInfo(
                        connection=conn,
                        created_at=time.time(),
                        last_used=time.time(),
                        transaction_id=transaction_id
                    )
                    self._active_transactions[transaction_id] = connection_info
                
                logger.debug(f"Started transaction {transaction_id}")
                yield conn
                
                # Commit transaction
                conn.commit()
                with self._stats_lock:
                    self._stats['transactions_committed'] += 1
                
                logger.debug(f"Committed transaction {transaction_id}")
                
            except Exception as e:
                try:
                    conn.rollback()
                    with self._stats_lock:
                        self._stats['transactions_rolled_back'] += 1
                    logger.debug(f"Rolled back transaction {transaction_id}")
                except Exception as rollback_error:
                    logger.error(f"Failed to rollback transaction {transaction_id}: {rollback_error}")
                
                raise TransactionError(
                    f"Transaction failed: {str(e)}",
                    transaction_id=transaction_id,
                    cause=e
                )
            finally:
                # Remove from active transactions
                with self._transaction_lock:
                    self._active_transactions.pop(transaction_id, None)
    
    def execute_query(
        self,
        query: str,
        parameters: Optional[Tuple] = None,
        fetch_one: bool = False,
        fetch_all: bool = True
    ) -> Any:
        """
        Execute a database query with proper error handling.
        
        Args:
            query: SQL query to execute
            parameters: Query parameters
            fetch_one: If True, return only first result
            fetch_all: If True, return all results (ignored if fetch_one=True)
            
        Returns:
            Query results or None
            
        Raises:
            DatabaseError: If query execution fails
        """
        start_time = time.time()
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                if parameters:
                    cursor.execute(query, parameters)
                else:
                    cursor.execute(query)
                
                result = None
                if fetch_one:
                    result = cursor.fetchone()
                    if result: # Convert single row
                        result = dict(result)
                elif fetch_all and query.strip().upper().startswith('SELECT'):
                    result = cursor.fetchall()
                    # Convert sqlite3.Row objects to dictionaries for JSON serialization
                    if result:
                        result = [dict(row) for row in result]
                elif not query.strip().upper().startswith('SELECT'):
                    result = cursor.rowcount
                
                cursor.close()
                
                with self._stats_lock:
                    self._stats['queries_executed'] += 1
                
                execution_time = time.time() - start_time
                logger.debug(f"Query executed in {execution_time:.3f}s: {query[:100]}...")
                
                return result
                
        except Exception as e:
            with self._stats_lock:
                self._stats['errors_occurred'] += 1
            
            logger.error(f"Query execution failed: {e}")
            raise DatabaseError(
                f"Query execution failed: {str(e)}",
                query=query,
                parameters=parameters,
                cause=e
            )
    
    def execute_many(self, query: str, parameters_list: List[Tuple]) -> int:
        """
        Execute a query multiple times with different parameters.
        
        Args:
            query: SQL query to execute
            parameters_list: List of parameter tuples
            
        Returns:
            Total number of affected rows
            
        Raises:
            DatabaseError: If query execution fails
        """
        try:
            with self.transaction() as conn:
                cursor = conn.cursor()
                cursor.executemany(query, parameters_list)
                result = cursor.rowcount
                cursor.close()
                
                with self._stats_lock:
                    self._stats['queries_executed'] += len(parameters_list)
                
                logger.debug(f"Executed batch query with {len(parameters_list)} parameter sets")
                return result
                
        except Exception as e:
            with self._stats_lock:
                self._stats['errors_occurred'] += 1
            
            logger.error(f"Batch query execution failed: {e}")
            raise DatabaseError(
                f"Batch query execution failed: {str(e)}",
                query=query,
                parameters=parameters_list[:5] if parameters_list else None,  # Log first 5 only
                cause=e
            )
    
    def _cleanup_loop(self) -> None:
        """Background thread for connection cleanup and maintenance."""
        while self._cleanup_running:
            try:
                current_time = time.time()
                
                # Clean up old overflow connections
                expired_connections = []
                for conn_id, conn_info in self._overflow_connections.items():
                    if (current_time - conn_info.last_used) > self.config.pool_recycle:
                        expired_connections.append(conn_id)
                
                for conn_id in expired_connections:
                    conn_info = self._overflow_connections.pop(conn_id, None)
                    if conn_info:
                        self._close_connection(conn_info)
                        logger.debug(f"Cleaned up expired overflow connection {conn_id}")
                
                # Log statistics periodically
                if int(current_time) % 300 == 0:  # Every 5 minutes
                    self._log_statistics()
                
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                time.sleep(60)
    
    def _log_statistics(self) -> None:
        """Log connection pool statistics."""
        with self._stats_lock:
            stats = self._stats.copy()
        
        pool_size = self._pool.qsize()
        overflow_size = len(self._overflow_connections)
        active_transactions = len(self._active_transactions)
        
        logger.info(
            f"DatabaseManager stats - "
            f"Pool: {pool_size}/{self.config.pool_size}, "
            f"Overflow: {overflow_size}/{self.config.max_overflow}, "
            f"Active transactions: {active_transactions}, "
            f"Created: {stats['connections_created']}, "
            f"Closed: {stats['connections_closed']}, "
            f"Queries: {stats['queries_executed']}, "
            f"Errors: {stats['errors_occurred']}"
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get current database manager statistics.
        
        Returns:
            Dictionary with current statistics
        """
        with self._stats_lock:
            stats = self._stats.copy()
        
        stats.update({
            'pool_size': self._pool.qsize(),
            'max_pool_size': self.config.pool_size,
            'overflow_connections': len(self._overflow_connections),
            'max_overflow': self.config.max_overflow,
            'active_transactions': len(self._active_transactions),
            'pool_utilization': (self.config.pool_size - self._pool.qsize()) / self.config.pool_size * 100
        })
        
        return stats
    
    def close(self) -> None:
        """
        Close all connections and shutdown the manager.
        """
        logger.info("Shutting down DatabaseManager...")
        
        # Stop cleanup thread
        self._cleanup_running = False
        if self._cleanup_thread.is_alive():
            self._cleanup_thread.join(timeout=5)
        
        # Close all pool connections
        while not self._pool.empty():
            try:
                connection_info = self._pool.get_nowait()
                self._close_connection(connection_info)
            except Empty:
                break
        
        # Close overflow connections
        for conn_info in self._overflow_connections.values():
            self._close_connection(conn_info)
        self._overflow_connections.clear()
        
        # Force close any active transactions
        for conn_info in self._active_transactions.values():
            try:
                conn_info.connection.rollback()
                self._close_connection(conn_info)
            except:
                pass
        self._active_transactions.clear()
        
        logger.info("DatabaseManager shutdown complete")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


# Global database manager instance
_db_manager: Optional[DatabaseManager] = None
_db_manager_lock = threading.Lock()


def get_database_manager() -> DatabaseManager:
    """
    Get the global database manager instance.
    
    Returns:
        DatabaseManager: Global database manager instance
    """
    global _db_manager
    
    if _db_manager is None:
        with _db_manager_lock:
            if _db_manager is None:
                _db_manager = DatabaseManager()
    
    return _db_manager


def initialize_database_manager(config: Optional[Config] = None) -> DatabaseManager:
    """
    Initialize the global database manager with optional configuration.
    
    Args:
        config: Configuration object
        
    Returns:
        DatabaseManager: Initialized database manager
    """
    global _db_manager
    
    with _db_manager_lock:
        if _db_manager is not None:
            _db_manager.close()
        _db_manager = DatabaseManager(config)
    
    return _db_manager


def close_database_manager() -> None:
    """Close the global database manager."""
    global _db_manager
    
    with _db_manager_lock:
        if _db_manager is not None:
            _db_manager.close()
            _db_manager = None