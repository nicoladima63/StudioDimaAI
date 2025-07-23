# Eccezioni custom per i servizi RENTRI

class RentriError(Exception):
    """Eccezione base per errori RENTRI"""
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class RentriAuthError(RentriError):
    """Errore di autenticazione RENTRI"""
    def __init__(self, message="Errore di autenticazione RENTRI"):
        super().__init__(message, 401)

class RentriConnectionError(RentriError):
    """Errore di connessione al servizio RENTRI"""
    def __init__(self, message="Impossibile connettersi al servizio RENTRI"):
        super().__init__(message, 503)

class RentriValidationError(RentriError):
    """Errore di validazione dati RENTRI"""
    def __init__(self, message="Dati non validi per RENTRI"):
        super().__init__(message, 422) 