"""
Custom Exceptions for StudioDimaAI V2

Questo modulo centralizza tutte le eccezioni personalizzate utilizzate
nell'applicazione per una gestione degli errori coerente.
"""
from typing import Optional, Any, Dict
# =============================================================================
# GENERAL EXCEPTIONS
# =============================================================================


class StudioDimaError(Exception):
    """
    Base exception class for all StudioDimaAI Server V2 errors.
    """
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.cause = cause

    def to_dict(self) -> Dict[str, Any]:
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
    Eccezione per errori relativi al database.
    """
    def __init__(
        self,
        message: str,
        query: Optional[str] = None,
        parameters: Optional[tuple] = None,
        **kwargs
    ):
        details = kwargs.get('details', {})
        if query:
            details['query'] = query
        if parameters:
            details['parameters'] = parameters
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class ConnectionPoolError(DatabaseError):
    """
    Eccezione per errori relativi al pool di connessioni del database.
    """
    def __init__(
        self,
        message: str,
        pool_size: Optional[int] = None,
        active_connections: Optional[int] = None,
        **kwargs
    ):
        details = kwargs.get('details', {})
        if pool_size is not None:
            details['pool_size'] = pool_size
        if active_connections is not None:
            details['active_connections'] = active_connections
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class RepositoryError(StudioDimaError):
    """
    Eccezione per errori nel livello repository (es. entità non trovata).
    """
    def __init__(
        self,
        message: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[Any] = None,
        **kwargs
    ):
        details = kwargs.get('details', {})
        if entity_type:
            details['entity_type'] = entity_type
        if entity_id is not None:
            details['entity_id'] = entity_id
        kwargs['details'] = details
        super().__init__(message, **kwargs)



class ServiceError(StudioDimaError):
    """
    Eccezione per errori nel livello di servizio (logica di business).
    """
    pass


class ValidationError(StudioDimaError):
    """
    Eccezione per errori di validazione dei dati.
    """
    def __init__(
        self,
        message: str,
        field_name: Optional[str] = None,
        field_value: Optional[Any] = None,
        validation_rule: Optional[str] = None,
        **kwargs
    ):
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
    Eccezione per errori nella gestione delle transazioni del database.
    """
    def __init__(
        self,
        message: str,
        transaction_id: Optional[str] = None,
        **kwargs
    ):
        details = kwargs.get('details', {})
        if transaction_id:
            details['transaction_id'] = transaction_id
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class DbfProcessingError(StudioDimaError):
    """
    Eccezione per errori durante l'elaborazione dei file DBF.
    """
    def __init__(
        self,
        message: str,
        file_path: Optional[str] = None,
        record_number: Optional[int] = None,
        field_name: Optional[str] = None,
        **kwargs
    ):
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
    Eccezione per errori di configurazione.
    """
    def __init__(
        self,
        message: str,
        setting_name: Optional[str] = None,
        setting_value: Optional[Any] = None,
        **kwargs):
        details = kwargs.get('details', {})
        if setting_name:
            details['setting_name'] = setting_name
        if setting_value is not None:
            details['setting_value'] = setting_value
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class RicettaServiceError(StudioDimaError):
    """
    Eccezione per errori nel servizio della ricetta elettronica.
    """
    def __init__(
        self,
        message: str,
        service_endpoint: Optional[str] = None,
        error_type: Optional[str] = None,
        **kwargs):
        details = kwargs.get('details', {})
        if service_endpoint:
            details['service_endpoint'] = service_endpoint
        if error_type:
            details['error_type'] = error_type
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class SSLConfigurationError(ConfigurationError):
    """
    Eccezione per errori di configurazione SSL/TLS.
    """
    def __init__(
        self,
        message: str,
        certificate_path: Optional[str] = None,
        ssl_version: Optional[str] = None,
        **kwargs):
        details = kwargs.get('details', {})
        if certificate_path:
            details['certificate_path'] = certificate_path
        if ssl_version:
            details['ssl_version'] = ssl_version
        
        kwargs['details'] = details
        super().__init__(message, **kwargs)


class AuthenticationError(StudioDimaError):
    """
    Eccezione per errori di autenticazione.
    """
    pass


class AuthorizationError(StudioDimaError):
    """
    Eccezione per errori di autorizzazione (permessi insufficienti).
    """
    pass


# =============================================================================
# GOOGLE CALENDAR EXCEPTIONS
# =============================================================================


class GoogleCredentialsNotFoundError(StudioDimaError):
    """
    Eccezione per credenziali Google non trovate (credentials.json o token.json).
    """
    pass


class CalendarSyncError(StudioDimaError):
    """
    Eccezione per errori durante la sincronizzazione con Google Calendar.
    """
    pass


class CacheError(StudioDimaError):
    """
    Eccezione per errori relativi alla cache.
    """
    pass


# =============================================================================
# TEMPLATE & SMS EXCEPTIONS
# =============================================================================


class TemplateError(StudioDimaError):
    """
    Eccezione base per errori relativi ai template.
    """
    pass


class TemplateNotFoundError(TemplateError):
    """
    Eccezione per template non trovato.
    """
    pass


class TemplateRenderError(TemplateError):
    """
    Eccezione per errori durante il rendering di un template.
    """
    pass


class GoogleQuotaError(CalendarSyncError):
    """
    Eccezione per superamento della quota API di Google.
    """
    pass