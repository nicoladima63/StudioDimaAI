class GoogleCredentialsNotFoundError(Exception):
    """Eccezione sollevata quando le credenziali Google non sono trovate per un utente."""
    def __init__(self, message, oauth_url=None):
        super().__init__(message)
        self.oauth_url = oauth_url