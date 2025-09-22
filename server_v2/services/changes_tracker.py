"""
Changes Tracker per StudioDimaAI Calendar System v2
==================================================

Servizio per tracciare e loggare i cambiamenti agli appuntamenti rilevati dal monitor.

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class AppointmentChange:
    """Rappresenta un cambiamento a un appuntamento"""
    timestamp: str
    change_type: str  # 'new', 'deleted', 'modified', 'moved'
    appointment_id: str
    studio: int
    patient_name: str
    appointment_date: str
    appointment_time: str
    old_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None
    details: Optional[str] = None

class ChangesTracker:
    """Gestisce il tracciamento dei cambiamenti agli appuntamenti"""
    
    def __init__(self, data_dir: str = "data/monitoring"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.changes_file = self.data_dir / "appointment_changes.json"
        self.appointments_file = self.data_dir / "appointments_data.json"
        
        # Carica dati esistenti
        self._load_existing_data()
    
    def _load_existing_data(self):
        """Carica dati esistenti dai file"""
        # Carica cambiamenti
        if self.changes_file.exists():
            try:
                with open(self.changes_file, 'r', encoding='utf-8') as f:
                    self.changes = json.load(f)
            except Exception as e:
                logger.error(f"Error loading changes file: {e}")
                self.changes = []
        else:
            self.changes = []
        
        # Carica appuntamenti
        if self.appointments_file.exists():
            try:
                with open(self.appointments_file, 'r', encoding='utf-8') as f:
                    self.appointments_data = json.load(f)
            except Exception as e:
                logger.error(f"Error loading appointments file: {e}")
                self.appointments_data = {}
        else:
            self.appointments_data = {}
    
    def _save_changes(self):
        """Salva i cambiamenti su file"""
        try:
            with open(self.changes_file, 'w', encoding='utf-8') as f:
                json.dump(self.changes, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving changes: {e}")
    
    def _save_appointments(self):
        """Salva i dati degli appuntamenti su file"""
        try:
            with open(self.appointments_file, 'w', encoding='utf-8') as f:
                json.dump(self.appointments_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving appointments: {e}")
    
    def track_change(self, change: AppointmentChange):
        """Traccia un cambiamento"""
        try:
            # Aggiungi ai cambiamenti
            self.changes.append(asdict(change))
            
            # Mantieni solo gli ultimi 1000 cambiamenti
            if len(self.changes) > 1000:
                self.changes = self.changes[-1000:]
            
            # Salva
            self._save_changes()
            
            logger.info(f"Tracked change: {change.change_type} for appointment {change.appointment_id}")
            
        except Exception as e:
            logger.error(f"Error tracking change: {e}")
    
    def update_appointments_data(self, appointments: List[Dict[str, Any]]):
        """Aggiorna i dati degli appuntamenti"""
        try:
            # Converti lista in dict per accesso rapido
            appointments_dict = {}
            for app in appointments:
                app_id = self._generate_appointment_id(app)
                appointments_dict[app_id] = app
            
            self.appointments_data = appointments_dict
            self._save_appointments()
            
            logger.info(f"Updated appointments data: {len(appointments)} appointments")
            
        except Exception as e:
            logger.error(f"Error updating appointments data: {e}")
    
    def _generate_appointment_id(self, appointment: Dict[str, Any]) -> str:
        """Genera ID univoco per un appuntamento"""
        try:
            # Usa data, ora, studio e paziente per ID univoco
            date = appointment.get('DATA', '')
            time = appointment.get('ORA', '')
            studio = appointment.get('STUDIO', '')
            patient = appointment.get('PAZIENTE', '')
            
            return f"{date}_{time}_{studio}_{patient}".replace(' ', '_')
        except Exception:
            return f"app_{datetime.now().timestamp()}"
    
    def get_changes_summary(self, date_from: Optional[str] = None, date_to: Optional[str] = None) -> Dict[str, Any]:
        """Ottiene riepilogo dei cambiamenti per periodo"""
        try:
            # Filtra per data se specificata
            filtered_changes = self.changes
            if date_from or date_to:
                filtered_changes = []
                for change in self.changes:
                    change_date = change['timestamp'][:10]  # YYYY-MM-DD
                    if date_from and change_date < date_from:
                        continue
                    if date_to and change_date > date_to:
                        continue
                    filtered_changes.append(change)
            
            # Conta per tipo
            summary = {
                'total_changes': len(filtered_changes),
                'new_appointments': 0,
                'deleted_appointments': 0,
                'modified_appointments': 0,
                'moved_appointments': 0,
                'by_studio': {},
                'by_date': {},
                'recent_changes': filtered_changes[-10:] if filtered_changes else []
            }
            
            for change in filtered_changes:
                change_type = change['change_type']
                studio = change.get('studio', 0)
                date = change['timestamp'][:10]
                
                # Conta per tipo
                if change_type == 'new':
                    summary['new_appointments'] += 1
                elif change_type == 'deleted':
                    summary['deleted_appointments'] += 1
                elif change_type == 'modified':
                    summary['modified_appointments'] += 1
                elif change_type == 'moved':
                    summary['moved_appointments'] += 1
                
                # Conta per studio
                if studio not in summary['by_studio']:
                    summary['by_studio'][studio] = 0
                summary['by_studio'][studio] += 1
                
                # Conta per data
                if date not in summary['by_date']:
                    summary['by_date'][date] = 0
                summary['by_date'][date] += 1
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting changes summary: {e}")
            return {'error': str(e)}
    
    def get_changes_for_date(self, date: str) -> List[Dict[str, Any]]:
        """Ottiene tutti i cambiamenti per una data specifica"""
        try:
            date_changes = []
            for change in self.changes:
                if change['timestamp'].startswith(date):
                    date_changes.append(change)
            
            return date_changes
            
        except Exception as e:
            logger.error(f"Error getting changes for date {date}: {e}")
            return []

# Istanza globale
_changes_tracker = None

def get_changes_tracker() -> ChangesTracker:
    """Ottiene istanza globale del ChangesTracker"""
    global _changes_tracker
    if _changes_tracker is None:
        _changes_tracker = ChangesTracker()
    return _changes_tracker
