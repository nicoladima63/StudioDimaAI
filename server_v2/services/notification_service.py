
import logging
from typing import Dict, Any, List, Optional
from core.database_manager import DatabaseManager
from repositories.notification_repository import NotificationRepository

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Service for managing user notifications.
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.notification_repository = NotificationRepository(db_manager)
        
    def notify_user(self, user_id: int, message: str, type: str = 'info', link: str = None) -> Dict[str, Any]:
        """Send a notification to a specific user via all available channels."""
        logger.info(f"Notifying user {user_id}: {message}")
        notification = self.notification_repository.create_notification(user_id, message, type, link)

        # 1. Broadcast via WebSocket for real-time delivery (if user is online)
        try:
            from app_v2 import websocket_service
            if websocket_service:
                websocket_service.broadcast_notification(user_id, {
                    'id': notification.get('id'),
                    'message': message,
                    'type': type,
                    'link': link,
                    'created_at': notification.get('created_at'),
                    'is_read': False
                })
        except Exception as e:
            logger.error(f"Failed to broadcast notification via WebSocket: {e}")

        # 2. Send browser push notification (works even if browser is closed)
        # Only send push for warning/error (urgent notifications)
        if type in ['warning', 'error']:
            try:
                from app_v2 import push_service
                if push_service:
                    # Extract title from message (first part before newline or full message)
                    title_parts = message.split('\n', 1)
                    title = title_parts[0][:50]  # Max 50 chars for title
                    body = title_parts[1] if len(title_parts) > 1 else message[:100]

                    # Determine urgency
                    urgency = 'high' if type == 'error' else 'normal'

                    push_service.send_notification(
                        user_id=user_id,
                        title=title,
                        body=body,
                        icon='/vite.svg',
                        url=link or '/',
                        tag=f'notification_{notification.get("id")}',
                        urgency=urgency
                    )
                    logger.info(f"Push notification sent to user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send push notification: {e}")

        return notification
        
    def get_unread_notifications(self, user_id: int) -> List[Dict[str, Any]]:
        """Get unread notifications for a user."""
        return self.notification_repository.get_unread_for_user(user_id)
        
    def mark_read(self, notification_id: int) -> bool:
        """Mark notification as read."""
        return self.notification_repository.mark_as_read(notification_id)
