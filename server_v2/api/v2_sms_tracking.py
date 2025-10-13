"""
API endpoints for managing and tracking SMS links.
"""

import uuid
from flask import Blueprint, jsonify, request, current_app
from core.database_manager import get_database_manager, DatabaseError
import logging

# Configura il logger
logger = logging.getLogger(__name__)

# Crea il Blueprint
sms_tracking_bp = Blueprint('sms_tracking_bp', __name__)

db_manager = get_database_manager()

@sms_tracking_bp.route('/', methods=['GET'])
def get_tracked_links():
    """Get a paginated list of tracked links."""
    try:
        # Aggiungiamo paginazione di base
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        offset = (page - 1) * per_page

        query = """
            SELECT l.*, t.nome as tipo_messaggio_nome
            FROM sms_tracked_links l
            JOIN tipi_di_messaggi t ON l.tipo_messaggio_id = t.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?;
        """
        links = db_manager.execute_query(query, (per_page, offset), fetch_all=True)
        
        count_query = "SELECT COUNT(id) as total FROM sms_tracked_links;"
        total = db_manager.execute_query(count_query, fetch_one=True)['total']

        return jsonify({
            'success': True,
            'data': links,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'total_pages': (total + per_page - 1) // per_page
            }
        })
    except DatabaseError as e:
        logger.error(f"Error fetching tracked links: {e}")
        return jsonify({'success': False, 'error': 'Errore nel recupero dei link tracciati'}), 500

@sms_tracking_bp.route('/<int:link_id>', methods=['GET'])
def get_tracked_link(link_id):
    """Get a single tracked link by its ID."""
    try:
        query = """
            SELECT l.*, t.nome as tipo_messaggio_nome, t.codice as tipo_messaggio_codice
            FROM sms_tracked_links l
            JOIN tipi_di_messaggi t ON l.tipo_messaggio_id = t.id
            WHERE l.id = ?;
        """
        link = db_manager.execute_query(query, (link_id,), fetch_one=True)
        if link:
            return jsonify({'success': True, 'data': link})
        else:
            return jsonify({'success': False, 'error': 'Link non trovato'}), 404
    except DatabaseError as e:
        logger.error(f"Error fetching tracked link with id {link_id}: {e}")
        return jsonify({'success': False, 'error': 'Errore nel recupero del link'}), 500

@sms_tracking_bp.route('/', methods=['POST'])
def create_tracked_link():
    """
    Create a new tracked link. This is the core endpoint for generating a link before sending an SMS.
    """
    data = request.get_json()
    if not data or not data.get('paziente_id') or not data.get('tipo_messaggio_id'):
        return jsonify({'success': False, 'error': 'Dati mancanti: "paziente_id" e "tipo_messaggio_id" sono obbligatori'}), 400

    paziente_id = data['paziente_id']
    tipo_messaggio_id = data['tipo_messaggio_id']
    metadata = data.get('metadata') # Può essere un dizionario/JSON
    
    # URL di destinazione: per ora usiamo un valore fisso, in futuro potrebbe venire dalla richiesta
    # o essere associato al tipo di messaggio.
    destination_url = "https://www.studiodima.eu"

    # Genera un token unico
    token = str(uuid.uuid4())

    try:
        query = "INSERT INTO sms_tracked_links (token, paziente_id, tipo_messaggio_id, metadata, destination_url) VALUES (?, ?, ?, ?, ?);"
        
        # Se metadata è un dizionario, lo convertiamo in stringa JSON
        import json
        metadata_str = json.dumps(metadata) if metadata else None

        with db_manager.transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (token, paziente_id, tipo_messaggio_id, metadata_str, destination_url))
            new_id = cursor.lastrowid

        # Costruisce l'URL completo leggendolo dalla configurazione dell'app, che cambia in base all'ambiente (dev/prod)
        base_url = current_app.config.get('TRACKED_LINK_BASE_URL', '').rstrip('/')
        if not base_url:
            logger.warning("TRACKED_LINK_BASE_URL non è configurato. Verrà usato un path relativo ('/r'). Questo funzionerà solo per test interni al browser e non da un dispositivo esterno.")
            base_url = '/r'  # Fallback a un path relativo
        full_link = f"{base_url}/{token}"

        return jsonify({
            'success': True,
            'data': {'id': new_id, 'token': token, 'full_link': full_link}
        }), 201

    except DatabaseError as e:
        logger.error(f"Error creating tracked link: {e}")
        return jsonify({'success': False, 'error': 'Errore nella creazione del link tracciato'}), 500


# Nota: Gli endpoint di UPDATE e DELETE per i link tracciati sono omessi volutamente
# in quanto un link generato non dovrebbe essere modificato o eliminato per mantenere l'integrità storica.
# Se necessario, si possono aggiungere in futuro.