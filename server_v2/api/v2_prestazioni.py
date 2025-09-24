"""
🏥 API Prestazioni - Gestione tariffario prestazioni
====================================================

API per recuperare le prestazioni dal file ONORARIO.DBF
raggruppate per categoria per il sistema di monitoraggio.

Author: Claude Code Studio Architect
Version: 1.0.0
"""

from flask import Blueprint, jsonify
from core.constants_v2 import get_campo_dbf, CATEGORIE_PRESTAZIONI
from utils.dbf_utils import clean_dbf_value
import os
import dbf
from core.config_manager import get_config
import logging

logger = logging.getLogger(__name__)

# Blueprint per le API prestazioni
prestazioni_bp = Blueprint('prestazioni', __name__)

def get_prestazioni_from_dbf():
    """Recupera tutte le prestazioni dal file ONORARIO.DBF raggruppate per categoria."""
    try:
        # Path del file ONORARIO.DBF usando ConfigManager
        config = get_config()
        onorario_path = config.get_dbf_path('onorario')
        
        if not os.path.exists(onorario_path):
            logger.error(f"File ONORARIO.DBF non trovato: {onorario_path}")
            return {}
        
        prestazioni_per_categoria = {}
        
        # Leggi il file DBF
        with dbf.Table(onorario_path, codepage='cp1252') as table:
            for record in table:
                if record is None:
                    continue
                
                # Estrai i campi essenziali
                id_prestazione = clean_dbf_value(record[get_campo_dbf('onorario', 'id_prestazione')])
                categoria = clean_dbf_value(record[get_campo_dbf('onorario', 'categoria')])
                nome_prestazione = clean_dbf_value(record[get_campo_dbf('onorario', 'nome_prestazione')])
                costo = clean_dbf_value(record[get_campo_dbf('onorario', 'costo')])
                codice_breve = clean_dbf_value(record[get_campo_dbf('onorario', 'codice_breve')])
                
                # Salta record vuoti o invalidi
                if not id_prestazione or not categoria:
                    continue
                
                # Converti categoria a int se possibile
                try:
                    categoria_int = int(categoria)
                except (ValueError, TypeError):
                    continue
                
                # Crea oggetto prestazione
                prestazione = {
                    'id': id_prestazione,
                    'nome': nome_prestazione or '',
                    'costo': float(costo) if costo else 0.0,
                    'codice_breve': codice_breve or '',
                    'categoria_id': categoria_int,
                    'categoria_nome': CATEGORIE_PRESTAZIONI.get(categoria_int, f'Categoria {categoria_int}')
                }
                
                # Raggruppa per categoria
                if categoria_int not in prestazioni_per_categoria:
                    prestazioni_per_categoria[categoria_int] = {
                        'categoria_id': categoria_int,
                        'categoria_nome': CATEGORIE_PRESTAZIONI.get(categoria_int, f'Categoria {categoria_int}'),
                        'prestazioni': []
                    }
                
                prestazioni_per_categoria[categoria_int]['prestazioni'].append(prestazione)
        
        # Ordina le prestazioni per nome all'interno di ogni categoria
        for categoria_data in prestazioni_per_categoria.values():
            categoria_data['prestazioni'].sort(key=lambda x: x['nome'])
        
        logger.info(f"Caricate {sum(len(cat['prestazioni']) for cat in prestazioni_per_categoria.values())} prestazioni da {len(prestazioni_per_categoria)} categorie")
        
        return prestazioni_per_categoria
        
    except Exception as e:
        logger.error(f"Errore lettura ONORARIO.DBF: {e}")
        return {}

@prestazioni_bp.route('/prestazioni', methods=['GET'])
def get_prestazioni():
    """Endpoint per recuperare tutte le prestazioni raggruppate per categoria."""
    try:
        prestazioni = get_prestazioni_from_dbf()
        
        return jsonify({
            'success': True,
            'data': prestazioni,
            'categorie': CATEGORIE_PRESTAZIONI
        })
        
    except Exception as e:
        logger.error(f"Errore API prestazioni: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@prestazioni_bp.route('/prestazioni/categorie', methods=['GET'])
def get_categorie():
    """Endpoint per recuperare solo le categorie disponibili."""
    try:
        return jsonify({
            'success': True,
            'data': CATEGORIE_PRESTAZIONI
        })
        
    except Exception as e:
        logger.error(f"Errore API categorie: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
