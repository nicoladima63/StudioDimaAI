"""
SyncStateManager - Gestisce lo stato di sincronizzazione con Google Calendar
Evita duplicati e gestisce aggiornamenti incrementali.
"""

import json
import hashlib
import logging
from typing import Dict, Any, Optional, Set
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class SyncStateManager:
    """
    Gestisce lo stato di sincronizzazione per evitare duplicati.
    Mantiene traccia degli appuntamenti già sincronizzati con Google Calendar.
    """

    def __init__(self, sync_state_file: Optional[str] = None):
        """
        Inizializza il manager dello stato di sincronizzazione.
        
        Args:
            sync_state_file: Percorso del file per salvare lo stato
        """
        from core.paths import CALENDAR_SYNC_STATE_PATH, ensure_data_dir
        ensure_data_dir()

        if sync_state_file:
            self.sync_state_file = Path(sync_state_file)
        else:
            # Default: persistent data directory (configurable via env)
            self.sync_state_file = CALENDAR_SYNC_STATE_PATH
            
        self.sync_state: Dict[str, Dict[str, Any]] = {}
        self._load_sync_state()
    
    def _load_sync_state(self) -> None:
        """Carica lo stato di sincronizzazione dal file."""
        try:
            if self.sync_state_file.exists():
                with open(self.sync_state_file, 'r', encoding='utf-8') as f:
                    self.sync_state = json.load(f)
                logger.debug(f"Caricato stato sincronizzazione: {len(self.sync_state)} eventi")
            else:
                self.sync_state = {}
                logger.debug("Nessuno stato sincronizzazione esistente, inizializzazione vuota")
        except Exception as e:
            logger.error(f"Errore caricamento stato sincronizzazione: {e}")
            self.sync_state = {}
    
    def _save_sync_state(self) -> None:
        """Salva lo stato di sincronizzazione su file."""
        try:
            from core.paths import ensure_data_dir
            ensure_data_dir()
            # Crea directory se non esiste
            self.sync_state_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.sync_state_file, 'w', encoding='utf-8') as f:
                json.dump(self.sync_state, f, ensure_ascii=False, indent=2)
            # logger.debug(f"Salvato stato sincronizzazione: {len(self.sync_state)} eventi")
        except Exception as e:
            logger.error(f"Errore salvataggio stato sincronizzazione: {e}")

    def load_sync_state(self) -> Dict[str, Dict[str, Any]]:
        """
        Carica e restituisce lo stato di sincronizzazione. 
        Wrapper pubblico per _load_sync_state che restituisce lo stato.
        """
        self._load_sync_state()
        return self.sync_state

    def save_sync_state(self, state: Optional[Dict[str, Dict[str, Any]]] = None) -> None:
        """
        Aggiorna e salva lo stato di sincronizzazione.
        
        Args:
            state: Il nuovo stato da salvare (opzionale). Se None, salva lo stato corrente.
        """
        if state is not None:
            self.sync_state = state
        self._save_sync_state()
    
    def generate_appointment_id(self, appointment: Dict[str, Any]) -> str:
        """
        Genera un ID univoco per un appuntamento.
        
        Args:
            appointment: Dati dell'appuntamento dal DBF
            
        Returns:
            ID univoco dell'appuntamento
        """
        try:
            data = appointment.get('DATA', '')
            ora_inizio = appointment.get('ORA_INIZIO', '')
            studio = appointment.get('STUDIO', '')
            paziente = appointment.get('PAZIENTE', '') or appointment.get('DESCRIZIONE', '') or ''
            note = appointment.get('NOTE', '') or ''
            
            # Pulisce i campi per evitare caratteri problematici e crea un ID più robusto
            paziente_clean = str(paziente).replace(' ', '').replace('\n', '').replace('\r', '')
            note_hash = hashlib.sha1(str(note).encode('utf-8')).hexdigest()[:8] # Un piccolo hash delle note
            
            return f"{data}_{ora_inizio}_{studio}_{paziente_clean}_{note_hash}"
        except Exception as e:
            logger.error(f"ERRORE CRITICO in generazione ID appuntamento: {e}")
            logger.error(f"DATI APPUNTAMENTO PROBLEMATICO: {appointment}")
            # Fallback con timestamp
            return f"fallback_{datetime.now().timestamp()}"
    
    def generate_appointment_hash(self, appointment: Dict[str, Any]) -> str:
        """
        Genera un hash per verificare se un appuntamento è cambiato.
        
        Args:
            appointment: Dati dell'appuntamento dal DBF
            
        Returns:
            Hash SHA256 dell'appuntamento
        """
        try:
            # Campi che determinano se l'appuntamento è cambiato
            fields = [
                appointment.get('DATA', ''),
                appointment.get('ORA_INIZIO', ''),
                appointment.get('ORA_FINE', ''),
                appointment.get('TIPO', ''),
                appointment.get('STUDIO', ''),
                appointment.get('NOTE', ''),
                appointment.get('DESCRIZIONE', ''),
                appointment.get('PAZIENTE', '')
            ]
            
            # Crea stringa concatenata
            content = '|'.join(str(field) for field in fields)
            
            # Genera hash SHA256
            return hashlib.sha256(content.encode('utf-8')).hexdigest()
        except Exception as e:
            logger.error(f"ERRORE CRITICO in generazione hash appuntamento: {e}")
            logger.error(f"DATI APPUNTAMENTO PROBLEMATICO: {appointment}")
            return hashlib.sha256(str(datetime.now().timestamp()).encode()).hexdigest()
    
    def get_sync_state_for_studios(self, studio_ids: Set[int]) -> Dict[str, Dict[str, Any]]:
        """
        Filtra lo stato di sincronizzazione per studi specifici.
        
        Args:
            studio_ids: Set di ID studi da includere
            
        Returns:
            Stato sincronizzazione filtrato per gli studi specificati
        """
        filtered_state = {}
        
        for app_id, sync_data in self.sync_state.items():
            try:
                # Estrae studio ID dall'app_id (formato: DATA_ORA_STUDIO_PAZIENTE)
                parts = app_id.split('_')
                if len(parts) >= 3:
                    studio_from_id = int(parts[2])
                    if studio_from_id in studio_ids:
                        filtered_state[app_id] = sync_data
            except (IndexError, ValueError) as e:
                logger.warning(f"Errore parsing app_id {app_id}: {e}")
                continue
        
        # logger.info(f"Filtrato stato sincronizzazione: {len(filtered_state)} eventi per studi {studio_ids}")
        return filtered_state
    
    def is_appointment_synced(self, appointment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Verifica se un appuntamento è già sincronizzato e se è cambiato.
        
        Args:
            appointment: Dati dell'appuntamento dal DBF
            
        Returns:
            Dati sincronizzazione se esiste e non è cambiato, None altrimenti
        """
        app_id = self.generate_appointment_id(appointment)
        app_hash = self.generate_appointment_hash(appointment)
        
        if app_id in self.sync_state:
            existing_data = self.sync_state[app_id]
            existing_hash = existing_data.get('hash', '')
            
            if existing_hash == app_hash:
                # Appuntamento già sincronizzato e non cambiato
                return existing_data
            else:
                # Appuntamento cambiato, va aggiornato
                # logger.info(f"Appuntamento {app_id} modificato, richiede aggiornamento")
                return None
        else:
            # Nuovo appuntamento
            # logger.info(f"Nuovo appuntamento {app_id}")
            return None
    
    def mark_appointment_synced(self, appointment: Dict[str, Any], 
                               calendar_id: str, event_id: str, 
                               month: int, year: int) -> None:
        """
        Marca un appuntamento come sincronizzato.
        
        Args:
            appointment: Dati dell'appuntamento dal DBF
            calendar_id: ID del calendario Google
            event_id: ID dell'evento Google Calendar
            month: Mese dell'appuntamento
            year: Anno dell'appuntamento
        """
        app_id = self.generate_appointment_id(appointment)
        app_hash = self.generate_appointment_hash(appointment)
        
        self.sync_state[app_id] = {
            'calendar_id': calendar_id,
            'event_id': event_id,
            'hash': app_hash,
            'month': month,
            'year': year,
            'synced_at': datetime.now().isoformat()
        }
        
        # logger.debug(f"Marcato appuntamento {app_id} come sincronizzato")
        self._save_sync_state()
    
    def remove_appointment_sync(self, appointment: Dict[str, Any]) -> None:
        """
        Rimuove un appuntamento dallo stato di sincronizzazione.
        
        Args:
            appointment: Dati dell'appuntamento dal DBF
        """
        app_id = self.generate_appointment_id(appointment)
        
        if app_id in self.sync_state:
            del self.sync_state[app_id]
            # logger.debug(f"Rimosso appuntamento {app_id} dallo stato sincronizzazione")
            self._save_sync_state()
    
    def get_appointments_to_delete(self, current_appointment_ids: Set[str], 
                                  month: int, year: int, studio_ids: Set[int]) -> Set[str]:
        """
        Identifica appuntamenti da cancellare (non più presenti nel DBF) per gli studi specificati.
        
        Args:
            current_appointment_ids: Set di ID appuntamenti attualmente nel DBF
            month: Mese di riferimento
            year: Anno di riferimento
            studio_ids: Set di ID degli studi per cui effettuare il controllo
            
        Returns:
            Set di app_id da cancellare dal calendario
        """
        to_delete = set()
        
        # Itale su una copia per evitare problemi di concorrenza se lo stato cambia
        state_snapshot = self.sync_state.copy()

        for app_id, sync_data in state_snapshot.items():
            try:
                # Estrae lo studio dall'ID dell'appuntamento (es. DATA_ORA_STUDIO_PAZIENTE)
                studio_from_id = int(app_id.split('_')[2])
            except (IndexError, ValueError):
                # Salta gli ID malformati
                continue

            # Controlla solo gli appuntamenti degli studi che stiamo sincronizzando
            if studio_from_id not in studio_ids:
                continue

            sync_month = sync_data.get('month')
            sync_year = sync_data.get('year')
            
            # Controlla solo gli appuntamenti del mese/anno corrente
            if sync_month == month and sync_year == year:
                if app_id not in current_appointment_ids:
                    to_delete.add(app_id)
        
        # logger.info(f"Identificati {len(to_delete)} appuntamenti da cancellare per gli studi {studio_ids}")
        return to_delete
    
    def reset_sync_state(self) -> bool:
        """Elimina il file di stato per forzare una risincronizzazione completa."""
        try:
            if self.sync_state_file.exists():
                self.sync_state_file.unlink()
                logger.info(f"File di stato sincronizzazione '{self.sync_state_file}' eliminato.")
            self.sync_state = {}
            return True
        except Exception as e:
            logger.error(f"Errore durante l'eliminazione del file di stato: {e}")
            return False
    
    def get_sync_statistics(self) -> Dict[str, Any]:
        """
        Restituisce statistiche sullo stato di sincronizzazione.
        
        Returns:
            Dizionario con statistiche
        """
        total_synced = len(self.sync_state)
        
        # Raggruppa per mese/anno
        by_month_year = {}
        for sync_data in self.sync_state.values():
            month = sync_data.get('month', 0)
            year = sync_data.get('year', 0)
            key = f"{year}-{month:02d}"
            by_month_year[key] = by_month_year.get(key, 0) + 1
        
        return {
            'total_synced': total_synced,
            'by_month_year': by_month_year,
            'last_updated': datetime.now().isoformat()
        }

    def validate_and_clean_sync_state(self) -> int:
        """
        Valida il sync state e rimuove eventi che non esistono più su Google Calendar.
        Returns: numero di eventi rimossi
        """
        from services.calendar_service import calendar_service
        
        try:
            service = calendar_service._get_calendar_service()
            sync_state = self.load_sync_state()
            
            invalid_appointments = []
            
            for app_id, sync_data in sync_state.items():
                calendar_id = sync_data.get('calendar_id')
                event_id = sync_data.get('event_id')
                
                if not calendar_id or not event_id:
                    invalid_appointments.append(app_id)
                    continue
                
                # Verifica se l'evento esiste ancora
                try:
                    service.events().get(
                        calendarId=calendar_id,
                        eventId=event_id
                    ).execute()
                    # Evento esiste, tutto ok
                except Exception as e:
                    # Evento non esiste più
                    logger.debug(f"Evento {event_id} non esiste più, rimuovo da sync state")
                    invalid_appointments.append(app_id)
            
            # Rimuovi eventi invalidi
            for app_id in invalid_appointments:
                del sync_state[app_id]
            
            if invalid_appointments:
                self.save_sync_state(sync_state)
                logger.info(f"Rimossi {len(invalid_appointments)} eventi invalidi")
            
            return len(invalid_appointments)
            
        except Exception as e:
            logger.error(f"Errore durante validazione sync state: {e}")
            return 0

# Singleton per accesso globale
_sync_state_manager: Optional[SyncStateManager] = None


def get_sync_state_manager() -> SyncStateManager:
    """
    Restituisce l'istanza singleton del SyncStateManager.
    
    Returns:
        Istanza del SyncStateManager
    """
    global _sync_state_manager
    
    if _sync_state_manager is None:
        _sync_state_manager = SyncStateManager()
    
    return _sync_state_manager
