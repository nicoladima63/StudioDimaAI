import os
import json
import logging
from pathlib import Path
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]


class GoogleCalendarClient:
    def __init__(
        self,
        *,
        credentials_path: Path,
        token_path: Path,
        app_name: str = "StudioDimaAI",
    ):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.app_name = app_name

        self.creds: Optional[Credentials] = None

    # =====================================================
    # PUBLIC
    # =====================================================

    def get_service(self):
        """
        Restituisce service Google Calendar autenticato.
        Rifa l'OAuth solo se necessario.
        """
        self._load_credentials()

        if not self.creds or not self.creds.valid:
            self._refresh_or_reauth()

        return build(
            "calendar",
            "v3",
            credentials=self.creds,
            cache_discovery=False,
        )

    # =====================================================
    # INTERNAL
    # =====================================================

    def _load_credentials(self):
        if self.token_path.exists():
            self.creds = Credentials.from_authorized_user_file(
                self.token_path,
                SCOPES,
            )

    def _refresh_or_reauth(self):
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                logger.info("Refreshing Google token")
                self.creds.refresh(Request())
                self._save_token()
                return
            except RefreshError as e:
                # invalid_grant, revoked, ecc.
                logger.error(
                    "Error refreshing credentials: %s",
                    str(e),
                )
                self._invalidate_token()

        # OAuth completo
        self._run_oauth_flow()

    def _run_oauth_flow(self):
        logger.info("Running full OAuth flow")

        flow = InstalledAppFlow.from_client_secrets_file(
            self.credentials_path,
            SCOPES,
        )

        self.creds = flow.run_local_server(
            port=0,
            prompt="consent",
            authorization_prompt_message="Autorizza l'accesso a Google Calendar",
        )

        self._save_token()

    def _save_token(self):
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.token_path, "w") as f:
            f.write(self.creds.to_json())

    def _invalidate_token(self):
        """
        Elimina token locale per forzare OAuth pulito
        """
        if self.token_path.exists():
            self.token_path.unlink()
        self.creds = None
