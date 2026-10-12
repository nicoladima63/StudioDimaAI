
import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository, QueryOptions, QueryResult
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError, ValidationError

logger = logging.getLogger(__name__)

# Posticipi consentiti per ogni todo: oltre questo limite l'unica via e' completarlo
MAX_SNOOZES = 5

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

                # Migration: add urgency_level column if missing
                cursor.execute("PRAGMA table_info(todo_messages)")
                columns = [row[1] for row in cursor.fetchall()]
                if 'urgency_level' not in columns:
                    cursor.execute("ALTER TABLE todo_messages ADD COLUMN urgency_level TEXT DEFAULT 'normal'")
                    logger.info("Added urgency_level column to todo_messages table")

                # Migration: stato dei richiami (promemoria ripetuti) e dei posticipi
                for column, ddl in (
                    ('reminder_count', "INTEGER DEFAULT 0"),
                    ('last_reminder_at', "TEXT"),
                    ('snooze_count', "INTEGER DEFAULT 0"),
                ):
                    if column not in columns:
                        cursor.execute(f"ALTER TABLE todo_messages ADD COLUMN {column} {ddl}")
                        logger.info(f"Added {column} column to todo_messages table")

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
    
    def get_open_with_due_date(self) -> List[Dict[str, Any]]:
        """Todo ancora da fare (pending/read) che hanno una scadenza: input del motore dei richiami."""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM todo_messages
                    WHERE status IN ('pending', 'read')
                    AND deleted_at IS NULL
                    AND due_date IS NOT NULL
                    ORDER BY due_date ASC
                ''')
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get open todos with due date: {e}")
            return []

    def get_attention_for_user(self, user_id: int, today_iso: str) -> List[Dict[str, Any]]:
        """Todo del destinatario che scadono oggi o sono scaduti, dal piu' vecchio."""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM todo_messages
                    WHERE recipient_id = ?
                    AND status IN ('pending', 'read')
                    AND deleted_at IS NULL
                    AND due_date IS NOT NULL
                    AND substr(due_date, 1, 10) <= ?
                    ORDER BY due_date ASC
                ''', (user_id, today_iso))
                columns = [description[0] for description in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get attention todos for user {user_id}: {e}")
            return []

    def record_reminder(self, message_id: int, sent_at: str) -> None:
        """Registra un richiamo inviato (serve a non ripeterlo nella stessa fascia oraria)."""
        with self.db_manager.transaction() as conn:
            conn.execute('''
                UPDATE todo_messages
                SET reminder_count = COALESCE(reminder_count, 0) + 1,
                    last_reminder_at = ?
                WHERE id = ?
            ''', (sent_at, message_id))

    def snooze_todo(self, message_id: int, days: int, user_id: int, count_snooze: bool = True) -> bool:
        """
        Snooze/postpone a todo by X days.
        Updates due_date and lowers urgency by one level.
        Riparte lo schema dei richiami sulla nuova scadenza. Se count_snooze e' True
        il posticipo conta verso MAX_SNOOZES (non per i rinvii in blocco di una lavorazione).
        """
        try:
            from datetime import datetime, timedelta

            message = self.get_by_id(message_id)
            if not message:
                return False

            # Ensure only recipient can snooze
            if str(message['recipient_id']) != str(user_id):
                logger.warning(f"User {user_id} attempted to snooze message {message_id}, but is not the recipient")
                return False

            # Calculate the new due date. A snooze from the dashboard must
            # always make an overdue todo actionable again: adding one day to
            # an old deadline would leave it overdue (potentially for months).
            current_due_date = message.get('due_date')
            if current_due_date:
                if isinstance(current_due_date, datetime):
                    due_date_obj = current_due_date
                else:
                    due_date_obj = datetime.fromisoformat(
                        str(current_due_date).replace('Z', '+00:00')
                    )

                base_date = max(due_date_obj.date(), datetime.now().date())
                new_due_date = base_date + timedelta(days=days)
            else:
                # If no due date is set, schedule it X days from today.
                new_due_date = datetime.now().date() + timedelta(days=days)

            # Calculate effective urgency (same logic as frontend getEffectiveUrgency)
            current_urgency = message.get('urgency_level', 'normal')
            if current_urgency == 'normal':
                # Derive from priority like frontend does
                priority = message.get('priority', 'medium')
                if priority == 'urgent':
                    current_urgency = 'critical'
                elif priority == 'high':
                    current_urgency = 'urgent'
                elif priority == 'medium':
                    current_urgency = 'attention'
                # low stays 'normal'

            # Lower urgency by one level (use 'lowered' instead of 'normal' to prevent priority fallback in FE)
            urgency_downgrade = {
                'critical': 'urgent',
                'urgent': 'attention',
                'attention': 'lowered',
                'normal': 'lowered',
                'lowered': 'lowered'
            }
            new_urgency = urgency_downgrade.get(current_urgency, 'lowered')

            # Update due_date and lowered urgency; i richiami ripartono dalla nuova scadenza
            updates = {
                'due_date': new_due_date.isoformat(),
                'urgency_level': new_urgency,
                'reminder_count': 0,
                'last_reminder_at': None,
            }
            if count_snooze:
                updates['snooze_count'] = int(message.get('snooze_count') or 0) + 1
            self.update(message_id, updates)

            logger.info(f"Snoozed todo {message_id} by {days} days, urgency: {current_urgency} -> {new_urgency}")
            return True

        except Exception as e:
            logger.error(f"Failed to snooze todo {message_id}: {e}")
            return False

