
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
        """Send a notification to a specific user."""
        logger.info(f"Notifying user {user_id}: {message}")
        return self.notification_repository.create_notification(user_id, message, type, link)
        
    def get_unread_notifications(self, user_id: int) -> List[Dict[str, Any]]:
        """Get unread notifications for a user."""
        return self.notification_repository.get_unread_for_user(user_id)
        
    def mark_read(self, notification_id: int) -> bool:
        """Mark notification as read."""
        return self.notification_repository.mark_as_read(notification_id)
