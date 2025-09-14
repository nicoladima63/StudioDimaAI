"""
Change Detector per StudioDimaAI Calendar System v2
===================================================

Componente per rilevare cambiamenti nel file APPUNTA.DBF usando hash comparison.

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import hashlib
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from core.config_manager import get_config
from services.change_logger import get_change_logger

logger = logging.getLogger(__name__)

class ChangeDetector:
    """
    Rilevatore di cambiamenti per file DBF.
    
    Usa hash MD5 per confrontare file e rilevare modifiche.
    """
    
    def __init__(self):
        self.config = get_config()
        self.change_logger = get_change_logger()
        self.snapshot_file = Path("data/appunta_snapshot.json")
        self.snapshot_file.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info("ChangeDetector initialized")
    
    def get_file_hash(self, file_path: str) -> str:
        """
        Calcola hash MD5 del file.
        
        Args:
            file_path: Percorso del file
            
        Returns:
            Hash MD5 del file
        """
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            logger.error(f"Error calculating hash for {file_path}: {e}")
            return ""
    
    def get_file_mtime(self, file_path: str) -> str:
        """
        Ottieni timestamp di modifica del file.
        
        Args:
            file_path: Percorso del file
            
        Returns:
            Timestamp ISO format
        """
        try:
            mtime = os.path.getmtime(file_path)
            return datetime.fromtimestamp(mtime).isoformat()
        except Exception as e:
            logger.error(f"Error getting mtime for {file_path}: {e}")
            return ""
    
    def load_snapshot(self) -> Dict[str, Any]:
        """
        Carica snapshot precedente.
        
        Returns:
            Snapshot data o dict vuoto
        """
        try:
            if not self.snapshot_file.exists():
                return {}
            
            with open(self.snapshot_file, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"Error loading snapshot: {e}")
            return {}
    
    def save_snapshot(self, file_hash: str, file_mtime: str, record_count: int) -> bool:
        """
        Salva snapshot corrente.
        
        Args:
            file_hash: Hash del file
            file_mtime: Timestamp di modifica
            record_count: Numero di record
            
        Returns:
            True se salvataggio riuscito
        """
        try:
            snapshot = {
                "file_hash": file_hash,
                "file_mtime": file_mtime,
                "record_count": record_count,
                "last_check": datetime.now().isoformat()
            }
            
            with open(self.snapshot_file, 'w', encoding='utf-8') as f:
                json.dump(snapshot, f, indent=2, ensure_ascii=False)
            
            logger.debug(f"Snapshot saved: {record_count} records")
            return True
            
        except Exception as e:
            logger.error(f"Error saving snapshot: {e}")
            return False
    
    def check_for_changes(self) -> bool:
        """
        Controlla se ci sono cambiamenti nel file APPUNTA.DBF.
        
        Returns:
            True se ci sono cambiamenti
        """
        try:
            # Ottieni percorso file
            file_path = self.config.get_dbf_path('APPUNTA')
            
            # Calcola hash e mtime corrente
            current_hash = self.get_file_hash(file_path)
            current_mtime = self.get_file_mtime(file_path)
            
            if not current_hash:
                logger.error("Failed to calculate file hash")
                return False
            
            # Carica snapshot precedente
            snapshot = self.load_snapshot()
            
            # Se non c'è snapshot, crea il primo
            if not snapshot:
                logger.info("No previous snapshot found, creating initial snapshot")
                self.save_snapshot(current_hash, current_mtime, 0)
                return False
            
            # Confronta hash
            if snapshot.get('file_hash') == current_hash:
                logger.debug("No changes detected (hash match)")
                return False
            
            # Hash diverso = file modificato
            logger.info(f"File changed detected! Hash: {current_hash[:8]}...")
            
            # Logga il cambiamento generico
            self.change_logger.log_change(
                action="modified",
                record_id="file_change",
                data={
                    "file_path": file_path,
                    "old_hash": snapshot.get('file_hash', ''),
                    "new_hash": current_hash,
                    "old_mtime": snapshot.get('file_mtime', ''),
                    "new_mtime": current_mtime
                }
            )
            
            # Aggiorna snapshot
            self.save_snapshot(current_hash, current_mtime, 0)
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking for changes: {e}")
            return False

# Singleton instance
_change_detector = None

def get_change_detector() -> ChangeDetector:
    """Ottieni istanza singleton del ChangeDetector."""
    global _change_detector
    if _change_detector is None:
        _change_detector = ChangeDetector()
    return _change_detector
