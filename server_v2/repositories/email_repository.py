import logging
from typing import Dict, Any, List, Optional
from core.base_repository import BaseRepository
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError

logger = logging.getLogger(__name__)


class EmailScopeRepository(BaseRepository):
    """Repository for managing email scopes (categories)."""

    @property
    def table_name(self) -> str:
        return 'email_scopes'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables_exist()

    def _ensure_tables_exist(self) -> None:
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS email_scopes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        label TEXT NOT NULL,
                        description TEXT,
                        icon TEXT DEFAULT 'cilEnvelopeClosed',
                        color TEXT DEFAULT '#3399ff',
                        is_default INTEGER DEFAULT 0,
                        active INTEGER DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS email_filter_rules (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scope_id INTEGER NOT NULL,
                        field TEXT NOT NULL,
                        operator TEXT NOT NULL,
                        value TEXT NOT NULL,
                        priority INTEGER DEFAULT 0,
                        active INTEGER DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (scope_id) REFERENCES email_scopes(id) ON DELETE CASCADE
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS email_ai_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        provider TEXT NOT NULL DEFAULT 'claude',
                        api_key TEXT,
                        model TEXT DEFAULT 'claude-sonnet-4-20250514',
                        active INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS email_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        message_id TEXT NOT NULL UNIQUE,
                        scope_id INTEGER,
                        subject TEXT,
                        sender TEXT,
                        date TEXT,
                        snippet TEXT,
                        classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        classification_source TEXT DEFAULT 'rule',
                        FOREIGN KEY (scope_id) REFERENCES email_scopes(id) ON DELETE SET NULL
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_email_cache_message ON email_cache(message_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_email_cache_scope ON email_cache(scope_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_email_rules_scope ON email_filter_rules(scope_id)')

                # Insert default scopes if empty
                cursor.execute('SELECT COUNT(*) FROM email_scopes')
                count = cursor.fetchone()[0]
                if count == 0:
                    default_scopes = [
                        ('fatture', 'Fatture e Documenti Fiscali', 'Email con fatture, note di credito, documenti contabili', 'cilDescription', '#28a745', 1),
                        ('pazienti', 'Comunicazioni Pazienti', 'Email da/per pazienti relative ad appuntamenti e referti', 'cilUser', '#17a2b8', 1),
                        ('ordini_fornitori', 'Ordini e Fornitori', 'Email relative a ordini materiali, preventivi, conferme', 'cilCart', '#ffc107', 1),
                        ('comunicazioni_studio', 'Comunicazioni Studio', 'Email amministrative e comunicazioni interne dello studio', 'cilBuilding', '#6f42c1', 1),
                    ]
                    cursor.executemany(
                        'INSERT INTO email_scopes (name, label, description, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?)',
                        default_scopes
                    )

        except Exception as e:
            logger.error(f"Failed to ensure email tables: {e}")
            raise RepositoryError(f"Failed to ensure email tables: {str(e)}", cause=e)

    def get_active_scopes(self) -> List[Dict[str, Any]]:
        try:
            query = "SELECT * FROM email_scopes WHERE active = 1 ORDER BY is_default DESC, label ASC"
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get active scopes: {e}")
            return []

    def get_all_scopes(self) -> List[Dict[str, Any]]:
        try:
            query = "SELECT * FROM email_scopes ORDER BY is_default DESC, label ASC"
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get all scopes: {e}")
            return []

    def create_scope(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.create(data)

    def update_scope(self, scope_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self.update(scope_id, data)

    def delete_scope(self, scope_id: int) -> bool:
        return self.delete(scope_id, soft_delete=False)


class EmailRuleRepository(BaseRepository):
    """Repository for managing email filter rules."""

    @property
    def table_name(self) -> str:
        return 'email_filter_rules'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)

    def get_rules_by_scope(self, scope_id: int) -> List[Dict[str, Any]]:
        try:
            query = "SELECT * FROM email_filter_rules WHERE scope_id = ? AND active = 1 ORDER BY priority DESC"
            results = self.execute_custom_query(query, (scope_id,), fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get rules for scope {scope_id}: {e}")
            return []

    def get_all_active_rules(self) -> List[Dict[str, Any]]:
        try:
            query = """
                SELECT r.*, s.name as scope_name, s.label as scope_label
                FROM email_filter_rules r
                JOIN email_scopes s ON r.scope_id = s.id
                WHERE r.active = 1 AND s.active = 1
                ORDER BY r.priority DESC
            """
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get all active rules: {e}")
            return []

    def get_all_rules(self) -> List[Dict[str, Any]]:
        try:
            query = """
                SELECT r.*, s.name as scope_name, s.label as scope_label
                FROM email_filter_rules r
                JOIN email_scopes s ON r.scope_id = s.id
                ORDER BY r.priority DESC
            """
            results = self.execute_custom_query(query, fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get all rules: {e}")
            return []

    def create_rule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.create(data)

    def update_rule(self, rule_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self.update(rule_id, data)

    def delete_rule(self, rule_id: int) -> bool:
        return self.delete(rule_id, soft_delete=False)


class EmailAiConfigRepository(BaseRepository):
    """Repository for managing AI classification config."""

    @property
    def table_name(self) -> str:
        return 'email_ai_config'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)

    def get_active_config(self) -> Optional[Dict[str, Any]]:
        try:
            query = "SELECT * FROM email_ai_config WHERE active = 1 LIMIT 1"
            results = self.execute_custom_query(query, fetch_all=True)
            if results and len(results) > 0:
                return dict(results[0])
            return None
        except Exception as e:
            logger.error(f"Failed to get AI config: {e}")
            return None

    def save_config(self, data: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_active_config()
        if existing:
            data['updated_at'] = 'CURRENT_TIMESTAMP'
            return self.update(existing['id'], data)
        return self.create(data)


class EmailCacheRepository(BaseRepository):
    """Repository for caching email classification results."""

    @property
    def table_name(self) -> str:
        return 'email_cache'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)

    def get_cached_classification(self, message_id: str) -> Optional[Dict[str, Any]]:
        try:
            query = "SELECT * FROM email_cache WHERE message_id = ?"
            results = self.execute_custom_query(query, (message_id,), fetch_all=True)
            if results and len(results) > 0:
                return dict(results[0])
            return None
        except Exception as e:
            logger.error(f"Failed to get cached classification for {message_id}: {e}")
            return None

    def cache_classification(self, data: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_cached_classification(data.get('message_id', ''))
        if existing:
            return self.update(existing['id'], data)
        return self.create(data)

    def get_cached_by_scope(self, scope_id: int) -> List[Dict[str, Any]]:
        try:
            query = "SELECT * FROM email_cache WHERE scope_id = ? ORDER BY date DESC"
            results = self.execute_custom_query(query, (scope_id,), fetch_all=True)
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"Failed to get cached emails for scope {scope_id}: {e}")
            return []

    def clear_cache(self) -> bool:
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM email_cache")
            return True
        except Exception as e:
            logger.error(f"Failed to clear email cache: {e}")
            return False
