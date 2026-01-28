
from typing import Optional, List, Dict, Any
from core.base_repository import BaseRepository

class ProviderRepository(BaseRepository):
    """
    Repository for managing Providers (internal/laboratories).
    Persists data to the 'providers' table in SQLite.
    """
    
    @property
    def table_name(self) -> str:
        return 'providers'
    
    def _ensure_tables_exist(self, cursor) -> None:
        """
        Create providers table if it doesn't exist.
        """
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                type TEXT DEFAULT 'external', -- external, internal, lab
                metadata TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL
            )
        ''') 

    def get_all_active(self) -> List[Dict[str, Any]]:
        """Get all active providers (not soft deleted)."""
        query = f"SELECT * FROM {self.table_name} WHERE deleted_at IS NULL ORDER BY name"
        return self.execute_custom_query(query, fetch_all=True)
    
    def find_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find a provider by name."""
        query = f"SELECT * FROM {self.table_name} WHERE name = ? AND deleted_at IS NULL"
        return self.execute_custom_query(query, (name,), fetch_one=True)
