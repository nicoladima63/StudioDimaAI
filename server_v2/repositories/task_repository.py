
import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository, QueryOptions, QueryResult
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError, ValidationError

logger = logging.getLogger(__name__)

class TaskRepository(BaseRepository):
    """
    Repository for managing Tasks (instances of Works) and their associated Steps.
    """
    
    @property
    def table_name(self) -> str:
        return 'tasks'
        
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()
        
    def _ensure_tables_exist(self) -> None:
        """Ensure necessary tables exist."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                # 1. Tasks Table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        patient_id TEXT NOT NULL, -- Link to PAZIENTI.DBF.DB_CODE
                        work_id INTEGER NOT NULL,
                        description TEXT,
                        prestazione_id TEXT, -- Link to PREVENT.DBF or ONORARIO.DBF specifically
                        external_ref_id TEXT, -- Generic external link if needed
                        status TEXT DEFAULT 'pending', -- pending, active, completed, cancelled
                        start_date TIMESTAMP,
                        due_date TIMESTAMP,
                        completed_at TIMESTAMP,
                        metadata TEXT DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (work_id) REFERENCES works(id)
                    )
                ''')
                
                # 2. Steps Table (Instances)
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS steps (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        status TEXT DEFAULT 'pending', -- pending, active, completed, skipped
                        order_index INTEGER DEFAULT 0,
                        provider_id TEXT,
                        completed_at TIMESTAMP,
                        completed_by TEXT, -- User ID
                        metadata TEXT DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (task_id) REFERENCES tasks(id)
                    )
                ''')
                
                # Indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_patient ON tasks(patient_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_work ON tasks(work_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_prestazione ON tasks(prestazione_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_steps_status ON steps(status)')
                
                cursor.close()
                
        except Exception as e:
            logger.error(f"Failed to ensure task tables: {e}")
            raise RepositoryError(f"Failed to ensure task tables: {str(e)}", cause=e)

    def get_task_with_steps(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get a task with all its steps."""
        task = self.get_by_id(task_id)
        if not task:
            return None
            
        steps = self.get_steps(task_id)
        task['steps'] = steps
        return task
        
    def get_steps(self, task_id: int) -> List[Dict[str, Any]]:
        """Get all steps for a task, ordered by index."""
        try:
            query = """
                SELECT * FROM steps 
                WHERE task_id = ? AND (deleted_at IS NULL OR deleted_at = '')
                ORDER BY order_index ASC
            """
            results = self.execute_custom_query(query, (task_id,), fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get steps for task {task_id}: {e}")
            return []
            
    def _attach_steps(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Helper to attach steps to a list of tasks."""
        for task in tasks:
            task['steps'] = self.get_steps(task['id'])
        return tasks

    def get_tasks_by_patient(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get all tasks for a specific patient."""
        try:
            options = QueryOptions()
            options.filters = {'patient_id': patient_id}
            options.order_by = 'created_at'
            options.order_direction = 'DESC'
            
            result = self.list(options)
            return self._attach_steps(result.data)
        except Exception as e:
            logger.error(f"Failed to get tasks for patient {patient_id}: {e}")
            return []
            
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """Get all tasks ordered by creation date."""
        try:
            options = QueryOptions()
            options.order_by = 'created_at'
            options.order_direction = 'DESC'
            
            result = self.list(options)
            return self._attach_steps(result.data)
        except Exception as e:
            logger.error(f"Failed to get all tasks: {e}")
            return []

    def create_task(self, task_data: Dict[str, Any], steps_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a new task with initial steps in a transaction."""
        try:
            with self.db_manager.transaction() as conn:
                # 1. Create Task
                self._validate_entity_data(task_data)
                query, params = self._build_insert_query(task_data)
                cursor = conn.cursor()
                cursor.execute(query, params)
                task_id = cursor.lastrowid
                
                # 2. Create Steps (if provided, usually copied from template)
                if steps_data:
                    for index, step in enumerate(steps_data):
                        step['task_id'] = task_id
                        step['order_index'] = step.get('order_index', index)
                        # Ensure status is pending/default if not specified
                        if 'status' not in step:
                            step['status'] = 'pending'
                        
                        fields = ', '.join(step.keys())
                        placeholders = ', '.join(['?' for _ in step.keys()])
                        values = list(step.values())
                        
                        step_query = f"INSERT INTO steps ({fields}) VALUES ({placeholders})"
                        cursor.execute(step_query, values)
                
                cursor.close()
                
            return self.get_task_with_steps(task_id)
                
        except Exception as e:
            logger.error(f"Failed to create task with steps: {e}")
            raise RepositoryError(f"Failed to create task: {str(e)}", cause=e)

    def update_step_status(self, step_id: int, status: str, user_id: str = None) -> Dict[str, Any]:
        """Update step status and log completion if completed."""
        try:
            update_data = {'status': status}
            if status == 'completed':
                import datetime
                update_data['completed_at'] = datetime.datetime.now()
                if user_id:
                    update_data['completed_by'] = user_id
            
            fields = list(update_data.keys())
            values = list(update_data.values())
            values.append(step_id)
            
            query = f"UPDATE steps SET {', '.join([f'{f}=?' for f in fields])} WHERE id = ?"
            
            with self.db_manager.transaction() as conn:
                conn.execute(query, values)
                
            # Return updated step
            result = self.execute_custom_query("SELECT * FROM steps WHERE id = ?", (step_id,), fetch_one=True)
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Failed to update step status {step_id}: {e}")
            raise RepositoryError(f"Failed to update step: {str(e)}", cause=e)

