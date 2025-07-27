from flask import Blueprint, request, jsonify, send_file, Response
from flask_jwt_extended import jwt_required
import base64
import io
from datetime import datetime
from server.app.ricetta_elettronica.utils import (
    cerca_diagnosi, cerca_farmaci, get_diagnosi_disponibili, 
    get_farmaci_per_diagnosi, get_posologie_per_farmaco, 
    get_durate_standard, get_note_frequenti, get_protocolli_terapeutici,
    add_diagnosi, update_diagnosi, delete_diagnosi,
    add_farmaco_to_diagnosi, update_farmaco_in_diagnosi, delete_farmaco_from_diagnosi
)
from server.app.ricetta_elettronica.auth_service import ricetta_auth_service
from server.app.ricetta_elettronica.ricetta_service import ricetta_service
from server.app.core.email_service import ricetta_email_service
import logging
import os

logger = logging.getLogger(__name__)

prescrizione_bp = Blueprint("prescrizione", __name__, url_prefix="/api")

@prescrizione_bp.route("/diagnosi")
def get_diagnosi():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])
    risultati = cerca_diagnosi(query)
    return jsonify(risultati)

@prescrizione_bp.route("/farmaci")
def get_farmaci():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])
    risultati = cerca_farmaci(query)
    return jsonify(risultati)

@prescrizione_bp.route("/ricetta/auth/test", methods=['GET'])
def test_ricetta_connection():
    """Testa la connessione al servizio di autenticazione ricetta elettronica"""
    try:
        result = ricetta_auth_service.test_connection()
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Connessione al servizio ricetta elettronica OK',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Errore di connessione al servizio ricetta elettronica',
                'details': result
            }), 400
            
    except Exception as e:
        logger.error(f"Errore test connessione ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore test connessione ricetta: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/auth/login", methods=['POST'])
def ricetta_auth_login():
    """Esegue l'autenticazione con il sistema Tessera Sanitaria"""
    try:
        logger.info("Richiesta autenticazione ricetta elettronica")
        
        # Esegui l'autenticazione
        result = ricetta_auth_service.authenticate()
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Autenticazione ricetta elettronica completata',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Autenticazione ricetta elettronica fallita',
                'details': result.get('error', 'Errore sconosciuto'),
                'fault_code': result.get('fault_code'),
                'raw_response': result.get('raw_response')
            }), 400
            
    except Exception as e:
        logger.error(f"Errore autenticazione ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore autenticazione ricetta: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/auth/status", methods=['GET'])
def ricetta_auth_status():
    """Restituisce lo stato della configurazione ricetta elettronica"""
    try:
        # Ottieni lo status di autenticazione
        auth_result = ricetta_auth_service.authenticate()
        
        config_status = {
            'environment': ricetta_auth_service.env,
            'endpoint_invio': ricetta_auth_service.endpoint_invio,
            'endpoint_visualizza': ricetta_auth_service.endpoint_visualizza,
            'endpoint_annulla': ricetta_auth_service.endpoint_annulla,
            'cf_medico': ricetta_auth_service.cf_medico,
            'regione': ricetta_auth_service.regione,
            'asl': ricetta_auth_service.asl,
            'specializzazione': ricetta_auth_service.specializzazione,
            'token_user_id': ricetta_auth_service.token_user_id,
            'auth_status': auth_result
        }
        
        return jsonify({
            'success': True,
            'data': config_status
        }), 200
        
    except Exception as e:
        logger.error(f"Errore status ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore status ricetta: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/debug/certs", methods=['GET'])
def ricetta_debug_certs():
    """Debug certificati ricetta elettronica"""
    try:
        # Forza ricarica configurazione
        ricetta_auth_service._load_config()
        
        debug_info = {
            'environment': ricetta_auth_service.env,
            'cf_medico': ricetta_auth_service.cf_medico,
        }
        
        # Certificati
        if hasattr(ricetta_auth_service, 'p12_path'):
            debug_info['p12_path'] = ricetta_auth_service.p12_path
            debug_info['p12_exists'] = os.path.exists(ricetta_auth_service.p12_path)
        
        if hasattr(ricetta_auth_service, 'client_cert_path'):
            debug_info['client_cert_path'] = ricetta_auth_service.client_cert_path
            debug_info['client_cert_exists'] = ricetta_auth_service.client_cert_path and os.path.exists(ricetta_auth_service.client_cert_path)
        
        if hasattr(ricetta_auth_service, 'client_key_path'):
            debug_info['client_key_path'] = ricetta_auth_service.client_key_path
            debug_info['client_key_exists'] = ricetta_auth_service.client_key_path and os.path.exists(ricetta_auth_service.client_key_path)
        
        if hasattr(ricetta_auth_service, 'ca_cert_path'):
            debug_info['ca_cert_path'] = ricetta_auth_service.ca_cert_path
            debug_info['ca_cert_exists'] = os.path.exists(ricetta_auth_service.ca_cert_path)
        
        return jsonify({
            'success': True,
            'data': debug_info
        }), 200
        
    except Exception as e:
        logger.error(f"Errore debug certificati: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore debug certificati: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/send", methods=['POST'])
def invia_ricetta_completa():
    """
    Invia una ricetta elettronica completa al Sistema TS
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Dati ricetta mancanti'
            }), 400
        
        # Valida dati obbligatori
        required_fields = [
            'paziente', 'diagnosi', 'farmaco', 'posologia', 'durata'
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        # Estrai dati paziente
        paziente = data['paziente']
        if 'codiceFiscale' not in paziente:
            return jsonify({
                'success': False,
                'error': 'Codice fiscale paziente obbligatorio'
            }), 400
        
        # Prepara dati per il servizio
        ricetta_data = {
            'cf_assistito': paziente['codiceFiscale'],
            'codice_diagnosi': data['diagnosi'].get('codice', ''),
            'descrizione_diagnosi': data['diagnosi'].get('descrizione', ''),
            'codice_farmaco': data['farmaco'].get('codice', ''),
            'denominazione_farmaco': data['farmaco'].get('descrizione', ''),
            'principio_attivo': data['farmaco'].get('principio_attivo', ''),
            'posologia': data['posologia'],
            'durata': data['durata'],
            'note': data.get('note', ''),
            'num_iscrizione': data.get('medico', {}).get('iscrizione', '591')
        }
        
        logger.info(f"Invio ricetta per CF: {ricetta_data['cf_assistito']}")
        
        # Invia ricetta
        result = ricetta_service.invia_ricetta(ricetta_data)
        
        if result['success']:
            # Salva ricetta nel database se ha i dati necessari
            if result.get('nre') and result.get('pin_ricetta'):
                try:
                    from ..core.ricette_db import RicetteDB
                    
                    # Prepara dati completi per il database
                    ricetta_db_data = {
                        'nre': result['nre'],
                        'codice_pin': result['pin_ricetta'],
                        'protocollo_transazione': result.get('protocollo_transazione'),
                        'stato': 'inviata',
                        
                        # Dati medico
                        'cf_medico': data.get('medico', {}).get('cfMedico', ricetta_data.get('cf_medico', '')),
                        'medico_cognome': data.get('medico', {}).get('cognome', ''),
                        'medico_nome': data.get('medico', {}).get('nome', ''),
                        'specializzazione': data.get('medico', {}).get('specializzazione', 'F'),
                        'nr_iscrizione_albo': ricetta_data['num_iscrizione'],
                        'medico_indirizzo': data.get('medico', {}).get('indirizzo', ''),
                        'medico_telefono': data.get('medico', {}).get('telefono', ''),
                        
                        # Dati paziente
                        'cf_assistito': ricetta_data['cf_assistito'],
                        'paziente_cognome': paziente.get('cognome', ''),
                        'paziente_nome': paziente.get('nome', ''),
                        'paziente_indirizzo': paziente.get('indirizzo', ''),
                        'paziente_cap': paziente.get('cap', ''),
                        'paziente_citta': paziente.get('citta', ''),
                        'paziente_provincia': paziente.get('provincia', ''),
                        
                        # Dati prescrizione
                        'data_compilazione': datetime.now(),
                        'tipo_prescrizione': 'farmaceutica',
                        'codice_diagnosi': ricetta_data['codice_diagnosi'],
                        'descrizione_diagnosi': ricetta_data['descrizione_diagnosi'],
                        
                        # Dati farmaco
                        'gruppo_equivalenza_farmaco': ricetta_data['principio_attivo'],
                        'prodotto_aic': ricetta_data['denominazione_farmaco'],
                        'codice_farmaco': ricetta_data['codice_farmaco'],
                        'quantita': 1,
                        'posologia': ricetta_data['posologia'],
                        'durata_trattamento': ricetta_data['durata'],
                        'note': ricetta_data['note'],
                        
                        # Metadati
                        'ambiente': 'test' if 'test' in ricetta_service.endpoint_invio else 'prod',
                        'response_xml': result['response_xml'],
                        'pdf_base64': result.get('pdf_promemoria_b64')
                    }
                    
                    ricetta_id = RicetteDB.save_ricetta(ricetta_db_data)
                    logger.info(f"Ricetta salvata nel database con ID: {ricetta_id}, NRE: {result['nre']}")
                    
                except Exception as e:
                    logger.error(f"Errore salvataggio ricetta nel database: {e}")
                    # Non fallisce l'invio se il salvataggio DB fallisce
            
            return jsonify({
                'success': True,
                'message': 'Ricetta inviata con successo al Sistema TS',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Errore invio ricetta al Sistema TS',
                'details': result
            }), 400
            
    except Exception as e:
        logger.error(f"Errore endpoint invio ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore interno: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/test-invio", methods=['POST'])
def test_invio_ricetta():
    """
    Test invio ricetta con dati di esempio dall'ambiente test
    """
    try:
        # Dati di test hardcodati dal kit ufficiale
        ricetta_test = {
            'cf_assistito': 'PNIMRA70A01H501P',  # CF assistito dal kit
            'codice_diagnosi': 'M25.50',
            'descrizione_diagnosi': 'Dolore articolare non specificato',
            'codice_farmaco': 'A01AD05',
            'denominazione_farmaco': 'Ibuprofene 600mg compresse',
            'principio_attivo': 'Ibuprofene',
            'posologia': '1 compressa ogni 8 ore',
            'durata': '7 giorni',
            'note': 'Test ricetta elettronica - ambiente test',
            'num_iscrizione': '591'
        }
        
        logger.info("Test invio ricetta con dati del kit ufficiale")
        
        # Invia ricetta di test
        result = ricetta_service.invia_ricetta(ricetta_test)
        
        return jsonify({
            'success': True,
            'message': 'Test invio ricetta completato',
            'test_data': ricetta_test,
            'result': result
        }), 200
        
    except Exception as e:
        logger.error(f"Errore test invio ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore test: {str(e)}'
        }), 500

# === NUOVI ENDPOINT PER PROTOCOLLI TERAPEUTICI ===

@prescrizione_bp.route("/protocolli", methods=['GET'])
def get_protocolli():
    """Restituisce tutti i protocolli terapeutici"""
    try:
        protocolli = get_protocolli_terapeutici()
        return jsonify({
            'success': True,
            'data': protocolli
        }), 200
    except Exception as e:
        logger.error(f"Errore nel recupero protocolli: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore nel recupero protocolli: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/diagnosi", methods=['GET'])
def get_diagnosi_protocolli():
    """Restituisce diagnosi con farmaci associati"""
    try:
        diagnosi = get_diagnosi_disponibili()
        return jsonify({
            'success': True,
            'data': diagnosi
        }), 200
    except Exception as e:
        logger.error(f"Errore nel recupero diagnosi: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore nel recupero diagnosi: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/farmaci/<diagnosi_id>", methods=['GET'])
def get_farmaci_diagnosi(diagnosi_id):
    """Restituisce farmaci raccomandati per una diagnosi"""
    try:
        farmaci = get_farmaci_per_diagnosi(diagnosi_id)
        return jsonify({
            'success': True,
            'data': farmaci
        }), 200
    except Exception as e:
        logger.error(f"Errore nel recupero farmaci per diagnosi {diagnosi_id}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore nel recupero farmaci: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/posologie", methods=['GET'])
def get_posologie():
    """Restituisce posologie per principio attivo"""
    principio_attivo = request.args.get('principio_attivo', '')
    if not principio_attivo:
        return jsonify({
            'success': False,
            'error': 'Principio attivo richiesto'
        }), 400
    
    try:
        posologie = get_posologie_per_farmaco(principio_attivo)
        return jsonify({
            'success': True,
            'data': posologie
        }), 200
    except Exception as e:
        logger.error(f"Errore nel recupero posologie: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore nel recupero posologie: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/durate", methods=['GET'])
def get_durate():
    """Restituisce durate standard di terapia"""
    try:
        durate = get_durate_standard()
        return jsonify({
            'success': True,
            'data': durate
        }), 200
    except Exception as e:
        logger.error(f"Errore nel recupero durate: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore nel recupero durate: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/note", methods=['GET'])
def get_note():
    """Restituisce note di prescrizione frequenti"""
    try:
        note = get_note_frequenti()
        return jsonify({
            'success': True,
            'data': note
        }), 200
    except Exception as e:
        logger.error(f"Errore nel recupero note: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore nel recupero note: {str(e)}'
        }), 500

# === ENDPOINT CRUD PER GESTIONE PROTOCOLLI ===

@prescrizione_bp.route("/protocolli/diagnosi", methods=['POST'])
def create_diagnosi():
    """Crea una nuova diagnosi"""
    try:
        data = request.get_json()
        
        required_fields = ['id', 'codice', 'descrizione']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        result = add_diagnosi(data)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Diagnosi creata con successo',
                'data': result
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore creazione diagnosi: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore creazione diagnosi: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/diagnosi/<diagnosi_id>", methods=['PUT'])
def update_diagnosi_endpoint(diagnosi_id):
    """Aggiorna una diagnosi esistente"""
    try:
        data = request.get_json()
        
        required_fields = ['codice', 'descrizione']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        result = update_diagnosi(diagnosi_id, data)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Diagnosi aggiornata con successo',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore aggiornamento diagnosi: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore aggiornamento diagnosi: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/diagnosi/<diagnosi_id>", methods=['DELETE'])
def delete_diagnosi_endpoint(diagnosi_id):
    """Elimina una diagnosi"""
    try:
        result = delete_diagnosi(diagnosi_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Diagnosi eliminata con successo'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore eliminazione diagnosi: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore eliminazione diagnosi: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/diagnosi/<diagnosi_id>/farmaci", methods=['POST'])
def create_farmaco_diagnosi(diagnosi_id):
    """Aggiunge un farmaco a una diagnosi"""
    try:
        data = request.get_json()
        
        required_fields = ['codice', 'nome', 'principio_attivo', 'classe', 
                          'posologia_default', 'durata_default', 'note_default']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        result = add_farmaco_to_diagnosi(diagnosi_id, data)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Farmaco aggiunto con successo',
                'data': result
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore aggiunta farmaco: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore aggiunta farmaco: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/diagnosi/<diagnosi_id>/farmaci/<farmaco_codice>", methods=['PUT'])
def update_farmaco_diagnosi(diagnosi_id, farmaco_codice):
    """Aggiorna un farmaco in una diagnosi"""
    try:
        data = request.get_json()
        
        required_fields = ['codice', 'nome', 'principio_attivo', 'classe', 
                          'posologia_default', 'durata_default', 'note_default']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        result = update_farmaco_in_diagnosi(diagnosi_id, farmaco_codice, data)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Farmaco aggiornato con successo',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore aggiornamento farmaco: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore aggiornamento farmaco: {str(e)}'
        }), 500

@prescrizione_bp.route("/protocolli/diagnosi/<diagnosi_id>/farmaci/<farmaco_codice>", methods=['DELETE'])
def delete_farmaco_diagnosi(diagnosi_id, farmaco_codice):
    """Elimina un farmaco da una diagnosi"""
    try:
        result = delete_farmaco_from_diagnosi(diagnosi_id, farmaco_codice)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Farmaco eliminato con successo'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore eliminazione farmaco: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore eliminazione farmaco: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/pdf/<protocollo_transazione>", methods=['GET'])
def download_ricetta_pdf(protocollo_transazione):
    """
    Scarica il PDF della ricetta dato il protocollo di transazione
    """
    try:
        # In un'implementazione reale, dovresti recuperare il PDF dal database
        # usando il protocollo_transazione per identificare la ricetta
        
        # Per ora, simuliamo che il PDF sia disponibile nella risposta più recente
        # In produzione dovresti implementare un sistema di storage dei PDF
        
        return jsonify({
            'success': False,
            'error': 'PDF non trovato - implementare storage PDF nel database'
        }), 404
        
    except Exception as e:
        logger.error(f"Errore download PDF ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore download PDF: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/pdf/base64", methods=['POST'])
def convert_pdf_base64():
    """
    Converte PDF base64 in file scaricabile
    """
    try:
        data = request.get_json()
        
        if not data or 'pdf_base64' not in data:
            return jsonify({
                'success': False,
                'error': 'PDF base64 mancante'
            }), 400
        
        pdf_b64 = data['pdf_base64']
        filename = data.get('filename', 'ricetta_elettronica.pdf')
        
        # Decodifica base64
        try:
            pdf_bytes = base64.b64decode(pdf_b64)
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Errore decodifica base64: {str(e)}'
            }), 400
        
        # Crea response con PDF
        response = Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/pdf',
                'Content-Length': str(len(pdf_bytes))
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Errore conversione PDF: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore conversione PDF: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/email/send", methods=['POST'])
def invia_ricetta_email():
    """
    Invia ricetta elettronica via email al paziente
    """
    try:
        data = request.get_json()
        logger.info(f"Richiesta email ricevuta con campi: {list(data.keys()) if data else 'NESSUN DATA'}")
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Nessun dato ricevuto'
            }), 400
        
        # Valida dati obbligatori
        required_fields = ['email_paziente', 'nome_paziente', 'ricetta_data', 'pdf_base64']
        for field in required_fields:
            if field not in data:
                logger.error(f"Campo mancante: {field}, campi presenti: {list(data.keys())}")
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante: {field}'
                }), 400
        
        # Invia email
        result = ricetta_email_service.invia_ricetta_email(
            destinatario_email=data['email_paziente'],
            destinatario_nome=data['nome_paziente'],
            ricetta_data=data['ricetta_data'],
            pdf_base64=data['pdf_base64']
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Email inviata con successo',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore endpoint invio email: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore invio email: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/email/test", methods=['GET'])
def test_email_connection():
    """
    Testa la connessione email SMTP
    """
    try:
        result = ricetta_email_service.test_connessione()
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Connessione email OK',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        logger.error(f"Errore test email: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore test email: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/email/test-send", methods=['GET'])
def test_send_email_direct():
    """
    Test diretto invio email con dati hardcodati
    """
    try:
        # Dati di test simulati
        ricetta_data_test = {
            'nre': 'TEST123456',
            'pin_ricetta': 'PIN789',
            'data_inserimento': '2025-07-27 12:00:00',
            'nome_medico': 'NICOLA',
            'cognome_medico': 'DI MARTINO',
            'denominazione_farmaco': 'AMOXICILLINA AC CLA ALM*12BUST (TEST)',
            'posologia': '1 bustina ogni 8 ore (TEST)',
            'protocollo_transazione': 'test-protocol-123'
        }
        
        # PDF base64 fittizio (header PDF valido)
        pdf_fake_b64 = "JVBERi0xLjQKJeLjz9MKNSAwIG9iago8PC9Db2xvclNwYWNlL0RldmljZUdyYXkvU3VidHlwZS9JbWFnZS9IZWlnaHQgMTAwL0ZpbHRlci9GbGF0ZURlY29kZS9UeXBlL1hPYmplY3QvV2lkdGggMTAwL0xlbmd0aCAzMy9CaXRzUGVyQ29tcG9uZW50IDg+PnN0cmVhbQp4nO3BAQ0AAADCoP6pbw43oAAAAAAAAAAAAODfALYj6ysKZW5kc3RyZWFtCmVuZG9iag=="
        
        logger.info("Test invio email diretto a nicoladimartino@gmail.com")
        
        # Invia email con servizio diretto
        result = ricetta_email_service.invia_ricetta_email(
            destinatario_email="nicoladimartino@gmail.com",
            destinatario_nome="Nicola Di Martino",
            ricetta_data=ricetta_data_test,
            pdf_base64=pdf_fake_b64
        )
        
        return jsonify({
            'success': True,
            'message': 'Test email completato',
            'result': result
        }), 200
        
    except Exception as e:
        logger.error(f"Errore test email diretto: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore test email: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/database/list", methods=['GET'])
def list_ricette_database():
    """
    Mostra tutte le ricette salvate nel database
    """
    try:
        from ..core.ricette_db import RicetteDB
        
        ricette = RicetteDB.get_all_ricette()
        
        return jsonify({
            'success': True,
            'count': len(ricette),
            'ricette': ricette
        }), 200
        
    except Exception as e:
        logger.error(f"Errore lista ricette DB: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore lista ricette: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/paziente/<cf_paziente>", methods=['GET'])
def get_ricette_paziente(cf_paziente):
    """
    Recupera tutte le ricette di un paziente specifico
    """
    try:
        from ..core.ricette_db import RicetteDB
        
        # Valida CF paziente
        if not cf_paziente or len(cf_paziente) != 16:
            return jsonify({
                'success': False,
                'error': 'Codice fiscale paziente non valido'
            }), 400
        
        # Recupera ricette del paziente
        ricette = RicetteDB.get_ricette_by_paziente(cf_paziente.upper())
        
        # Calcola statistiche
        stats = {
            'totale_ricette': len(ricette),
            'ricette_inviate': len([r for r in ricette if r.get('stato') == 'inviata']),
            'ricette_annullate': len([r for r in ricette if r.get('stato') == 'annullata']),
            'ultima_ricetta': ricette[0].get('data_compilazione') if ricette else None
        }
        
        return jsonify({
            'success': True,
            'cf_paziente': cf_paziente.upper(),
            'statistiche': stats,
            'ricette': ricette
        }), 200
        
    except Exception as e:
        logger.error(f"Errore recupero ricette paziente {cf_paziente}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore recupero ricette paziente: {str(e)}'
        }), 500

@prescrizione_bp.route("/ricetta/download/<nre>", methods=['GET'])
def download_ricetta_by_nre(nre):
    """
    Scarica il PDF di una ricetta tramite NRE
    """
    try:
        from ..core.ricette_db import RicetteDB
        import base64
        from flask import Response
        
        # Recupera ricetta per NRE
        ricetta = RicetteDB.get_ricetta_by_nre(nre)
        
        if not ricetta:
            return jsonify({
                'success': False,
                'error': f'Ricetta con NRE {nre} non trovata'
            }), 404
        
        # Controlla se ha il PDF
        if not ricetta.get('pdf_base64'):
            return jsonify({
                'success': False,
                'error': 'PDF non disponibile per questa ricetta'
            }), 404
        
        # Decodifica PDF
        try:
            pdf_bytes = base64.b64decode(ricetta['pdf_base64'])
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Errore decodifica PDF: {str(e)}'
            }), 400
        
        # Genera nome file
        filename = f"ricetta_{nre}_{ricetta.get('paziente_cognome', 'paziente').replace(' ', '_')}.pdf"
        
        # Restituisci PDF
        response = Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'application/pdf',
                'Content-Length': str(len(pdf_bytes))
            }
        )
        
        logger.info(f"PDF ricetta {nre} scaricato per paziente {ricetta.get('cf_assistito')}")
        return response
        
    except Exception as e:
        logger.error(f"Errore download ricetta {nre}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Errore download ricetta: {str(e)}'
        }), 500