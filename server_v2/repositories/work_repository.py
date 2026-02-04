
import logging
import json
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

    def list(self, options: Optional[QueryOptions] = None) -> QueryResult:
        """List works with their steps."""
        # Get works using base method
        result = super().list(options)
        
        # Hydrate steps for each work
        if result.data:
            for work in result.data:
                work_id = work.get('id')
                if work_id:
                    work['steps'] = self.get_step_templates(work_id)
        
        return result
        
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
            if not results:
                return []
            
            # Filter out provider_id and ensure dict
            steps = []
            for row in results:
                step = dict(row)
                if 'provider_id' in step:
                    del step['provider_id']
                steps.append(step)
            return steps
        except Exception as e:
            logger.error(f"Failed to get step templates for work {work_id}: {e}")
            return []

    def create_work(self, work_data: Dict[str, Any], steps_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a new work with optional steps in a transaction."""
        try:
            with self.db_manager.transaction() as conn:
                # 1. Create Work
                # Remove 'steps' field if present (it's not a column in works table)
                clean_work_data = {k: v for k, v in work_data.items() if k != 'steps'}
                
                # validation is handled by base create(), but here we do manual insert for transaction safety
                self._validate_entity_data(clean_work_data)
                query, params = self._build_insert_query(clean_work_data)
                cursor = conn.cursor()
                cursor.execute(query, params)
                work_id = cursor.lastrowid
                
                # 2. Create Steps
                if steps_data:
                    for index, step in enumerate(steps_data):
                        step['work_id'] = work_id
                        step['order_index'] = step.get('order_index', index)
                        
                        # Map incoming user_id to DB user_id
                        step['user_id'] = step.get('user_id')
                        # Ensure provider_id is NOT used for steps
                        if 'provider_id' in step:
                            del step['provider_id']
                            
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
            # Ensure user_id usage
            if 'provider_id' in step_data:
                del step_data['provider_id']
            
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

    def update_work_with_steps(self, work_id: int, work_data: Dict[str, Any], steps_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Update a work and its steps in a transaction."""
        try:
            with self.db_manager.transaction() as conn:
                # 1. Update Work
                if work_data:
                    # Remove steps if present in work_data to avoid DB error
                    clean_work_data = {k: v for k, v in work_data.items() if k != 'steps'}
                    self.update(work_id, clean_work_data)
                
                # 2. Update Steps
                if steps_data is not None:
                    cursor = conn.cursor()
                    
                    # Get existing step IDs to detect deletions
                    existing_steps = self.get_step_templates(work_id)
                    existing_ids = {s['id'] for s in existing_steps}
                    incoming_ids = {s['id'] for s in steps_data if 'id' in s}
                    
                    # Delete steps that are no longer present
                    ids_to_delete = existing_ids - incoming_ids
                    if ids_to_delete:
                        placeholders = ', '.join(['?' for _ in ids_to_delete])
                        delete_query = f"UPDATE step_templates SET deleted_at = CURRENT_TIMESTAMP WHERE id IN ({placeholders})"
                        cursor.execute(delete_query, list(ids_to_delete))
                    
                    # Upsert steps
                    for index, step in enumerate(steps_data):
                        step_id = step.get('id')
                        step_data = {
                            'work_id': work_id,
                            'name': step['name'],
                            'description': step.get('description'),
                            'order_index': step.get('order_index', index),
                            'order_index': step.get('order_index', index),
                            'user_id': step.get('user_id'),
                            # 'provider_id': step.get('provider_id'), # Removed
                            'metadata': step.get('metadata', '{}') if isinstance(step.get('metadata'), str) else json.dumps(step.get('metadata', {}))
                        }
                        
                        if step_id and step_id in existing_ids:
                            # Update existing
                            set_clauses = [f"{k} = ?" for k in step_data.keys()]
                            query = f"UPDATE step_templates SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
                            values = list(step_data.values()) + [step_id]
                            cursor.execute(query, values)
                        else:
                            # Insert new
                            fields = ', '.join(step_data.keys())
                            placeholders = ', '.join(['?' for _ in step_data.keys()])
                            query = f"INSERT INTO step_templates ({fields}) VALUES ({placeholders})"
                            values = list(step_data.values())
                            cursor.execute(query, values)
                            
                    cursor.close()
                
            return self.get_work_with_steps(work_id)
                
        except Exception as e:
            logger.error(f"Failed to update work with steps: {e}")
            raise RepositoryError(f"Failed to update work: {str(e)}", cause=e)

