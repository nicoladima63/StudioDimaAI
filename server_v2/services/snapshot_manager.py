"""
📸 Snapshot Manager per StudioDimaAI Calendar System v2
======================================================

Gestisce lo stato corrente dei record DBF per il sistema di sincronizzazione incrementale:
- Creazione snapshot iniziale delle tabelle DBF monitorate
- Aggiornamento snapshot in tempo reale
- Persistenza su disco per recovery automatico
- Hash-based change detection per performance

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import os
import json
import hashlib
import logging
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from pathlib import Path
from dataclasses import dataclass, asdict

from core.config_manager import get_config
from core.constants_v2 import DBF_TABLES, get_dbf_table_info
from utils.dbf_utils import get_optimized_reader

logger = logging.getLogger(__name__)

@dataclass
class SnapshotRecord:
    """Record singolo nello snapshot."""
    record_id: str
    data: Dict[str, Any]
    hash: str
    timestamp: str

@dataclass
class TableSnapshot:
    """Snapshot completo di una tabella DBF."""
    table_name: str
    records: Dict[str, SnapshotRecord]  # record_id -> SnapshotRecord
    file_path: str
    file_hash: str
    last_modified: str
    record_count: int
    created_at: str

class SnapshotManager:
    """
    Manager per snapshot delle tabelle DBF.
    
    Caratteristiche:
    - Snapshot iniziale automatico all'avvio
    - Aggiornamento incrementale in tempo reale
    - Persistenza su disco per recovery
    - Hash-based change detection
    - Thread-safe operations
    """
    
    def __init__(self, snapshot_dir: str = "data/snapshots"):
        self.config = get_config()
        self.snapshot_dir = Path(snapshot_dir)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Cache snapshot in memoria
        self.snapshots: Dict[str, TableSnapshot] = {}
        
        # DBF reader ottimizzato
        self.dbf_reader = get_optimized_reader()
        
        # Tabelle monitorate (dinamiche)
        self.monitored_tables: Set[str] = set()
        
        # logger.info(f"SnapshotManager initialized: dir={self.snapshot_dir}")
    
    def start_monitoring(self, table_name: str, file_path: str = None) -> bool:
        """
        Avvia il monitoraggio di una tabella specifica.
        
        Args:
            table_name: Nome tabella da monitorare
            file_path: Percorso file DBF (opzionale, se non fornito usa config)
            
        Returns:
            True se avvio riuscito
        """
        # Validazione opzionale - commentata per permettere qualsiasi tabella
        # if table_name not in DBF_TABLES:
        #     logger.error(f"Table {table_name} not found in DBF_TABLES")
        #     return False
        
        with self.lock:
            if table_name in self.monitored_tables:
                # logger.info(f"Table {table_name} already being monitored")
                return True
            
            try:
                # logger.info(f"Starting monitoring for table: {table_name}")
                
                # Aggiungi alla lista monitorate
                self.monitored_tables.add(table_name)
                
                # Crea snapshot iniziale
                success = self._create_table_snapshot(table_name, file_path)
                
                if success:
                    start_time = datetime.now().strftime("%H:%M:%S")
                    # logger.info(f"Monitoring started for {table_name} at {start_time}")
                    return True
                else:
                    # Rimuovi dalla lista se fallisce
                    self.monitored_tables.discard(table_name)
                    logger.error(f"Failed to start monitoring for {table_name}")
                    return False
                    
            except Exception as e:
                self.monitored_tables.discard(table_name)
                logger.error(f"Error starting monitoring for {table_name}: {e}")
                return False
    
    def stop_monitoring(self, table_name: str) -> bool:
        """
        Ferma il monitoraggio di una tabella.
        
        Args:
            table_name: Nome tabella da fermare
            
        Returns:
            True se stop riuscito
        """
        with self.lock:
            if table_name not in self.monitored_tables:
                logger.warning(f"Table {table_name} not being monitored")
                return False
            
            try:
                # Rimuovi dalla lista
                self.monitored_tables.discard(table_name)
                
                # Mantieni snapshot in memoria per recovery
                # logger.info(f"Monitoring stopped for {table_name}")
                return True
                
            except Exception as e:
                logger.error(f"Error stopping monitoring for {table_name}: {e}")
                return False
    
    def update_snapshot(self, table_name: str) -> bool:
        """
        Aggiorna snapshot per una tabella specifica.
        
        Args:
            table_name: Nome tabella da aggiornare
            
        Returns:
            True se aggiornamento riuscito
        """
        with self.lock:
            if table_name not in self.monitored_tables:
                logger.warning(f"Table {table_name} not being monitored")
                return False
            
            try:
                # logger.info(f"Updating snapshot for {table_name}")
                
                # Recupera file_path dallo snapshot esistente
                existing_snapshot = self.snapshots.get(table_name)
                if existing_snapshot:
                    file_path = existing_snapshot.file_path
                else:
                    # Se non esiste snapshot, usa ConfigManager
                    file_path = self.config.get_dbf_path(table_name)
                
                # Ricrea snapshot con file_path
                success = self._create_table_snapshot(table_name, file_path)
                
                if success:
                    # logger.info(f"Snapshot updated for {table_name}")
                    return True
                else:
                    logger.error(f"Failed to update snapshot for {table_name}")
                    return False
                    
            except Exception as e:
                logger.error(f"Error updating snapshot for {table_name}: {e}")
                return False
    
    def initialize_snapshots(self) -> Dict[str, bool]:
        """
        Crea snapshot iniziali per tutte le tabelle monitorate.
        
        Returns:
            Dict con status creazione per ogni tabella
        """
        results = {}
        
        with self.lock:
            for table_name in self.monitored_tables:
                try:
                    # logger.info(f"Creating initial snapshot for table: {table_name}")
                    
                    # Recupera file_path da ConfigManager
                    file_path = self.config.get_dbf_path(table_name)
                    success = self._create_table_snapshot(table_name, file_path)
                    results[table_name] = success
                    
                    if success:
                        # logger.debug(f"Snapshot created for {table_name}")
                        pass
                    else:
                        logger.error(f"Failed to create snapshot for {table_name}")
                        
                except Exception as e:
                    logger.error(f"Error creating snapshot for {table_name}: {e}")
                    results[table_name] = False
        
        return results
    
    def load_existing_snapshots(self, table_name: str = None) -> Dict[str, bool]:
        """
        Carica snapshot esistenti da disco.
        
        Args:
            table_name: Nome tabella specifica (opzionale)
            
        Returns:
            Dict con status caricamento per ogni tabella
        """
        results = {}
        
        with self.lock:
            tables_to_load = [table_name] if table_name else list(self.monitored_tables)
            
            for table in tables_to_load:
                try:
                    snapshot_file = self.snapshot_dir / f"{table}_snapshot.json"
                    
                    if snapshot_file.exists():
                        # logger.info(f"Loading existing snapshot for {table}")
                        success = self._load_table_snapshot(table, snapshot_file)
                        results[table] = success
                        
                        if success:
                            # logger.info(f"Snapshot loaded for {table}")
                            pass
                        else:
                            logger.error(f"Failed to load snapshot for {table}")
                    else:
                        # logger.info(f"No existing snapshot for {table}")
                        results[table] = False
                        
                except Exception as e:
                    logger.error(f"Error loading snapshot for {table}: {e}")
                    results[table] = False
        
        return results
    
    
    def get_snapshot(self, table_name: str) -> Optional[TableSnapshot]:
        """
        Recupera snapshot di una tabella.
        
        Args:
            table_name: Nome tabella
            
        Returns:
            TableSnapshot o None se non esiste
        """
        with self.lock:
            return self.snapshots.get(table_name)
    
    def get_all_snapshots(self) -> Dict[str, TableSnapshot]:
        """Recupera tutti gli snapshot."""
        with self.lock:
            return self.snapshots.copy()
    
    def get_snapshot_status(self) -> Dict[str, Any]:
        """
        Recupera status di tutti gli snapshot per monitoring.
        
        Returns:
            Dict con informazioni dettagliate
        """
        with self.lock:
            status = {
                'total_tables': len(self.monitored_tables),
                'snapshots_loaded': len(self.snapshots),
                'tables': {}
            }
            
            for table_name in self.monitored_tables:
                snapshot = self.snapshots.get(table_name)
                
                if snapshot:
                    status['tables'][table_name] = {
                        'loaded': True,
                        'record_count': snapshot.record_count,
                        'last_modified': snapshot.last_modified,
                        'file_path': snapshot.file_path,
                        'file_hash': snapshot.file_hash[:16] + '...' if len(snapshot.file_hash) > 16 else snapshot.file_hash
                    }
                else:
                    status['tables'][table_name] = {
                        'loaded': False,
                        'error': 'No snapshot available'
                    }
            
            return status
    
    def _read_appunta_only(self, table_name: str, file_path: str = None) -> List[Dict[str, Any]]:
        """Legge solo il file DBF specificato senza join con pazienti."""
        try:
            from dbfread import DBF
            
            # Usa percorso fornito (obbligatorio)
            if file_path is None:
                raise ValueError(f"file_path is required for table {table_name}")
            
            if not os.path.exists(file_path):
                logger.error(f"DBF file not found: {file_path}")
                return []
            
            # Leggi direttamente con dbfread
            dbf = DBF(file_path, encoding='latin-1')
            records = []
            
            for record in dbf:
                # Converti in dict semplice con conversione date
                record_dict = {}
                for field, value in record.items():
                    # Converti date in stringhe per JSON serialization
                    if hasattr(value, 'isoformat'):  # datetime/date objects
                        record_dict[field] = value.isoformat()
                    else:
                        record_dict[field] = value
                records.append(record_dict)
            
            # logger.debug(f"Read {len(records)} records from APPUNTA.DBF")
            return records
            
        except Exception as e:
            logger.error(f"Error reading APPUNTA.DBF: {e}")
            return []
    
    def _create_table_snapshot(self, table_name: str, file_path: str = None) -> bool:
        """
        Crea snapshot completo di una tabella DBF.
        
        Args:
            table_name: Nome tabella
            file_path: Percorso file DBF (opzionale, se non fornito usa config)
            
        Returns:
            True se creazione riuscita
        """
        try:
            # Recupera info tabella
            table_info = get_dbf_table_info(table_name)
            
            # Usa percorso fornito (obbligatorio)
            if file_path is None:
                raise ValueError(f"file_path is required for table {table_name}")
            
            # Calcola hash del file
            file_hash = self._calculate_file_hash(file_path)
            file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
            
            # Leggi tutti i record
            # logger.debug(f"Reading all records from {file_path}")
            
            # Leggi i record dal file DBF
            records_data = self._read_appunta_only(table_name, file_path)
            
            # Crea snapshot records
            snapshot_records = {}
            for record_data in records_data:
                record_id = self._generate_record_id(record_data, table_name)
                record_hash = self._calculate_record_hash(record_data)
                
                snapshot_records[record_id] = SnapshotRecord(
                    record_id=record_id,
                    data=record_data,
                    hash=record_hash,
                    timestamp=datetime.now().isoformat()
                )
            
            # Crea snapshot
            snapshot = TableSnapshot(
                table_name=table_name,
                records=snapshot_records,
                file_path=file_path,
                file_hash=file_hash,
                last_modified=file_mtime,
                record_count=len(snapshot_records),
                created_at=datetime.now().isoformat()
            )
            
            # Salva in memoria e su disco
            self.snapshots[table_name] = snapshot
            self._save_table_snapshot(table_name)
            
            # logger.info(f"Created snapshot for {table_name}: {len(snapshot_records)} records")
            return True
            
        except Exception as e:
            logger.error(f"Error creating snapshot for {table_name}: {e}")
            return False
    
    def _load_table_snapshot(self, table_name: str, snapshot_file: Path) -> bool:
        """
        Carica snapshot da file JSON.
        
        Args:
            table_name: Nome tabella
            snapshot_file: Path al file snapshot
            
        Returns:
            True se caricamento riuscito
        """
        try:
            with open(snapshot_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Ricostruisci snapshot
            records = {}
            for record_id, record_data in data.get('records', {}).items():
                records[record_id] = SnapshotRecord(**record_data)
            
            snapshot = TableSnapshot(
                table_name=data['table_name'],
                records=records,
                file_path=data['file_path'],
                file_hash=data['file_hash'],
                last_modified=data['last_modified'],
                record_count=data['record_count'],
                created_at=data['created_at']
            )
            
            self.snapshots[table_name] = snapshot
            return True
            
        except Exception as e:
            logger.error(f"Error loading snapshot for {table_name}: {e}")
            return False
    
    def _save_table_snapshot(self, table_name: str) -> bool:
        """
        Salva snapshot su disco.
        
        Args:
            table_name: Nome tabella
            
        Returns:
            True se salvataggio riuscito
        """
        try:
            snapshot = self.snapshots.get(table_name)
            if not snapshot:
                return False
            
            snapshot_file = self.snapshot_dir / f"{table_name}_snapshot.json"
            
            # Converti snapshot in dict per JSON serialization
            data = {
                'table_name': snapshot.table_name,
                'records': {rid: asdict(record) for rid, record in snapshot.records.items()},
                'file_path': snapshot.file_path,
                'file_hash': snapshot.file_hash,
                'last_modified': snapshot.last_modified,
                'record_count': snapshot.record_count,
                'created_at': snapshot.created_at
            }
            
            with open(snapshot_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving snapshot for {table_name}: {e}")
            return False
    
    def _read_all_patients(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Legge tutti i pazienti dal DBF.
        
        Args:
            file_path: Path al file PAZIENTI.DBF
            
        Returns:
            Lista di record pazienti
        """
        try:
            import dbf
            
            records = []
            with dbf.Table(file_path, codepage='cp1252') as table:
                for record in table:
                    try:
                        # Converti record in dict
                        record_dict = {}
                        for field_name in table.field_names:
                            value = record[field_name]
                            # Converti bytes in string se necessario
                            if isinstance(value, bytes):
                                value = value.decode('cp1252', errors='ignore').strip()
                            elif value is None:
                                value = ''
                            record_dict[field_name] = value
                        
                        records.append(record_dict)
                        
                    except Exception as e:
                        logger.warning(f"Error reading patient record: {e}")
                        continue
            
            # logger.info(f"Read {len(records)} patient records from {file_path}")
            return records
            
        except Exception as e:
            logger.error(f"Error reading patients from {file_path}: {e}")
            return []
    
    def _generate_record_id(self, record_data: Dict[str, Any], table_name: str) -> str:
        """
        Genera ID univoco per un record.
        
        Args:
            record_data: Dati del record
            table_name: Nome tabella
            
        Returns:
            ID univoco del record
        """
        if table_name == 'APPUNTA':
            # Per appuntamenti: data + ora + paziente + medico
            data = record_data.get('DB_APDATA', '')
            ora = record_data.get('DB_APOREIN', '')
            paziente = record_data.get('DB_APPACOD', '')
            medico = record_data.get('DB_APMEDIC', '')
            return f"app_{data}_{ora}_{paziente}_{medico}"
        
        elif table_name == 'pazienti':
            # Per pazienti: codice paziente
            codice = record_data.get('DB_CODE', '')
            return f"paz_{codice}"
        
        else:
            # Fallback: hash dei dati
            data_str = str(sorted(record_data.items()))
            return hashlib.md5(data_str.encode()).hexdigest()[:16]
    
    def _calculate_record_hash(self, record_data: Dict[str, Any]) -> str:
        """
        Calcola hash di un record per change detection.
        
        Args:
            record_data: Dati del record
            
        Returns:
            Hash MD5 del record
        """
        # Ordina i campi per hash consistente
        sorted_data = sorted(record_data.items())
        data_str = str(sorted_data)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """
        Calcola hash di un file DBF.
        
        Args:
            file_path: Path al file
            
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
            logger.error(f"Error calculating file hash for {file_path}: {e}")
            return ""


# Singleton instance
_snapshot_manager = None

def get_snapshot_manager() -> SnapshotManager:
    """Get singleton snapshot manager instance."""
    global _snapshot_manager
    if _snapshot_manager is None:
        _snapshot_manager = SnapshotManager()
    return _snapshot_manager

def start_table_monitoring(table_name: str) -> bool:
    """
    Convenience function per avviare monitoraggio di una tabella.
    
    Args:
        table_name: Nome tabella da monitorare
        
    Returns:
        True se avvio riuscito
        
    Example:
        >>> start_table_monitoring('APPUNTA')
        True
        >>> start_table_monitoring('pazienti') 
        True
    """
    manager = get_snapshot_manager()
    return manager.start_monitoring(table_name)

def stop_table_monitoring(table_name: str) -> bool:
    """
    Convenience function per fermare monitoraggio di una tabella.
    
    Args:
        table_name: Nome tabella da fermare
        
    Returns:
        True se stop riuscito
    """
    manager = get_snapshot_manager()
    return manager.stop_monitoring(table_name)
