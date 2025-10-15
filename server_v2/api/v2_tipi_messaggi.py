"""
API endpoints for managing message types (tipi_di_messaggi).
Provides full CRUD functionality for message types.
"""

from flask import Blueprint, jsonify, request
from core.database_manager import get_database_manager, DatabaseError
import logging

# Configura il logger
logger = logging.getLogger(__name__)

# Crea il Blueprint
tipi_messaggi_bp = Blueprint('tipi_messaggi_bp', __name__)

db_manager = get_database_manager()

@tipi_messaggi_bp.route('/', methods=['GET'])
def get_tipi_messaggi():
    """Get all message types, ordered by name."""
    try:
        query = "SELECT * FROM tipi_di_messaggi ORDER BY nome;"
        tipi = db_manager.execute_query(query, fetch_all=True)
        return jsonify({'success': True, 'data': tipi})
    except DatabaseError as e:
        logger.error(f"Error fetching tipi_di_messaggi: {e}")
        return jsonify({'success': False, 'error': 'Errore nel recupero dei tipi di messaggio'}), 500

@tipi_messaggi_bp.route('/<int:tipo_id>', methods=['GET'])
def get_tipo_messaggio(tipo_id):
    """Get a single message type by its ID."""
    try:
        query = "SELECT * FROM tipi_di_messaggi WHERE id = ?;"
        tipo = db_manager.execute_query(query, (tipo_id,), fetch_one=True)
        if tipo:
            return jsonify({'success': True, 'data': tipo})
        else:
            return jsonify({'success': False, 'error': 'Tipo di messaggio non trovato'}), 404
    except DatabaseError as e:
        logger.error(f"Error fetching tipo_di_messaggio with id {tipo_id}: {e}")
        return jsonify({'success': False, 'error': 'Errore nel recupero del tipo di messaggio'}), 500

@tipi_messaggi_bp.route('/', methods=['POST'])
def create_tipo_messaggio():
    """Create a new message type."""
    data = request.get_json()
    if not data or not data.get('codice') or not data.get('nome'):
        return jsonify({'success': False, 'error': 'Dati mancanti: "codice" e "nome" sono obbligatori'}), 400

    codice = data['codice']
    nome = data['nome']
    descrizione = data.get('descrizione', '')

    try:
        query = "INSERT INTO tipi_di_messaggi (codice, nome, descrizione) VALUES (?, ?, ?);"
        with db_manager.transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (codice, nome, descrizione))
            new_id = cursor.lastrowid
        
        return jsonify({'success': True, 'data': {'id': new_id, **data}}), 201
    except DatabaseError as e:
        # Gestisce l'errore di unicità del codice
        if 'UNIQUE constraint failed' in str(e):
            return jsonify({'success': False, 'error': f"Il codice '{codice}' esiste già."}), 409
        logger.error(f"Error creating tipo_messaggio: {e}")
        return jsonify({'success': False, 'error': 'Errore nella creazione del tipo di messaggio'}), 500

@tipi_messaggi_bp.route('/<int:tipo_id>', methods=['PUT'])
def update_tipo_messaggio(tipo_id):
    """Update an existing message type."""
    data = request.get_json()
    if not data or not data.get('codice') or not data.get('nome'):
        return jsonify({'success': False, 'error': 'Dati mancanti: "codice" e "nome" sono obbligatori'}), 400

    try:
        query = "UPDATE tipi_di_messaggi SET codice = ?, nome = ?, descrizione = ? WHERE id = ?;"
        affected_rows = db_manager.execute_query(query, (data['codice'], data['nome'], data.get('descrizione', ''), tipo_id), fetch_all=False)
        if affected_rows > 0:
            return jsonify({'success': True, 'data': {'id': tipo_id, **data}})
        else:
            return jsonify({'success': False, 'error': 'Tipo di messaggio non trovato'}), 404
    except DatabaseError as e:
        logger.error(f"Error updating tipo_messaggio {tipo_id}: {e}")
        return jsonify({'success': False, 'error': 'Errore nell\'aggiornamento del tipo di messaggio'}), 500

@tipi_messaggi_bp.route('/<int:tipo_id>', methods=['DELETE'])
def delete_tipo_messaggio(tipo_id):
    """Delete a message type."""
    # Attenzione: valutare se impedire la cancellazione se ci sono link tracciati che lo usano.
    try:
        query = "DELETE FROM tipi_di_messaggi WHERE id = ?;"
        affected_rows = db_manager.execute_query(query, (tipo_id,), fetch_all=False)
        if affected_rows > 0:
            return jsonify({'success': True, 'message': 'Tipo di messaggio eliminato con successo'})
        else:
            return jsonify({'success': False, 'error': 'Tipo di messaggio non trovato'}), 404
    except DatabaseError as e:
        logger.error(f"Error deleting tipo_messaggio {tipo_id}: {e}")
        return jsonify({'success': False, 'error': 'Errore nell\'eliminazione del tipo di messaggio'}), 500