from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
import logging
import os
from server.app.rentri.rentri_client import RentriClient
from server.app.rentri.exceptions import RentriError

logger = logging.getLogger(__name__)
rentri_bp = Blueprint('rentri', __name__, url_prefix='/api/rentri')


def get_rentri_client():
    """Factory per creare istanza RentriClient con configurazione."""
    demo = request.args.get('demo', 'false').lower() == 'true'
    return RentriClient(demo=demo, logger=logger)

@rentri_bp.route('/test-simple', methods=['GET'])
def test_simple():
    """Test endpoint semplice senza dipendenze."""
    return jsonify({'message': 'Test semplice funziona!'}), 200

@rentri_bp.route('/auth-test', methods=['POST', 'OPTIONS'])
@jwt_required()
def auth_test():
    """Testa l'autorizzazione RENTRI con certificato."""
    if request.method == 'OPTIONS':
        return '', 200
    
    response_data = {
        'success': True,
        'message': 'Endpoint auth-test raggiunto con JWT valido!',
        'details': {'test': True}
    }
    
    return jsonify(response_data), 200

@rentri_bp.route('/operatori/me', methods=['GET'])
@jwt_required()
def get_operatore_corrente():
    """Recupera i dati dell'operatore corrente dal certificato."""
    try:
        client = get_rentri_client()
        # L'issuer dal JWT contiene il codice fiscale/operatore_id
        operatore_id = client.issuer
        
        return jsonify({
            'message': 'Operatore corrente',
            'operatore_id': operatore_id
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_operatore_corrente: {e}")
        return jsonify({'error': 'Errore interno del server', 'details': str(e)}), 500

@rentri_bp.route('/operatori', methods=['GET'])
@jwt_required()
def get_operatori():
    """Recupera elenco operatori RENTRI."""
    try:
        client = get_rentri_client()
        num_iscr_ass = request.args.get('num_iscr_ass')
        
        status_code, data = client.get_operatori(num_iscr_ass=num_iscr_ass)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero operatori', 'details': data}), status_code
        
        return jsonify({
            'message': 'Operatori recuperati con successo',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_operatori: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/operatori/<identificativo>/controllo-iscrizione', methods=['GET'])
@jwt_required()
def get_controllo_iscrizione(identificativo):
    """Controlla iscrizione operatore."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_controllo_iscrizione(identificativo)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel controllo iscrizione', 'details': data}), status_code
        
        return jsonify({
            'message': 'Controllo iscrizione completato',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore controllo_iscrizione: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/operatori/<num_iscr>/siti', methods=['GET'])
@jwt_required()
def get_siti(num_iscr):
    """Recupera siti associati all'operatore."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_siti(num_iscr)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero siti', 'details': data}), status_code
        
        return jsonify({
            'message': 'Siti recuperati con successo',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_siti: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/operatori/registri', methods=['POST'])
@jwt_required()
def post_operatore_registro():
    """Crea nuovo registro per operatore."""
    try:
        client = get_rentri_client()
        body = request.get_json()
        
        if not body:
            return jsonify({'error': 'Payload richiesto'}), 400
        
        num_iscr_sito = body.get('num_iscr_sito')
        attivita = body.get('attivita')
        descrizione = body.get('descrizione')
        attivita_rec_smalt = body.get('attivita_rec_smalt')
        
        if not num_iscr_sito or not attivita:
            return jsonify({'error': 'num_iscr_sito e attivita sono obbligatori'}), 400
        
        status_code, data = client.post_operatore_registro(
            num_iscr_sito=num_iscr_sito,
            attivita=attivita,
            descrizione=descrizione,
            attivita_rec_smalt=attivita_rec_smalt
        )
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nella creazione registro', 'details': data}), status_code
        
        return jsonify({
            'message': 'Registro creato con successo',
            'data': data
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Errore post_operatore_registro: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/anagrafiche/status', methods=['GET'])
@jwt_required()
def get_status_anagrafica():
    """Recupera status servizio anagrafiche."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_status_anagrafica()
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero status', 'details': data}), status_code
        
        return jsonify({
            'message': 'Status anagrafica recuperato',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_status_anagrafica: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/anagrafiche/operatori/<codice_fiscale>', methods=['GET'])
@jwt_required()
def get_anagrafica_operatore(codice_fiscale):
    """Recupera anagrafica operatore."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_anagrafica_operatore(codice_fiscale)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero anagrafica', 'details': data}), status_code
        
        return jsonify({
            'message': 'Anagrafica operatore recuperata',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_anagrafica_operatore: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500


@rentri_bp.route('/registri/<id_registro>', methods=['GET'])
@jwt_required()
def get_registro(id_registro):
    """Recupera dati di un registro."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_registro(id_registro)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero registro', 'details': data}), status_code
        
        return jsonify({
            'message': 'Registro recuperato con successo',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_registro: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/registri', methods=['GET', 'POST'])
@jwt_required()
def registri():
    """Gestisce GET (elenco registri) e POST (crea nuovo registro)."""
    logger.info(f"Endpoint /registri chiamato con metodo: {request.method}")
    
    try:
        client = get_rentri_client()
        
        if request.method == 'GET':
            # GET: Recupera elenco registri
            status_code, data = client.get_registri()
            
            if status_code >= 400:
                return jsonify({'error': 'Errore nel recupero registri', 'details': data}), status_code
            
            return jsonify({
                'message': 'Registri recuperati con successo',
                'data': data
            }), 200
            
        else:  # POST
            # POST: Crea nuovo registro
            payload = request.get_json()
            logger.info(f"Payload ricevuto: {payload}")
            
            if not payload:
                return jsonify({'error': 'Payload richiesto'}), 400
            
            status_code, data = client.post_registro(payload)
            logger.info(f"Risposta RENTRI API: status={status_code}, data={data}")
            
            if status_code >= 400:
                return jsonify({'error': 'Errore nella creazione registro', 'details': data}), status_code
            
            return jsonify({
                'message': 'Registro creato con successo',
                'data': data
            }), 201
        
    except Exception as e:
        error_msg = f"Errore registri ({request.method}): {e}"
        logger.error(error_msg)
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/movimenti', methods=['POST'])
@jwt_required()
def post_movimento():
    """Crea nuovo movimento."""
    try:
        client = get_rentri_client()
        payload = request.get_json()
        
        if not payload:
            return jsonify({'error': 'Payload richiesto'}), 400
        
        status_code, data = client.post_movimento(payload)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nella creazione movimento', 'details': data}), status_code
        
        return jsonify({
            'message': 'Movimento creato con successo',
            'data': data
        }), 201
        
    except Exception as e:
        logger.error(f"Errore post_movimento: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/movimenti/<id_movimento>', methods=['GET'])
@jwt_required()
def get_movimento(id_movimento):
    """Recupera dati di un movimento."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_movimento(id_movimento)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero movimento', 'details': data}), status_code
        
        return jsonify({
            'message': 'Movimento recuperato con successo',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_movimento: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/fir/<id_fir>', methods=['GET'])
@jwt_required()
def get_fir(id_fir):
    """Recupera dati FIR."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_fir(id_fir)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero FIR', 'details': data}), status_code
        
        return jsonify({
            'message': 'FIR recuperato con successo',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_fir: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/fir/<id_fir>/pdf', methods=['GET'])
@jwt_required()
def get_fir_pdf(id_fir):
    """Recupera PDF del FIR."""
    try:
        client = get_rentri_client()
        status_code, data = client.get_fir_pdf(id_fir)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nel recupero PDF FIR', 'details': data}), status_code
        
        return jsonify({
            'message': 'PDF FIR recuperato con successo',
            'data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Errore get_fir_pdf: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500

@rentri_bp.route('/documenti/upload', methods=['POST'])
@jwt_required()
def upload_documento():
    """Upload documento."""
    try:
        client = get_rentri_client()
        
        if 'file' not in request.files:
            return jsonify({'error': 'File richiesto'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Nome file richiesto'}), 400
        
        # Salva temporaneamente il file
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp_file:
            file.save(tmp_file.name)
            tipo_documento = request.form.get('tipo_documento', 'allegato')
            
            status_code, data = client.upload_documento(tmp_file.name, tipo_documento)
            
            # Rimuovi file temporaneo
            os.unlink(tmp_file.name)
        
        if status_code >= 400:
            return jsonify({'error': 'Errore nell\'upload documento', 'details': data}), status_code
        
        return jsonify({
            'message': 'Documento caricato con successo',
            'data': data
        }), 201
        
    except Exception as e:
        logger.error(f"Errore upload_documento: {e}")
        return jsonify({'error': 'Errore interno del server'}), 500