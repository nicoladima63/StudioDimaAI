"""
API endpoints per il sistema di monitoraggio dei cambiamenti
==========================================================

Endpoints per recuperare e gestire i log dei cambiamenti agli appuntamenti.

Author: Claude Code Studio Architect
Version: 2.0.0
"""

from flask import Blueprint, jsonify, request
import logging
from datetime import datetime, timedelta

from services.changes_tracker import get_changes_tracker

logger = logging.getLogger(__name__)

# Blueprint per le API di monitoraggio cambiamenti
monitoring_changes_bp = Blueprint('monitoring_changes', __name__)

@monitoring_changes_bp.route('/summary', methods=['GET'])
def get_changes_summary():
    """
    Ottiene riepilogo dei cambiamenti per un periodo.
    
    Query parameters:
    - date_from: Data inizio (YYYY-MM-DD)
    - date_to: Data fine (YYYY-MM-DD)
    - days: Numero di giorni da oggi (default: 7)
    """
    try:
        # Parametri di default
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        days = int(request.args.get('days', 7))
        
        # Se non specificate date, usa gli ultimi N giorni
        if not date_from and not date_to:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days-1)
            date_from = start_date.strftime('%Y-%m-%d')
            date_to = end_date.strftime('%Y-%m-%d')
        
        # Ottieni il tracker
        tracker = get_changes_tracker()
        
        # Ottieni riepilogo
        summary = tracker.get_changes_summary(date_from, date_to)
        
        return jsonify({
            'success': True,
            'data': summary,
            'period': {
                'from': date_from,
                'to': date_to
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting changes summary: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitoring_changes_bp.route('/today', methods=['GET'])
def get_today_changes():
    """Ottiene tutti i cambiamenti di oggi"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        
        tracker = get_changes_tracker()
        changes = tracker.get_changes_for_date(today)
        
        return jsonify({
            'success': True,
            'data': {
                'date': today,
                'changes': changes,
                'count': len(changes)
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting today changes: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitoring_changes_bp.route('/date/<date>', methods=['GET'])
def get_changes_for_date(date):
    """
    Ottiene tutti i cambiamenti per una data specifica.
    
    Args:
        date: Data in formato YYYY-MM-DD
    """
    try:
        # Valida formato data
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Formato data non valido. Usa YYYY-MM-DD'
            }), 400
        
        tracker = get_changes_tracker()
        changes = tracker.get_changes_for_date(date)
        
        return jsonify({
            'success': True,
            'data': {
                'date': date,
                'changes': changes,
                'count': len(changes)
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting changes for date {date}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitoring_changes_bp.route('/recent', methods=['GET'])
def get_recent_changes():
    """
    Ottiene i cambiamenti più recenti.
    
    Query parameters:
    - limit: Numero massimo di cambiamenti (default: 20)
    """
    try:
        limit = int(request.args.get('limit', 20))
        
        tracker = get_changes_tracker()
        
        # Ottieni gli ultimi N cambiamenti
        recent_changes = tracker.changes[-limit:] if tracker.changes else []
        
        return jsonify({
            'success': True,
            'data': {
                'changes': recent_changes,
                'count': len(recent_changes),
                'limit': limit
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting recent changes: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitoring_changes_bp.route('/stats', methods=['GET'])
def get_changes_stats():
    """Ottiene statistiche sui cambiamenti"""
    try:
        tracker = get_changes_tracker()
        
        # Statistiche generali
        total_changes = len(tracker.changes)
        total_appointments = len(tracker.appointments_data)
        
        # Statistiche per tipo (ultimi 30 giorni)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        summary_30d = tracker.get_changes_summary(
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        # Statistiche per studio
        studio_stats = {}
        for change in tracker.changes:
            studio = change.get('studio', 0)
            if studio not in studio_stats:
                studio_stats[studio] = {'total': 0, 'new': 0, 'deleted': 0, 'modified': 0}
            
            studio_stats[studio]['total'] += 1
            change_type = change.get('change_type', '')
            if change_type in studio_stats[studio]:
                studio_stats[studio][change_type] += 1
        
        return jsonify({
            'success': True,
            'data': {
                'total_changes': total_changes,
                'total_appointments': total_appointments,
                'last_30_days': summary_30d,
                'by_studio': studio_stats
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting changes stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitoring_changes_bp.route('/clear', methods=['POST'])
def clear_changes():
    """Cancella tutti i log dei cambiamenti"""
    try:
        tracker = get_changes_tracker()
        tracker.changes = []
        tracker._save_changes()
        
        return jsonify({
            'success': True,
            'message': 'Log dei cambiamenti cancellati'
        })
        
    except Exception as e:
        logger.error(f"Error clearing changes: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
