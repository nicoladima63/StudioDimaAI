
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
                        urgency_level TEXT DEFAULT 'normal', -- normal, attention, urgent, critical
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
            
        # Ensure only recipient can mark read
        if str(message['recipient_id']) != str(user_id):
            logger.warning(f"User {user_id} attempted to mark message {message_id} as read, but is not the recipient")
            return False
            
        return self.update_status(message_id, 'read')

    def update_status(self, message_id: int, status: str) -> bool:
        """Update message status."""
        try:
            self.update(message_id, {'status': status})
            return True
        except Exception:
            return False
    
    def get_pending_for_user(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all pending or read todos for a user (not completed/archived)."""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM todo_messages 
                    WHERE recipient_id = ? 
                    AND status IN ('pending', 'read')
                    AND deleted_at IS NULL
                    ORDER BY 
                        CASE urgency_level
                            WHEN 'critical' THEN 1
                            WHEN 'urgent' THEN 2
                            WHEN 'attention' THEN 3
                            ELSE 4
                        END,
                        due_date ASC,
                        created_at DESC
                ''', (user_id,))
                
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get pending todos for user {user_id}: {e}")
            return []
    
    def mark_as_completed(self, message_id: int, user_id: int) -> bool:
        """Mark a message as completed if recipient matches."""
        message = self.get_by_id(message_id)
        if not message:
            return False
            
        # Ensure only recipient can mark completed
        if str(message['recipient_id']) != str(user_id):
            logger.warning(f"User {user_id} attempted to complete message {message_id}, but is not the recipient")
            return False
            
        return self.update_status(message_id, 'completed')
    
    def archive_message(self, message_id: int, user_id: int) -> bool:
        """Archive a message (soft delete via status)."""
        message = self.get_by_id(message_id)
        if not message:
            return False
            
        # Ensure only recipient can archive
        if str(message['recipient_id']) != str(user_id):
            logger.warning(f"User {user_id} attempted to archive message {message_id}, but is not the recipient")
            return False
            
        return self.update_status(message_id, 'archived')
    
    def get_related_to_task(self, task_id: int) -> List[Dict[str, Any]]:
        """Get all todos related to a specific task."""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM todo_messages 
                    WHERE related_task_id = ?
                    AND deleted_at IS NULL
                    ORDER BY created_at DESC
                ''', (task_id,))
                
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get todos for task {task_id}: {e}")
            return []
    
    def get_related_to_step(self, step_id: int) -> List[Dict[str, Any]]:
        """Get all todos related to a specific step."""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM todo_messages 
                    WHERE related_step_id = ?
                    AND deleted_at IS NULL
                    ORDER BY created_at DESC
                ''', (step_id,))
                
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get todos for step {step_id}: {e}")
            return []
    
    def get_overdue_todos(self) -> List[Dict[str, Any]]:
        """Get all overdue todos (due_date < today, status = pending/read)."""
        try:
            from datetime import datetime
            today = datetime.now().date().isoformat()
            
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM todo_messages 
                    WHERE due_date < ?
                    AND status IN ('pending', 'read')
                    AND deleted_at IS NULL
                    ORDER BY due_date ASC
                ''', (today,))
                
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get overdue todos: {e}")
            return []
    
    def update_urgency_level(self, message_id: int, urgency_level: str) -> bool:
        """Update urgency level of a todo."""
        try:
            self.update(message_id, {'urgency_level': urgency_level})
            return True
        except Exception as e:
            logger.error(f"Failed to update urgency level for message {message_id}: {e}")
            return False

