"""
Custom exception classes for StudioDimaAI Server V2.

Provides a hierarchy of custom exceptions for proper error handling
throughout the application stack.
"""

from typing import Optional, Any, Dict


class StudioDimaError(Exception):
    """
    Base exception class for all StudioDimaAI Server V2 errors.
    
    All custom exceptions should inherit from this base class to ensure
    consistent error handling throughout the application.
    """
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None
    ):
        """
        Initialize StudioDimaError.
        
        Args:
            message: Human-readable error message
            error_code: Machine-readable error code for programmatic handling
            details: Additional error details as key-value pairs
            cause: Original exception that caused this error (if any)
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.cause = cause
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert exception to dictionary for JSON serialization.
        
        Returns:
            Dictionary representation of the exception
        """
        result = {
            "error": self.__class__.__name__,
            "message": self.message,
        }
        
        if self.error_code:
            result["error_code"] = self.error_code
            
        if self.details:
            result["details"] = self.details
            
        if self.cause:
            result["cause"] = str(self.cause)
            
        return result


class DatabaseError(StudioDimaError):
    """
    Exception raised for database-related errors.
    
    Covers general database connectivity, query execution,
    and data integrity issues.
    """
    
    def __init__(
        self,
        message: str,
        query: Optional[str] = None,
        parameters: Optional[tuple] = None,
        **kwargs
    ):
        """
        Initialize DatabaseError.
        
        Args:
            message: Error message
            query: SQL query that caused the error (if applicable)
            parameters: Query parameters (if applicable)
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if query:
            details['query'] = query
        if parameters:
            details['parameters'] = parameters
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class ConnectionPoolError(DatabaseError):
    """
    Exception raised for connection pool-related errors.
    
    Includes pool exhaustion, connection timeouts, and pool
    configuration issues.
    """
    
    def __init__(
        self,
        message: str,
        pool_size: Optional[int] = None,
        active_connections: Optional[int] = None,
        **kwargs
    ):
        """
        Initialize ConnectionPoolError.
        
        Args:
            message: Error message
            pool_size: Maximum pool size
            active_connections: Number of active connections
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if pool_size is not None:
            details['pool_size'] = pool_size
        if active_connections is not None:
            details['active_connections'] = active_connections
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class RepositoryError(StudioDimaError):
    """
    Exception raised for repository layer errors.
    
    Covers entity not found, validation failures, and
    repository-specific business logic errors.
    """
    
    def __init__(
        self,
        message: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[Any] = None,
        **kwargs
    ):
        """
        Initialize RepositoryError.
        
        Args:
            message: Error message
            entity_type: Type of entity involved in the error
            entity_id: ID of the specific entity (if applicable)
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if entity_type:
            details['entity_type'] = entity_type
        if entity_id is not None:
            details['entity_id'] = entity_id
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class ValidationError(StudioDimaError):
    """
    Exception raised for data validation errors.
    
    Includes field validation failures, constraint violations,
    and business rule validation errors.
    """
    
    def __init__(
        self,
        message: str,
        field_name: Optional[str] = None,
        field_value: Optional[Any] = None,
        validation_rule: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize ValidationError.
        
        Args:
            message: Error message
            field_name: Name of the field that failed validation
            field_value: Value that failed validation
            validation_rule: Description of the validation rule that failed
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if field_name:
            details['field_name'] = field_name
        if field_value is not None:
            details['field_value'] = field_value
        if validation_rule:
            details['validation_rule'] = validation_rule
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class TransactionError(DatabaseError):
    """
    Exception raised for transaction management errors.
    
    Includes transaction rollback failures, deadlocks,
    and transaction timeout issues.
    """
    
    def __init__(
        self,
        message: str,
        transaction_id: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize TransactionError.
        
        Args:
            message: Error message
            transaction_id: ID of the transaction (if available)
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if transaction_id:
            details['transaction_id'] = transaction_id
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class DbfProcessingError(StudioDimaError):
    """
    Exception raised for DBF file processing errors.
    
    Includes file reading errors, data conversion failures,
    and DBF format issues.
    """
    
    def __init__(
        self,
        message: str,
        file_path: Optional[str] = None,
        record_number: Optional[int] = None,
        field_name: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize DbfProcessingError.
        
        Args:
            message: Error message
            file_path: Path to the DBF file
            record_number: Record number that caused the error
            field_name: Field name that caused the error
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if file_path:
            details['file_path'] = file_path
        if record_number is not None:
            details['record_number'] = record_number
        if field_name:
            details['field_name'] = field_name
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class ConfigurationError(StudioDimaError):
    """
    Exception raised for configuration-related errors.
    
    Includes missing configuration values, invalid settings,
    and environment setup issues.
    """
    
    def __init__(
        self,
        message: str,
        setting_name: Optional[str] = None,
        setting_value: Optional[Any] = None,
        **kwargs
    ):
        """
        Initialize ConfigurationError.
        
        Args:
            message: Error message
            setting_name: Name of the problematic setting
            setting_value: Value of the problematic setting
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if setting_name:
            details['setting_name'] = setting_name
        if setting_value is not None:
            details['setting_value'] = setting_value
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class RicettaServiceError(StudioDimaError):
    """
    Exception raised for ricetta elettronica service errors.
    
    Includes SSL/TLS issues, Sistema TS communication errors,
    and ricetta processing failures.
    """
    
    def __init__(
        self,
        message: str,
        service_endpoint: Optional[str] = None,
        error_type: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize RicettaServiceError.
        
        Args:
            message: Error message
            service_endpoint: Endpoint that caused the error
            error_type: Type of service error (SSL, SOAP, etc.)
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if service_endpoint:
            details['service_endpoint'] = service_endpoint
        if error_type:
            details['error_type'] = error_type
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class SSLConfigurationError(ConfigurationError):
    """
    Exception raised for SSL/TLS configuration errors.
    
    Includes certificate loading failures, SSL context creation
    issues, and certificate validation problems.
    """
    
    def __init__(
        self,
        message: str,
        certificate_path: Optional[str] = None,
        ssl_version: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize SSLConfigurationError.
        
        Args:
            message: Error message
            certificate_path: Path to problematic certificate
            ssl_version: SSL/TLS version involved
            **kwargs: Additional arguments passed to base class
        """
        details = kwargs.get('details', {})
        if certificate_path:
            details['certificate_path'] = certificate_path
        if ssl_version:
            details['ssl_version'] = ssl_version
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class AuthenticationError(StudioDimaError):
    """
    Exception raised for authentication failures.
    
    Includes invalid credentials, token expiration,
    and authentication service errors.
    """
    pass


class AuthorizationError(StudioDimaError):
    """
    Exception raised for authorization failures.
    
    Includes insufficient permissions, role-based access
    control violations, and resource access denials.
    """
    pass


class CalendarSyncError(StudioDimaError):
    """
    Exception raised for calendar synchronization errors.
    
    This exception is raised when there are issues with Google Calendar
    synchronization operations.
    """
    pass


class GoogleCredentialsNotFoundError(StudioDimaError):
    """
    Exception raised when Google Calendar credentials are missing or invalid.
    
    This exception is raised when the application cannot authenticate
    with Google Calendar API due to missing or invalid credentials.
    """
    pass


class CacheError(StudioDimaError):
    """
    Exception raised for cache-related errors.
    
    This exception is raised when there are issues with cache operations
    such as redis connectivity or memory cache failures.
    """
    pass


class DBFReadError(StudioDimaError):
    """
    Exception raised for DBF file reading errors.
    
    This exception is raised when there are issues reading from DBF files
    used by the gestionale system.
    """
    pass