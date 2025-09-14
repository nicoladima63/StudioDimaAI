"""
Change Logger per StudioDimaAI Calendar System v2
==================================================

Componente semplice per loggare cambiamenti DBF in formato JSON.
Append-only: sempre aggiunge, mai sovrascrive.

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class ChangeLogger:
    """
    Logger semplice per cambiamenti DBF.
    
    Formato JSON:
    {
        "timestamp": "2025-09-10T18:30:00",
        "action": "added|modified|deleted",
        "record_id": "unique_id",
        "data": {...}
    }
    """
    
    def __init__(self, log_file: str = "data/changes.json"):
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"ChangeLogger initialized: {self.log_file}")
    
    def log_change(self, action: str, record_id: str, data: Dict[str, Any]) -> bool:
        """
        Logga un cambiamento.
        
        Args:
            action: "added", "modified", "deleted"
            record_id: ID univoco del record
            data: Dati del record
            
        Returns:
            True se logging riuscito
        """
        try:
            change_entry = {
                "timestamp": datetime.now().isoformat(),
                "action": action,
                "record_id": record_id,
                "data": data
            }
            
            # Append al file JSON
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(change_entry, ensure_ascii=False) + '\n')
            
            logger.debug(f"Logged {action} change for record {record_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging change: {e}")
            return False
    
    def get_changes(self) -> List[Dict[str, Any]]:
        """
        Legge tutti i cambiamenti dal file.
        
        Returns:
            Lista di cambiamenti
        """
        try:
            if not self.log_file.exists():
                return []
            
            changes = []
            with open(self.log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        changes.append(json.loads(line))
            
            logger.debug(f"Loaded {len(changes)} changes from {self.log_file}")
            return changes
            
        except Exception as e:
            logger.error(f"Error reading changes: {e}")
            return []
    
    def clear_changes(self) -> bool:
        """
        Pulisce il file dei cambiamenti.
        
        Returns:
            True se pulizia riuscita
        """
        try:
            if self.log_file.exists():
                self.log_file.unlink()
            
            logger.info(f"Cleared changes log: {self.log_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error clearing changes: {e}")
            return False
    
    def get_change_count(self) -> int:
        """
        Conta i cambiamenti nel file.
        
        Returns:
            Numero di cambiamenti
        """
        return len(self.get_changes())

# Singleton instance
_change_logger = None

def get_change_logger() -> ChangeLogger:
    """Ottieni istanza singleton del ChangeLogger."""
    global _change_logger
    if _change_logger is None:
        _change_logger = ChangeLogger()
    return _change_logger
