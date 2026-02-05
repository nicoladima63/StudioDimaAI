
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from core.database_manager import DatabaseManager
from core.exceptions import ServiceError, ValidationError
from repositories.todo_repository import TodoRepository
from services.base_service import BaseService

logger = logging.getLogger(__name__)

class TodoService(BaseService):
    """
    Service for managing Todo Messages.
    Handles business logic, validation, and integration with notifications.
    """
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__(db_manager)
        self.todo_repository = TodoRepository(db_manager)
        
    def create_todo(
        self,
        sender_id: int,
        recipient_id: int,
        subject: str,
        message: str = None,
        priority: str = 'medium',
        due_date: str = None,
        type: str = 'general',
        related_task_id: int = None,
        related_step_id: int = None
    ) -> Dict[str, Any]:
        """
        Create a new todo message.
        Sends notification and broadcasts via WebSocket.
        """
        try:
            # Validation
            if not sender_id or not recipient_id:
                raise ValidationError("sender_id and recipient_id are required")
            
            if not subject:
                raise ValidationError("subject is required")
            
            # Prepare data
            todo_data = {
                'sender_id': sender_id,
                'recipient_id': recipient_id,
                'subject': subject,
                'message': message,
                'priority': priority,
                'due_date': due_date,
                'type': type,
                'related_task_id': related_task_id,
                'related_step_id': related_step_id,
                'status': 'pending',
                'urgency_level': 'normal'
            }
            
            # Create todo
            todo = self.todo_repository.create(todo_data)
            
            # Send notification
            self._send_notification(todo)
            
            # Broadcast via WebSocket
            self._broadcast_todo(todo)
            
            logger.info(f"Created todo {todo['id']} from user {sender_id} to user {recipient_id}")
            return todo
            
        except Exception as e:
            logger.error(f"Failed to create todo: {e}")
            raise ServiceError(f"Failed to create todo: {str(e)}")
    
    def create_todo_from_step(
        self,
        step: Dict[str, Any],
        task: Dict[str, Any],
        sender_id: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Create a todo from a task step (automation integration).
        """
        try:
            recipient_id = step.get('user_id')
            if not recipient_id:
                logger.warning(f"Step {step.get('id')} has no assigned user, skipping todo creation")
                return None
            
            # Calculate due_date based on task due_date or default to 7 days
            due_date = task.get('due_date')
            if not due_date:
                due_date = (datetime.now() + timedelta(days=7)).isoformat()
            
            subject = f"Nuova fase: {step['name']}"
            message = f"Hai una nuova fase da completare per il task '{task.get('description', 'N/A')}'"
            
            return self.create_todo(
                sender_id=sender_id,
                recipient_id=recipient_id,
                subject=subject,
                message=message,
                priority='medium',
                due_date=due_date,
                type='notification',
                related_task_id=task.get('id'),
                related_step_id=step.get('id')
            )
            
        except Exception as e:
            logger.error(f"Failed to create todo from step: {e}")
            return None
    
    def get_pending_for_user(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all pending todos for a user."""
        return self.todo_repository.get_pending_for_user(user_id)
    
    def get_inbox(self, user_id: int) -> List[Dict[str, Any]]:
        """Get inbox for a user."""
        result = self.todo_repository.get_inbox(user_id)
        return result.data if hasattr(result, 'data') else result
    
    def get_sent(self, user_id: int) -> List[Dict[str, Any]]:
        """Get sent todos by a user."""
        result = self.todo_repository.get_sent(user_id)
        return result.data if hasattr(result, 'data') else result
    
    def get_by_id(self, todo_id: int) -> Optional[Dict[str, Any]]:
        """Get todo by ID."""
        return self.todo_repository.get_by_id(todo_id)
    
    def mark_as_read(self, todo_id: int, user_id: int) -> bool:
        """Mark todo as read."""
        return self.todo_repository.mark_as_read(todo_id, user_id)
    
    def mark_as_completed(self, todo_id: int, user_id: int) -> bool:
        """Mark todo as completed."""
        success = self.todo_repository.mark_as_completed(todo_id, user_id)
        
        if success:
            # Broadcast update
            todo = self.get_by_id(todo_id)
            if todo:
                self._broadcast_todo(todo, event_type='completed')
        
        return success
    
    def archive_message(self, todo_id: int, user_id: int) -> bool:
        """Archive a todo."""
        return self.todo_repository.archive_message(todo_id, user_id)
    
    def update_todo(self, todo_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a todo."""
        try:
            updated = self.todo_repository.update(todo_id, updates)
            
            if updated:
                self._broadcast_todo(updated, event_type='updated')
            
            return updated
        except Exception as e:
            logger.error(f"Failed to update todo {todo_id}: {e}")
            return None
    
    def get_related_to_task(self, task_id: int) -> List[Dict[str, Any]]:
        """Get todos related to a task."""
        return self.todo_repository.get_related_to_task(task_id)
    
    def get_related_to_step(self, step_id: int) -> List[Dict[str, Any]]:
        """Get todos related to a step."""
        return self.todo_repository.get_related_to_step(step_id)
    
    def auto_complete_step_todos(self, step_id: int) -> int:
        """
        Auto-complete all todos related to a step.
        Returns number of todos completed.
        """
        try:
            todos = self.get_related_to_step(step_id)
            completed_count = 0
            
            for todo in todos:
                if todo['status'] in ('pending', 'read'):
                    # Use system user (1) to auto-complete
                    if self.todo_repository.update_status(todo['id'], 'completed'):
                        completed_count += 1
                        self._broadcast_todo(todo, event_type='auto_completed')
            
            logger.info(f"Auto-completed {completed_count} todos for step {step_id}")
            return completed_count
            
        except Exception as e:
            logger.error(f"Failed to auto-complete todos for step {step_id}: {e}")
            return 0
    
    def _send_notification(self, todo: Dict[str, Any]) -> None:
        """Send push notification for a todo."""
        try:
            from services.notification_service import NotificationService
            
            notification_service = NotificationService(self.db_manager)
            
            # Determine notification type based on urgency
            notif_type = 'info'
            if todo.get('urgency_level') == 'critical':
                notif_type = 'error'
            elif todo.get('urgency_level') == 'urgent':
                notif_type = 'warning'
            elif todo.get('urgency_level') == 'attention':
                notif_type = 'warning'
            
            notification_service.notify_user(
                user_id=todo['recipient_id'],
                message=todo['subject'],
                type=notif_type,
                link=f"/todos/{todo['id']}"
            )
            
        except Exception as e:
            logger.error(f"Failed to send notification for todo {todo.get('id')}: {e}")
    
    def _broadcast_todo(self, todo: Dict[str, Any], event_type: str = 'created') -> None:
        """Broadcast todo via WebSocket."""
        try:
            from app_v2 import websocket_service
            
            if websocket_service:
                websocket_service.broadcast_notification(
                    user_id=todo['recipient_id'],
                    data={
                        'type': 'todo',
                        'event': event_type,
                        'todo': todo
                    }
                )
                
        except Exception as e:
            logger.error(f"Failed to broadcast todo {todo.get('id')}: {e}")
    
    def snooze_todo(self, todo_id: int, days: int, user_id: int) -> bool:
        """
        Snooze/postpone a todo by X days.
        Resets urgency and broadcasts update.
        """
        success = self.todo_repository.snooze_todo(todo_id, days, user_id)
        
        if success:
            # Broadcast update
            todo = self.get_by_id(todo_id)
            if todo:
                self._broadcast_todo(todo, event_type='snoozed')
                
                # Send notification
                try:
                    from services.notification_service import NotificationService
                    notification_service = NotificationService(self.db_manager)
                    
                    notification_service.notify_user(
                        user_id=todo['recipient_id'],
                        message=f"Todo '{todo['subject']}' posticipato di {days} giorni",
                        type='info',
                        link=f"/todos/{todo_id}"
                    )
                except Exception as e:
                    logger.error(f"Failed to send snooze notification: {e}")
        
        return success
    
    def postpone_task_todos(self, task_id: int, days: int, user_id: int) -> Dict[str, Any]:
        """
        Postpone all todos related to a task by X days.
        Useful when patient reschedules appointment.
        """
        try:
            todos = self.get_related_to_task(task_id)
            postponed_count = 0
            
            for todo in todos:
                # Only postpone pending/read todos
                if todo['status'] in ('pending', 'read'):
                    # Use repository directly to avoid multiple broadcasts
                    if self.todo_repository.snooze_todo(todo['id'], days, user_id):
                        postponed_count += 1
            
            logger.info(f"Postponed {postponed_count} todos for task {task_id} by {days} days")
            
            # Single broadcast for task postpone
            try:
                from app_v2 import websocket_service
                if websocket_service:
                    websocket_service.broadcast_notification(
                        user_id=user_id,
                        data={
                            'type': 'task_postponed',
                            'task_id': task_id,
                            'days': days,
                            'todos_affected': postponed_count
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to broadcast task postpone: {e}")
            
            return {
                'success': True,
                'postponed_count': postponed_count,
                'days': days
            }
            
        except Exception as e:
            logger.error(f"Failed to postpone task todos: {e}")
            return {
                'success': False,
                'error': str(e)
            }

