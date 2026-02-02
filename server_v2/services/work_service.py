
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from core.database_manager import DatabaseManager
from core.exceptions import ServiceError, ValidationError
from repositories.work_repository import WorkRepository
from repositories.task_repository import TaskRepository
from services.base_service import BaseService

logger = logging.getLogger(__name__)

class WorkService(BaseService):
    """
    Service for managing Works, Tasks, and Steps logic.
    Handles the orchestration of creating tasks from templates and advancing steps.
    """
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__(db_manager)
        self.work_repository = WorkRepository(db_manager)
        self.task_repository = TaskRepository(db_manager)
        # We will inject ProviderAutomationService later or import it when needed to avoid circular deps
        
    def get_all_works(self) -> List[Dict[str, Any]]:
        """Get all work templates."""
        result = self.work_repository.list()
        return result.data
        
    def get_work_details(self, work_id: int) -> Optional[Dict[str, Any]]:
        """Get full work template details with steps."""
        return self.work_repository.get_work_with_steps(work_id)
        
    def create_work_template(self, work_data: Dict[str, Any], steps_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a new work template."""
        return self.work_repository.create_work(work_data, steps_data)
        
    def update_work_template(self, work_id: int, work_data: Dict[str, Any], steps_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Update a work template and its steps."""
        return self.work_repository.update_work_with_steps(work_id, work_data, steps_data)

    def delete_work_template(self, work_id: int) -> bool:
        """Delete a work template."""
        return self.work_repository.delete(work_id)

    def create_task_from_work(
        self, 
        patient_id: str, 
        work_id: int, 
        description: str = None, 
        prestazione_id: str = None,
        external_ref_id: str = None,
        start_date: str = None,
        due_date: str = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """
        Create a new Task instance from a Work template.
        Copies all StepTemplates to Steps.
        """
        try:
            # 1. Get Work Template
            work = self.work_repository.get_work_with_steps(work_id)
            if not work:
                raise ValidationError(f"Work template {work_id} not found")
                
            # 2. Prepare Task Data
            task_data = {
                'patient_id': patient_id,
                'work_id': work_id,
                'description': description or work['name'],
                'prestazione_id': prestazione_id,
                'external_ref_id': external_ref_id,
                'status': 'active', # Start as active immediately? Or pending? Let's say active.
                'start_date': start_date or datetime.now(),
                'due_date': due_date
            }
            
            # 3. Prepare Steps Data from Template
            steps_data = []
            for step_temp in work.get('steps', []):
                steps_data.append({
                    'name': step_temp['name'],
                    'description': step_temp.get('description'),
                    'order_index': step_temp['order_index'],
                    'user_id': step_temp.get('user_id'),
                    'metadata': step_temp.get('metadata', '{}'),
                    'status': 'pending' 
                })
            
            # 4. Create Task and Steps via Repository
            task = self.task_repository.create_task(task_data, steps_data)
            
            # 5. Activate first step automatically
            if task and task.get('steps'):
                first_step = task['steps'][0]
                self.task_repository.update_step_status(first_step['id'], 'active')
                task['steps'][0]['status'] = 'active' # Update local object to reflect

                # 6. Send notification to first user
                first_user_id = first_step.get('user_id')
                if first_user_id:
                    try:
                        from services.notification_service import NotificationService
                        notification_service = NotificationService(self.db_manager)

                        try:
                            user_id_int = int(first_user_id)
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid user_id format for first step notification: {first_user_id}")
                            user_id_int = None

                        if user_id_int:
                            message = f"Nuovo Task #{task['id']}: Step '{first_step['name']}' pronto per essere eseguito"
                            link = f"/works/{task['id']}"

                            notification_service.notify_user(
                                user_id=user_id_int,
                                message=message,
                                type='info',
                                link=link
                            )

                            logger.info(f"Notification sent to user {user_id_int} for new task {task['id']}")

                    except Exception as notif_error:
                        # Non-critical error, log and continue
                        logger.error(f"Failed to send notification for new task: {notif_error}")

            logger.info(f"Created Task {task['id']} for Patient {patient_id} from Work {work_id}")
            return task
            
        except Exception as e:
            logger.error(f"Failed to create task from work: {e}")
            raise ServiceError(f"Failed to create task: {str(e)}")

    def get_task_details(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get task details with steps."""
        return self.task_repository.get_task_with_steps(task_id)

    def get_tasks_for_patient(self, patient_id: str) -> List[Dict[str, Any]]:
        """List tasks for a patient."""
        return self.task_repository.get_tasks_by_patient(patient_id)
        
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """List all tasks."""
        return self.task_repository.get_all_tasks()

    def complete_step(self, task_id: int, step_id: int, user_id: str = None) -> Dict[str, Any]:
        """
        Mark a step as completed and activate the next one.
        Triggers any associated automation.
        """
        try:
            # 1. Update current step and get updated Object
            updated_step = self.task_repository.update_step_status(step_id, 'completed', user_id)
            if not updated_step:
                raise ValidationError(f"Step {step_id} not found")
                
            # 2. Find next step
            all_steps = self.task_repository.get_steps(task_id)
            
            current_index = updated_step['order_index']
            next_step = None
            
            for step in all_steps:
                if step['order_index'] > current_index and step['status'] == 'pending':
                    next_step = step
                    break
            
            # 3. Activate next step
            if next_step:
                self.task_repository.update_step_status(next_step['id'], 'active')
                logger.info(f"Activated next step {next_step['id']} for task {task_id}")

                # 4. Send notification if operator changes
                next_user_id = next_step.get('user_id')
                current_user_id = updated_step.get('user_id')

                if (next_user_id and
                    current_user_id and
                    str(next_user_id) != str(current_user_id)):

                    try:
                        from services.notification_service import NotificationService
                        notification_service = NotificationService(self.db_manager)

                        try:
                            next_user_id_int = int(next_user_id)
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid user_id format for notification: {next_user_id}")
                            next_user_id_int = None

                        if next_user_id_int:
                            message = f"Step '{next_step['name']}' attivato per Task #{task_id}"
                            link = f"/works/{task_id}"

                            notification_service.notify_user(
                                user_id=next_user_id_int,
                                message=message,
                                type='info',
                                link=link
                            )

                            logger.info(f"Notification sent to user {next_user_id_int} for step {next_step['id']}")

                    except Exception as notif_error:
                        # Non-critical error, log and continue
                        logger.error(f"Failed to send notification: {notif_error}")
            else:
                # No more steps, complete the task
                self.task_repository.update(task_id, {'status': 'completed', 'completed_at': datetime.now()})
                logger.info(f"Task {task_id} completed")
                
            return self.get_task_details(task_id)
            
        except Exception as e:
            logger.error(f"Failed to complete step: {e}")
            raise ServiceError(f"Failed to complete step: {str(e)}")

    def delete_task(self, task_id: int) -> bool:
        """Delete a task."""
        try:
            return self.task_repository.delete(task_id)
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            raise ServiceError(f"Failed to delete task: {str(e)}")

    def update_task_status(self, task_id: int, status: str) -> Optional[Dict[str, Any]]:
        """Update task status."""
        try:
            return self.task_repository.update(task_id, {'status': status})
        except Exception as e:
            logger.error(f"Failed to update task status {task_id}: {e}")
            raise ServiceError(f"Failed to update task: {str(e)}")

