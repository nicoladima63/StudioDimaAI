
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

    def create_task_from_work(
        self, 
        patient_id: str, 
        work_id: int, 
        description: str = None, 
        prestazione_id: str = None,
        external_ref_id: str = None,
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
                'start_date': datetime.now()
            }
            
            # 3. Prepare Steps Data from Template
            steps_data = []
            for step_temp in work.get('steps', []):
                steps_data.append({
                    'name': step_temp['name'],
                    'description': step_temp.get('description'),
                    'order_index': step_temp['order_index'],
                    'provider_id': step_temp.get('provider_id'),
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

    def complete_step(self, task_id: int, step_id: int, user_id: str = None) -> Dict[str, Any]:
        """
        Mark a step as completed and activate the next one.
        Triggers any associated automation.
        """
        try:
            # 1. Update current step
            current_step = self.task_repository.get_by_id(step_id, table_name='steps') # Wait, base repo get_by_id uses self.table_name
            # I need to access steps table directly or via a method in task_repo
            # task_repository has update_step_status which handles it.
            
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
                
                # Check for provider automation
                if next_step.get('provider_id'):
                    # TODO: Trigger automation service
                    pass
            else:
                # No more steps, complete the task
                self.task_repository.update(task_id, {'status': 'completed', 'completed_at': datetime.now()})
                logger.info(f"Task {task_id} completed")
                
            return self.get_task_details(task_id)
            
        except Exception as e:
            logger.error(f"Failed to complete step: {e}")
            raise ServiceError(f"Failed to complete step: {str(e)}")

