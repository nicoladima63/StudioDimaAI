from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from server.app.services.classificazione_costi_service import classificazione_service

api_studio_classification = Blueprint('api_studio_classification', __name__, url_prefix='/api/studio')

@api_studio_classification.route('/spesa/auto-classify-sottoconto', methods=['POST'])
@jwt_required()
def auto_classify_spesa_sottoconto():
    """
    Auto-classifica una spesa per assegnare automaticamente il sottoconto
    per fornitori STUDIO/SERVIZI MISTI basandosi sulla descrizione
    """
    try:
        data = request.get_json()
        
        if not data or 'descrizione' not in data:
            return jsonify({
                "success": False,
                "error": "Descrizione richiesta"
            }), 400
        
        descrizione = data.get('descrizione', '')
        contoid = data.get('contoid', 0)
        brancaid = data.get('brancaid', 0)
        
        # Auto-classifica
        risultato = classificazione_service.auto_classify_spesa_sottoconto(
            descrizione=descrizione,
            contoid=contoid,
            brancaid=brancaid
        )
        
        return jsonify({
            "success": True,
            "data": risultato
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@api_studio_classification.route('/test-zzzzzp', methods=['GET'])
@jwt_required()
def test_zzzzzp_classification():
    """
    Testa il sistema di classificazione con i dati reali del fornitore ZZZZZP
    """
    try:
        # Dati di test basati su ZZZZZP
        spese_test = [
            {
                "descrizione": "CORRISPETTIVO PER SUBLOCAZIONE PERIODO GIUGNO  PER IMMOBILE SITO IN VIA BUO",
                "importo": 700.00
            },
            {
                "descrizione": "TeamSystem / Gestione Studio",
                "importo": 0.00
            },
            {
                "descrizione": "Elaborazione buste paga mensili dipendenti",
                "importo": 150.00
            },
            {
                "descrizione": "Tenuta contabilità ordinaria periodo marzo",
                "importo": 250.00
            },
            {
                "descrizione": "Dichiarazione IVA trimestrale",
                "importo": 80.00
            },
            {
                "descrizione": "Consulenza fiscale su detrazioni",
                "importo": 120.00
            },
            {
                "descrizione": "Adempimenti contributivi INPS/INAIL",
                "importo": 90.00
            }
        ]
        
        risultati = []
        
        for spesa in spese_test:
            classificazione = classificazione_service.auto_classify_spesa_sottoconto(
                descrizione=spesa["descrizione"],
                contoid=1,  # STUDIO
                brancaid=1  # SERVIZI MISTI
            )
            
            risultati.append({
                **spesa,
                **classificazione
            })
        
        # Calcola statistiche
        stats = {}
        for r in risultati:
            sottoconto = r['sottoconto_nome']
            if sottoconto not in stats:
                stats[sottoconto] = {'count': 0, 'total_confidence': 0}
            stats[sottoconto]['count'] += 1
            stats[sottoconto]['total_confidence'] += r['confidence']
        
        for sottoconto, data in stats.items():
            data['avg_confidence'] = data['total_confidence'] / data['count']
            data['percentage'] = (data['count'] / len(risultati)) * 100
        
        return jsonify({
            "success": True,
            "data": {
                "spese_classificate": risultati,
                "statistiche": {
                    "totale_spese": len(risultati),
                    "confidence_media": sum(r['confidence'] for r in risultati) / len(risultati),
                    "distribuzione_sottoconti": stats
                },
                "struttura_finale": {
                    "conto": "STUDIO",
                    "branca": "SERVIZI MISTI",
                    "sottoconti_automatici": list(stats.keys())
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500