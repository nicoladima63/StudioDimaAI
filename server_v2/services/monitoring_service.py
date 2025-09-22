"""
Monitoring Service per StudioDimaAI Calendar System v2
========================================================

Sistema modulare di monitoraggio che si integra con lo scheduler esistente:
- Monitoraggio dinamico di tabelle DBF
- Integrazione con SchedulerService per job periodici
- API per gestione monitoraggio da frontend
- Sistema di plugin per estendere funzionalità

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import os
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable, Set
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum

from core.config_manager import get_config
from core.constants_v2 import DBF_TABLES
from services.snapshot_manager import get_snapshot_manager
from services.file_watcher import get_file_watcher
from utils.dbf_utils import get_optimized_reader

logger = logging.getLogger(__name__)

class MonitorType(Enum):
    """Tipi di monitoraggio disponibili."""
    DBF_WATCHDOG = "dbf_watchdog"
    FILE_WATCHER = "file_watcher"
    PERIODIC_CHECK = "periodic_check"
    REAL_TIME = "real_time"

class MonitorStatus(Enum):
    """Status del monitoraggio."""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"

@dataclass
class MonitorConfig:
    """Configurazione di un monitor."""
    monitor_id: str
    table_name: str
    file_path: str
    monitor_type: MonitorType
    interval_seconds: int = 30
    enabled: bool = True
    auto_start: bool = False
    callback_functions: List[str] = None  # Nomi funzioni da chiamare
    metadata: Dict[str, Any] = None

@dataclass
class MonitorInstance:
    """Istanza di monitoraggio attiva."""
    config: MonitorConfig
    status: MonitorStatus
    last_check: Optional[str] = None
    last_change: Optional[str] = None
    change_count: int = 0
    error_count: int = 0
    created_at: str = None
    started_at: Optional[str] = None
    thread: Optional[threading.Thread] = None

class MonitoringService:
    """
    Servizio di monitoraggio modulare per tabelle DBF.
    
    Caratteristiche:
    - Monitoraggio dinamico on-demand
    - Integrazione con scheduler esistente
    - Sistema di plugin per estendere funzionalità
    - API per gestione da frontend
    - Persistenza configurazioni
    """
    
    def __init__(self, config_dir: str = "data/monitoring"):
        self.config = get_config()
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Monitor attivi
        self.active_monitors: Dict[str, MonitorInstance] = {}
        
        # Callback registry
        self.callback_registry: Dict[str, Callable] = {}
        
        # Snapshot manager
        self.snapshot_manager = get_snapshot_manager()
        
        # File watcher
        self.file_watcher = get_file_watcher()
        
        # DBF reader
        self.dbf_reader = get_optimized_reader()
        
        # Configurazioni salvate
        self.saved_configs: Dict[str, MonitorConfig] = {}
        
        # Carica configurazioni esistenti
        self._load_saved_configs()
        
        # logger.info(f"MonitoringService initialized: {len(self.saved_configs)} saved configs")
    
    def create_monitor(self,
                       table_name: str,
                       monitor_type: MonitorType = MonitorType.PERIODIC_CHECK,
                       interval_seconds: int = 30,
                       auto_start: bool = False,
                       callback_functions: List[str] = None,
                       metadata: Dict[str, Any] = None) -> str:
        """
        Crea un nuovo monitor per una tabella.
        
        Args:
            table_name: Nome tabella da monitorare
            file_path: Percorso file DBF già risolto
            monitor_type: Tipo di monitoraggio
            interval_seconds: Intervallo di controllo (per periodic_check)
            auto_start: Avvia automaticamente il monitor
            callback_functions: Lista funzioni da chiamare su cambiamenti
            metadata: Metadati aggiuntivi
            
        Returns:
            ID del monitor creato
        """
        # Validazione opzionale - commentata per permettere qualsiasi tabella
        # if table_name not in DBF_TABLES:
        #     raise ValueError(f"Table {table_name} not found in DBF_TABLES")
        
        # Genera ID univoco
        monitor_id = f"{table_name}_{monitor_type.value}_{int(time.time())}"
        
        # Ottieni file_path dal ConfigManager (che ora legge da database_mode.txt)
        config = get_config()
        file_path = config.get_dbf_path(table_name)
        
        # Crea configurazione
        config = MonitorConfig(
            monitor_id=monitor_id,
            table_name=table_name,
            file_path=file_path,
            monitor_type=monitor_type,
            interval_seconds=interval_seconds,
            auto_start=auto_start,
            callback_functions=callback_functions or [],
            metadata=metadata or {}
        )
        
        with self.lock:
            # Salva configurazione
            self.saved_configs[monitor_id] = config
            self._save_config(config)
            
            # Avvia se richiesto
            if auto_start:
                self.start_monitor(monitor_id)
            
            # logger.info(f"Created monitor {monitor_id} for table {table_name}")
            return monitor_id
    
    def start_monitor(self, monitor_id: str) -> bool:
        """
        Avvia un monitor esistente.
        
        Args:
            monitor_id: ID del monitor
            
        Returns:
            True se avvio riuscito
        """
        with self.lock:
            if monitor_id not in self.saved_configs:
                logger.error(f"Monitor {monitor_id} not found")
                return False
            
            if monitor_id in self.active_monitors:
                logger.warning(f"Monitor {monitor_id} already running")
                return True
            
            config = self.saved_configs[monitor_id]
            
            try:
                # AVVIA TUTTO IL SISTEMA DI MONITORAGGIO
                start_time = datetime.now()
                
                # 1. Usa percorso già risolto dall'API
                logger.info(f"Avviato servizio monitoraggio alle {start_time.strftime('%H:%M:%S')} - File: {config.file_path}")
                
                # 2. Crea snapshot iniziale
                snapshot_success = self.snapshot_manager.start_monitoring(config.table_name, config.file_path)
                if not snapshot_success:
                    logger.error(f"Failed to create initial snapshot for {config.table_name}")
                    return False
                
                # 3. Avvia file watcher se non è già attivo
                if not self.file_watcher.is_running:
                    # Imposta callback per notificare cambiamenti
                    self.file_watcher.set_change_callback(self.increment_change_count)
                    
                    watcher_success = self.file_watcher.start(config.file_path)
                    if not watcher_success:
                        logger.error("Failed to start file watcher")
                        return False
                
                # 3. Crea istanza monitor
                instance = MonitorInstance(
                    config=config,
                    status=MonitorStatus.RUNNING,
                    created_at=start_time.isoformat(),
                    started_at=start_time.isoformat()
                )
                
                self.active_monitors[monitor_id] = instance
                
                # 4. Notifica avvio con timestamp
                start_time_str = start_time.strftime("%H:%M:%S")
                # logger.info(f"Servizio monitoraggio avviato alle {start_time_str}")
                
                return True
                
            except Exception as e:
                logger.error(f"Error starting monitor {monitor_id}: {e}")
                return False
    
    def stop_monitor(self, monitor_id: str) -> bool:
        """
        Ferma un monitor attivo.
        
        Args:
            monitor_id: ID del monitor
            
        Returns:
            True se stop riuscito
        """
        with self.lock:
            if monitor_id not in self.active_monitors:
                logger.warning(f"Monitor {monitor_id} not running")
                return False
            
            try:
                instance = self.active_monitors[monitor_id]
                instance.status = MonitorStatus.STOPPED
                
                # Ferma thread se attivo
                if instance.thread and instance.thread.is_alive():
                    # Thread si fermerà da solo controllando status
                    pass
                
                # Rimuovi da attivi
                del self.active_monitors[monitor_id]
                
                # Se non ci sono più monitor attivi, ferma il file watcher
                if not self.active_monitors:
                    self.file_watcher.stop()
                    # logger.info("Stopped file watcher - no active monitors")
                
                # logger.info(f"Servizio monitoraggio fermato alle {datetime.now().strftime('%H:%M:%S')}")
                return True
                
            except Exception as e:
                logger.error(f"Error stopping monitor {monitor_id}: {e}")
                return False
    
    def pause_monitor(self, monitor_id: str) -> bool:
        """Mette in pausa un monitor."""
        with self.lock:
            if monitor_id not in self.active_monitors:
                return False
            
            self.active_monitors[monitor_id].status = MonitorStatus.PAUSED
            # logger.info(f"Paused monitor {monitor_id}")
            return True
    
    def resume_monitor(self, monitor_id: str) -> bool:
        """Riprende un monitor in pausa."""
        with self.lock:
            if monitor_id not in self.active_monitors:
                return False
            
            self.active_monitors[monitor_id].status = MonitorStatus.RUNNING
            # logger.info(f"Resumed monitor {monitor_id}")
            return True
    
    def delete_monitor(self, monitor_id: str) -> bool:
        """
        Elimina un monitor e la sua configurazione.
        
        Args:
            monitor_id: ID del monitor
            
        Returns:
            True se eliminazione riuscita
        """
        with self.lock:
            # Ferma se attivo
            if monitor_id in self.active_monitors:
                self.stop_monitor(monitor_id)
            
            # Rimuovi configurazione
            if monitor_id in self.saved_configs:
                del self.saved_configs[monitor_id]
                self._delete_config_file(monitor_id)
            
            # logger.info(f"Deleted monitor {monitor_id}")
            return True
    
    def get_monitor_status(self, monitor_id: str = None) -> Dict[str, Any]:
        """
        Recupera status di monitor specifico o tutti.
        
        Args:
            monitor_id: ID monitor specifico (opzionale)
            
        Returns:
            Status del monitor/i
        """
        with self.lock:
            if monitor_id:
                if monitor_id in self.active_monitors:
                    instance = self.active_monitors[monitor_id]
                    return {
                        'monitor_id': monitor_id,
                        'status': instance.status.value,
                        'table_name': instance.config.table_name,
                        'monitor_type': instance.config.monitor_type.value,
                        'last_check': instance.last_check,
                        'last_change': instance.last_change,
                        'change_count': instance.change_count,
                        'error_count': instance.error_count,
                        'created_at': instance.created_at
                    }
                else:
                    return {'error': f'Monitor {monitor_id} not found'}
            
            else:
                # Status di tutti i monitor
                return {
                    'total_monitors': len(self.saved_configs),
                    'active_monitors': len(self.active_monitors),
                    'monitors': {
                        mid: {
                            'status': instance.status.value,
                            'table_name': instance.config.table_name,
                            'monitor_type': instance.config.monitor_type.value,
                            'last_check': instance.last_check,
                            'change_count': instance.change_count
                        }
                        for mid, instance in self.active_monitors.items()
                    }
                }
    
    def increment_change_count(self, table_name: str) -> bool:
        """
        Incrementa il contatore dei cambiamenti per tutti i monitor attivi di una tabella.
        
        Args:
            table_name: Nome della tabella
            
        Returns:
            True se incremento riuscito
        """
        with self.lock:
            try:
                updated_count = 0
                current_time = datetime.now().isoformat()
                
                # Trova tutti i monitor attivi per questa tabella
                for monitor_id, instance in self.active_monitors.items():
                    if instance.config.table_name == table_name:
                        instance.change_count += 1
                        instance.last_change = current_time
                        updated_count += 1
                        # logger.debug(f"Incremented change_count for {monitor_id}: {instance.change_count}")
                
                if updated_count > 0:
                    logger.info(f"Incremented change_count for {updated_count} monitors of table {table_name}")
                    return True
                else:
                    logger.warning(f"No active monitors found for table {table_name}")
                    return False
                    
            except Exception as e:
                logger.error(f"Error incrementing change_count for {table_name}: {e}")
                return False
    
    def register_callback(self, name: str, callback: Callable):
        """
        Registra una funzione callback per i cambiamenti.
        
        Args:
            name: Nome della funzione
            callback: Funzione da chiamare
        """
        self.callback_registry[name] = callback
        # logger.info(f"Registered callback: {name}")
    
    # Worker di controllo periodico rimossi - ora usa FileWatcher
    
    # Metodo di controllo cambiamenti rimosso - ora usa FileWatcher
    
    def _execute_callbacks(self, callback_names: List[str], changes: List[Dict], config: MonitorConfig):
        """Esegue le funzioni callback registrate."""
        for callback_name in callback_names:
            if callback_name in self.callback_registry:
                try:
                    callback = self.callback_registry[callback_name]
                    callback(changes, config)
                except Exception as e:
                    logger.error(f"Error executing callback {callback_name}: {e}")
    
    def _load_saved_configs(self):
        """Carica configurazioni salvate da disco."""
        try:
            configs_file = self.config_dir / "monitors_config.json"
            
            if configs_file.exists():
                with open(configs_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                for monitor_id, config_data in data.items():
                    try:
                        # Converte stringa enum in MonitorType
                        if 'monitor_type' in config_data and isinstance(config_data['monitor_type'], str):
                            config_data['monitor_type'] = MonitorType(config_data['monitor_type'])
                        config = MonitorConfig(**config_data)
                        self.saved_configs[monitor_id] = config
                        
                        # Avvia monitor con auto_start
                        if config.auto_start:
                            self.start_monitor(monitor_id)
                    except Exception as e:
                        logger.warning(f"Error loading config for {monitor_id}: {e}")
                        continue
                
                # logger.info(f"Loaded {len(self.saved_configs)} monitor configurations")
            else:
                # logger.info("No saved configurations found")
                pass
            
        except Exception as e:
            logger.error(f"Error loading saved configs: {e}")
    
    def _save_config(self, config: MonitorConfig):
        """Salva configurazione su disco."""
        try:
            configs_file = self.config_dir / "monitors_config.json"
            
            # Carica configurazioni esistenti
            data = {}
            if configs_file.exists():
                with open(configs_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            
            # Aggiungi nuova configurazione (converte enum in string)
            config_dict = asdict(config)
            config_dict['monitor_type'] = config.monitor_type.value
            data[config.monitor_id] = config_dict
            
            # Salva
            with open(configs_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"Error saving config for {config.monitor_id}: {e}")
    
    def _delete_config_file(self, monitor_id: str):
        """Elimina configurazione da disco."""
        try:
            configs_file = self.config_dir / "monitors_config.json"
            
            if configs_file.exists():
                with open(configs_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if monitor_id in data:
                    del data[monitor_id]
                    
                    with open(configs_file, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"Error deleting config for {monitor_id}: {e}")

    def get_all_monitors(self) -> List[Dict[str, Any]]:
        """
        Recupera tutti i monitor configurati con i loro status.
        
        Returns:
            Lista di monitor con informazioni complete
        """
        with self.lock:
            monitors = []
            
            for monitor_id, config in self.saved_configs.items():
                # Recupera status se attivo
                status_info = None
                if monitor_id in self.active_monitors:
                    instance = self.active_monitors[monitor_id]
                    status_info = {
                        'status': instance.status.value,
                        'last_check': instance.last_check,
                        'last_change': instance.last_change,
                        'change_count': instance.change_count,
                        'error_count': instance.error_count,
                        'created_at': instance.created_at,
                        'started_at': instance.started_at
                    }
                else:
                    status_info = {
                        'status': 'stopped',
                        'last_check': None,
                        'last_change': None,
                        'change_count': 0,
                        'error_count': 0,
                        'created_at': None
                    }
                
                monitor_info = {
                    'config': {
                        'monitor_id': config.monitor_id,
                        'table_name': config.table_name,
                        'monitor_type': config.monitor_type.value,
                        'interval_seconds': config.interval_seconds,
                        'auto_start': config.auto_start,
                        'callback_functions': config.callback_functions,
                        'metadata': config.metadata
                    },
                    'status': status_info
                }
                
                monitors.append(monitor_info)
            
            return monitors


# Singleton instance
_monitoring_service = None

def get_monitoring_service() -> MonitoringService:
    """Get singleton monitoring service instance."""
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService()
    return _monitoring_service

# Convenience functions
def create_table_monitor(table_name: str, 
                        monitor_type: MonitorType = MonitorType.PERIODIC_CHECK,
                        interval_seconds: int = 30,
                        auto_start: bool = True) -> str:
    """
    Convenience function per creare monitor tabella.
    
    Args:
        table_name: Nome tabella
        monitor_type: Tipo monitoraggio
        interval_seconds: Intervallo controllo
        auto_start: Avvia automaticamente
        
    Returns:
        ID del monitor creato
    """
    service = get_monitoring_service()
    return service.create_monitor(
        table_name=table_name,
        monitor_type=monitor_type,
        interval_seconds=interval_seconds,
        auto_start=auto_start
    )


def start_table_monitor(monitor_id: str) -> bool:
    """Convenience function per avviare monitor."""
    service = get_monitoring_service()
    return service.start_monitor(monitor_id)

def stop_table_monitor(monitor_id: str) -> bool:
    """Convenience function per fermare monitor."""
    service = get_monitoring_service()
    return service.stop_monitor(monitor_id)
