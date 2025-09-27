"""
Monitoring Service per StudioDimaAI Calendar System v2
========================================================

Sistema modulare di monitoraggio che si integra con lo scheduler esistente:
- Monitoraggio dinamico di tabelle DBF
- Integrazione con SchedulerService per job periodici
- API per gestione monitoraggio da frontend
- Sistema di plugin per estendere funzionalità

Author: Claude Code Studio Architect
Version: 2.1.0
"""

import os
import json
import logging
import threading
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum

from core.config_manager import get_config
from services.snapshot_manager import get_snapshot_manager
from services.file_watcher import get_file_watcher
from services.automation_service import get_automation_service
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
    """
    
    def __init__(self, config_dir: str = "data/monitoring"):
        self.config = get_config()
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self.lock = threading.RLock()
        self.active_monitors: Dict[str, MonitorInstance] = {}
        
        self.automation_service = get_automation_service()
        self.snapshot_manager = get_snapshot_manager()
        self.file_watcher = get_file_watcher()
        self.dbf_reader = get_optimized_reader()
        
        self.saved_configs: Dict[str, MonitorConfig] = {}
        self.settings = self._load_settings()
        self._load_saved_configs()
    
    def create_monitor(self,
                       table_name: str,
                       monitor_type: MonitorType = MonitorType.PERIODIC_CHECK,
                       interval_seconds: int = 30,
                       auto_start: bool = False,
                       metadata: Dict[str, Any] = None) -> str:
        """Crea un nuovo monitor per una tabella."""
        monitor_id = f"{table_name}_{monitor_type.value}_{int(time.time())}"
        
        config_manager = get_config()
        file_path = config_manager.get_dbf_path(table_name)
        
        config = MonitorConfig(
            monitor_id=monitor_id,
            table_name=table_name,
            file_path=file_path,
            monitor_type=monitor_type,
            interval_seconds=interval_seconds,
            auto_start=auto_start,
            metadata=metadata or {}
        )
        
        with self.lock:
            self.saved_configs[monitor_id] = config
            self._save_config(config)
            
            if auto_start:
                self.start_monitor(monitor_id)
            
            return monitor_id
    
    def start_monitor(self, monitor_id: str) -> bool:
        """Avvia un monitor esistente."""
        with self.lock:
            if monitor_id not in self.saved_configs:
                logger.error(f"Monitor {monitor_id} not found")
                return False
            
            if monitor_id in self.active_monitors:
                logger.warning(f"Monitor {monitor_id} already running")
                return True
            
            config = self.saved_configs[monitor_id]
            
            try:
                start_time = datetime.now()
                logger.info(f"Avviando servizio monitoraggio alle {start_time.strftime('%H:%M:%S')} - File: {config.file_path}")
                
                snapshot_success = self.snapshot_manager.start_monitoring(config.table_name, config.file_path)
                if not snapshot_success:
                    logger.error(f"Failed to create initial snapshot for {config.table_name}")
                    return False
                
                if not self.file_watcher.is_running:
                    self.file_watcher.set_change_callback(self.handle_file_change)
                    watcher_success = self.file_watcher.start(os.path.dirname(config.file_path))
                    if not watcher_success:
                        logger.error("Failed to start file watcher")
                        return False
                
                instance = MonitorInstance(
                    config=config,
                    status=MonitorStatus.RUNNING,
                    created_at=start_time.isoformat(),
                    started_at=start_time.isoformat()
                )
                self.active_monitors[monitor_id] = instance
                return True
                
            except Exception as e:
                logger.error(f"Error starting monitor {monitor_id}: {e}", exc_info=True)
                return False
    
    def stop_monitor(self, monitor_id: str) -> bool:
        """Ferma un monitor attivo."""
        with self.lock:
            if monitor_id not in self.active_monitors:
                logger.warning(f"Monitor {monitor_id} not running")
                return False
            
            try:
                instance = self.active_monitors.pop(monitor_id)
                instance.status = MonitorStatus.STOPPED
                
                if not self.active_monitors:
                    self.file_watcher.stop()
                
                logger.info(f"Servizio monitoraggio fermato per {monitor_id}")
                return True
                
            except Exception as e:
                logger.error(f"Error stopping monitor {monitor_id}: {e}")
                # Put it back if stopping failed unexpectedly
                if 'instance' in locals():
                    self.active_monitors[monitor_id] = instance
                return False

    def handle_file_change(self, table_name: str):
        """
        Callback eseguita da FileWatcher quando rileva una modifica.
        Orchestra il rilevamento delle modifiche e l'innesco delle automazioni.
        """
        with self.lock:
            logger.info(f"Rilevata modifica per la tabella {table_name} alle {datetime.now().strftime('%H:%M:%S')}.")
            
            active_monitors_for_table = [
                instance for instance in self.active_monitors.values()
                if instance.config.table_name == table_name and instance.status == MonitorStatus.RUNNING
            ]

            if not active_monitors_for_table:
                logger.warning(f"Nessun monitor attivo per processare la modifica per la tabella {table_name}.")
                return

            # 1. Ottieni le modifiche effettive dallo snapshot manager
            changes = self.snapshot_manager.get_changes(table_name)
            
            if not changes:
                logger.info(f"Nessun record nuovo o modificato trovato per {table_name} dopo il controllo.")
                self.snapshot_manager.update_snapshot(table_name)
                return

            logger.info(f"Processando {len(changes)} modifiche per la tabella {table_name}.")

            # 2. Processa ogni modifica attraverso il motore di automazione
            for change in changes:
                trigger_id = change.get('DB_APCODP')
                
                if not trigger_id:
                    logger.warning(f"Salto la modifica perché 'DB_APCODP' è mancante: {change}")
                    continue

                try:
                    logger.info(f"Eseguendo automazione per trigger 'prestazione' con ID '{trigger_id}'.")
                    self.automation_service.execute_rules_for_trigger(
                        trigger_type='prestazione',
                        trigger_id=str(trigger_id).strip(),
                        context_data=change
                    )
                except Exception as e:
                    logger.error(f"Errore durante l'esecuzione dell'automazione per il trigger {trigger_id}: {e}", exc_info=True)

            # 3. Aggiorna lo snapshot al nuovo stato dopo aver processato tutte le modifiche
            logger.info(f"Aggiornando lo snapshot per {table_name} dopo aver processato le modifiche.")
            self.snapshot_manager.update_snapshot(table_name)

            # 4. Aggiorna le statistiche dell'istanza del monitor
            current_time = datetime.now().isoformat()
            for instance in active_monitors_for_table:
                instance.change_count += len(changes)
                instance.last_change = current_time

    def get_monitor_status(self, monitor_id: str = None) -> Dict[str, Any]:
        """Recupera status di monitor specifico o tutti."""
        with self.lock:
            if monitor_id:
                instance = self.active_monitors.get(monitor_id)
                if instance:
                    return asdict(instance)
                else:
                    return {'error': f'Monitor {monitor_id} not found or not active'}
            
            return {
                'total_saved_configs': len(self.saved_configs),
                'active_monitors': len(self.active_monitors),
                'monitors': {mid: asdict(inst) for mid, inst in self.active_monitors.items()}
            }

    def _load_settings(self) -> Dict[str, Any]:
        """Carica impostazioni del monitoraggio."""
        try:
            settings_file = self.config_dir / "settings.json"
            if settings_file.exists():
                with open(settings_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                default_settings = {"auto_start_monitors": False}
                self._save_settings(default_settings)
                return default_settings
        except Exception as e:
            logger.error(f"Error loading settings: {e}")
            return {"auto_start_monitors": False}

    def _save_settings(self, settings: Dict[str, Any]):
        """Salva impostazioni su disco."""
        try:
            settings_file = self.config_dir / "settings.json"
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving settings: {e}")

    def _load_saved_configs(self):
        """Carica configurazioni salvate da disco."""
        configs_file = self.config_dir / "monitors_config.json"
        if not configs_file.exists():
            return
        
        with open(configs_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for monitor_id, config_data in data.items():
            try:
                config_data['monitor_type'] = MonitorType(config_data['monitor_type'])
                table_name = config_data.get('table_name')
                if table_name:
                    config_data['file_path'] = self.config.get_dbf_path(table_name)
                
                # Remove old field if it exists
                config_data.pop('callback_functions', None)

                config = MonitorConfig(**config_data)
                self.saved_configs[monitor_id] = config
                
                if config.auto_start and self.settings.get("auto_start_monitors"):
                    self.start_monitor(monitor_id)
            except Exception as e:
                logger.warning(f"Error loading config for {monitor_id}: {e}")

    def _save_config(self, config: MonitorConfig):
        """Salva configurazione su disco."""
        configs_file = self.config_dir / "monitors_config.json"
        data = {}
        if configs_file.exists():
            with open(configs_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        
        config_dict = asdict(config)
        config_dict['monitor_type'] = config.monitor_type.value
        data[config.monitor_id] = config_dict
        
        with open(configs_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

# Singleton instance
_monitoring_service = None
_monitoring_service_lock = threading.Lock()

def get_monitoring_service() -> MonitoringService:
    """Get singleton monitoring service instance."""
    global _monitoring_service
    if _monitoring_service is None:
        with _monitoring_service_lock:
            if _monitoring_service is None:
                _monitoring_service = MonitoringService()
    return _monitoring_service