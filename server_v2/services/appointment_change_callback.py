"""
Appointment Change Callback per StudioDimaAI Calendar System v2
==============================================================

Callback per il monitor che traccia i cambiamenti agli appuntamenti e aggiorna i dati.

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import logging
from datetime import datetime
from typing import Dict, List, Any

from services.changes_tracker import get_changes_tracker, AppointmentChange
from services.calendar_service import CalendarServiceV2

def convert_gestionale_time_to_standard(time_value):
    """
    Converte l'orario dal formato gestionale (es. 10.10) al formato standard (es. 10:10).
    
    Il gestionale usa solo minuti multipli di 10: 00, 10, 20, 30, 40, 50
    
    Args:
        time_value: Orario dal DBF (es. 10.10, 12.30, 15.40)
        
    Returns:
        str: Orario in formato standard (es. 10:10, 12:30, 15:40)
    """
    try:
        if not time_value or time_value == '':
            return ''
        
        # Converte in stringa e rimuovi spazi
        time_str = str(time_value).strip()
        
        # Se contiene un punto, è nel formato gestionale
        if '.' in time_str:
            parts = time_str.split('.')
            if len(parts) == 2:
                hours = parts[0].zfill(2)  # Aggiungi zero se necessario
                minutes_raw = parts[1]
                
                # Converte i minuti dal formato gestionale
                # 10 = 10 minuti, 20 = 20 minuti, 30 = 30 minuti, etc.
                if minutes_raw.isdigit():
                    minutes = int(minutes_raw)
                    # Arrotonda al multiplo di 10 più vicino se necessario
                    if minutes % 10 != 0:
                        minutes = round(minutes / 10) * 10
                        logger.warning(f"Orario non valido {time_value}, arrotondato a {hours}:{minutes:02d}")
                    
                    return f"{hours}:{minutes:02d}"
        
        # Se è già nel formato standard, restituisci così
        if ':' in time_str:
            return time_str
            
        # Se è solo un numero, assumi che sia ore
        if time_str.isdigit():
            return f"{time_str.zfill(2)}:00"
            
        return time_str
        
    except Exception as e:
        logger.warning(f"Error converting time {time_value}: {e}")
        return str(time_value)

logger = logging.getLogger(__name__)

def appointment_change_callback(changes: List[Dict], config: Dict[str, Any]):
    """
    Callback chiamata dal monitor quando rileva cambiamenti agli appuntamenti.
    
    Args:
        changes: Lista dei cambiamenti rilevati
        config: Configurazione del monitor
    """
    try:
        current_time = datetime.now().strftime('%H:%M:%S')
        logger.info(f"Callback eseguita alle ore {current_time} con {len(changes)} cambiamenti")
        
        # Ottieni il tracker dei cambiamenti
        tracker = get_changes_tracker()
        
        # Aspetta un momento per permettere al DBF di essere completamente aggiornato
        import time
        time.sleep(2)
        
        # Leggi TUTTI gli appuntamenti dal DBF (stesso metodo dello snapshot)
        from core.config_manager import get_config
        config = get_config()
        file_path = config.get_dbf_path("appointments")
        
        # Usa lo stesso metodo di lettura dello SnapshotManager
        all_appointments = _read_appunta_only("appointments", file_path)
        
        # DEBUG: Controlla stato del tracker
        logger.info(f"DEBUG: Tracker ha {len(tracker.appointments_data)} appuntamenti precedenti")
        logger.info(f"DEBUG: Letti {len(all_appointments)} appuntamenti attuali")
        
        # Se è la prima volta (dati vuoti), inizializza senza confronto
        if not tracker.appointments_data or len(tracker.appointments_data) == 0:
            logger.info(f"Prima inizializzazione: caricando {len(all_appointments)} appuntamenti come baseline")
            tracker.update_appointments_data(all_appointments)
            logger.info("Baseline stabilita - prossime modifiche saranno rilevate correttamente")
            return  # Esce subito senza tracciare cambiamenti
        else:
            # Salva i dati precedenti per il confronto
            previous_appointments = tracker.appointments_data.copy()
            
            # Aggiorna i dati degli appuntamenti
            tracker.update_appointments_data(all_appointments)
            
            # Analizza i cambiamenti specifici confrontando con i dati precedenti
            changes_count = _analyze_and_track_changes(tracker, all_appointments, previous_appointments)
        logger.info(f"DEBUG: Rilevati {changes_count} cambiamenti specifici")
        
        logger.info("Appointment change callback completed successfully")
        
    except Exception as e:
        logger.error(f"Error in appointment change callback: {e}")

def _analyze_and_track_changes(tracker, current_appointments: List[Dict[str, Any]], previous_appointments: List[Dict[str, Any]] = None) -> int:
    """
    Analizza i cambiamenti confrontando con i dati precedenti.
    
    Args:
        tracker: Istanza del ChangesTracker
        current_appointments: Lista aggiornata degli appuntamenti
        previous_appointments: Lista precedente degli appuntamenti (se None, usa tracker.appointments_data)
        
    Returns:
        Numero di cambiamenti rilevati
    """
    changes_count = 0
    
    try:
        # Crea dict per accesso rapido
        current_dict = {}
        for app in current_appointments:
            app_id = tracker._generate_appointment_id(app)
            current_dict[app_id] = app
        
        # Confronta con dati precedenti
        if previous_appointments is not None:
            # Usa i dati precedenti passati come parametro
            previous_dict = {}
            for app in previous_appointments:
                app_id = tracker._generate_appointment_id(app)
                previous_dict[app_id] = app
        else:
            # Fallback ai dati del tracker (per compatibilità)
            previous_dict = tracker.appointments_data
            
        logger.info(f"Confronto: {len(current_dict)} appuntamenti attuali vs {len(previous_dict)} precedenti")
        
        # Trova nuovi appuntamenti
        for app_id, app in current_dict.items():
            if app_id not in previous_dict:
                change = AppointmentChange(
                    timestamp=datetime.now().isoformat(),
                    change_type='new',
                    appointment_id=app_id,
                    studio=int(app.get('STUDIO', 0)),
                    patient_name=app.get('PAZIENTE', 'N/A'),
                    appointment_date=app.get('DATA', ''),
                    appointment_time=convert_gestionale_time_to_standard(app.get('ORA', '')),
                    new_data=app,
                    details=f"Nuovo appuntamento per {app.get('PAZIENTE', 'N/A')}"
                )
                tracker.track_change(change)
                changes_count += 1
                logger.info(f"NUOVO appuntamento rilevato: {app.get('PAZIENTE', 'N/A')} - {app.get('DATA', '')} {convert_gestionale_time_to_standard(app.get('ORA', ''))}")
        
        # Trova appuntamenti cancellati
        for app_id, app in previous_dict.items():
            if app_id not in current_dict:
                change = AppointmentChange(
                    timestamp=datetime.now().isoformat(),
                    change_type='deleted',
                    appointment_id=app_id,
                    studio=int(app.get('STUDIO', 0)),
                    patient_name=app.get('PAZIENTE', 'N/A'),
                    appointment_date=app.get('DATA', ''),
                    appointment_time=convert_gestionale_time_to_standard(app.get('ORA', '')),
                    old_data=app,
                    details=f"Appuntamento cancellato per {app.get('PAZIENTE', 'N/A')}"
                )
                tracker.track_change(change)
                changes_count += 1
                logger.info(f"CANCELLATO appuntamento rilevato: {app.get('PAZIENTE', 'N/A')} - {app.get('DATA', '')} {convert_gestionale_time_to_standard(app.get('ORA', ''))}")
        
        # Trova appuntamenti modificati
        for app_id, current_app in current_dict.items():
            if app_id in previous_dict:
                previous_app = previous_dict[app_id]
                
                # Confronta campi chiave
                if _appointment_changed(previous_app, current_app):
                    change_type = 'modified'
                    details = _get_change_details(previous_app, current_app)
                    
                    change = AppointmentChange(
                        timestamp=datetime.now().isoformat(),
                        change_type=change_type,
                        appointment_id=app_id,
                        studio=int(current_app.get('STUDIO', 0)),
                        patient_name=current_app.get('PAZIENTE', 'N/A'),
                        appointment_date=current_app.get('DATA', ''),
                        appointment_time=convert_gestionale_time_to_standard(current_app.get('ORA', '')),
                        old_data=previous_app,
                        new_data=current_app,
                        details=details
                    )
                    tracker.track_change(change)
                    changes_count += 1
                    logger.info(f"MODIFICATO appuntamento rilevato: {current_app.get('PAZIENTE', 'N/A')} - {details}")
        
        return changes_count
        
    except Exception as e:
        logger.error(f"Error analyzing changes: {e}")
        return 0

def _read_appunta_only(table_name: str, file_path: str = None) -> List[Dict[str, Any]]:
    """Legge solo il file DBF specificato senza join con pazienti (stesso metodo dello SnapshotManager)."""
    try:
        import os
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
            # Converti in dict semplice con conversione date e mapping campi
            record_dict = {}
            for field, value in record.items():
                # Converti date in stringhe per JSON serialization
                if hasattr(value, 'isoformat'):  # datetime/date objects
                    record_dict[field] = value.isoformat()
                else:
                    record_dict[field] = value
            
            # Mappa i campi DBF ai nomi che si aspetta il ChangesTracker
            mapped_record = {
                'DATA': record_dict.get('DB_APDATA', ''),
                'ORA': record_dict.get('DB_APOREIN', ''),
                'STUDIO': record_dict.get('DB_APSTUDI', ''),
                'PAZIENTE': record_dict.get('DB_APPACOD', ''),  # Codice paziente
                'MEDICO': record_dict.get('DB_APMEDIC', ''),
                'ORA_FINE': record_dict.get('DB_APOREOU', ''),
                'TIPO': record_dict.get('DB_GUARDIA', ''),
                'NOTE': record_dict.get('DB_NOTE', ''),
                'DESCRIZIONE': record_dict.get('DB_APDESCR', ''),
                # Mantieni anche i campi originali per compatibilità
                **record_dict
            }
            records.append(mapped_record)
        
        logger.debug(f"Read {len(records)} records from {table_name}")
        return records
        
    except Exception as e:
        logger.error(f"Error reading {table_name}: {e}")
        return []

def _appointment_changed(old_app: Dict[str, Any], new_app: Dict[str, Any]) -> bool:
    """Verifica se un appuntamento è cambiato confrontando campi chiave"""
    try:
        # Campi da confrontare
        key_fields = ['DATA', 'ORA', 'PAZIENTE', 'STUDIO', 'NOTE', 'TIPO']
        
        for field in key_fields:
            old_value = old_app.get(field, '')
            new_value = new_app.get(field, '')
            
            if str(old_value).strip() != str(new_value).strip():
                return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error comparing appointments: {e}")
        return False

def _get_change_details(old_app: Dict[str, Any], new_app: Dict[str, Any]) -> str:
    """Genera descrizione dettagliata dei cambiamenti"""
    try:
        changes = []
        
        # Confronta campi chiave
        key_fields = {
            'DATA': 'Data',
            'ORA': 'Ora',
            'PAZIENTE': 'Paziente',
            'STUDIO': 'Studio',
            'NOTE': 'Note',
            'TIPO': 'Tipo'
        }
        
        for field, label in key_fields.items():
            old_value = old_app.get(field, '')
            new_value = new_app.get(field, '')
            
            # Converti orari se necessario
            if field == 'ORA':
                old_value = convert_gestionale_time_to_standard(old_value)
                new_value = convert_gestionale_time_to_standard(new_value)
            
            if str(old_value).strip() != str(new_value).strip():
                changes.append(f"{label}: '{old_value}' → '{new_value}'")
        
        if changes:
            return f"Modifiche: {', '.join(changes)}"
        else:
            return "Appuntamento modificato"
            
    except Exception as e:
        logger.error(f"Error generating change details: {e}")
        return "Appuntamento modificato"
