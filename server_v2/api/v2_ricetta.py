"""
API V2 per la gestione delle ricette elettroniche
Implementa endpoint modernizzati con architettura repository/service
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
import sqlite3
import os
import base64
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography import x509
from typing import Dict, Any, Optional
from utils.ricetta_utils import ricetta_data_manager

# Database path per protocolli
INSTANCE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'instance')
PROTOCOLLI_DB_PATH = os.path.join(INSTANCE_DIR, 'protocolli.db')
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))  # server_v2/
_PROJ_ROOT = os.path.dirname(PROJECT_ROOT)  # StudioDimaAI/
_sanitel_env = os.getenv('SANITEL_CERT_PATH', os.path.join('certs', 'test', 'SanitelCF-2024-2027.cer'))
SANITEL_CERT_PATH = _sanitel_env if os.path.isabs(_sanitel_env) else os.path.join(_PROJ_ROOT, _sanitel_env)

logger = logging.getLogger(__name__)

ricetta_bp = Blueprint("ricetta_bp", __name__)

_TABLES_READY = False


def _ensure_tables():
    """Crea le tabelle proprie di questo blueprint se non esistono (auto-migrazione)."""
    global _TABLES_READY
    if _TABLES_READY:
        return
    with sqlite3.connect(PROTOCOLLI_DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS farmaci_commerciali (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farmaco_id INTEGER NOT NULL,
                aic TEXT NOT NULL,
                nome_commerciale TEXT NOT NULL,
                classe TEXT,
                ripetibilita TEXT,
                gruppo_equivalenza_codice TEXT,
                gruppo_equivalenza_descrizione TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(farmaco_id, aic),
                FOREIGN KEY (farmaco_id) REFERENCES farmaci(id)
            )
        """)
        conn.commit()
    _TABLES_READY = True


@ricetta_bp.route("/ricetta/diagnosi-all", methods=['GET'])
@jwt_required()
def get_all_diagnosi():
    """Get all diagnosi (not search)"""
    try:
        with sqlite3.connect(PROTOCOLLI_DB_PATH) as conn:
            cursor = conn.cursor()
            
            query = """
            SELECT 
                d.id,
                d.codice,
                d.descrizione,
                d.categoria,
                COUNT(DISTINCT p.farmacoId) as num_farmaci
            FROM diagnosi d
            LEFT JOIN protocolli_terapeutici p ON d.id = p.diagnosiId
            GROUP BY d.id, d.codice, d.descrizione, d.categoria
            ORDER BY d.codice
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            diagnosi = []
            for row in rows:
                diagnosi.append({
                    'id': row[0],
                    'codice': row[1],
                    'descrizione': row[2],
                    'categoria':row[3],
                    'num_farmaci': row[4]
                })
            
            return jsonify({
                'success': True,
                'data': {
                    'diagnosi': diagnosi,
                    'count': len(diagnosi)
                }
            })
            
    except Exception as e:
        logger.error(f"Errore get_all_diagnosi: {e}")
        return jsonify({
            'success': False,
            'error': 'Database error retrieving diagnosi'
        }), 500

@ricetta_bp.route("/ricetta/farmaci", methods=['GET'])
@jwt_required()
def search_farmaci():
    """Ricerca farmaci ATC"""
    try:
        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 20))
        
        if not query or len(query) < 2:
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Query troppo breve'
            }), 200
        
        risultati = ricetta_data_manager.cerca_farmaci(query, limit)
        
        return jsonify({
            'success': True,
            'data': risultati,
            'count': len(risultati),
            'query': query
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'INVALID_PARAMETERS',
            'message': f'Parametri non validi: {e}'
        }), 400
    except Exception as e:
        logger.error(f"Errore ricerca farmaci: {e}")
        return jsonify({
            'success': False,
            'error': 'SEARCH_FAILED',
            'message': f'Errore durante la ricerca: {e}'
        }), 500

@ricetta_bp.route("/ricetta/farmaci/per-diagnosi/<codice_diagnosi>", methods=['GET'])
@jwt_required()
def get_farmaci_per_diagnosi(codice_diagnosi: str):
    """Ottiene farmaci suggeriti per una diagnosi"""
    try:
        if not codice_diagnosi:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'Codice diagnosi obbligatorio'
            }), 400
        
        # Valida diagnosi
        if not ricetta_data_manager.validate_diagnosi(codice_diagnosi):
            return jsonify({
                'success': False,
                'error': 'INVALID_DIAGNOSIS',
                'message': f'Diagnosi {codice_diagnosi} non valida'
            }), 400
        
        farmaci = ricetta_data_manager.get_farmaci_per_diagnosi(codice_diagnosi)
        
        return jsonify({
            'success': True,
            'data': farmaci,
            'count': len(farmaci),
            'diagnosi': codice_diagnosi
        }), 200
        
    except Exception as e:
        logger.error(f"Errore farmaci per diagnosi: {e}")
        return jsonify({
            'success': False,
            'error': 'LOOKUP_FAILED',
            'message': f'Errore durante la ricerca: {e}'
        }), 500

@ricetta_bp.route("/ricetta/farmaci-commerciali/<int:farmaco_id>", methods=['GET'])
@jwt_required()
def get_farmaci_commerciali(farmaco_id):
    """Elenco dei prodotti commerciali (AIC) disponibili per un principio attivo"""
    try:
        _ensure_tables()
        with sqlite3.connect(PROTOCOLLI_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, aic, nome_commerciale, classe, ripetibilita,
                       gruppo_equivalenza_codice, gruppo_equivalenza_descrizione
                FROM farmaci_commerciali
                WHERE farmaco_id = ?
                ORDER BY nome_commerciale
            """, (farmaco_id,))
            rows = cursor.fetchall()

            prodotti = [{
                'id': row[0],
                'aic': row[1],
                'nome_commerciale': row[2],
                'classe': row[3],
                'ripetibilita': row[4],
                'gruppo_equivalenza_codice': row[5],
                'gruppo_equivalenza_descrizione': row[6],
            } for row in rows]

            return jsonify({
                'success': True,
                'data': {'prodotti': prodotti, 'count': len(prodotti), 'farmaco_id': farmaco_id}
            })
    except Exception as e:
        logger.error(f"Errore farmaci commerciali per farmaco_id {farmaco_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Database error retrieving farmaci commerciali'
        }), 500

@ricetta_bp.route("/ricetta/farmaci-commerciali", methods=['POST'])
@jwt_required()
def add_farmaci_commerciali():
    """Inserisce/aggiorna prodotti commerciali (AIC) per un principio attivo (upsert per aic)"""
    try:
        _ensure_tables()
        dati = request.get_json()
        farmaco_id = dati.get('farmaco_id')
        prodotti = dati.get('prodotti', [])
        if not farmaco_id or not prodotti:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'farmaco_id e prodotti sono obbligatori'
            }), 400

        with sqlite3.connect(PROTOCOLLI_DB_PATH) as conn:
            for p in prodotti:
                conn.execute("""
                    INSERT INTO farmaci_commerciali
                        (farmaco_id, aic, nome_commerciale, classe, ripetibilita,
                         gruppo_equivalenza_codice, gruppo_equivalenza_descrizione)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(farmaco_id, aic) DO UPDATE SET
                        nome_commerciale=excluded.nome_commerciale,
                        classe=excluded.classe,
                        ripetibilita=excluded.ripetibilita,
                        gruppo_equivalenza_codice=excluded.gruppo_equivalenza_codice,
                        gruppo_equivalenza_descrizione=excluded.gruppo_equivalenza_descrizione
                """, (
                    farmaco_id, p['aic'], p['nome_commerciale'], p.get('classe'),
                    p.get('ripetibilita'), p.get('gruppo_equivalenza_codice'),
                    p.get('gruppo_equivalenza_descrizione'),
                ))
            conn.commit()

        return jsonify({'success': True, 'message': f'{len(prodotti)} prodotti salvati'})
    except Exception as e:
        logger.error(f"Errore inserimento farmaci commerciali: {e}")
        return jsonify({
            'success': False,
            'error': 'INSERT_FAILED',
            'message': str(e)
        }), 500

@ricetta_bp.route("/ricetta/protocolli-per-diagnosi/<int:diagnosi_id>", methods=['GET'])
@jwt_required()
def get_protocolli_per_diagnosi(diagnosi_id):
    """Get protocolli for a specific diagnosi by ID"""
    try:
        with sqlite3.connect(PROTOCOLLI_DB_PATH) as conn:
            cursor = conn.cursor()
            
            query = """
            SELECT 
                p.id,
                p.farmacoId,
                f.principio_attivo as farmaco_codice,
                f.nomi_commerciali as farmaco_nome,
                f.principio_attivo,
                f.categoria,
                NULL as posologia_custom,
                NULL as durata_custom,
                NULL as note_custom,
                f.posologia_standard,
                p.ordine
            FROM protocolli_terapeutici p
            JOIN farmaci f ON p.farmacoId = f.id
            WHERE p.diagnosiId = ?
            ORDER BY p.ordine, f.nomi_commerciali
            """
            
            cursor.execute(query, (diagnosi_id,))
            rows = cursor.fetchall()
            
            protocolli = []
            for row in rows:
                protocolli.append({
                    'id': row[0],
                    'farmaco_id': row[1],
                    'farmaco_codice': row[2],
                    'nomi_commerciali': row[3],
                    'principio_attivo': row[4],
                    'categoria': row[5],
                    'posologia_custom': row[6],
                    'durata_custom': row[7],
                    'note_custom': row[8],
                    'posologia_standard': row[9],
                    'ordine': row[10] or 0
                })
            
            return jsonify({
                'success': True,
                'data': {
                    'protocolli': protocolli,
                    'count': len(protocolli),
                    'diagnosi_id': diagnosi_id
                }
            })
            
    except Exception as e:
        logger.error(f"Errore protocolli per diagnosi {diagnosi_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Database error retrieving protocolli'
        }), 500

@ricetta_bp.route("/ricetta/suggestions/posologie", methods=['GET'])
@jwt_required()
def get_posologie_suggestions():
    """Ottiene suggerimenti posologie"""
    try:
        posologie = ricetta_data_manager.get_posologie_comuni()
        
        return jsonify({
            'success': True,
            'data': posologie,
            'count': len(posologie)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore posologie: {e}")
        return jsonify({
            'success': False,
            'error': 'SUGGESTIONS_FAILED',
            'message': f'Errore caricamento posologie: {e}'
        }), 500

@ricetta_bp.route("/ricetta/suggestions/durate", methods=['GET'])
@jwt_required()
def get_durate_suggestions():
    """Ottiene suggerimenti durate terapia"""
    try:
        durate = ricetta_data_manager.get_durate_comuni()
        
        return jsonify({
            'success': True,
            'data': durate,
            'count': len(durate)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore durate: {e}")
        return jsonify({
            'success': False,
            'error': 'SUGGESTIONS_FAILED',
            'message': f'Errore caricamento durate: {e}'
        }), 500

@ricetta_bp.route("/ricetta/suggestions/note", methods=['GET'])
@jwt_required()
def get_note_suggestions():
    """Ottiene suggerimenti note"""
    try:
        note = ricetta_data_manager.get_note_frequenti()
        
        return jsonify({
            'success': True,
            'data': note,
            'count': len(note)
        }), 200
        
    except Exception as e:
        logger.error(f"Errore note: {e}")
        return jsonify({
            'success': False,
            'error': 'SUGGESTIONS_FAILED',
            'message': f'Errore caricamento note: {e}'
        }), 500

@ricetta_bp.route("/ricetta/invio", methods=['POST'])
def invia_ricetta():
    """Invia ricetta elettronica al Sistema TS"""
    logger.info("=== DEBUG: Richiesta invio ricetta ricevuta ===")
    try:
        # Validazione request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
        dati = request.get_json()
        if not dati:
            return jsonify({
                'success': False,
                'error': 'EMPTY_REQUEST',
                'message': 'Dati ricetta non presenti'
            }), 400

        # --- MAPPING COME V1: payload -> formato interno ---
        # V1 mappa payload a formato flat con cf_assistito
        paziente = dati['paziente']
        dati_ricetta = {
            'cf_assistito': paziente.get('codice_fiscale') or paziente.get('codiceFiscale', ''),
            'nome_assistito': paziente.get('nome', ''),
            'cognome_assistito': paziente.get('cognome', ''),
            'codice_diagnosi': dati['diagnosi']['codice'],
            'descrizione_diagnosi': dati['diagnosi']['descrizione'],
            'codice_farmaco': dati['farmaco']['codice'],
            'denominazione_farmaco': dati['farmaco']['descrizione'],
            'principio_attivo': dati['farmaco']['principio_attivo'],
            'posologia': dati['posologia'],
            'durata': dati['durata'],
            'note': dati.get('note', ''),
            'quantita': dati.get('quantita'),
            'num_iscrizione': dati.get('medico', {}).get('iscrizione'),
            'cod_gruppo_equival': dati['farmaco'].get('gruppo_equivalenza_codice'),
            'descr_gruppo_equival': dati['farmaco'].get('gruppo_equivalenza_descrizione'),
        }

        # indirMedico/telefMedico Sistema TS: formato pipe-delimited "via|cap|citta|prov" e "prefisso|numero".
        # Nessun fallback: se i dati medico non sono stati inviati dal FE, l'errore deve emergere subito.
        medico = dati.get('medico', {})
        if all(medico.get(k) for k in ('indirizzo', 'cap', 'citta', 'provincia', 'telefono')):
            dati_ricetta['indirizzo_medico'] = '|'.join([
                medico['indirizzo'], medico['cap'], medico['citta'], medico['provincia'],
            ])
            dati_ricetta['telefono_medico'] = f"+39|{medico['telefono']}"

        # indirizzo paziente Sistema TS: stesso formato "via|cap|citta|prov".
        # Campo opzionale nello schema: lo includiamo solo se abbiamo dati reali del paziente,
        # mai un indirizzo inventato per non inviare dati falsi al Sistema TS.
        if paziente.get('indirizzo') and paziente.get('citta') and paziente.get('provincia'):
            dati_ricetta['indirizzo_paziente'] = '|'.join([
                paziente['indirizzo'],
                paziente.get('cap', ''),
                paziente['citta'],
                paziente['provincia'],
            ])

        # Validazione base come V1 - controlla anche che il valore non sia vuoto, non solo presente.
        # codice_diagnosi/descrizione_diagnosi NON sono richiesti: il Sistema TS rifiuta (errore 1039)
        # i codici di categoria del nostro DB locale (es. "K02.x"), e il portale stesso non li richiede.
        required_fields = ['cf_assistito',
                          'codice_farmaco', 'denominazione_farmaco', 'principio_attivo',
                          'posologia', 'durata', 'quantita', 'num_iscrizione']

        for field in required_fields:
            if not dati_ricetta.get(field):
                return jsonify({
                    'success': False,
                    'error': f'Campo obbligatorio mancante o vuoto: {field}'
                }), 400
        
        logger.info(f"Invio ricetta per CF: {dati_ricetta['cf_assistito']}")
        
        # Usa il servizio V2 corretto
        from services.ricette_ts_service import ricette_ts_service

        result = ricette_ts_service.invia_ricetta(dati_ricetta)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Ricetta inviata con successo al Sistema TS',
                'data': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'INVIO_FAILED'),
                'message': result.get('errore_descrizione') or result.get('response_text', '')[:300],
                'data': result
            }), 200
    except Exception as e:
        logger.error(f"Errore invio ricetta: {e}")
        return jsonify({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': f'Errore interno v2_ricetta: {e}'
        }), 500

@ricetta_bp.route("/ricetta/environment", methods=['GET'])
@jwt_required()
def get_environment_info():
    """Informazioni ambiente corrente"""
    from services.ricette_ts_service import ricette_ts_service

    try:
        info = ricette_ts_service.get_environment_info()
        
        return jsonify({
            'success': True,
            'data': info
        }), 200
        
    except Exception as e:
        logger.error(f"Errore info ambiente: {e}")
        return jsonify({
            'success': False,
            'error': 'ENVIRONMENT_INFO_FAILED',
            'message': f'Errore informazioni ambiente: {e}'
        }), 500

@ricetta_bp.route("/ricetta/ts/list", methods=['GET'])
@jwt_required()  # Temporaneamente rimosso per test
def list_ricette_from_ts():
    """
    Recupera le ricette dal Sistema TS con supporto ricerca specifica per NRE
    Supporta sia test che produzione con cifratura CF
    """
    try:
        # Parametri dalla query string
        data_da = request.args.get('data_da')  # formato YYYY-MM-DD
        data_a = request.args.get('data_a')    # formato YYYY-MM-DD
        cf_assistito = request.args.get('cf_assistito')
        
        # Parametro per ricerca specifica per NRE
        nre = request.args.get('nre')
        test_ricerca_specifica = request.args.get('test_ricerca_specifica') == 'true'

        logger.info(f"Richiesta lista ricette Sistema TS - Da={data_da}, A={data_a}, CF={cf_assistito}, NRE={nre}")
        
        # Se è una ricerca specifica con NRE, usa la funzione di visualizzazione ricetta singola
        if test_ricerca_specifica and nre and cf_assistito:
            from services.ricette_ts_service import ricette_ts_service
            logger.info(f"Ricerca ricetta specifica per NRE={nre}, env={ricette_ts_service.env}")

            ts_response = ricette_ts_service.get_ricetta(
                cf_assistito=cf_assistito,
                nrbe=nre
            )

            return jsonify({
                'success': ts_response.get('success', False),
                'source': 'sistema_ts_ricerca_specifica',
                'count': 1 if ts_response.get('success') else 0,
                'data': [ts_response.get('ricetta_data')] if ts_response.get('success') else [],
                'ts_response': {
                    'message': ts_response.get('message'),
                    'timestamp': ts_response.get('timestamp'),
                    'http_status': ts_response.get('http_status'),
                    'response_xml': ts_response.get('response_xml', ''),
                    'environment': ricette_ts_service.env,
                    'nre_ricercato': nre,
                    'cf_assistito': cf_assistito
                }
            })
        
        # Modalità standard: recupera tutte le ricette
        from services.ricette_ts_service import ricette_ts_service
        
        ts_response = ricette_ts_service.get_all_ricette(
            data_da=data_da,
            data_a=data_a, 
            cf_assistito=cf_assistito
        )
        
        if ts_response.get('success'):
            logger.info(f"Ricette recuperate dal Sistema TS: {ts_response.get('total_count', 0)}")
            
            return jsonify({
                'success': True,
                'source': 'sistema_ts',
                'count': ts_response.get('total_count', 0),
                'data': ts_response.get('ricette', []),
                'ts_response': {
                    'message': ts_response.get('message'),
                    'timestamp': ts_response.get('timestamp'),
                    'http_status': ts_response.get('http_status'),
                    'response_xml': ts_response.get('response_xml', '')
                }
            }), 200
        else:
            # Sistema TS offline o errore
            logger.error(f"Errore Sistema TS: {ts_response.get('error')}")
            
            return jsonify({
                'success': False,
                'source': 'sistema_ts',
                'error': 'SISTEMA_TS_ERROR',
                'message': ts_response.get('error', 'Sistema TS non disponibile'),
                'details': ts_response,
                'ts_response': {
                    'message': ts_response.get('message'),
                    'timestamp': ts_response.get('timestamp'),
                    'http_status': ts_response.get('http_status'),
                    'response_xml': ts_response.get('response_xml', '')
                }
            }), 503  # Service Unavailable
        
    except Exception as e:
        logger.error(f"Errore chiamata Sistema TS: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'source': 'sistema_ts',
            'error': 'SISTEMA_TS_EXCEPTION',
            'message': f'Errore comunicazione Sistema TS: {str(e)}'
        }), 500

@ricetta_bp.route("/ricetta/db/paziente/<cfPaziente>", methods=['GET'])
@jwt_required()
def get_ricette_by_paziente(cfPaziente: str):
    """
    Recupera le ricette di un paziente specifico dal database locale
    """
    try:
        if not cfPaziente:
            return jsonify({
                'success': False,
                'error': 'MISSING_CF',
                'message': 'Codice fiscale del paziente mancante'
            }), 400
        
        logger.info(f"Richiesta ricette per paziente CF: {cfPaziente}")
        
        # Usa il servizio DB V2
        from services.ricette_db_service import ricette_db_service
        
        ricette = ricette_db_service.get_ricette_by_paziente(cfPaziente)
        
        logger.info(f"Ricette recuperate per CF {cfPaziente}: {len(ricette)}")
        
        return jsonify({
            'success': True,
            'source': 'database_locale',
            'count': len(ricette),
            'data': ricette,
            'cf_paziente': cfPaziente
        }), 200
        
    except Exception as e:
        logger.error(f"Errore recupero ricette per paziente {cfPaziente}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'source': 'database_locale',
            'error': 'DATABASE_ERROR',
            'message': f'Errore database locale: {str(e)}'
        }), 500

@ricetta_bp.route("/ricetta/db/list", methods=['GET']) 
@jwt_required()  # Temporaneamente rimosso per test
def list_ricette_from_db():
    """
    Recupera le ricette dal database locale
    """
    try:
        # Parametri opzionali dalla query string
        limit = int(request.args.get('limit', 50))
        cf_assistito = request.args.get('cf_assistito')
        
        logger.info(f"Richiesta lista ricette database locale - Limit: {limit}, CF: {cf_assistito}")
        
        # Usa il servizio DB V2
        from services.ricette_db_service import ricette_db_service
        
        if cf_assistito:
            # Ricette di un paziente specifico
            ricette = ricette_db_service.get_ricette_by_paziente(cf_assistito)
        else:
            # Tutte le ricette
            ricette = ricette_db_service.get_all_ricette(limit)
        
        logger.info(f"Ricette recuperate dal database locale: {len(ricette)}")
        
        return jsonify({
            'success': True,
            'source': 'database_locale',
            'count': len(ricette),
            'data': ricette,
            'parameters': {
                'limit': limit,
                'cf_assistito': cf_assistito
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore recupero ricette database locale: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'source': 'database_locale',
            'error': 'DATABASE_ERROR',
            'message': f'Errore database locale: {str(e)}'
        }), 500

@ricetta_bp.route("/ricetta/health", methods=['GET'])
def health_check():
    """Health check per il servizio ricetta"""
    try:
        from services.ricette_ts_service import ricette_ts_service
        info = ricette_ts_service.get_environment_info()
        return jsonify({
            'success': True,
            'service': 'ricetta_elettronica_v2',
            'environment': info['environment'],
            'cf_medico': info['cf_medico'],
            'certificates_valid': all(info['certificates'].values()),
            'credentials_configured': info['credentials_configured'],
            'id_sessione_set': info.get('id_sessione_set', False),
            'id_sessione_preview': info.get('id_sessione_preview')
        }), 200
    except Exception as e:
        logger.error(f"Errore health check: {e}")
        return jsonify({
            'success': False,
            'error': 'HEALTH_CHECK_FAILED',
            'message': str(e)
        }), 500

@ricetta_bp.route("/ricetta/test-connection", methods=['GET'])
@jwt_required()
def test_connection():
    """Testa la connessione al Sistema Tessera Sanitaria"""
    try:
        from services.ricette_ts_service import ricette_ts_service
        result = ricette_ts_service.test_connection()
        
        status_code = 200 if result['success'] else 502
        return jsonify({
            'success': result['success'],
            'data': result,
            'message': result.get('message', 'Test completato')
        }), status_code
        
    except Exception as e:
        logger.error(f"Errore test connessione: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_CONNECTION_FAILED',
            'message': f'Errore durante il test: {e}'
        }), 500

@ricetta_bp.route("/ricetta/test/farmaci-sicuri", methods=['GET'])
@jwt_required()
def get_farmaci_test_sicuri():
    """Ottiene farmaci sicuri per test"""
    try:
        farmaci = ricetta_data_manager.get_farmaci_test_sicuri()
        
        return jsonify({
            'success': True,
            'data': farmaci,
            'count': len(farmaci),
            'message': 'Farmaci sicuri per ambiente test'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore farmaci test: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_DATA_FAILED',
            'message': f'Errore caricamento farmaci test: {e}'
        }), 500

@ricetta_bp.route("/ricetta/invio/email", methods=['POST'])
@jwt_required()
def invia_ricetta_email():
    """Invia il PDF promemoria della ricetta via email al paziente"""
    try:
        dati = request.get_json()
        if not dati:
            return jsonify({
                'success': False,
                'error': 'EMPTY_REQUEST',
                'message': 'Dati email non presenti'
            }), 400

        email_paziente = dati.get('email_paziente')
        nome_paziente = dati.get('nome_paziente')
        pdf_base64 = dati.get('pdf_base64')
        nre = dati.get('nre')

        if not email_paziente or not pdf_base64:
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': 'Email paziente e PDF sono obbligatori'
            }), 400

        from services.ricetta_email_service import invia_pdf_ricetta_email
        invia_pdf_ricetta_email(email_paziente, nome_paziente or 'Paziente', pdf_base64, nre=nre)

        return jsonify({
            'success': True,
            'message': f'Email inviata a {email_paziente}'
        })
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'INVALID_REQUEST',
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Errore invio email ricetta: {e}")
        return jsonify({
            'success': False,
            'error': 'EMAIL_SEND_FAILED',
            'message': str(e)
        }), 500

@ricetta_bp.route("/ricetta/db/save", methods=['POST'])
@jwt_required()
def save_ricetta():
    """Salva ricetta elettronica nel database locale"""
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_CONTENT_TYPE',
                'message': 'Content-Type deve essere application/json'
            }), 400
            
        ricetta_data = request.get_json()
        if not ricetta_data:
            return jsonify({
                'success': False,
                'error': 'EMPTY_REQUEST',
                'message': 'Dati ricetta non presenti'
            }), 400
        
        logger.info(f"Salvataggio ricetta per CF: {ricetta_data.get('cf_assistito', 'N/A')}")
        
        # Usa il servizio DB V2
        from services.ricette_db_service import ricette_db_service
        
        ricetta_id = ricette_db_service.save_ricetta(ricetta_data)
        
        logger.info(f"Ricetta salvata con ID: {ricetta_id}")
        
        return jsonify({
            'success': True,
            'message': 'Ricetta salvata con successo',
            'data': {
                'ricetta_id': ricetta_id,
                'nre': ricetta_data.get('nre'),
                'cf_assistito': ricetta_data.get('cf_assistito')
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Errore salvataggio ricetta: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'SAVE_FAILED',
            'message': f'Errore salvataggio ricetta: {str(e)}'
        }), 500

@ricetta_bp.route("/ricetta/test/ricette-funzionanti", methods=['GET'])
@jwt_required()
def get_ricette_test_funzionanti():
    """Ottiene ricette test già funzionanti"""
    try:
        ricette = ricetta_data_manager.get_ricette_test_funzionanti()
        
        return jsonify({
            'success': True,
            'data': ricette,
            'count': len(ricette),
            'message': 'Ricette test funzionanti'
        }), 200
        
    except Exception as e:
        logger.error(f"Errore ricette test: {e}")
        return jsonify({
            'success': False,
            'error': 'TEST_DATA_FAILED',
            'message': f'Errore caricamento ricette test: {e}'
        }), 500


sanitel_cert = "/path/to/cert.cer"  # percorso certificato

@ricetta_bp.route("/ricetta/cifra-cf", methods=['POST'])
def encrypt_cf():
    """
    Cifra il cf_assistito usando il certificato SanitelCF
    Seguendo le specifiche del kit ufficiale
    """
    try:
        data = request.get_json()
        cf_assistito = data["cf_assistito"]

        # Carica il certificato SanitelCF
        with open(SANITEL_CERT_PATH, 'rb') as f:
            cert_data = f.read()
            
        # Se è un file .cer_, rinominalo
        if SANITEL_CERT_PATH.endswith('.cer_'):
            cert_path_fixed = SANITEL_CERT_PATH.replace('.cer_', '.cer')
            if not os.path.exists(cert_path_fixed):
                with open(cert_path_fixed, 'wb') as f_out:
                    f_out.write(cert_data)
            cert_data = open(cert_path_fixed, 'rb').read()
        
        # Parse del certificato
        if cert_data.startswith(b'-----BEGIN'):
            cert = x509.load_pem_x509_certificate(cert_data)
        else:
            cert = x509.load_der_x509_certificate(cert_data)
        
        # Estrai la chiave pubblica
        public_key = cert.public_key()
        
        # Cifra il CF
        cf_bytes = cf_assistito.encode('utf-8')
        encrypted = public_key.encrypt(
            cf_bytes,
            padding.PKCS1v15()
        )
        
        # Codifica in base64
        encrypted_b64 = base64.b64encode(encrypted).decode('utf-8')
        
        logger.info("Codice fiscale cifrato correttamente")
        return { "cf_cifrato": encrypted_b64 }
        
    except Exception as e:
        logger.error(f"Errore cifratura CF: {e}")
        raise

@ricetta_bp.route("/ricetta/cifra-pincode", methods=['POST'])
def encrypt_pincode():
    """
    Cifra il pincode usando il certificato SanitelCF
    Funzione generica per cifrare pincode o codice fiscale
    """
    try:
        data = request.get_json()
        pincode = data["pincode"]

        # Carica il certificato SanitelCF
        with open(SANITEL_CERT_PATH, 'rb') as f:
            cert_data = f.read()
            
        # Se è un file .cer_, rinominalo
        if SANITEL_CERT_PATH.endswith('.cer_'):
            cert_path_fixed = SANITEL_CERT_PATH.replace('.cer_', '.cer')
            if not os.path.exists(cert_path_fixed):
                with open(cert_path_fixed, 'wb') as f_out:
                    f_out.write(cert_data)
            cert_data = open(cert_path_fixed, 'rb').read()
        
        # Parse del certificato
        if cert_data.startswith(b'-----BEGIN'):
            cert = x509.load_pem_x509_certificate(cert_data)
        else:
            cert = x509.load_der_x509_certificate(cert_data)
        
        # Estrai la chiave pubblica
        public_key = cert.public_key()
        
        # Cifra il pincode
        pincode_bytes = pincode.encode('utf-8')
        encrypted = public_key.encrypt(
            pincode_bytes,
            padding.PKCS1v15()
        )
        
        # Codifica in base64
        encrypted_b64 = base64.b64encode(encrypted).decode('utf-8')
        
        logger.info("Pincode cifrato correttamente")
        return { "pincode_cifrato": encrypted_b64 }
        
    except Exception as e:
        logger.error(f"Errore cifratura pincode: {e}")
        raise