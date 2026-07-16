"""
Automation Log Service
----------------------
Servizio leggero per registrare gli invii di messaggi legati alle automazioni
e recuperare i log via API.
"""
import logging
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

from core.database_manager import get_database_manager

logger = logging.getLogger(__name__)

_TABLES_READY = False


class AutomationLogService:
    def __init__(self, db_manager=None):
        self.db_manager = db_manager or get_database_manager()
        self._ensure_tables()

    def _ensure_tables(self):
        global _TABLES_READY
        if _TABLES_READY:
            return
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS automation_message_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        trigger_type TEXT,
                        trigger_id TEXT,
                        monitor_id TEXT,
                        rule_id INTEGER,
                        action_name TEXT,
                        channel TEXT,
                        recipient TEXT,
                        message_text TEXT,
                        result_json TEXT
                    )
                ''')
            _TABLES_READY = True
            logger.debug("AutomationLogService: table automation_message_log ready")
        except Exception as e:
            logger.error(f"AutomationLogService: error creating table: {e}")

    def log_message(self, *, trigger_type: Optional[str] = None, trigger_id: Optional[str] = None,
                    monitor_id: Optional[str] = None, rule_id: Optional[int] = None,
                    action_name: Optional[str] = None, channel: Optional[str] = None,
                    recipient: Optional[str] = None, message_text: Optional[str] = None,
                    result: Optional[Dict[str, Any]] = None) -> int:
        try:
            result_json = json.dumps(result or {})
            query = '''
                INSERT INTO automation_message_log (
                    trigger_type, trigger_id, monitor_id, rule_id, action_name, channel, recipient, message_text, result_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            '''
            params = (
                trigger_type, trigger_id, monitor_id, rule_id, action_name, channel, recipient, message_text, result_json
            )
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                new_id = cursor.lastrowid
                cursor.close()
            return int(new_id) if new_id else 0
        except Exception as e:
            logger.error(f"Error logging automation message: {e}")
            return 0

    def list_messages(self, limit: int = 100, since: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            query = "SELECT * FROM automation_message_log"
            params: List[Any] = []
            if since:
                query += " WHERE created_at >= ?"
                params.append(since)
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            rows = self.db_manager.execute_query(query, tuple(params))
            return rows
        except Exception as e:
            logger.error(f"Error listing automation messages: {e}")
            return []


# Singleton accessor
_automation_log_service = None

def get_automation_log_service():
    global _automation_log_service
    if _automation_log_service is None:
        _automation_log_service = AutomationLogService()
    return _automation_log_service
