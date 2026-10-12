"""
Push Notification Service for Browser Push Notifications.
Uses Web Push API to send notifications even when browser is closed.
"""

import logging
import json
import time
import uuid
from typing import Dict, Any, Optional
import requests
from pywebpush import webpush, WebPushException
from core.database_manager import DatabaseManager

logger = logging.getLogger(__name__)

# Esito dell'invio verso una singola sottoscrizione
SEND_OK = 'sent'
SEND_EXPIRED = 'expired'
SEND_FAILED = 'failed'

# Il push service risponde 404/410 quando la sottoscrizione non esiste piu
EXPIRED_STATUS_CODES = (404, 410)
# Errori transitori del push service: vale la pena riprovare
RETRYABLE_STATUS_CODES = (408, 429, 500, 502, 503, 504)

SEND_MAX_ATTEMPTS = 3
SEND_RETRY_BACKOFF_SECONDS = 1.0
SEND_TIMEOUT_SECONDS = 15
SEND_TTL_SECONDS = 86400  # 24 hours

_TABLES_READY = False


def _ensure_tables(db_manager: DatabaseManager) -> None:
    """Crea la tabella delle sottoscrizioni se manca (una sola volta per sessione)."""
    global _TABLES_READY
    if _TABLES_READY:
        return
    with db_manager.transaction() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id '
            'ON push_subscriptions(user_id)'
        )
    _TABLES_READY = True


class PushNotificationService:
    """
    Service for managing browser push notifications via Web Push API.
    """

    def __init__(self, db_manager: DatabaseManager, vapid_private_key: str, vapid_claims: Dict[str, str]):
        """
        Initialize push notification service.

        Args:
            db_manager: Database manager instance
            vapid_private_key: VAPID private key for authentication
            vapid_claims: VAPID claims (e.g., {"sub": "mailto:admin@studiodima.com"})
        """
        self.db_manager = db_manager
        self.vapid_private_key = vapid_private_key
        self.vapid_claims = vapid_claims

    def subscribe_user(self, user_id: int, subscription_info: Dict[str, Any]) -> bool:
        """
        Save user's push subscription to database.

        Args:
            user_id: User ID
            subscription_info: Subscription object from browser (endpoint, keys, etc.)

        Returns:
            True if successful
        """
        try:
            _ensure_tables(self.db_manager)
            logger.info(f"Attempting to subscribe user {user_id}")
            logger.info(f"Subscription endpoint: {subscription_info.get('endpoint', 'N/A')[:50]}...")

            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()

                # Insert or update subscription
                cursor.execute('''
                    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(endpoint) DO UPDATE SET
                        user_id = excluded.user_id,
                        p256dh = excluded.p256dh,
                        auth = excluded.auth,
                        updated_at = CURRENT_TIMESTAMP
                ''', (
                    user_id,
                    subscription_info['endpoint'],
                    subscription_info['keys']['p256dh'],
                    subscription_info['keys']['auth']
                ))

                rows_affected = cursor.rowcount
                cursor.close()

            logger.info(f"Successfully subscribed user {user_id} to push notifications (rows affected: {rows_affected})")
            return True

        except Exception as e:
            logger.error(f"Failed to subscribe user {user_id}: {e}", exc_info=True)
            return False

    def unsubscribe_user(self, user_id: int, endpoint: str) -> bool:
        """
        Remove user's push subscription.

        Args:
            user_id: User ID
            endpoint: Subscription endpoint to remove

        Returns:
            True if successful
        """
        try:
            _ensure_tables(self.db_manager)
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    DELETE FROM push_subscriptions
                    WHERE user_id = ? AND endpoint = ?
                ''', (user_id, endpoint))
                cursor.close()

            logger.info(f"Unsubscribed user {user_id} from push notifications")
            return True

        except Exception as e:
            logger.error(f"Failed to unsubscribe user {user_id}: {e}")
            return False

    def is_subscribed(self, user_id: int, endpoint: str) -> bool:
        """
        Check whether the given endpoint is registered for the user.

        Args:
            user_id: User ID
            endpoint: Subscription endpoint held by the browser

        Returns:
            True if the server holds this subscription for the user
        """
        try:
            _ensure_tables(self.db_manager)
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT 1 FROM push_subscriptions
                    WHERE user_id = ? AND endpoint = ?
                ''', (user_id, endpoint))
                found = cursor.fetchone() is not None
                cursor.close()
            return found
        except Exception as e:
            logger.error(f"Failed to check subscription for user {user_id}: {e}")
            return False

    def send_notification(
        self,
        user_id: int,
        title: str,
        body: str,
        icon: Optional[str] = None,
        url: Optional[str] = None,
        tag: Optional[str] = None,
        urgency: str = 'normal'
    ) -> Dict[str, Any]:
        """
        Send push notification to all subscribed devices of a user.

        Args:
            user_id: Target user ID
            title: Notification title
            body: Notification body/message
            icon: Icon URL (optional)
            url: URL to open on click (optional)
            tag: Notification tag for grouping/replacing (optional). Se assente ne viene
                generato uno univoco, cosi' notifiche diverse non si sostituiscono a vicenda.
            urgency: Urgency level ('normal', 'high') - affects delivery priority

        Returns:
            Dict with success status and results
        """
        try:
            # Get all subscriptions for this user
            subscriptions = self._get_user_subscriptions(user_id)

            if not subscriptions:
                logger.warning(f"No push subscriptions found for user {user_id}")
                return {
                    'success': False,
                    'error': 'No subscriptions found',
                    'sent_count': 0
                }

            # Prepare notification payload
            notification_payload = json.dumps({
                'title': title,
                'body': body,
                'icon': icon or '/logo192.png',
                'badge': '/badge-icon.png',
                'tag': tag or f'push_{uuid.uuid4().hex[:12]}',
                'data': {
                    'url': url or '/',
                    'timestamp': None  # Will be set by browser
                },
                'requireInteraction': urgency == 'high',  # Stay visible if urgent
                'vibrate': [200, 100, 200] if urgency == 'high' else [100]
            })

            sent_count = 0
            failed_count = 0
            expired_endpoints = []

            # Un errore su un dispositivo non deve impedire l'invio agli altri
            for sub in subscriptions:
                outcome = self._send_to_subscription(user_id, sub, notification_payload, urgency)
                if outcome == SEND_OK:
                    sent_count += 1
                elif outcome == SEND_EXPIRED:
                    expired_endpoints.append(sub['endpoint'])
                else:
                    failed_count += 1

            # Clean up expired subscriptions
            for endpoint in expired_endpoints:
                self.unsubscribe_user(user_id, endpoint)
                logger.info(f"Removed expired push subscription for user {user_id} (endpoint: {endpoint[:50]}...)")

            return {
                'success': sent_count > 0,
                'sent_count': sent_count,
                'failed_count': failed_count,
                'removed_count': len(expired_endpoints)
            }

        except Exception as e:
            logger.error(f"Failed to send push notification to user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'sent_count': 0
            }

    def _send_to_subscription(
        self,
        user_id: int,
        sub: Dict[str, Any],
        payload: str,
        urgency: str
    ) -> str:
        """
        Send one payload to one subscription, retrying transient failures.

        Returns:
            SEND_OK, SEND_EXPIRED (subscription gone, remove it) or SEND_FAILED
        """
        endpoint_short = f"{sub['endpoint'][:50]}..."
        subscription_info = {
            'endpoint': sub['endpoint'],
            'keys': {
                'p256dh': sub['p256dh'],
                'auth': sub['auth']
            }
        }

        for attempt in range(1, SEND_MAX_ATTEMPTS + 1):
            try:
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=self.vapid_private_key,
                    # webpush() modifica il dict dei claims (aud/exp): ne serve una copia per invio
                    vapid_claims=dict(self.vapid_claims),
                    ttl=SEND_TTL_SECONDS,
                    timeout=SEND_TIMEOUT_SECONDS,
                    headers={'Urgency': 'high' if urgency == 'high' else 'normal'}
                )
                logger.info(f"Push notification sent to user {user_id} (endpoint: {endpoint_short})")
                return SEND_OK

            except WebPushException as e:
                # Attenzione: un requests.Response con status 4xx/5xx e' falsy,
                # quindi va confrontato con None e non usato come booleano.
                status = e.response.status_code if e.response is not None else None
                if status in EXPIRED_STATUS_CODES:
                    logger.warning(f"Push subscription expired for user {user_id} (status {status}, endpoint: {endpoint_short})")
                    return SEND_EXPIRED
                retryable = status in RETRYABLE_STATUS_CODES
                logger.error(
                    f"Push failed for user {user_id} (status {status}, attempt {attempt}/{SEND_MAX_ATTEMPTS}, "
                    f"endpoint: {endpoint_short}): {e}"
                )

            except requests.exceptions.RequestException as e:
                # Errori di rete/DNS verso il push service: transitori
                retryable = True
                logger.error(
                    f"Push network error for user {user_id} (attempt {attempt}/{SEND_MAX_ATTEMPTS}, "
                    f"endpoint: {endpoint_short}): {e}"
                )

            except Exception as e:
                # Sottoscrizione malformata o errore di cifratura: inutile riprovare
                logger.error(f"Push unexpected error for user {user_id} (endpoint: {endpoint_short}): {e}")
                return SEND_FAILED

            if not retryable or attempt == SEND_MAX_ATTEMPTS:
                break
            time.sleep(SEND_RETRY_BACKOFF_SECONDS * attempt)

        return SEND_FAILED

    def send_notification_to_all(
        self,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        url: Optional[str] = None,
        urgency: str = 'normal',
    ) -> Dict[str, Any]:
        """Invia push notification a tutti gli utenti con subscription attiva."""
        try:
            _ensure_tables(self.db_manager)
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT DISTINCT user_id FROM push_subscriptions')
                user_ids = [row[0] for row in cursor.fetchall()]
                cursor.close()
            sent = 0
            for uid in user_ids:
                res = self.send_notification(user_id=uid, title=title, body=body, url=url, urgency=urgency)
                if res.get('success'):
                    sent += res.get('sent_count', 0)
            return {'success': True, 'sent_to': len(user_ids), 'sent_count': sent}
        except Exception as e:
            logger.error(f"Errore send_notification_to_all: {e}")
            return {'success': False, 'error': str(e)}

    def _get_user_subscriptions(self, user_id: int):
        """Get all push subscriptions for a user."""
        try:
            _ensure_tables(self.db_manager)
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, user_id, endpoint, p256dh, auth, created_at
                    FROM push_subscriptions
                    WHERE user_id = ?
                ''', (user_id,))

                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()

                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get subscriptions for user {user_id}: {e}")
            return []
