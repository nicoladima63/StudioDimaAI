"""
File Watcher per StudioDimaAI Calendar System v2
================================================

Componente per monitorare cambiamenti nel file APPUNTA.DBF usando watchdog.

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from services.snapshot_manager import get_snapshot_manager

logger = logging.getLogger(__name__)

class AppuntaFileHandler(FileSystemEventHandler):
    """
    Handler per eventi di modifica del file APPUNTA.DBF.
    """
    
    def __init__(self, callback: Callable[[], None]):
        self.callback = callback
        self.last_trigger = 0
        self.debounce_seconds = 2  # Evita trigger multipli
    
    def on_modified(self, event):
        """Chiamato quando un file viene modificato."""
        if event.is_directory:
            return
        
        # Solo per APPUNTA.DBF
        if not event.src_path.endswith('APPUNTA.DBF'):
            return
        
        # Debounce: evita trigger multipli
        current_time = time.time()
        if current_time - self.last_trigger < self.debounce_seconds:
            return
        
        self.last_trigger = current_time
        
        logger.info(f"File modified: {Path(event.src_path).name}")
        
        # Chiama callback dopo un piccolo delay
        threading.Timer(1.0, self.callback).start()

class FileWatcher:
    """
    Watcher per monitorare il file APPUNTA.DBF.
    
    Usa watchdog per eventi file system in tempo reale.
    """
    
    def __init__(self):
        self.observer = None
        self.is_running = False
        self.snapshot_manager = get_snapshot_manager()
        self.change_callback = None  # Callback per notificare cambiamenti
        
        # logger.info("FileWatcher initialized")
    
    def set_change_callback(self, callback: Callable[[str], None]):
        """
        Imposta il callback per notificare cambiamenti.
        
        Args:
            callback: Funzione che riceve table_name come parametro
        """
        self.change_callback = callback
        # logger.debug("Change callback set for FileWatcher")
    
    def start(self, file_path: str = None) -> bool:
        """
        Avvia il file watcher.
        
        Args:
            file_path: Percorso file DBF 
        
        Returns:
            True se avvio riuscito
        """
        try:
            if self.is_running:
                logger.warning("FileWatcher already running")
                return True
            
            # Usa percorso fornito (obbligatorio)
            if file_path is None:
                raise ValueError("file_path is required for FileWatcher")
            watch_dir = Path(file_path).parent
            
            # Crea observer
            self.observer = Observer()
            
            # Crea handler con callback
            handler = AppuntaFileHandler(self._on_file_changed)
            
            # Aggiungi handler all'observer
            self.observer.schedule(handler, str(watch_dir), recursive=False)
            
            # Avvia observer
            self.observer.start()
            self.is_running = True
            
            start_time = datetime.now().strftime("%H:%M:%S")
            logger.info(f"FileWatcher started monitoring: {watch_dir} at {start_time}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting FileWatcher: {e}")
            return False
    
    def stop(self) -> bool:
        """
        Ferma il file watcher.
        
        Returns:
            True se stop riuscito
        """
        try:
            if not self.is_running or not self.observer:
                logger.warning("FileWatcher not running")
                return True
            
            self.observer.stop()
            self.observer.join()
            self.is_running = False
            
            # logger.info("FileWatcher stopped")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping FileWatcher: {e}")
            return False
    
    def _on_file_changed(self):
        """
        Callback chiamato quando il file viene modificato.
        """
        try:
            # logger.info("File change detected, updating snapshots...")
            
            # Aggiorna snapshot per tutte le tabelle monitorate
            monitored_tables = self.snapshot_manager.monitored_tables
            for table_name in monitored_tables:
                success = self.snapshot_manager.update_snapshot(table_name)
                if success:
                    # logger.info(f"Snapshot updated for {table_name}")
                    
                    # Notifica il cambiamento tramite callback
                    if self.change_callback:
                        self.change_callback(table_name)
                else:
                    logger.warning(f"Failed to update snapshot for {table_name}")
                
        except Exception as e:
            logger.error(f"Error in file change callback: {e}")
    
    def get_status(self) -> dict:
        """
        Ottieni status del watcher.
        
        Returns:
            Dict con informazioni di status
        """
        return {
            "is_running": self.is_running,
            "observer_active": self.observer.is_alive() if self.observer else False
        }

# Singleton instance
_file_watcher = None

def get_file_watcher() -> FileWatcher:
    """Ottieni istanza singleton del FileWatcher."""
    global _file_watcher
    if _file_watcher is None:
        _file_watcher = FileWatcher()
    return _file_watcher
