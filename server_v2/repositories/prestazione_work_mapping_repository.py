import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError

logger = logging.getLogger(__name__)

class PrestazioneWorkMappingRepository(BaseRepository):
    """Repository per mappare codici prestazione → work_id"""

    @property
    def table_name(self) -> str:
        return 'prestazione_work_mapping'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()

    def _ensure_tables_exist(self) -> None:
        """Crea la tabella mapping se non esiste."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS prestazione_work_mapping (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        codice_prestazione TEXT NOT NULL UNIQUE,
                        work_id INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (work_id) REFERENCES works(id)
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_prestazione_codice ON prestazione_work_mapping(codice_prestazione)')
        except Exception as e:
            logger.error(f"Failed to ensure prestazione_work_mapping table: {e}")
            raise RepositoryError(f"Failed to ensure table: {str(e)}", cause=e)

    def get_work_id_by_prestazione(self, codice_prestazione: str) -> Optional[int]:
        """Ottiene work_id dato il codice prestazione."""
        try:
            query = "SELECT work_id FROM prestazione_work_mapping WHERE codice_prestazione = ?"
            result = self.execute_custom_query(query, (codice_prestazione,), fetch_one=True, fetch_all=False)
            return result['work_id'] if result else None
        except Exception as e:
            logger.error(f"Failed to get work_id for prestazione {codice_prestazione}: {e}")
            return None

    def upsert_mapping(self, codice_prestazione: str, work_id: int) -> Dict[str, Any]:
        """Inserisce o aggiorna un mapping."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO prestazione_work_mapping (codice_prestazione, work_id, updated_at)
                    VALUES (?, ?, datetime('now'))
                    ON CONFLICT(codice_prestazione) DO UPDATE SET
                        work_id = excluded.work_id,
                        updated_at = datetime('now')
                ''', (codice_prestazione, work_id))

                cursor.execute('SELECT * FROM prestazione_work_mapping WHERE codice_prestazione = ?', (codice_prestazione,))
                return dict(cursor.fetchone())
        except Exception as e:
            logger.error(f"Failed to upsert mapping {codice_prestazione} → {work_id}: {e}")
            raise RepositoryError(f"Failed to upsert mapping: {str(e)}", cause=e)

    def list(self, options=None):
        """Override list per non usare deleted_at."""
        try:
            query = "SELECT * FROM prestazione_work_mapping ORDER BY codice_prestazione"
            results = self.execute_custom_query(query, (), fetch_all=True)
            data = [dict(row) for row in results] if results else []

            # Return oggetto compatibile con QueryResult
            class SimpleResult:
                def __init__(self, data):
                    self.data = data
                    self.total = len(data)

            return SimpleResult(data)
        except Exception as e:
            logger.error(f"Failed to list mappings: {e}")
            return SimpleResult([])

    def delete_mapping(self, codice_prestazione: str) -> bool:
        """Elimina un mapping."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM prestazione_work_mapping WHERE codice_prestazione = ?', (codice_prestazione,))
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to delete mapping for {codice_prestazione}: {e}")
            return False
