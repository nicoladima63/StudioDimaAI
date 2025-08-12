from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from server.app.services.classificazione_costi_service import classificazione_service
from server.app.services.conti_service import conti_service

api_classificazioni = Blueprint('api_classificazioni', __name__, url_prefix='/api/classificazioni')

@api_classificazioni.route('/fornitore/<fornitore_id>', methods=['PUT'])
@jwt_required()
def classifica_fornitore(fornitore_id):
    """
    Classifica un fornitore come diretto/indiretto/non_deducibile
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Dati JSON richiesti"
            }), 400
        
        tipo_di_costo = data.get('tipo_di_costo')
        categoria = data.get('categoria')
        categoria_conto = data.get('categoria_conto')  # Nuovo campo
        note = data.get('note')
        
        if tipo_di_costo not in [1, 2, 3]:
            return jsonify({
                "success": False,
                "error": "tipo_di_costo deve essere 1 (diretto), 2 (indiretto) o 3 (non_deducibile)"
            }), 400
        
        success = classificazione_service.classifica_fornitore(
            codice_fornitore=fornitore_id,
            tipo_di_costo=tipo_di_costo,
            categoria=categoria,
            categoria_conto=categoria_conto,
            note=note
        )
        
        if success:
            classificazione = classificazione_service.get_classificazione_fornitore(fornitore_id)
            return jsonify({
                "success": True,
                "message": "Fornitore classificato con successo",
                "data": classificazione
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Errore nella classificazione del fornitore"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/spesa/<spesa_id>', methods=['PUT'])
@jwt_required()
def classifica_spesa(spesa_id):
    """
    Classifica una spesa come diretta/indiretta/non_deducibile (fallback se AI non funziona)
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Dati JSON richiesti"
            }), 400
        
        tipo_di_costo = data.get('tipo_di_costo')
        categoria = data.get('categoria')
        note = data.get('note')
        
        if tipo_di_costo not in [1, 2, 3]:
            return jsonify({
                "success": False,
                "error": "tipo_di_costo deve essere 1 (diretto), 2 (indiretto) o 3 (non_deducibile)"
            }), 400
        
        success = classificazione_service.classifica_spesa(
            codice_spesa=spesa_id,
            tipo_di_costo=tipo_di_costo,
            categoria=categoria,
            note=note
        )
        
        if success:
            classificazione = classificazione_service.get_classificazione_spesa(spesa_id)
            return jsonify({
                "success": True,
                "message": "Spesa classificata con successo",
                "data": classificazione
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Errore nella classificazione della spesa"
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/fornitore/<fornitore_id>', methods=['GET'])
@jwt_required()
def get_classificazione_fornitore(fornitore_id):
    """
    Ottiene la classificazione di un fornitore
    """
    try:
        classificazione = classificazione_service.get_classificazione_fornitore(fornitore_id)
        
        if classificazione:
            return jsonify({
                "success": True,
                "data": classificazione
            }), 200
        else:
            return jsonify({
                "success": True,
                "data": None,
                "message": "Fornitore non classificato"
            }), 200
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/spesa/<spesa_id>', methods=['GET'])
@jwt_required()
def get_classificazione_spesa(spesa_id):
    """
    Ottiene la classificazione di una spesa
    """
    try:
        classificazione = classificazione_service.get_classificazione_spesa(spesa_id)
        
        if classificazione:
            return jsonify({
                "success": True,
                "data": classificazione
            }), 200
        else:
            return jsonify({
                "success": True,
                "data": None,
                "message": "Spesa non classificata"
            }), 200
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/fornitori', methods=['GET'])
@jwt_required()
def get_fornitori_classificati():
    """
    Ottiene tutti i fornitori classificati
    """
    try:
        fornitori = classificazione_service.get_fornitori_classificati()
        
        return jsonify({
            "success": True,
            "data": fornitori,
            "count": len(fornitori)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/spese', methods=['GET'])
@jwt_required()
def get_spese_classificate():
    """
    Ottiene tutte le spese classificate
    """
    try:
        spese = classificazione_service.get_spese_classificate()
        
        return jsonify({
            "success": True,
            "data": spese,
            "count": len(spese)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/fornitore/<fornitore_id>', methods=['DELETE'])
@jwt_required()
def rimuovi_classificazione_fornitore(fornitore_id):
    """
    Rimuove la classificazione di un fornitore
    """
    try:
        success = classificazione_service.rimuovi_classificazione_fornitore(fornitore_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Classificazione fornitore rimossa con successo"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Classificazione non trovata o errore nella rimozione"
            }), 404
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/spesa/<spesa_id>', methods=['DELETE'])
@jwt_required()
def rimuovi_classificazione_spesa(spesa_id):
    """
    Rimuove la classificazione di una spesa
    """
    try:
        success = classificazione_service.rimuovi_classificazione_spesa(spesa_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Classificazione spesa rimossa con successo"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Classificazione non trovata o errore nella rimozione"
            }), 404
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/statistiche', methods=['GET'])
@jwt_required()
def get_statistiche_classificazioni():
    """
    Ottiene statistiche sulle classificazioni
    """
    try:
        statistiche = classificazione_service.get_statistiche_classificazioni()
        
        return jsonify({
            "success": True,
            "data": statistiche
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_classificazioni.route('/categorie-spesa', methods=['GET'])
@jwt_required()
def get_categorie_spesa():
    """
    Ottiene tutte le categorie di spesa da CONTI.DBF
    """
    try:
        categorie = conti_service.get_categorie_spesa()
        
        return jsonify({
            "success": True,
            "data": categorie,
            "count": len(categorie)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@api_classificazioni.route('/fornitore/<fornitore_id>/suggest-categoria', methods=['GET'])
@jwt_required()
def suggest_categoria_fornitore(fornitore_id):
    """
    Suggerisce automaticamente una categoria per un fornitore basandosi su:
    - Nome del fornitore
    - Storico delle fatture
    - Algoritmi di pattern matching (incluso sistema collaboratori)
    """
    try:
        from server.services.collaboratori_service import init_collaboratori_service
        
        # Prima verifica se è un collaboratore (massima priorità)
        try:
            collaboratori_service = init_collaboratori_service()
            collaboratori_attivi = collaboratori_service.get_collaboratori_confermati()
            
            for collab in collaboratori_attivi:
                if collab['codice_fornitore'] == fornitore_id:
                    # È un collaboratore - suggeriamo la categoria collaboratori appropriata
                    tipo_collaboratore = collab.get('tipo', 'Collaboratori')
                    
                    # Mapping dei tipi collaboratore alle categorie conto
                    categoria_mapping = {
                        'Chirurgia': 'ZZZZXO',  # Sottoconto chirurgia  
                        'Ortodonzia': 'ZZZZXP',  # Sottoconto ortodonzia
                        'Igienista': 'ZZZZYB',   # Sottoconto igienista
                    }
                    
                    categoria_suggerita = categoria_mapping.get(tipo_collaboratore, 'ZZZZZI')  # Default collaboratori
                    
                    return jsonify({
                        "success": True,
                        "data": {
                            "categoria_suggerita": categoria_suggerita,
                            "confidence": 1.0,
                            "motivo": f"Collaboratore identificato - {tipo_collaboratore}",
                            "algoritmo": "collaboratori_diretti"
                        }
                    }), 200
                    
        except Exception as e:
            print(f"Errore controllo collaboratori per {fornitore_id}: {e}")
        
        # Se non è collaboratore, usiamo altri algoritmi di categorizzazione
        # TODO: Implementare algoritmi per:
        # - Fornitori materiali dentali (keywords: dental, materiali, implant, etc.)  
        # - Fornitori servizi (keywords: energia, telefono, assicurazione, etc.)
        # - Fornitori farmaceutici (keywords: farmacia, medicinali, etc.)
        # - Laboratori (keywords: laboratorio, protesi, etc.)
        
        # Per ora returnamo "da classificare"
        return jsonify({
            "success": True,
            "data": {
                "categoria_suggerita": None,
                "confidence": 0.0,
                "motivo": "Nessun pattern riconosciuto - classificazione manuale richiesta",
                "algoritmo": "nessuno"
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@api_classificazioni.route('/conti', methods=['GET'])
# @jwt_required()  # Temporaneamente rimosso per testing
def get_conti_contabili():
    """
    Ottiene tutti i conti contabili disponibili
    """
    try:
        conti = classificazione_service.get_conti_contabili()
        return jsonify({
            "success": True,
            "data": conti,
            "count": len(conti)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@api_classificazioni.route('/conti/<codice_conto>/sottoconti', methods=['GET'])
@jwt_required()
def get_sottoconti_per_conto(codice_conto):
    """
    Ottiene tutti i sottoconti per un conto specifico
    """
    try:
        sottoconti = classificazione_service.get_sottoconti_per_conto(codice_conto)
        return jsonify({
            "success": True,
            "data": sottoconti,
            "count": len(sottoconti),
            "conto_padre": codice_conto
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@api_classificazioni.route('/conti-sottoconti/count', methods=['GET'])
@jwt_required()
def get_count_conti_sottoconti():
    """
    Ottiene il conteggio di conti e sottoconti per il caching intelligente
    """
    try:
        counts = classificazione_service.get_count_conti_sottoconti()
        return jsonify({
            "success": True,
            "data": counts
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500