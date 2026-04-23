import os
import json
import logging
import threading
from pathlib import Path
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError

from .exceptions import GoogleCredentialsNotFoundError
from .paths import ensure_data_dir

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]

# Process-wide lock: prevents two threads from refreshing the same token concurrently
_token_refresh_lock = threading.Lock()


class GoogleCalendarClient:
    def __init__(
        self,
        *,
        credentials_path: Path,
        token_path: Path,
        oauth_state_path: Optional[Path] = None,
        app_name: str = "StudioDimaAI",
    ):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.oauth_state_path = oauth_state_path
        self.app_name = app_name
        self.creds: Optional[Credentials] = None

    def get_service(self):
        """
        Returns an authenticated Google Calendar service.
        Raises GoogleCredentialsNotFoundError if credentials are not present or invalid.
        """
        self._load_credentials()

        if not self.creds or not self.creds.valid:
            try:
                self._refresh_or_reauth()
            except GoogleCredentialsNotFoundError:
                # Re-raise to signal that auth is required
                raise

        return build(
            "calendar",
            "v3",
            credentials=self.creds,
            cache_discovery=False,
        )

    def generate_web_auth_url(self, redirect_uri: str) -> str:
        """Generates a web-based OAuth URL and saves the state."""
        if not self.credentials_path.exists():
            raise GoogleCredentialsNotFoundError(
                f"Google credentials file not found at: {self.credentials_path}. "
                "Please ensure credentials.json is in the server_v2 directory."
            )
        
        flow = Flow.from_client_secrets_file(
            self.credentials_path,
            scopes=SCOPES,
        )
        flow.redirect_uri = redirect_uri

        auth_url, state = flow.authorization_url(
            access_type='offline',
            prompt='consent',
            login_hint='studiodrnicoladimartino@gmail.com'
        )
        
        self._save_state_for_callback(state)
        return auth_url
        
    def handle_web_auth_callback(self, code: str, state: str, redirect_uri: str):
        """Handles the OAuth callback, verifies state, and exchanges code for token."""
        saved_state = self._load_saved_state()
        if state != saved_state:
            raise Exception("OAuth state mismatch - possible CSRF attack")

        flow = Flow.from_client_secrets_file(
            self.credentials_path,
            scopes=SCOPES,
            state=state
        )
        flow.redirect_uri = redirect_uri
        
        flow.fetch_token(code=code)
        
        self.creds = flow.credentials
        self._save_token()
        self._clear_saved_state()

    def _load_credentials(self):
        if self.token_path.exists():
            try:
                self.creds = Credentials.from_authorized_user_file(
                    self.token_path,
                    SCOPES,
                )
            except Exception as e:
                logger.error(f"Failed to load token file: {e}")
                self.creds = None


    def _refresh_or_reauth(self):
        """Tries to refresh the token. If it fails, raises an error."""
        with _token_refresh_lock:
            # Re-read from disk inside the lock: another thread/process may have already
            # refreshed the token while we were waiting.
            self._load_credentials()

            if self.creds and self.creds.valid:
                return  # Another thread already refreshed — nothing to do

            if self.creds and self.creds.expired and self.creds.refresh_token:
                try:
                    logger.info("Refreshing Google token")
                    self.creds.refresh(Request())
                    self._save_token()
                    return  # Success
                except RefreshError as e:
                    # Clear in-memory state only. Do NOT delete the token file: the disk
                    # copy might be newer than our in-memory copy (written by another
                    # thread), and an invalid_grant can be transient (clock skew, quota).
                    logger.error("Token refresh failed, clearing in-memory credentials: %s", str(e))
                    self.creds = None
                    raise GoogleCredentialsNotFoundError("Token refresh failed. Re-authentication is required.") from e

            # Creds are missing or have no refresh token.
            raise GoogleCredentialsNotFoundError("No valid credentials found. Re-authentication is required.")

    def _save_token(self):
        ensure_data_dir()
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.token_path, "w") as f:
            f.write(self.creds.to_json())

    def _invalidate_token(self, delete_file: bool = False):
        """Clears in-memory credentials. Pass delete_file=True only when you
        are certain the token is permanently revoked (e.g. after a successful
        new OAuth flow that will immediately write a replacement)."""
        if delete_file and self.token_path.exists():
            self.token_path.unlink()
        self.creds = None

    def _get_state_path(self) -> Path:
        if self.oauth_state_path:
            return self.oauth_state_path
        return self.token_path.parent / "oauth_state.json"

    def _save_state_for_callback(self, state: str):
        ensure_data_dir()
        state_path = self._get_state_path()
        state_path.parent.mkdir(parents=True, exist_ok=True)
        with open(state_path, "w") as f:
            json.dump({'state': state}, f)
            
    def _load_saved_state(self) -> str:
        state_path = self._get_state_path()
        if not state_path.exists():
            raise Exception("OAuth state file not found.")
        with open(state_path, "r") as f:
            data = json.load(f)
            return data['state']
            
    def _clear_saved_state(self):
        state_path = self._get_state_path()
        if state_path.exists():
            state_path.unlink()
