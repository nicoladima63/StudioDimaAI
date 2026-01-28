
import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository, QueryOptions, QueryResult
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError, ValidationError

logger = logging.getLogger(__name__)

class WorkRepository(BaseRepository):
    """
    Repository for managing Work templates and their associated Step templates.
    """
    
    @property
    def table_name(self) -> str:
        return 'works'
        
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()
        
    def _ensure_tables_exist(self) -> None:
        """Ensure necessary tables exist."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                
                # 1. Works Table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS works (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        description TEXT,
                        category TEXT,
                        provider_id TEXT, -- Optional default provider
                        version INTEGER DEFAULT 1,
                        metadata TEXT DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL
                    )
                ''')
                
                # 2. Step Templates Table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS step_templates (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        work_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        order_index INTEGER DEFAULT 0,
                        provider_id TEXT, -- Specific provider for this step
                        metadata TEXT DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        deleted_at TIMESTAMP NULL,
                        FOREIGN KEY (work_id) REFERENCES works(id)
                    )
                ''')
                
                # Indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_works_deleted ON works(deleted_at)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_step_templates_work ON step_templates(work_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_step_templates_order ON step_templates(work_id, order_index)')
                
                cursor.close()
                
        except Exception as e:
            logger.error(f"Failed to ensure work tables: {e}")
            raise RepositoryError(f"Failed to ensure work tables: {str(e)}", cause=e)

    def get_work_with_steps(self, work_id: int) -> Optional[Dict[str, Any]]:
        """Get a work with all its step templates."""
        work = self.get_by_id(work_id)
        if not work:
            return None
            
        steps = self.get_step_templates(work_id)
        work['steps'] = steps
        return work
        
    def get_step_templates(self, work_id: int) -> List[Dict[str, Any]]:
        """Get all step templates for a work, ordered by index."""
        try:
            query = """
                SELECT * FROM step_templates 
                WHERE work_id = ? AND (deleted_at IS NULL OR deleted_at = '')
                ORDER BY order_index ASC
            """
            results = self.execute_custom_query(query, (work_id,), fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get step templates for work {work_id}: {e}")
            return []

    def create_work(self, work_data: Dict[str, Any], steps_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a new work with optional steps in a transaction."""
        try:
            with self.db_manager.transaction() as conn:
                # 1. Create Work
                # validation is handled by base create(), but here we do manual insert for transaction safety
                self._validate_entity_data(work_data)
                query, params = self._build_insert_query(work_data)
                cursor = conn.cursor()
                cursor.execute(query, params)
                work_id = cursor.lastrowid
                
                # 2. Create Steps
                if steps_data:
                    for index, step in enumerate(steps_data):
                        step['work_id'] = work_id
                        step['order_index'] = step.get('order_index', index)
                        
                        fields = ', '.join(step.keys())
                        placeholders = ', '.join(['?' for _ in step.keys()])
                        values = list(step.values())
                        
                        step_query = f"INSERT INTO step_templates ({fields}) VALUES ({placeholders})"
                        cursor.execute(step_query, values)
                
                cursor.close()
                
                # Return complete object
                return self.get_work_with_steps(work_id)
                
        except Exception as e:
            logger.error(f"Failed to create work with steps: {e}")
            raise RepositoryError(f"Failed to create work: {str(e)}", cause=e)

    def add_step_template(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add a single step template to a work."""
        try:
            # Simple direct insert using base logic could be tricky due to table name mismatch
            # creating a mini-repo or just custom query is better
            fields = ', '.join(step_data.keys())
            placeholders = ', '.join(['?' for _ in step_data.keys()])
            values = list(step_data.values())
            
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(f"INSERT INTO step_templates ({fields}) VALUES ({placeholders})", values)
                step_id = cursor.lastrowid
                cursor.close()
                
                # Fetch back
                result = self.execute_custom_query(
                    "SELECT * FROM step_templates WHERE id = ?", (step_id,), fetch_one=True
                )
                return dict(result)
        except Exception as e:
             logger.error(f"Failed to add step template: {e}")
             raise RepositoryError(f"Failed to add step: {str(e)}", cause=e)

