"""
Repository degli avvisi email: configurazione per scopo e registro delle email gia' viste.
"""
import logging
import time
from typing import Any, Dict, List, Optional

from core.base_repository import BaseRepository
from core.database_manager import DatabaseManager
from core.exceptions import RepositoryError

logger = logging.getLogger(__name__)

MODE_NONE = 'none'
MODE_ALERT = 'alert'
MODE_TODO = 'todo'
VALID_MODES = (MODE_NONE, MODE_ALERT, MODE_TODO)
VALID_PRIORITIES = ('low', 'medium', 'high', 'urgent')

# Il registro serve solo a non rielaborare le stesse email: oltre questo limite si ripulisce
LOG_RETENTION_DAYS = 45

_TABLES_READY = False


class EmailAlertRepository(BaseRepository):
    """Configurazione avvisi per scopo (email_alert_config) e registro (email_alert_log)."""

    @property
    def table_name(self) -> str:
        return 'email_alert_config'

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        super().__init__(db_manager)
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        global _TABLES_READY
        if _TABLES_READY:
            return
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS email_alert_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scope_id INTEGER NOT NULL UNIQUE,
                        mode TEXT NOT NULL DEFAULT 'none',
                        recipient_id INTEGER,
                        priority TEXT NOT NULL DEFAULT 'medium',
                        due_days INTEGER NOT NULL DEFAULT 1,
                        since_at INTEGER,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (scope_id) REFERENCES email_scopes(id) ON DELETE CASCADE
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS email_alert_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        message_id TEXT NOT NULL UNIQUE,
                        scope_id INTEGER,
                        action TEXT NOT NULL DEFAULT 'none',
                        recipient_id INTEGER,
                        todo_id INTEGER,
                        subject TEXT,
                        sender TEXT,
                        processed_at INTEGER NOT NULL
                    )
                ''')
                cursor.execute(
                    'CREATE INDEX IF NOT EXISTS idx_email_alert_log_processed ON email_alert_log(processed_at)'
                )
                cursor.close()
            _TABLES_READY = True
        except Exception as e:
            logger.error(f"Failed to ensure email alert tables: {e}")
            raise RepositoryError(f"Failed to ensure email alert tables: {str(e)}", cause=e)

    # ------------------------------------------------------------------
    # Configurazione
    # ------------------------------------------------------------------

    def get_all_configs(self) -> Dict[int, Dict[str, Any]]:
        """Configurazioni salvate, indicizzate per scope_id."""
        rows = self.execute_custom_query("SELECT * FROM email_alert_config", None, fetch_all=True)
        return {row['scope_id']: dict(row) for row in (rows or [])}

    def save_config(self, scope_id: int, mode: str, recipient_id: Optional[int],
                    priority: str, due_days: int) -> Dict[str, Any]:
        """
        Crea o aggiorna la configurazione di uno scopo.
        since_at riparte ogni volta che l'avviso passa da spento ad attivo (o cambia
        modalita'): le email arrivate prima non generano mai avvisi retroattivi.
        """
        now = int(time.time())
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT mode, since_at FROM email_alert_config WHERE scope_id = ?", (scope_id,))
                existing = cursor.fetchone()
                if mode == MODE_NONE:
                    since_at = None
                elif existing and existing[0] == mode and existing[1]:
                    since_at = existing[1]
                else:
                    since_at = now

                if existing:
                    cursor.execute(
                        '''UPDATE email_alert_config
                           SET mode = ?, recipient_id = ?, priority = ?, due_days = ?,
                               since_at = ?, updated_at = CURRENT_TIMESTAMP
                           WHERE scope_id = ?''',
                        (mode, recipient_id, priority, due_days, since_at, scope_id),
                    )
                else:
                    cursor.execute(
                        '''INSERT INTO email_alert_config
                           (scope_id, mode, recipient_id, priority, due_days, since_at)
                           VALUES (?, ?, ?, ?, ?, ?)''',
                        (scope_id, mode, recipient_id, priority, due_days, since_at),
                    )
                cursor.close()
        except Exception as e:
            logger.error(f"Failed to save email alert config for scope {scope_id}: {e}")
            raise RepositoryError(f"Failed to save email alert config: {str(e)}", cause=e)
        return self.get_all_configs()[scope_id]

    # ------------------------------------------------------------------
    # Registro
    # ------------------------------------------------------------------

    def get_known_ids(self, message_ids: List[str]) -> set:
        """Sottoinsieme di message_ids gia' presenti nel registro."""
        if not message_ids:
            return set()
        known = set()
        # SQLite limita il numero di parametri: si interroga a blocchi
        for start in range(0, len(message_ids), 200):
            chunk = message_ids[start:start + 200]
            marks = ','.join('?' for _ in chunk)
            rows = self.execute_custom_query(
                f"SELECT message_id FROM email_alert_log WHERE message_id IN ({marks})",
                tuple(chunk), fetch_all=True,
            )
            known.update(row['message_id'] for row in (rows or []))
        return known

    def log_message(self, message_id: str, scope_id: Optional[int], action: str,
                    recipient_id: Optional[int] = None, todo_id: Optional[int] = None,
                    subject: Optional[str] = None, sender: Optional[str] = None) -> None:
        """Registra un'email come elaborata (INSERT OR IGNORE: idempotente)."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''INSERT OR IGNORE INTO email_alert_log
                       (message_id, scope_id, action, recipient_id, todo_id, subject, sender, processed_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                    (message_id, scope_id, action, recipient_id, todo_id, subject, sender, int(time.time())),
                )
                cursor.close()
        except Exception as e:
            logger.error(f"Failed to log email alert {message_id}: {e}")
            raise RepositoryError(f"Failed to log email alert: {str(e)}", cause=e)

    def get_recent_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Ultimi avvisi effettivamente inviati (alert o todo)."""
        rows = self.execute_custom_query(
            '''SELECT l.message_id, l.scope_id, l.action, l.recipient_id, l.todo_id,
                      l.subject, l.sender, l.processed_at, s.label AS scope_label
               FROM email_alert_log l
               LEFT JOIN email_scopes s ON s.id = l.scope_id
               WHERE l.action IN ('alert', 'todo')
               ORDER BY l.processed_at DESC
               LIMIT ?''',
            (int(limit),), fetch_all=True,
        )
        return [dict(row) for row in (rows or [])]

    def prune_log(self) -> None:
        cutoff = int(time.time()) - LOG_RETENTION_DAYS * 86400
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM email_alert_log WHERE processed_at < ?", (cutoff,))
                cursor.close()
        except Exception as e:
            logger.error(f"Failed to prune email alert log: {e}")
