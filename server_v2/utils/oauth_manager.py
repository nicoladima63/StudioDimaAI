"""
OAuth Manager for Social Media Platforms.
Gestisce OAuth2 flow per Meta (Instagram/Facebook), LinkedIn, TikTok.
"""

import os
import time
import hmac
import hashlib
import base64
import requests
import logging
from enum import Enum
from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from urllib.parse import urlencode
from core.config import get_config_value

logger = logging.getLogger(__name__)


class OAuthProvider(Enum):
    """Supported OAuth providers"""
    META = "meta"  # Instagram + Facebook
    LINKEDIN = "linkedin"
    TIKTOK = "tiktok"


class OAuthManager:
    """
    Manager centralizzato per OAuth2 flow multi-piattaforma.

    Gestisce:
    - Generazione authorization URL con CSRF protection
    - Exchange authorization code per access token
    - Refresh token automatico
    - Validazione token expiration
    """

    def __init__(self):
        """Initialize OAuth manager with provider configurations"""
        self.providers_config = self._load_providers_config()
        self.state_secret = get_config_value('OAUTH_STATE_SECRET', default='default_secret_change_me')

        if self.state_secret == 'default_secret_change_me' or self.state_secret == 'change_this_to_random_secret':
            logger.warning("OAuth state secret is using default value. Please set OAUTH_STATE_SECRET in .env")

    def _load_providers_config(self) -> Dict[OAuthProvider, Dict]:
        """
        Carica configurazione OAuth da .env per ogni provider.

        Returns:
            Dictionary con config per ogni provider
        """
        return {
            OAuthProvider.META: {
                'client_id': get_config_value('META_APP_ID', required=False),
                'client_secret': get_config_value('META_APP_SECRET', required=False),
                'redirect_uri': get_config_value('META_REDIRECT_URI'),
                'auth_url': 'https://www.facebook.com/v18.0/dialog/oauth',
                'token_url': 'https://graph.facebook.com/v18.0/oauth/access_token',
                'scopes': get_config_value('META_SCOPES', default='instagram_basic').split(',')
            },
            OAuthProvider.LINKEDIN: {
                'client_id': get_config_value('LINKEDIN_CLIENT_ID', required=False),
                'client_secret': get_config_value('LINKEDIN_CLIENT_SECRET', required=False),
                'redirect_uri': get_config_value('LINKEDIN_REDIRECT_URI'),
                'auth_url': 'https://www.linkedin.com/oauth/v2/authorization',
                'token_url': 'https://www.linkedin.com/oauth/v2/accessToken',
                'scopes': get_config_value('LINKEDIN_SCOPES', default='w_member_social').split(',')
            },
            OAuthProvider.TIKTOK: {
                'client_id': get_config_value('TIKTOK_CLIENT_KEY', required=False),
                'client_secret': get_config_value('TIKTOK_CLIENT_SECRET', required=False),
                'redirect_uri': get_config_value('TIKTOK_REDIRECT_URI'),
                'auth_url': 'https://www.tiktok.com/auth/authorize/',
                'token_url': 'https://open-api.tiktok.com/oauth/access_token/',
                'scopes': get_config_value('TIKTOK_SCOPES', default='user.info.basic').split(',')
            }
        }

    def generate_authorization_url(self, provider: OAuthProvider, user_id: int, account_id: int) -> Tuple[str, str]:
        """
        Genera URL di autorizzazione OAuth con state per CSRF protection.

        Args:
            provider: Provider OAuth (META, LINKEDIN, TIKTOK)
            user_id: ID utente corrente
            account_id: ID account social da connettere

        Returns:
            Tuple (authorization_url, state)
        """
        config = self.providers_config.get(provider)
        if not config:
            raise ValueError(f"Provider {provider} not supported")

        if not config['client_id']:
            raise ValueError(f"Client ID not configured for {provider}")

        # Generate secure state token
        state = self._generate_state(user_id, account_id, provider)

        # Build authorization URL
        params = {
            'client_id': config['client_id'],
            'redirect_uri': config['redirect_uri'],
            'scope': ' '.join(config['scopes']),
            'response_type': 'code',
            'state': state
        }

        auth_url = f"{config['auth_url']}?{urlencode(params)}"

        logger.info(f"Generated OAuth URL for {provider.value} (user={user_id}, account={account_id})")

        return auth_url, state

    def _generate_state(self, user_id: int, account_id: int, provider: OAuthProvider) -> str:
        """
        Genera state token sicuro con HMAC per CSRF protection.

        Format: base64(user_id:account_id:provider:timestamp:signature)

        Args:
            user_id: ID utente
            account_id: ID account social
            provider: Provider OAuth

        Returns:
            State token sicuro
        """
        timestamp = int(time.time())
        data = f"{user_id}:{account_id}:{provider.value}:{timestamp}"

        # Generate HMAC signature
        signature = hmac.new(
            self.state_secret.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()

        # Combine data and signature
        state_data = f"{data}:{signature}"

        # Base64 encode
        return base64.urlsafe_b64encode(state_data.encode()).decode()

    def validate_state(self, state: str, max_age: int = 600) -> Tuple[int, int, OAuthProvider]:
        """
        Valida state token e restituisce (user_id, account_id, provider).

        Args:
            state: State token da validare
            max_age: Età massima in secondi (default 10 minuti)

        Returns:
            Tuple (user_id, account_id, provider)

        Raises:
            ValueError: Se state non valido o scaduto
        """
        try:
            # Debug: Log received state
            logger.error(f"[DEBUG] Validating state token (length={len(state)}): {state[:50]}...")

            # Decode from base64
            state_data = base64.urlsafe_b64decode(state.encode()).decode()
            logger.error(f"[DEBUG] Decoded state data: {state_data}")

            # Parse components
            parts = state_data.split(':')
            logger.error(f"[DEBUG] State parts count: {len(parts)}, expected: 5")

            if len(parts) != 5:
                raise ValueError(f"Invalid state format: got {len(parts)} parts, expected 5")

            user_id_str, account_id_str, provider_str, timestamp_str, received_signature = parts

            # Verify signature
            data = f"{user_id_str}:{account_id_str}:{provider_str}:{timestamp_str}"
            expected_signature = hmac.new(
                self.state_secret.encode(),
                data.encode(),
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(received_signature, expected_signature):
                raise ValueError("Invalid signature")

            # Check timestamp
            timestamp = int(timestamp_str)
            age = int(time.time()) - timestamp

            if age > max_age:
                raise ValueError(f"State expired (age: {age}s, max: {max_age}s)")

            # Parse values
            user_id = int(user_id_str)
            account_id = int(account_id_str)
            provider = OAuthProvider(provider_str)

            logger.info(f"State validated successfully (user={user_id}, account={account_id}, provider={provider_str})")

            return user_id, account_id, provider

        except Exception as e:
            logger.error(f"State validation failed: {e}")
            raise ValueError(f"Invalid state token: {str(e)}")

    def exchange_code_for_token(self, provider: OAuthProvider, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code per access token.

        Args:
            provider: Provider OAuth
            code: Authorization code ricevuto dal callback

        Returns:
            Dictionary con token data: {
                'access_token': str,
                'refresh_token': str (opzionale),
                'expires_in': int,
                'token_type': str
            }

        Raises:
            Exception: Se exchange fallisce
        """
        config = self.providers_config.get(provider)
        if not config:
            raise ValueError(f"Provider {provider} not supported")

        # Prepare request data
        data = {
            'client_id': config['client_id'],
            'client_secret': config['client_secret'],
            'redirect_uri': config['redirect_uri'],
            'code': code,
            'grant_type': 'authorization_code'
        }

        try:
            logger.info(f"Exchanging code for token with {provider.value}")

            response = requests.post(config['token_url'], data=data, timeout=30)
            response.raise_for_status()

            token_data = response.json()

            # Normalize response format across providers
            if provider == OAuthProvider.META:
                # Meta returns expires_in as seconds
                return {
                    'access_token': token_data.get('access_token'),
                    'refresh_token': token_data.get('refresh_token'),
                    'expires_in': token_data.get('expires_in', 3600),
                    'token_type': token_data.get('token_type', 'bearer')
                }
            elif provider == OAuthProvider.LINKEDIN:
                return {
                    'access_token': token_data.get('access_token'),
                    'refresh_token': token_data.get('refresh_token'),
                    'expires_in': token_data.get('expires_in', 5184000),  # 60 days default
                    'token_type': token_data.get('token_type', 'Bearer')
                }
            elif provider == OAuthProvider.TIKTOK:
                return {
                    'access_token': token_data.get('access_token'),
                    'refresh_token': token_data.get('refresh_token'),
                    'expires_in': token_data.get('expires_in', 86400),  # 1 day default
                    'token_type': token_data.get('token_type', 'bearer')
                }

            return token_data

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to exchange code for token: {e}")
            raise Exception(f"Token exchange failed: {str(e)}")

    def refresh_access_token(self, provider: OAuthProvider, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.

        Args:
            provider: Provider OAuth
            refresh_token: Refresh token

        Returns:
            Dictionary con nuovo token data

        Raises:
            Exception: Se refresh fallisce
        """
        config = self.providers_config.get(provider)
        if not config:
            raise ValueError(f"Provider {provider} not supported")

        # Prepare request data
        data = {
            'client_id': config['client_id'],
            'client_secret': config['client_secret'],
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }

        try:
            logger.info(f"Refreshing access token for {provider.value}")

            response = requests.post(config['token_url'], data=data, timeout=30)
            response.raise_for_status()

            token_data = response.json()

            return {
                'access_token': token_data.get('access_token'),
                'refresh_token': token_data.get('refresh_token', refresh_token),  # Use old if new not provided
                'expires_in': token_data.get('expires_in', 3600),
                'token_type': token_data.get('token_type', 'bearer')
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to refresh token: {e}")
            raise Exception(f"Token refresh failed: {str(e)}")

    def is_token_expired(self, token_expires_at: Optional[str]) -> bool:
        """
        Check if token is expired.

        Args:
            token_expires_at: ISO format timestamp

        Returns:
            True se expired, False altrimenti
        """
        if not token_expires_at:
            return False

        try:
            expires = datetime.fromisoformat(token_expires_at.replace('Z', '+00:00'))
            return datetime.utcnow() >= expires
        except Exception as e:
            logger.warning(f"Error checking token expiration: {e}")
            return False

    def get_provider_from_platform(self, platform: str) -> OAuthProvider:
        """
        Get OAuth provider from platform name.

        Args:
            platform: Platform name ('instagram', 'facebook', 'linkedin', 'tiktok')

        Returns:
            OAuthProvider enum
        """
        if platform in ['instagram', 'facebook']:
            return OAuthProvider.META
        elif platform == 'linkedin':
            return OAuthProvider.LINKEDIN
        elif platform == 'tiktok':
            return OAuthProvider.TIKTOK
        else:
            raise ValueError(f"Unsupported platform: {platform}")
