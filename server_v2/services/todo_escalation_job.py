
import logging
from datetime import datetime, date
from typing import Dict, Any, List

from core.database_manager import DatabaseManager
from repositories.todo_repository import TodoRepository
from services.notification_service import NotificationService

logger = logging.getLogger(__name__)

class TodoEscalationJob:
    """
    Scheduled job to check for overdue todos and escalate them.
    Runs daily to update urgency levels and send reminder notifications.
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.todo_repository = TodoRepository(db_manager)
        self.notification_service = NotificationService(db_manager)
    
    def check_and_escalate(self) -> Dict[str, Any]:
        """
        Check all overdue todos and escalate based on days overdue.
        Returns summary of actions taken.
        """
        try:
            logger.info("Starting todo escalation check...")
            
            # Get all overdue todos
            overdue_todos = self.todo_repository.get_overdue_todos()
            
            if not overdue_todos:
                logger.info("No overdue todos found")
                return {
                    'success': True,
                    'overdue_count': 0,
                    'escalated_count': 0
                }
            
            logger.info(f"Found {len(overdue_todos)} overdue todos")
            
            escalated_count = 0
            today = date.today()
            
            for todo in overdue_todos:
                try:
                    # Calculate days overdue
                    due_date_str = todo.get('due_date')
                    if not due_date_str:
                        continue
                    
                    # Parse due_date (format: YYYY-MM-DD or ISO datetime)
                    if 'T' in due_date_str:
                        due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).date()
                    else:
                        due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
                    
                    days_overdue = (today - due_date).days
                    
                    # Determine urgency level
                    old_urgency = todo.get('urgency_level', 'normal')
                    new_urgency = self._calculate_urgency_level(days_overdue)
                    
                    # Only escalate if urgency changed
                    if new_urgency != old_urgency:
                        # Update urgency level
                        self.todo_repository.update_urgency_level(todo['id'], new_urgency)
                        
                        # Send reminder notification
                        self._send_reminder_notification(todo, new_urgency, days_overdue)
                        
                        escalated_count += 1
                        logger.info(f"Escalated todo {todo['id']} from {old_urgency} to {new_urgency} ({days_overdue} days overdue)")
                
                except Exception as e:
                    logger.error(f"Failed to escalate todo {todo.get('id')}: {e}")
                    continue
            
            logger.info(f"Escalation check complete: {escalated_count}/{len(overdue_todos)} todos escalated")
            
            return {
                'success': True,
                'overdue_count': len(overdue_todos),
                'escalated_count': escalated_count
            }
            
        except Exception as e:
            logger.error(f"Failed to run escalation check: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_urgency_level(self, days_overdue: int) -> str:
        """
        Calculate urgency level based on days overdue.

        - 0 days: attention (appena scaduto)
        - 1-2 days: urgent (insistent reminder)
        - 3+ days: critical (very insistent reminder)
        """
        if days_overdue > 2:  # 3+ giorni
            return 'critical'
        elif days_overdue >= 1:  # 1-2 giorni
            return 'urgent'
        else:  # 0 giorni (appena scaduto)
            return 'attention'
    
    def _send_reminder_notification(self, todo: Dict[str, Any], urgency_level: str, days_overdue: int) -> None:
        """Send reminder notification based on urgency level."""
        try:
            recipient_id = todo.get('recipient_id')
            if not recipient_id:
                return
            
            # Determine notification type based on urgency
            notif_type_map = {
                'attention': 'warning',
                'urgent': 'warning',
                'critical': 'error'
            }
            notif_type = notif_type_map.get(urgency_level, 'info')
            
            # Create message based on urgency
            subject = todo.get('subject', 'Task')
            
            if urgency_level == 'critical':
                message = f"🚨 URGENTE: '{subject}' è in ritardo di {days_overdue} giorni! Completala al più presto!"
            elif urgency_level == 'urgent':
                message = f"🔥 '{subject}' è in ritardo di {days_overdue} giorni. Richiede la tua attenzione!"
            elif urgency_level == 'attention':
                message = f"⚠️ Promemoria: '{subject}' è scaduta ieri. Ricordati di completarla."
            else:
                return  # No notification for normal
            
            # Send notification
            self.notification_service.notify_user(
                user_id=recipient_id,
                message=message,
                type=notif_type,
                link=f"/todos/{todo['id']}"
            )
            
            # Broadcast via WebSocket for real-time update
            try:
                from app_v2 import websocket_service
                if websocket_service:
                    websocket_service.broadcast_notification(
                        user_id=recipient_id,
                        notification_data={
                            'type': 'todo_escalation',
                            'todo_id': todo['id'],
                            'urgency_level': urgency_level,
                            'days_overdue': days_overdue
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to broadcast escalation: {e}")
            
        except Exception as e:
            logger.error(f"Failed to send reminder notification: {e}")

