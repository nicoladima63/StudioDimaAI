from flask import Blueprint, request, jsonify
import logging
from server.app.core.protocolli_db import ProtocolliDB, load_initial_data

logger = logging.getLogger(__name__)

protocolli_bp = Blueprint('protocolli', __name__, url_prefix='/api/protocolli')

@protocolli_bp.route('/diagnosi', methods=['GET'])
def get_diagnosi():
    """Recupera tutte le diagnosi"""
    try:
        diagnosi = ProtocolliDB.get_all_diagnosi()
        return jsonify({
            'success': True,
            'diagnosi': diagnosi
        })
    except Exception as e:
        logger.error(f"Errore recupero diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi', methods=['POST'])
def create_diagnosi():
    """Crea una nuova diagnosi"""
    try:
        data = request.json
        success = ProtocolliDB.create_diagnosi(
            data['id'],
            data['codice'], 
            data['descrizione']
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Diagnosi già esistente'}), 400
            
    except Exception as e:
        logger.error(f"Errore creazione diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi/<diagnosi_id>', methods=['PUT'])
def update_diagnosi(diagnosi_id):
    """Aggiorna una diagnosi esistente"""
    try:
        data = request.json
        success = ProtocolliDB.update_diagnosi(
            diagnosi_id,
            data['codice'],
            data['descrizione']
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Diagnosi non trovata'}), 404
            
    except Exception as e:
        logger.error(f"Errore aggiornamento diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi/<diagnosi_id>/duplicate', methods=['POST'])
def duplicate_diagnosi(diagnosi_id):
    """Duplica una diagnosi con tutte le sue associazioni"""
    try:
        data = request.json
        success = ProtocolliDB.duplicate_diagnosi(
            diagnosi_id,
            data['new_id'],
            data['new_codice'],
            data['new_descrizione']
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Errore nella duplicazione'}), 400
            
    except Exception as e:
        logger.error(f"Errore duplicazione diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi/<diagnosi_id>', methods=['DELETE'])
def delete_diagnosi(diagnosi_id):
    """Elimina una diagnosi"""
    try:
        success = ProtocolliDB.delete_diagnosi(diagnosi_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Diagnosi non trovata'}), 404
            
    except Exception as e:
        logger.error(f"Errore eliminazione diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi/<int:diagnosi_id>/protocolli', methods=['GET'])
def get_protocolli_diagnosi(diagnosi_id):
    """Recupera protocolli terapeutici per una diagnosi"""
    try:
        protocolli = ProtocolliDB.get_protocolli_per_diagnosi(diagnosi_id)
        return jsonify({
            'success': True,
            'protocolli': protocolli
        })
    except Exception as e:
        logger.error(f"Errore recupero protocolli per diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi/<diagnosi_id>/farmaci', methods=['POST'])
def add_farmaco_to_diagnosi(diagnosi_id):
    """Aggiunge un farmaco a una diagnosi"""
    try:
        data = request.json
        success = ProtocolliDB.add_farmaco_to_diagnosi(
            diagnosi_id,
            data['farmaco_codice'],
            data['posologia'],
            data['durata'],
            data.get('note', '')
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Associazione già esistente'}), 400
            
    except Exception as e:
        logger.error(f"Errore aggiunta farmaco a diagnosi: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/farmaci-associazioni/<int:associazione_id>', methods=['PUT'])
def update_farmaco_associazione(associazione_id):
    """Aggiorna un'associazione farmaco"""
    try:
        data = request.json
        success = ProtocolliDB.update_farmaco_associazione(
            associazione_id,
            data['posologia'],
            data['durata'],
            data.get('note', '')
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Associazione non trovata'}), 404
            
    except Exception as e:
        logger.error(f"Errore aggiornamento associazione: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/farmaci-associazioni/<int:associazione_id>', methods=['DELETE'])
def delete_farmaco_associazione(associazione_id):
    """Elimina un'associazione farmaco"""
    try:
        success = ProtocolliDB.delete_farmaco_associazione(associazione_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Associazione non trovata'}), 404
            
    except Exception as e:
        logger.error(f"Errore eliminazione associazione: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/farmaci', methods=['GET'])
def get_farmaci():
    """Recupera tutti i farmaci disponibili, opzionalmente filtrati per categoria"""
    try:
        categoria = request.args.get('categoria')
        farmaci = ProtocolliDB.get_all_farmaci(categoria)
        return jsonify({
            'success': True,
            'farmaci': farmaci
        })
    except Exception as e:
        logger.error(f"Errore recupero farmaci: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/categorie-farmaci', methods=['GET'])
def get_categorie_farmaci():
    """Recupera tutte le categorie di farmaci"""
    try:
        categorie = ProtocolliDB.get_categorie_farmaci()
        return jsonify({
            'success': True,
            'categorie': categorie
        })
    except Exception as e:
        logger.error(f"Errore recupero categorie farmaci: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# API per protocolli terapeutici
@protocolli_bp.route('/protocolli', methods=['POST'])
def create_protocollo():
    """Crea un nuovo protocollo terapeutico"""
    try:
        data = request.json
        protocollo_id = ProtocolliDB.create_protocollo(
            data['diagnosiId'],
            data['farmacoId'],
            data.get('posologia_custom'),
            data.get('durata_custom'),
            data.get('note_custom'),
            data.get('ordine', 0)
        )
        
        if protocollo_id:
            return jsonify({'success': True, 'protocollo_id': protocollo_id})
        else:
            return jsonify({'success': False, 'error': 'Errore nella creazione'}), 400
            
    except Exception as e:
        logger.error(f"Errore creazione protocollo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/protocolli/<int:protocollo_id>', methods=['PUT'])
def update_protocollo(protocollo_id):
    """Aggiorna un protocollo terapeutico esistente"""
    try:
        data = request.json
        success = ProtocolliDB.update_protocollo(
            protocollo_id,
            data.get('posologia_custom'),
            data.get('durata_custom'),
            data.get('note_custom'),
            data.get('ordine')
        )
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Protocollo non trovato'}), 404
            
    except Exception as e:
        logger.error(f"Errore aggiornamento protocollo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/protocolli/<int:protocollo_id>', methods=['DELETE'])
def delete_protocollo(protocollo_id):
    """Elimina un protocollo terapeutico"""
    try:
        success = ProtocolliDB.delete_protocollo(protocollo_id)
        
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Protocollo non trovato'}), 404
            
    except Exception as e:
        logger.error(f"Errore eliminazione protocollo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/diagnosi/<int:diagnosi_id>/duplicate-with-protocolli', methods=['POST'])
def duplicate_diagnosi_with_protocolli(diagnosi_id):
    """Duplica una diagnosi con tutti i suoi protocolli"""
    try:
        data = request.json
        new_diagnosi_id = ProtocolliDB.duplicate_diagnosi_with_protocolli(
            diagnosi_id,
            data['new_codice'],
            data['new_descrizione'],
            data.get('new_categoria')
        )
        
        if new_diagnosi_id:
            return jsonify({'success': True, 'new_diagnosi_id': new_diagnosi_id})
        else:
            return jsonify({'success': False, 'error': 'Errore nella duplicazione'}), 400
            
    except Exception as e:
        logger.error(f"Errore duplicazione diagnosi con protocolli: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@protocolli_bp.route('/reload-data', methods=['POST'])
def reload_initial_data():
    """Ricarica i dati iniziali dai file txt"""
    try:
        load_initial_data()
        return jsonify({'success': True, 'message': 'Dati ricaricati con successo'})
    except Exception as e:
        logger.error(f"Errore ricaricamento dati: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500