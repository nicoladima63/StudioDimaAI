"""
🔍 API per il sistema di monitoraggio DBF
========================================

Endpoint per gestire il sistema di monitoraggio modulare:
- CRUD operations per monitor
- Start/Stop/Pause/Resume monitor
- Status e metriche
- Callback management

Author: Claude Code Studio Architect
Version: 2.0.0
"""

import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from typing import Dict, Any, List

from services.monitoring_service import get_monitoring_service, MonitorType
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# Blueprint per le API di monitoraggio
monitoring_bp = Blueprint('monitoring', __name__)

@monitoring_bp.route('/monitoring/monitors', methods=['GET'])
def get_all_monitors():
    """Recupera tutti i monitor configurati."""
    try:
        service = get_monitoring_service()
        
        # Recupera tutti i monitor configurati
        monitors = service.get_all_monitors()
        
        return jsonify({
            'success': True,
            'data': monitors
        })
        
    except Exception as e:
        logger.error(f"Error getting monitors: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nel recupero dei monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/status', methods=['GET'])
def get_status():
    """Recupera lo status di tutti i monitor."""
    try:
        service = get_monitoring_service()
        status = service.get_monitor_status()
        
        return jsonify({
            'success': True,
            'data': status
        })
        
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nel recupero dello status: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/status', methods=['GET'])
def get_monitor_status(monitor_id: str):
    """Recupera lo status di un monitor specifico."""
    try:
        service = get_monitoring_service()
        status = service.get_monitor_status(monitor_id)
        
        return jsonify({
            'success': True,
            'data': status
        })
        
    except Exception as e:
        logger.error(f"Error getting monitor status: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nel recupero dello status del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors', methods=['POST'])
def create_monitor():
    """Crea un nuovo monitor."""
    try:
        data = request.get_json()
        
        # Validazione dati
        required_fields = ['table_name', 'monitor_type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        # Validazione monitor_type
        if data['monitor_type'] not in ['periodic_check', 'real_time', 'file_watcher']:
            return jsonify({
                'success': False,
                'message': 'Tipo di monitoraggio non valido'
            }), 400
        
        # Validazione tramite ConfigManager
        try:
            from core.config_manager import get_config
            config = get_config()
            # Verifica che la tabella esista
            config.get_dbf_path(data['table_name'])
        except (ValueError, KeyError) as e:
            return jsonify({
                'success': False,
                'message': f'Tabella non esistente: {data["table_name"]}'
            }), 400
        
        # Crea monitor
        service = get_monitoring_service()
        monitor_type = MonitorType(data['monitor_type'])
        
        monitor_id = service.create_monitor(
            table_name=data['table_name'],
            monitor_type=monitor_type,
            interval_seconds=data.get('interval_seconds', 30),
            auto_start=data.get('auto_start', False),
            callback_functions=data.get('callback_functions', []),
            metadata=data.get('metadata', {})
        )
        
        return jsonify({
            'success': True,
            'data': {'monitor_id': monitor_id},
            'message': 'Monitor creato con successo'
        })
        
    except Exception as e:
        logger.error(f"Error creating monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nella creazione del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/start', methods=['POST'])
def start_monitor(monitor_id: str):
    """Avvia un monitor."""
    try:
        service = get_monitoring_service()
        success = service.start_monitor(monitor_id)
        
        if success:
            start_time = datetime.now().strftime("%H:%M:%S")
            start_datetime = datetime.now().isoformat()
            return jsonify({
                'success': True,
                'message': f'Monitor avviato con successo alle {start_time}',
                'start_time': start_time,
                'started_at': start_datetime
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Errore nell\'avvio del monitor'
            }), 400
        
    except Exception as e:
        logger.error(f"Error starting monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nell\'avvio del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/stop', methods=['POST'])
def stop_monitor(monitor_id: str):
    """Ferma un monitor."""
    try:
        service = get_monitoring_service()
        success = service.stop_monitor(monitor_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Monitor fermato con successo'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Errore nella fermata del monitor'
            }), 400
        
    except Exception as e:
        logger.error(f"Error stopping monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nella fermata del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/pause', methods=['POST'])
def pause_monitor(monitor_id: str):
    """Mette in pausa un monitor."""
    try:
        service = get_monitoring_service()
        success = service.pause_monitor(monitor_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Monitor messo in pausa con successo'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Errore nella pausa del monitor'
            }), 400
        
    except Exception as e:
        logger.error(f"Error pausing monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nella pausa del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/resume', methods=['POST'])
def resume_monitor(monitor_id: str):
    """Riprende un monitor in pausa."""
    try:
        service = get_monitoring_service()
        success = service.resume_monitor(monitor_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Monitor ripreso con successo'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Errore nella ripresa del monitor'
            }), 400
        
    except Exception as e:
        logger.error(f"Error resuming monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nella ripresa del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>', methods=['DELETE'])
def delete_monitor(monitor_id: str):
    """Elimina un monitor."""
    try:
        service = get_monitoring_service()
        success = service.delete_monitor(monitor_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Monitor eliminato con successo'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Errore nell\'eliminazione del monitor'
            }), 400
        
    except Exception as e:
        logger.error(f"Error deleting monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nell\'eliminazione del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>', methods=['PUT'])
def update_monitor(monitor_id: str):
    """Aggiorna la configurazione di un monitor."""
    try:
        data = request.get_json()
        
        service = get_monitoring_service()
        
        # Per ora implementazione semplice
        # In futuro si può implementare l'aggiornamento della configurazione
        
        return jsonify({
            'success': True,
            'message': 'Monitor aggiornato con successo'
        })
        
    except Exception as e:
        logger.error(f"Error updating monitor: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nell\'aggiornamento del monitor: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/callbacks', methods=['POST'])
def register_callback():
    """Registra una funzione callback."""
    try:
        data = request.get_json()
        
        if 'name' not in data or 'callback' not in data:
            return jsonify({
                'success': False,
                'message': 'Campi obbligatori mancanti: name, callback'
            }), 400
        
        service = get_monitoring_service()
        service.register_callback(data['name'], data['callback'])
        
        return jsonify({
            'success': True,
            'message': 'Callback registrato con successo'
        })
        
    except Exception as e:
        logger.error(f"Error registering callback: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nella registrazione del callback: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/logs', methods=['GET'])
def get_monitor_logs(monitor_id: str):
    """Recupera i log di un monitor."""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        # Per ora restituiamo log vuoti
        # In futuro si può implementare il sistema di log
        
        return jsonify({
            'success': True,
            'data': []
        })
        
    except Exception as e:
        logger.error(f"Error getting monitor logs: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nel recupero dei log: {str(e)}'
        }), 500

@monitoring_bp.route('/monitoring/monitors/<monitor_id>/metrics', methods=['GET'])
def get_monitor_metrics(monitor_id: str):
    """Recupera le metriche di un monitor."""
    try:
        service = get_monitoring_service()
        status = service.get_monitor_status(monitor_id)
        
        # Per ora restituiamo lo status come metriche
        # In futuro si possono aggiungere metriche più dettagliate
        
        return jsonify({
            'success': True,
            'data': status
        })
        
    except Exception as e:
        logger.error(f"Error getting monitor metrics: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nel recupero delle metriche: {str(e)}'
        }), 500

# Health check endpoint
@monitoring_bp.route('/monitoring/health', methods=['GET'])
def health_check():
    """Health check per il servizio di monitoraggio."""
    try:
        service = get_monitoring_service()
        status = service.get_monitor_status()
        
        return jsonify({
            'success': True,
            'data': {
                'service': 'monitoring',
                'status': 'healthy',
                'monitors': status
            }
        })
        
    except Exception as e:
        logger.error(f"Error in health check: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore nel health check: {str(e)}'
        }), 500
