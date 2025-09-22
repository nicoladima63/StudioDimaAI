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
        
        # Ottieni il servizio calendario per leggere i dati aggiornati
        calendar_service = CalendarServiceV2()
        
        # Aspetta un momento per permettere al DBF di essere completamente aggiornato
        import time
        time.sleep(2)
        
        # Leggi tutti gli appuntamenti aggiornati
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Leggi appuntamenti per i prossimi 3 mesi
        all_appointments = []
        for month_offset in range(3):
            month = current_month + month_offset
            year = current_year
            if month > 12:
                month -= 12
                year += 1
            
            try:
                month_appointments = calendar_service.get_db_appointments_for_month(month, year)
                all_appointments.extend(month_appointments)
            except Exception as e:
                logger.warning(f"Error reading appointments for {month:02d}/{year}: {e}")
        
        # Aggiorna i dati degli appuntamenti
        tracker.update_appointments_data(all_appointments)
        
        # Analizza i cambiamenti specifici
        _analyze_and_track_changes(tracker, all_appointments)
        
        logger.info("Appointment change callback completed successfully")
        
    except Exception as e:
        logger.error(f"Error in appointment change callback: {e}")

def _analyze_and_track_changes(tracker, current_appointments: List[Dict[str, Any]]):
    """
    Analizza i cambiamenti confrontando con i dati precedenti.
    
    Args:
        tracker: Istanza del ChangesTracker
        current_appointments: Lista aggiornata degli appuntamenti
    """
    try:
        # Crea dict per accesso rapido
        current_dict = {}
        for app in current_appointments:
            app_id = tracker._generate_appointment_id(app)
            current_dict[app_id] = app
        
        # Confronta con dati precedenti
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
        
    except Exception as e:
        logger.error(f"Error analyzing changes: {e}")

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
