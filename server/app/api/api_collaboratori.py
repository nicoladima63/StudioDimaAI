"""
API endpoints per gestione collaboratori con sistema di apprendimento
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ...services.collaboratori_service import init_collaboratori_service
import os

collaboratori_bp = Blueprint('collaboratori', __name__, url_prefix='/api/collaboratori')

# Inizializza service
DB_PATH = os.environ.get('DATABASE_PATH', 'server/instance/studio_dima.db')
collaboratori_service = init_collaboratori_service(DB_PATH)


@collaboratori_bp.route('/', methods=['GET'])
@jwt_required()
def get_collaboratori_per_interfaccia():
    """
    Endpoint principale per interfaccia select multi
    Restituisce collaboratori confermati + nuovi candidati automatici
    """
    try:
        risultato = collaboratori_service.get_collaboratori_per_interfaccia()
        
        return jsonify({
            'success': True,
            'data': risultato,
            'message': f"Trovati {risultato['totale_confermati']} confermati + {risultato['totale_nuovi']} nuovi candidati"
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Errore nel recupero collaboratori'
        }), 500


@collaboratori_bp.route('/confermati', methods=['GET'])
@jwt_required()
def get_collaboratori_confermati():
    """Solo collaboratori già confermati dall'utente"""
    try:
        collaboratori = collaboratori_service.get_collaboratori_confermati()
        
        return jsonify({
            'success': True,
            'data': collaboratori,
            'count': len(collaboratori)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@collaboratori_bp.route('/candidati', methods=['GET'])
@jwt_required()  
def get_nuovi_candidati():
    """Solo nuovi candidati identificati automaticamente"""
    try:
        candidati = collaboratori_service.get_nuovi_candidati_automatici()
        
        return jsonify({
            'success': True,
            'data': candidati,
            'count': len(candidati),
            'message': f'Identificati {len(candidati)} nuovi candidati automaticamente'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@collaboratori_bp.route('/salva-selezione', methods=['POST'])
@jwt_required()
def salva_selezione_collaboratori():
    """
    Salva la selezione finale dell'utente dalla select multi
    
    Body: {
        "codici_selezionati": ["ZZZZWB", "ZZZZXP", ...],
        "tipi_assegnati": {
            "ZZZZWB": "Chirurgia",
            "ZZZZXP": "Ortodonzia", 
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'codici_selezionati' not in data:
            return jsonify({
                'success': False,
                'error': 'codici_selezionati richiesto'
            }), 400
        
        codici_selezionati = data['codici_selezionati']
        tipi_assegnati = data.get('tipi_assegnati', {})
        
        risultato = collaboratori_service.salva_selezione_utente(
            codici_selezionati, 
            tipi_assegnati
        )
        
        return jsonify({
            'success': True,
            'data': risultato,
            'message': f'Salvati {len(codici_selezionati)} collaboratori'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Errore nel salvare la selezione'
        }), 500


@collaboratori_bp.route('/statistiche', methods=['GET'])  
@jwt_required()
def get_statistiche():
    """Statistiche collaboratori per dashboard"""
    try:
        stats = collaboratori_service.get_statistiche_collaboratori()
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@collaboratori_bp.route('/rimuovi/<codice_fornitore>', methods=['DELETE'])
@jwt_required()
def rimuovi_collaboratore(codice_fornitore):
    """Disattiva un collaboratore (soft delete)"""
    try:
        import sqlite3
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute(
                "SELECT nome FROM collaboratori WHERE codice_fornitore = ? AND attivo = TRUE",
                (codice_fornitore,)
            )
            
            collaboratore = cursor.fetchone()
            if not collaboratore:
                return jsonify({
                    'success': False,
                    'error': 'Collaboratore non trovato'
                }), 404
            
            # Disattiva invece di eliminare
            conn.execute("""
                UPDATE collaboratori 
                SET attivo = FALSE, data_ultima_modifica = CURRENT_TIMESTAMP 
                WHERE codice_fornitore = ?
            """, (codice_fornitore,))
            
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Collaboratore {collaboratore[0]} disattivato'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@collaboratori_bp.route('/aggiorna-tipo/<codice_fornitore>', methods=['PUT'])
@jwt_required()
def aggiorna_tipo_collaboratore(codice_fornitore):
    """
    Aggiorna il tipo di un collaboratore
    Body: {"tipo": "Chirurgia" | "Ortodonzia" | "Igienista"}
    """
    try:
        data = request.get_json()
        
        if not data or 'tipo' not in data:
            return jsonify({
                'success': False,
                'error': 'Campo tipo richiesto'
            }), 400
        
        nuovo_tipo = data['tipo']
        tipi_validi = ['Chirurgia', 'Ortodonzia', 'Igienista']
        
        if nuovo_tipo not in tipi_validi:
            return jsonify({
                'success': False,
                'error': f'Tipo deve essere uno di: {tipi_validi}'
            }), 400
        
        import sqlite3
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute(
                "SELECT nome FROM collaboratori WHERE codice_fornitore = ?",
                (codice_fornitore,)
            )
            
            collaboratore = cursor.fetchone()
            if not collaboratore:
                return jsonify({
                    'success': False,
                    'error': 'Collaboratore non trovato'
                }), 404
            
            conn.execute("""
                UPDATE collaboratori 
                SET tipo = ?, data_ultima_modifica = CURRENT_TIMESTAMP 
                WHERE codice_fornitore = ?
            """, (nuovo_tipo, codice_fornitore))
            
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Tipo di {collaboratore[0]} aggiornato a {nuovo_tipo}'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500