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

class DbfFileEventHandler(FileSystemEventHandler):
    """
    Handler generico per eventi di modifica di file DBF.
    Notifica il FileWatcher principale per ogni evento rilevante.
    """
    
    def __init__(self, callback: Callable[[str, str], None]):
        self.callback = callback

    def on_any_event(self, event):
        """
        Chiamato per ogni tipo di evento del file system.
        """
        if event.is_directory:
            return

        # Interessa solo i file DBF
        file_path = event.src_path
        if event.event_type == 'moved':
            file_path = event.dest_path

        if file_path.upper().endswith('.DBF'):
            self.callback(event.event_type, file_path)


class FileWatcher:
    """
    Watcher per monitorare il file APPUNTA.DBF.
    
    Usa watchdog per eventi file system in tempo reale.
    """
    
class FileWatcher:
    """
    Watcher per monitorare file DBF specifici.
    
    Usa watchdog per eventi file system in tempo reale.
    """
    
    def __init__(self):
        self.observer = None
        self.is_running = False
        self.snapshot_manager = get_snapshot_manager()
        self.change_callback = None  # Callback per notificare cambiamenti
        self.monitored_files: Dict[str, str] = {} # Mappa filename.upper() -> table_name
        self.last_trigger_time: Dict[str, float] = {} # Debounce per file
        self.debounce_seconds = 5 # Evita trigger multipli
        
        # logger.info("FileWatcher initialized")
    
    def set_change_callback(self, callback: Callable[[str], None]):
        """
        Imposta il callback per notificare cambiamenti.
        
        Args:
            callback: Funzione che riceve table_name come parametro
        """
        self.change_callback = callback
        # logger.debug("Change callback set for FileWatcher")
    
    def start(self, target_file_path: str) -> bool:
        """
        Avvia il file watcher per un file specifico.
        
        Args:
            target_file_path: Percorso completo del file DBF da monitorare.
        
        Returns:
            True se avvio riuscito
        """
        try:
            # Il watcher deve essere avviato una sola volta per la directory radice
            if not self.is_running:
                watch_dir = Path(target_file_path).parent.parent # Monitora la cartella 'windent'
                self.observer = Observer()
                handler = DbfFileEventHandler(self._on_any_dbf_event)
                self.observer.schedule(handler, str(watch_dir), recursive=True) # Monitora ricorsivamente
                self.observer.start()
                self.is_running = True
                start_time = datetime.now().strftime("%H:%M:%S")
                logger.debug(f"FileWatcher.start: Inizializzo watcher per directory: {watch_dir}") # More explicit
            
            # Aggiungi il file specifico alla lista di quelli monitorati
            file_name = Path(target_file_path).name.upper()
            table_name = file_name.split('.')[0]
            self.monitored_files[file_name] = table_name
            logger.debug(f"FileWatcher.start: Aggiunto file {file_name} (tabella: {table_name}) alla lista di monitoraggio.") # More explicit
            
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
    
    def _on_any_dbf_event(self, event_type: str, file_path: str):
        """
        Callback generico per eventi su file DBF.
        Applica debouncing e notifica il change_callback se il file è monitorato.
        """
        file_name = Path(file_path).name.upper()
        
        # Verifica se il file è tra quelli che ci interessano
        if file_name not in self.monitored_files:
            return

        table_name = self.monitored_files[file_name]

        # Debounce: evita trigger multipli per lo stesso file
        current_time = time.time()
        last_time = self.last_trigger_time.get(file_name, 0)
        if (current_time - last_time) < self.debounce_seconds:
            return
        self.last_trigger_time[file_name] = current_time

        logger.debug(f"File event '{event_type}' detected for monitored file: {file_name}") # Downgraded to DEBUG
        logger.debug(f"FileWatcher: Chiamata callback per {file_name} (table: {table_name})")
        
        # Chiama il callback principale del FileWatcher (che è in monitoring_service)
        if self.change_callback:
            # Il callback si aspetta il table_name
            self.change_callback(table_name)

    
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
