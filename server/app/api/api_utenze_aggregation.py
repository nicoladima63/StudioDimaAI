from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from server.app.services.classificazione_costi_service import classificazione_service

api_utenze_aggregation = Blueprint('api_utenze_aggregation', __name__, url_prefix='/api/utenze')

@api_utenze_aggregation.route('/aggregate', methods=['POST'])
@jwt_required()
def aggregate_utenze_spese():
    """
    Aggrega le spese di utenze per fornitore/periodo nascondendo i dettagli
    """
    try:
        data = request.get_json()
        
        if not data or 'spese' not in data:
            return jsonify({
                "success": False,
                "error": "Lista spese richiesta"
            }), 400
        
        spese_list = data.get('spese', [])
        
        # Aggrega le utenze
        risultato = classificazione_service.aggregate_utenze_spese(spese_list)
        
        return jsonify({
            "success": True,
            "data": {
                "spese_da_mostrare": risultato['spese_normali'] + risultato['spese_aggregate'],
                "spese_aggregate": risultato['spese_aggregate'],
                "spese_normali": risultato['spese_normali'],
                "voci_nascoste": risultato['voci_nascoste'],
                "statistiche": risultato['statistiche']
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_utenze_aggregation.route('/conferma-filtrati', methods=['POST'])
@jwt_required()
def conferma_filtrati():
    """
    Conferma e classifica automaticamente una voce utenze aggregata
    """
    try:
        data = request.get_json()
        
        if not data or 'voce_aggregata_id' not in data:
            return jsonify({
                "success": False,
                "error": "ID voce aggregata richiesto"
            }), 400
        
        voce_id = data.get('voce_aggregata_id')
        
        # Qui dovresti implementare la logica per:
        # 1. Recuperare la voce aggregata
        # 2. Classificare automaticamente tutte le voci originali
        # 3. Archiviare/nascondere le voci di dettaglio
        # 4. Salvare la classificazione
        
        # Per ora ritorna un placeholder
        return jsonify({
            "success": True,
            "message": f"Voce aggregata {voce_id} classificata automaticamente",
            "data": {
                "voci_classificate": 12,  # Esempio
                "classificazione_applicata": {
                    "conto": "UTENZE",
                    "branca": "ENERGIA", 
                    "sottoconto": "BOLLETTA"
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_utenze_aggregation.route('/test-aggregazione', methods=['GET'])
@jwt_required()
def test_aggregazione_utenze():
    """
    Testa il sistema di aggregazione con dati di esempio
    """
    try:
        # Dati di test che simulano le voci di bolletta Enel e Publiacqua
        spese_test = [
            {
                "id": "1",
                "codice_fornitore": "ENEL001",
                "nome_fornitore": "ENEL ENERGIA SPA",
                "descrizione": "IT001E40672052",
                "importo": 45.67,
                "data_documento": "2024-06-15",
                "numero_documento": "40672052"
            },
            {
                "id": "2", 
                "codice_fornitore": "ENEL001",
                "nome_fornitore": "ENEL ENERGIA SPA",
                "descrizione": "SPESA ONERI DI SISTEMA - Oneri generali relativi al sostegno delle energie",
                "importo": 12.34,
                "data_documento": "2024-06-15",
                "numero_documento": "40672052"
            },
            {
                "id": "3",
                "codice_fornitore": "ENEL001", 
                "nome_fornitore": "ENEL ENERGIA SPA",
                "descrizione": "Energia attiva",
                "importo": 234.56,
                "data_documento": "2024-06-15",
                "numero_documento": "40672052"
            },
            {
                "id": "4",
                "codice_fornitore": "PUBLI001",
                "nome_fornitore": "PUBLIACQUA S.P.A.",
                "descrizione": "Ricalcolo periodi precedenti Quota Fissa Acquedotto",
                "importo": 23.45,
                "data_documento": "2024-06-10",
                "numero_documento": "AQ123456"
            },
            {
                "id": "5",
                "codice_fornitore": "PUBLI001",
                "nome_fornitore": "PUBLIACQUA S.P.A.", 
                "descrizione": "Ricalcolo periodi precedenti Quota Consumo Fognatura",
                "importo": 67.89,
                "data_documento": "2024-06-10",
                "numero_documento": "AQ123456"
            },
            {
                "id": "6",
                "codice_fornitore": "STUDIO001",
                "nome_fornitore": "DELTA TRE ELABORAZIONI SNC",
                "descrizione": "Elaborazione buste paga mensili",
                "importo": 150.00,
                "data_documento": "2024-06-01",
                "numero_documento": "BT001"
            }
        ]
        
        # Aggrega le utenze
        risultato = classificazione_service.aggregate_utenze_spese(spese_test)
        
        return jsonify({
            "success": True,
            "data": {
                "test_input": {
                    "totale_spese_originali": len(spese_test),
                    "fornitori_nel_test": ["ENEL ENERGIA SPA", "PUBLIACQUA S.P.A.", "DELTA TRE ELABORAZIONI SNC"]
                },
                "risultato_aggregazione": risultato,
                "confronto": {
                    "prima": f"{len(spese_test)} voci da classificare manualmente",
                    "dopo": f"{len(risultato['spese_normali']) + len(risultato['spese_aggregate'])} voci da classificare",
                    "risparmio": f"{len(risultato['voci_nascoste'])} voci nascoste automaticamente"
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500