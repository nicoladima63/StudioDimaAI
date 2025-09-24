"""
Monitor Prestazioni API V2 for StudioDimaAI.

API endpoints per il monitoraggio real-time delle prestazioni eseguite.
"""

import logging
import asyncio
import threading
import time
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required
from typing import Dict, Any, Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from app_v2 import require_auth, format_response
from core.exceptions import ValidationError
from core.constants_v2 import get_campo_dbf
# from utils.dbf_utils import read_dbf_file

logger = logging.getLogger(__name__)

# Create blueprint
monitor_prestazioni_bp = Blueprint('monitor_prestazioni', __name__)

# Global state
monitor_state = {
    'is_running': False,
    'prevent_path': None,
    'observer': None,
    'last_state_cache': {},
    'log_callbacks': [],
    'logs': []  # Log persistente per il frontend
}

class PreventFileHandler(FileSystemEventHandler):
    """Handler per modifiche al file PREVENT.DBF."""
    
    def __init__(self):
        self.pending_changes = set()
        self.debounce_timer = None
        self.debounce_delay = 0.0  # Nessun debouncing per test
    
    def on_modified(self, event):
        if event.is_directory or not event.src_path.endswith('PREVENT.DBF'):
            return
        
        # Log immediato per debug
        logger.info(f"File modificato: {event.src_path}")
        
        # Processo immediato senza debouncing
        self._process_changes()
    
    def _process_changes(self):
        logger.info("Processando modifiche in tempo reale")
        analyze_prevent_changes()


def analyze_prevent_changes():
    """Analizza le modifiche al file PREVENT.DBF."""
    try:
        
        # Leggi file attuale
        from dbfread import DBF
        records = []
        try:
            with DBF(monitor_state['prevent_path'], encoding='latin-1') as table:
                for record in table:
                    if record is not None:
                        records.append(record)
        except Exception as e:
            log_message(f"Errore lettura DBF: {str(e)}", "error")
            return
        
        if not records:
            log_message("File vuoto durante analisi", "warning")
            return
        
        # Analizza modifiche - LOGICA CORRETTA
        nuovi_record = []
        modificati_record = []
        
        for i, record in enumerate(records):
            record_id = str(i + 1)  # Usa indice come ID
            guardia = record.get(get_campo_dbf('preventivi', 'stato_prestazione'))
            prlavor = record.get(get_campo_dbf('preventivi', 'codice_prestazione'), '')
            prelcod = record.get(get_campo_dbf('preventivi', 'id_paziente'), '')
            
            # Ottieni nome paziente - versione semplice che funzionava
            nome_paziente = f"Paziente {prelcod}"
            
            # CASO 1: Record completamente nuovo
            if record_id not in monitor_state['last_state_cache']:
                if guardia == 3:  # Eseguito
                    nuovi_record.append({
                        'id': record_id,
                        'prlavor': prlavor,
                        'prelcod': prelcod,
                        'nome_paziente': nome_paziente,
                        'tipo': 'nuovo_eseguito'
                    })
                else:  # Da eseguire/in corso
                    nuovi_record.append({
                        'id': record_id,
                        'prlavor': prlavor,
                        'prelcod': prelcod,
                        'nome_paziente': nome_paziente,
                        'tipo': 'nuovo_da_eseguire'
                    })
            else:
                # CASO 2 e 3: Record esistente, controllo se modificato
                old_state = monitor_state['last_state_cache'][record_id]
                if old_state['guardia'] != guardia:
                    if guardia == 3:  # Passato a eseguito
                        if old_state['guardia'] in [1, 2]:  # Era da eseguire/in corso
                            modificati_record.append({
                                'id': record_id,
                                'prlavor': prlavor,
                                'prelcod': prelcod,
                                'nome_paziente': nome_paziente,
                                'tipo': 'modificato_a_eseguito',
                                'stato_precedente': old_state['guardia']
                            })
            
            # Aggiorna cache con TUTTI i record
            monitor_state['last_state_cache'][record_id] = {
                'guardia': guardia,
                'prlavor': prlavor,
                'prelcod': prelcod
            }
        
        # Invia notifiche
        send_notifications(nuovi_record, modificati_record)
        
    except Exception as e:
        log_message(f"Errore analisi modifiche: {str(e)}", "error")
        logger.error(f"Errore analisi modifiche: {e}")

def send_notifications(nuovi_record, modificati_record):
    """Invia notifiche per le modifiche rilevate."""
    # Notifica nuovi record
    if nuovi_record:
        log_message(f"Rilevati {len(nuovi_record)} record nuovi", "success")
        for record in nuovi_record:
            if record['tipo'] == 'nuovo_eseguito':
                log_message(f"NUOVO ESEGUITO: {record['prlavor']} per {record['nome_paziente']}", "success")
            else:
                log_message(f"NUOVO DA ESEGUIRE: {record['prlavor']} per {record['nome_paziente']}", "info")
    
    # Notifica record modificati
    if modificati_record:
        log_message(f"Trovati {len(modificati_record)} record modificati", "warning")
        for record in modificati_record:
            stato_prec = "da eseguire" if record['stato_precedente'] == 1 else "in corso"
            log_message(f"MODIFICATO A ESEGUITO: {record['prlavor']} per {record['nome_paziente']} (era {stato_prec})", "warning")

def log_message(message: str, log_type: str = "info"):
    """Invia log a tutti i callback registrati e li salva persistentemente."""
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'message': message,
        'type': log_type
    }
    
    # Salva nel log persistente (max 100 log)
    monitor_state['logs'].append(log_entry)
    if len(monitor_state['logs']) > 100:
        monitor_state['logs'] = monitor_state['logs'][-100:]
    
    # Invia a tutti i callback
    for callback in monitor_state['log_callbacks']:
        try:
            callback(log_entry)
        except Exception as e:
            logger.error(f"Errore callback log: {e}")

@monitor_prestazioni_bp.route('/monitor/start', methods=['POST'])
@jwt_required()
def start_monitor():
    """Avvia il monitoraggio delle prestazioni."""
    try:
        if monitor_state['is_running']:
            return format_response(
                success=False,
                error="Monitor già attivo"
            ), 400
        
        # Determina percorso PREVENT.DBF
        data = request.get_json() or {}
        prevent_path = data.get('prevent_path', 'C:/Pixel/WINDENT/DATI/PREVENT.DBF')
        
        # Inizializza cache stato - SALVA TUTTI I RECORD
        try:
            from dbfread import DBF
            monitor_state['last_state_cache'] = {}
            with DBF(prevent_path, encoding='latin-1') as table:
                for i, record in enumerate(table):
                    if record is not None:
                        record_id = str(i + 1)
                        guardia = record.get(get_campo_dbf('preventivi', 'stato_prestazione'))
                        # Salva TUTTI i record (1, 2, 3) per confronto futuro
                        monitor_state['last_state_cache'][record_id] = {
                            'guardia': guardia,
                            'prlavor': record.get(get_campo_dbf('preventivi', 'codice_prestazione'), ''),
                            'prelcod': record.get(get_campo_dbf('preventivi', 'id_paziente'), '')
                        }
            log_message(f"Cache inizializzata con {len(monitor_state['last_state_cache'])} record", "info")
        except Exception as e:
            logger.error(f"Errore inizializzazione cache: {e}")
        
        # Configura file watcher
        file_handler = PreventFileHandler()
        observer = Observer()
        # Estrai directory dal percorso (funziona sia con / che con \)
        import os
        directory = os.path.dirname(prevent_path)
        observer.schedule(file_handler, directory, recursive=False)
        
        # Avvia observer
        observer.start()
        
        monitor_state.update({
            'is_running': True,
            'prevent_path': prevent_path,
            'observer': observer
        })
        
        log_message("Monitor prestazioni avviato", "success")
        
        return format_response(
            success=True,
            message="Monitor avviato con successo",
            data={'prevent_path': prevent_path}
        )
        
    except Exception as e:
        logger.error(f"Errore avvio monitor: {e}")
        return format_response(
            success=False,
            error=f"Errore avvio monitor: {str(e)}"
        ), 500

@monitor_prestazioni_bp.route('/monitor/stop', methods=['POST'])
@jwt_required()
def stop_monitor():
    """Ferma il monitoraggio delle prestazioni."""
    try:
        if not monitor_state['is_running']:
            return format_response(
                success=False,
                error="Monitor non attivo"
            ), 400
        
        if monitor_state['observer']:
            monitor_state['observer'].stop()
            monitor_state['observer'].join()
            monitor_state['observer'] = None
        
        monitor_state.update({
            'is_running': False,
            'prevent_path': None
        })
        
        log_message("Monitor prestazioni fermato", "success")
        
        return format_response(
            success=True,
            message="Monitor fermato con successo"
        )
        
    except Exception as e:
        logger.error(f"Errore stop monitor: {e}")
        return format_response(
            success=False,
            error=f"Errore stop monitor: {str(e)}"
        ), 500

@monitor_prestazioni_bp.route('/monitor/status', methods=['GET'])
@jwt_required()
def get_monitor_status():
    """Restituisce lo stato attuale del monitor."""
    try:
        return format_response(
            success=True,
            data={
                'is_running': monitor_state['is_running'],
                'prevent_path': monitor_state['prevent_path'],
                'cached_records': len(monitor_state['last_state_cache']),
                'last_update': datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Errore recupero stato monitor: {e}")
        return format_response(
            success=False,
            error=f"Errore recupero stato: {str(e)}"
        ), 500

@monitor_prestazioni_bp.route('/monitor/logs', methods=['GET'])
@jwt_required()
def get_monitor_logs():
    """Restituisce i log del monitoraggio."""
    try:
        return format_response(
            success=True,
            data={
                'logs': monitor_state['logs'],
                'message': f'Log persistente ({len(monitor_state["logs"])} entries)'
            }
        )
        
    except Exception as e:
        logger.error(f"Errore recupero log: {e}")
        return format_response(
            success=False,
            error=f"Errore recupero log: {str(e)}"
        ), 500

@monitor_prestazioni_bp.route('/monitor/test', methods=['POST'])
@jwt_required()
def test_monitor():
    """Testa il monitoraggio forzando un'analisi."""
    try:
        if not monitor_state['is_running']:
            return format_response(
                success=False,
                error="Monitor non attivo"
            ), 400
        
        log_message("Test monitoraggio avviato", "info")
        analyze_prevent_changes()
        log_message("Test monitoraggio completato", "success")
        
        return format_response(
            success=True,
            message="Test completato"
        )
        
    except Exception as e:
        logger.error(f"Errore test monitor: {e}")
        return format_response(
            success=False,
            error=f"Errore test: {str(e)}"
        ), 500

@monitor_prestazioni_bp.route('/monitor/clear-logs', methods=['POST'])
@jwt_required()
def clear_monitor_logs():
    """Pulisce i log del monitoraggio."""
    try:
        monitor_state['logs'] = []
        log_message("Log monitoraggio puliti", "info")
        
        return format_response(
            success=True,
            message="Log puliti con successo"
        )
        
    except Exception as e:
        logger.error(f"Errore pulizia log: {e}")
        return format_response(
            success=False,
            error=f"Errore pulizia log: {str(e)}"
        ), 500
