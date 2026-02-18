"""
Push Notification Service for Browser Push Notifications.
Uses Web Push API to send notifications even when browser is closed.
"""

import logging
import json
from typing import Dict, Any, Optional
from pywebpush import webpush, WebPushException
from core.database_manager import DatabaseManager

logger = logging.getLogger(__name__)


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
            tag: Notification tag for grouping/replacing (optional)
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
            notification_payload = {
                'title': title,
                'body': body,
                'icon': icon or '/logo192.png',
                'badge': '/badge-icon.png',
                'tag': tag,
                'data': {
                    'url': url or '/',
                    'timestamp': None  # Will be set by browser
                },
                'requireInteraction': urgency == 'high',  # Stay visible if urgent
                'vibrate': [200, 100, 200] if urgency == 'high' else [100]
            }

            # Send to all subscriptions
            sent_count = 0
            failed_subscriptions = []

            for sub in subscriptions:
                try:
                    subscription_info = {
                        'endpoint': sub['endpoint'],
                        'keys': {
                            'p256dh': sub['p256dh'],
                            'auth': sub['auth']
                        }
                    }

                    webpush(
                        subscription_info=subscription_info,
                        data=json.dumps(notification_payload),
                        vapid_private_key=self.vapid_private_key,
                        vapid_claims=self.vapid_claims,
                        ttl=86400  # 24 hours
                    )

                    sent_count += 1
                    logger.info(f"Push notification sent to user {user_id} (endpoint: {sub['endpoint'][:50]}...)")

                except WebPushException as e:
                    logger.error(f"Failed to send push to endpoint {sub['endpoint']}: {e}")

                    # If subscription is expired/invalid, remove it
                    if e.response and e.response.status_code in [404, 410]:
                        failed_subscriptions.append(sub['endpoint'])

            # Clean up failed subscriptions
            for endpoint in failed_subscriptions:
                self.unsubscribe_user(user_id, endpoint)

            return {
                'success': sent_count > 0,
                'sent_count': sent_count,
                'failed_count': len(failed_subscriptions)
            }

        except Exception as e:
            logger.error(f"Failed to send push notification to user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'sent_count': 0
            }

    def _get_user_subscriptions(self, user_id: int):
        """Get all push subscriptions for a user."""
        try:
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
