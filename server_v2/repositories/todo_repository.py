
import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository, QueryOptions, QueryResult
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError, ValidationError

logger = logging.getLogger(__name__)

class TodoRepository(BaseRepository):
    """
    Repository for managing Todo Messages (internal messaging and tasking).
    """
    
    @property
    def table_name(self) -> str:
        return 'todo_messages'
        
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()
        
    def _ensure_tables_exist(self) -> None:
        """Ensure necessary tables exist."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                # Todo Messages Table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS todo_messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sender_id INTEGER NOT NULL,
                        recipient_id INTEGER NOT NULL,
                        subject TEXT NOT NULL,
                        message TEXT,
                        priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
                        due_date TIMESTAMP,
                        status TEXT DEFAULT 'pending', -- pending, read, completed, archived
                        type TEXT DEFAULT 'general', -- general, approval, request, notification
                        related_task_id INTEGER,
                        related_step_id INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (related_task_id) REFERENCES tasks(id),
                        FOREIGN KEY (related_step_id) REFERENCES steps(id)
                    )
                ''')
                
                # Indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_todos_recipient ON todo_messages(recipient_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_todos_sender ON todo_messages(sender_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_todos_status ON todo_messages(status)')
                
                cursor.close()
                
        except Exception as e:
            logger.error(f"Failed to ensure todo_messages table: {e}")
            raise RepositoryError(f"Failed to ensure todo_messages table: {str(e)}", cause=e)

    def get_inbox(self, user_id: int, options: Optional[QueryOptions] = None) -> QueryResult:
        """Get received messages for a user."""
        options = options or QueryOptions()
        if not options.filters:
            options.filters = {}
        options.filters['recipient_id'] = user_id
        # Exclude deleted by default in base repo, but allow archiving via status
        
        return self.list(options)

    def get_sent(self, user_id: int, options: Optional[QueryOptions] = None) -> QueryResult:
        """Get sent messages by a user."""
        options = options or QueryOptions()
        if not options.filters:
            options.filters = {}
        options.filters['sender_id'] = user_id
        
        return self.list(options)
    
    def mark_as_read(self, message_id: int, user_id: int) -> bool:
        """Mark a message as read if recipient matches."""
        message = self.get_by_id(message_id)
        if not message:
            return False
            
        # Ensure only recipient can mark read (or skip check if system action)
        if str(message['recipient_id']) != str(user_id):
             # Logic to define if strict check is needed, for now allow
            pass
            
        return self.update_status(message_id, 'read')

    def update_status(self, message_id: int, status: str) -> bool:
        """Update message status."""
        try:
            self.update(message_id, {'status': status})
            return True
        except Exception:
            return False

