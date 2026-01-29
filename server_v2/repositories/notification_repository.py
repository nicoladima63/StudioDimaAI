
import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository, QueryOptions
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError

logger = logging.getLogger(__name__)

class NotificationRepository(BaseRepository):
    """
    Repository for managing user notifications.
    """
    
    @property
    def table_name(self) -> str:
        return 'notifications'
        
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()
        
    def _ensure_tables_exist(self) -> None:
        """Ensure notification table exists."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS notifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        message TEXT NOT NULL,
                        type TEXT DEFAULT 'info', -- info, warning, success, error
                        link TEXT,
                        read_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) -- Assuming users table is linked or we just store ID
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at)')
                
        except Exception as e:
            logger.error(f"Failed to ensure notification table: {e}")
            raise RepositoryError(f"Failed to ensure notification table: {str(e)}", cause=e)

    def create_notification(self, user_id: int, message: str, type: str = 'info', link: str = None) -> Dict[str, Any]:
        """Create a new notification."""
        data = {
            'user_id': user_id,
            'message': message,
            'type': type,
            'link': link
        }
        return self.create(data)

    def get_unread_for_user(self, user_id: int) -> List[Dict[str, Any]]:
        """Get unread notifications for a user."""
        try:
            query = "SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC"
            results = self.execute_custom_query(query, (user_id,), fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get notifications for user {user_id}: {e}")
            return []

    def mark_as_read(self, notification_id: int) -> bool:
        """Mark a notification as read."""
        try:
            import datetime
            update_data = {'read_at': datetime.datetime.now()}
            result = self.update(notification_id, update_data)
            return result is not None
        except Exception as e:
            logger.error(f"Failed to mark notification {notification_id} as read: {e}")
            return False
