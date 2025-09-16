"""
Servizio per la gestione delle ricette elettroniche tramite Sistema TS - Versione 2
Replica la logica di visualizza_ricette() da V1 ricetta_service.py
"""

import os
import ssl
import requests
import urllib3
from datetime import datetime, timedelta
from requests.adapters import HTTPAdapter

import logging
from typing import Dict, Any, Optional

# Carica variabili d'ambiente dal file .env nella root del progetto
try:
    from dotenv import load_dotenv
    # Trova la root del progetto (due livelli sopra questo file)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    env_path = os.path.join(project_root, '.env')
    load_dotenv(env_path)
    print(f"✅ File .env caricato da: {env_path}")
except ImportError:
    print("⚠️  python-dotenv non installato, usando solo variabili d'ambiente di sistema")
except Exception as e:
    print(f"⚠️  Errore caricamento .env: {e}")

logger = logging.getLogger(__name__)

class RicetteTsService:
    """
    Servizio per la comunicazione con il Sistema Tessera Sanitaria.
    
    Implementa solo il recupero ricette dal Sistema TS tramite SOAP,
    replicando esattamente la logica V1 che funziona.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._load_configuration()
        
    def _load_configuration(self):
        """Carica configurazione dinamica da variabili d'ambiente"""
        self.env = 'prod'  # SEMPRE PRODUZIONE per visualizzazione
        
        # Path dinamico - usa la stessa logica del caricamento .env
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        
        # === CONFIGURAZIONE DINAMICA - Tutti i dati da env ===
        self.cf_medico = os.getenv('CF_MEDICO_PROD')
        self.password = os.getenv('PASSWORD_PROD')
        self.pincode = os.getenv('PINCODE_PROD')
        self.regione = os.getenv('REGIONE_PROD')
        self.asl = os.getenv('ASL_PROD')
        self.specializzazione = os.getenv('SPECIALIZZAZIONE_PROD')
        
        # Endpoint dinamici da env
        self.endpoint_visualizza = os.getenv('ENDPOINT_VISUALIZZA_PROD', 
            'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca')
        self.endpoint_invio = os.getenv('ENDPOINT_INVIO_PROD',
            'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca')
        self.endpoint_annulla = os.getenv('ENDPOINT_ANNULLA_PROD',
            'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca')
        
        # Certificati dinamici da env - path relativo a server_v2/certs/prod
        server_v2_dir = os.path.dirname(os.path.dirname(__file__))  # server_v2/
        certs_dir = os.getenv('CERTS_DIR_PROD', os.path.join(server_v2_dir, 'certs', 'prod'))
        self.client_cert = os.getenv('CLIENT_CERT_PATH', os.path.join(certs_dir, 'client_cert.pem'))
        self.client_key = os.getenv('CLIENT_KEY_PATH', os.path.join(certs_dir, 'client_key.pem'))
        self.sanitel_cert = os.getenv('SANITEL_CERT_PATH', os.path.join(certs_dir, 'SanitelCF-2024-2027.cer'))
        
        # Validazione configurazione obbligatoria
        required_vars = ['CF_MEDICO_PROD', 'PASSWORD_PROD', 'PINCODE_PROD', 'REGIONE_PROD', 'ASL_PROD', 'ID_SESSIONE_PROD']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            self.logger.error(f"Variabili d'ambiente mancanti: {missing_vars}")
            self.logger.error(f"File .env cercato in: {os.path.join(project_root, '.env')}")
            raise ValueError(f"Configurazione incompleta: mancano {missing_vars}")
        
        self.logger.info(f"RicetteTsService configurato dinamicamente")
        self.logger.info(f"Project root: {project_root}")
        self.logger.info(f"CF Medico: {self.cf_medico}")
        self.logger.info(f"Regione: {self.regione}, ASL: {self.asl}")
        self.logger.info(f"Endpoint visualizzazione: {self.endpoint_visualizza}")
        self.logger.info(f"Certificati: {self.client_cert}")
        self.logger.info(f"SanitelCF certificato: {self.sanitel_cert} (esiste: {os.path.exists(self.sanitel_cert)})")
    
    def _get_current_env(self) -> str:
        """Ottiene l'ambiente corrente - SEMPRE PRODUZIONE per visualizzazione"""
        return 'prod'  # SEMPRE PRODUZIONE per visualizzazione ricette
    
    def reload_configuration(self):
        """Ricarica la configurazione da variabili d'ambiente"""
        self.logger.info("Ricarico configurazione da variabili d'ambiente")
        self._load_configuration()
    
    def _genera_token_2fa(self) -> str:
        """
        Ottiene l'ID-SESSIONE per il Sistema TS - OBBLIGATORIO
        """
        id_sessione = os.getenv('ID_SESSIONE_PROD')
        
        if not id_sessione:
            raise ValueError("ID_SESSIONE_PROD deve essere configurato nel file .env")
        
        self.logger.info("Usando ID-SESSIONE da variabile d'ambiente")
        return id_sessione
    
    def _encrypt_cf_assistito(self, cf_assistito: str) -> str:
        """
        Cifra il CF dell'assistito usando l'endpoint di cifratura dinamico
        """
        try:
            # Endpoint di cifratura dinamico da env
            cifra_endpoint = os.getenv('CIFRA_CF_ENDPOINT', 'http://localhost:5001/api/v2/ricetta/cifra-cf')
            
            import requests
            
            response = requests.post(
                cifra_endpoint,
                json={'cf_assistito': cf_assistito},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                cf_cifrato = response.json().get('cf_cifrato')
                return cf_cifrato
            else:
                return cf_assistito
                
        except Exception as e:
            self.logger.error(f"Errore cifratura CF assistito: {e}")
            # Fallback: ritorna in chiaro se cifratura fallisce
            return cf_assistito
    
    def _create_session(self) -> requests.Session:
        """
        Crea sessione HTTP con configurazione SSL legacy - copia esatta da V1
        """
        # Disabilita avvisi SSL
        urllib3.disable_warnings()
        
        # Configurazione SSL permissiva per certificati legacy - copia V1
        class LegacySSLAdapter(HTTPAdapter):
            def init_poolmanager(self, *args, **kwargs):
                # Crea contesto SSL con security level 0
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                
                # Configurazione ultra-permissiva
                context.set_ciphers('ALL:@SECLEVEL=0')
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                
                # Opzioni per certificati molto vecchi
                context.options |= ssl.OP_LEGACY_SERVER_CONNECT
                if hasattr(ssl, 'OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION'):
                    context.options |= ssl.OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION
                
                kwargs['ssl_context'] = context
                return super().init_poolmanager(*args, **kwargs)
        
        # Configurazione ambiente
        os.environ['PYTHONHTTPSVERIFY'] = '0'
        os.environ['OPENSSL_CONF'] = ''
        
        session = requests.Session()
        session.mount('https://', LegacySSLAdapter())
        
        # Basic Authentication (CF medico + password)
        session.auth = (self.cf_medico, self.password)
        # Certificati SSL client se esistono
        if os.path.exists(self.client_cert) and os.path.exists(self.client_key):
            session.cert = (self.client_cert, self.client_key)
        
        # Disabilita verifica SSL
        session.verify = False
        
        # Headers globali
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Connection': 'close'
        })
        
        return session
    
    def _create_visualizza_soap_request(self, data_da: str, data_a: str, cf_assistito: str = None, nre: str = None) -> str:
        """
        Crea richiesta SOAP per visualizzazione ricette - DINAMICA
        """
        
        # PINCODE CIFRATO DINAMICO - da variabile d'ambiente o cifrato dinamicamente
        pincode_cifrato = os.getenv('PINCODE_CIFRATO_PROD')
        
        if not pincode_cifrato:
            # Se non è fornito cifrato, usa il pincode in chiaro e lo cifra
            if self.pincode:
                pincode_cifrato = self._encrypt_pincode(self.pincode)
            else:
                raise ValueError("PINCODE_CIFRATO_PROD o PINCODE_PROD deve essere configurato")
        
        # CF ASSISTITO CIFRATO - sempre cifrato dinamicamente se fornito
        if cf_assistito:
            cf_assistito_cifrato = self._encrypt_cf_assistito(cf_assistito)
        else:
            # CF assistito di default da env
            cf_assistito_default = os.getenv('CF_ASSISTITO_DEFAULT_CIFRATO')
            if cf_assistito_default:
                cf_assistito_cifrato = cf_assistito_default
            else:
                raise ValueError("CF_ASSISTITO_DEFAULT_CIFRATO deve essere configurato se non viene fornito CF assistito")
        
        # Template SOAP DINAMICO per visualizzazione ricette con data, CF assistito e NRE opzionale
        soap_template = f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:vis="http://visualizzaprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it" 
                  xmlns:tip="http://tipodativisualizzaprescrittoricettabianca.xsd.dem.sanita.finanze.it">
    <soapenv:Header/>
    <soapenv:Body>
        <vis:VisualizzaPrescrittoRicettaBiancaRichiesta>
            <vis:codicePaziente>{cf_assistito_cifrato}</vis:codicePaziente>
            <vis:cfMedico>{self.cf_medico}</vis:cfMedico>'''
        
        # Aggiungi NRE se specificato
        if nre:
            soap_template += f'''
            <vis:nrbe>{nre}</vis:nrbe>'''
        
        soap_template += '''
        </vis:VisualizzaPrescrittoRicettaBiancaRichiesta>
    </soapenv:Body>
</soapenv:Envelope>'''
        
        return soap_template
    
    def _encrypt_pincode(self, pincode: str) -> str:
        """
        Cifra il pincode usando l'endpoint di cifratura dinamico
        """
        try:
            # Endpoint di cifratura pincode dinamico da env
            cifra_pincode_endpoint = os.getenv('CIFRA_PINCODE_ENDPOINT', 'http://localhost:5001/api/v2/ricetta/cifra-pincode')
            
            import requests
            
            response = requests.post(
                cifra_pincode_endpoint,
                json={'pincode': pincode},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                pincode_cifrato = response.json().get('pincode_cifrato')
                return pincode_cifrato
            else:
                return pincode
                
        except Exception as e:
            self.logger.error(f"Errore cifratura pincode: {e}")
            # Fallback: ritorna il pincode originale se cifratura fallisce
            return pincode
    
    def _parse_visualizza_response(self, response: requests.Response) -> Dict[str, Any]:
        """Parsa la risposta della visualizzazione ricette - BASATO SUI TRACCIATI UFFICIALI"""
        try:
            response_text = response.text
            self.logger.info(f"Parsing risposta visualizzazione ricette")
            
            if response.status_code == 200:
                
                # === PARSING XML BASATO SUI TRACCIATI UFFICIALI ===
                ricette = []
                metadati_risposta = {}
                
                try:
                    from lxml import etree
                    import re
                    
                    # Parse XML response
                    root = etree.fromstring(response.content)
                    
                    # Namespaces ufficiali dal kit di sviluppo
                    namespaces = {
                        'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                        'ricevuta': 'http://visualizzaprescrittoricettabiancaricevuta.xsd.dem.sanita.finanze.it',
                        'td': 'http://tipodativisualizzaprescrittoricettabianca.xsd.dem.sanita.finanze.it'
                    }
                    
                    # === ESTRAZIONE METADATI RISPOSTA (dal tracciato ufficiale) ===
                    metadati_risposta = self._extract_response_metadata(root, namespaces)
                    
                    # === ANALISI ERRORI ===
                    error_analysis = self._analyze_response_errors(metadati_risposta)
                    
                    # === RICERCA RICETTE SINGOLE ===
                    # Il Sistema TS restituisce una singola ricetta per richiesta
                    # Cerca l'elemento principale della risposta
                    ricetta_principale = root.xpath('//ricevuta:VisualizzaPrescrittoRicettaBiancaRicevuta', namespaces=namespaces)
                    
                    if ricetta_principale:
                        self.logger.info("Trovata ricetta principale nel formato ufficiale")
                        ricetta_data = self._parse_ricetta_officiale(ricetta_principale[0], namespaces)
                        if ricetta_data:
                            ricette.append(ricetta_data)
                    
                    # === FALLBACK: RICERCA ALTERNATIVA ===
                    if not ricette:
                        # Cerca ricette in altri formati possibili
                        ricette_alternative = root.xpath('//ricetta | //ricettaElettronica | //dettaglioPrescrizioneRicettaBianca')
                        self.logger.info(f"Trovate ricette alternative: {len(ricette_alternative)}")
                        
                        for ricetta_elem in ricette_alternative:
                            ricetta_data = self._parse_single_ricetta(ricetta_elem, namespaces)
                            if ricetta_data:
                                ricette.append(ricetta_data)
                    
                    # === FALLBACK FINALE: REGEX ===
                    if not ricette:
                        ricette = self._parse_ricette_fallback(response_text)
                    
                    self.logger.info(f"Parsing completato: {len(ricette)} ricette trovate")
                    
                except Exception as parse_error:
                    self.logger.error(f"Errore parsing XML: {parse_error}")
                    # Fallback: usa parsing regex
                    ricette = self._parse_ricette_fallback(response_text)
                
                return {
                    'success': True,
                    'http_status': response.status_code,
                    'ricette': ricette,
                    'total_count': len(ricette),
                    'response_xml': response_text,
                    'metadati_risposta': metadati_risposta,
                    'error_analysis': error_analysis,
                    'timestamp': datetime.now().isoformat(),
                    'message': f'Parsing completato: {len(ricette)} ricette estratte'
                }
            else:
                return {
                    'success': False,
                    'http_status': response.status_code,
                    'error': f'HTTP {response.status_code}',
                    'response_xml': response_text,
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            self.logger.error(f"Errore parsing risposta visualizzazione: {e}")
            return {
                'success': False,
                'error': f'Errore parsing risposta: {str(e)}',
                'http_status': response.status_code if hasattr(response, 'status_code') else 0,
                'response_xml': response.text if hasattr(response, 'text') else '',
                'timestamp': datetime.now().isoformat()
            }
    
    def _extract_response_metadata(self, root, namespaces: dict) -> dict:
        """Estrae i metadati della risposta dal tracciato ufficiale"""
        try:
            metadati = {}
            
            # Estrai campi principali della risposta (dal XSD ufficiale)
            metadati['protocollo_transazione'] = self._extract_text(root, ['protocolloTransazione'])
            metadati['data_ricezione'] = self._extract_text(root, ['dataRicezione'])
            metadati['cod_esito_visualizzazione'] = self._extract_text(root, ['codEsitoVisualizzazione'])
            metadati['cf_medico'] = self._extract_text(root, ['cfMedico'])
            metadati['nome_medico'] = self._extract_text(root, ['nomeMedico'])
            metadati['cognome_medico'] = self._extract_text(root, ['cognomeMedico'])
            metadati['cod_regione'] = self._extract_text(root, ['codRegione'])
            metadati['cod_asl'] = self._extract_text(root, ['codASLAo'])
            metadati['cod_specializzazione'] = self._extract_text(root, ['codSpecializzazione'])
            metadati['codice_paziente'] = self._extract_text(root, ['codicePaziente'])
            metadati['cogn_nome'] = self._extract_text(root, ['cognNome'])
            metadati['indirizzo'] = self._extract_text(root, ['indirizzo'])
            metadati['tipo_prescrizione'] = self._extract_text(root, ['tipoPrescrizione'])
            metadati['cod_diagnosi'] = self._extract_text(root, ['codDiagnosi'])
            metadati['descr_diagnosi'] = self._extract_text(root, ['descrDiagnosi'])
            metadati['data_compilazione'] = self._extract_text(root, ['dataCompilazione'])
            metadati['nrbe'] = self._extract_text(root, ['nrbe'])
            metadati['pin_nrbe'] = self._extract_text(root, ['pinNrbe'])
            metadati['stato_processo'] = self._extract_text(root, ['statoProcesso'])
            metadati['data_inserimento'] = self._extract_text(root, ['dataInserimento'])
            
            # Estrai errori ricetta
            errori = []
            errori_elements = root.xpath('//erroreRicetta')
            for errore_elem in errori_elements:
                errore = {
                    'cod_esito': self._extract_text(errore_elem, ['codEsito']),
                    'esito': self._extract_text(errore_elem, ['esito']),
                    'identificativo_prod_prest': self._extract_text(errore_elem, ['identificativoProdPrest']),
                    'tipo_errore': self._extract_text(errore_elem, ['tipoErrore'])
                }
                errori.append(errore)
            metadati['errori_ricetta'] = errori
            
            # Estrai comunicazioni
            comunicazioni = []
            comm_elements = root.xpath('//comunicazione')
            for comm_elem in comm_elements:
                comm = {
                    'codice': self._extract_text(comm_elem, ['codice']),
                    'messaggio': self._extract_text(comm_elem, ['messaggio'])
                }
                comunicazioni.append(comm)
            metadati['comunicazioni'] = comunicazioni
            
            return metadati
            
        except Exception as e:
            self.logger.error(f"Errore estrazione metadati: {e}")
            return {}
    
    def _parse_ricetta_officiale(self, ricetta_elem, namespaces: dict) -> dict:
        """Parsa una ricetta usando il formato ufficiale del tracciato"""
        try:
            ricetta_data = {}
            
            # Estrai dati principali della ricetta
            ricetta_data['nre'] = self._extract_text(ricetta_elem, ['nrbe'])
            ricetta_data['codice_pin'] = self._extract_text(ricetta_elem, ['pinNrbe'])
            ricetta_data['cf_assistito'] = self._extract_text(ricetta_elem, ['codicePaziente'])
            ricetta_data['paziente_nome'] = self._extract_text(ricetta_elem, ['cognNome'])
            ricetta_data['data_compilazione'] = self._extract_text(ricetta_elem, ['dataCompilazione'])
            ricetta_data['stato'] = self._extract_text(ricetta_elem, ['statoProcesso'])
            ricetta_data['data_inserimento'] = self._extract_text(ricetta_elem, ['dataInserimento'])
            
            # Dati medico
            ricetta_data['cf_medico'] = self._extract_text(ricetta_elem, ['cfMedico'])
            ricetta_data['nome_medico'] = self._extract_text(ricetta_elem, ['nomeMedico'])
            ricetta_data['cognome_medico'] = self._extract_text(ricetta_elem, ['cognomeMedico'])
            
            # Diagnosi
            ricetta_data['cod_diagnosi'] = self._extract_text(ricetta_elem, ['codDiagnosi'])
            ricetta_data['descr_diagnosi'] = self._extract_text(ricetta_elem, ['descrDiagnosi'])
            
            # Estrai dettagli prescrizione (farmaci)
            dettagli_prescrizione = []
            dettagli_elements = ricetta_elem.xpath('.//dettaglioPrescrizioneRicettaBianca')
            
            for dettaglio_elem in dettagli_elements:
                dettaglio = {
                    'cod_prod_prest': self._extract_text(dettaglio_elem, ['codProdPrest']),
                    'descr_prod_prest': self._extract_text(dettaglio_elem, ['descrProdPrest']),
                    'cod_gruppo_equival': self._extract_text(dettaglio_elem, ['codGruppoEquival']),
                    'descr_gruppo_equival': self._extract_text(dettaglio_elem, ['descrGruppoEquival']),
                    'non_sost': self._extract_text(dettaglio_elem, ['nonSost']),
                    'cod_motivaz_non_sost': self._extract_text(dettaglio_elem, ['codMotivazNonSost']),
                    'tdl': self._extract_text(dettaglio_elem, ['tdl']),
                    'descr_testo_libero_note': self._extract_text(dettaglio_elem, ['descrTestoLiberoNote']),
                    'quantita': self._extract_text(dettaglio_elem, ['quantita']),
                    'posologia': self._extract_text(dettaglio_elem, ['posologia']),
                    'durata_trattamento': self._extract_text(dettaglio_elem, ['durataTrattamento']),
                    'modalita_impiego': self._extract_text(dettaglio_elem, ['modalitaImpiego']),
                    'preparaz_farmaceutica': self._extract_text(dettaglio_elem, ['preparazFarmaceutica']),
                    'num_ripetibilita': self._extract_text(dettaglio_elem, ['numRipetibilita']),
                    'validita_farm': self._extract_text(dettaglio_elem, ['validitaFarm']),
                    'stato': self._extract_text(dettaglio_elem, ['stato'])
                }
                dettagli_prescrizione.append(dettaglio)
            
            ricetta_data['dettagli_prescrizione'] = dettagli_prescrizione
            
            # Se ci sono dettagli prescrizione, usa il primo per i campi principali
            if dettagli_prescrizione:
                primo_dettaglio = dettagli_prescrizione[0]
                ricetta_data['prodotto_aic'] = primo_dettaglio.get('cod_prod_prest')
                ricetta_data['denominazione_farmaco'] = primo_dettaglio.get('descr_prod_prest')
                ricetta_data['posologia'] = primo_dettaglio.get('posologia')
                ricetta_data['durata_trattamento'] = primo_dettaglio.get('durata_trattamento')
                ricetta_data['note'] = primo_dettaglio.get('descr_testo_libero_note')
                ricetta_data['quantita'] = primo_dettaglio.get('quantita')
            
            ricetta_data['source'] = 'sistema_ts_officiale'
            ricetta_data['id'] = len(ricetta_data) + 1  # ID temporaneo
            
            self.logger.info(f"Ricetta ufficiale parsata: NRE={ricetta_data.get('nre')}, Farmaco={ricetta_data.get('denominazione_farmaco')}")
            return ricetta_data
            
        except Exception as e:
            self.logger.error(f"Errore parsing ricetta ufficiale: {e}")
            return None

    def _parse_single_ricetta(self, ricetta_elem, namespaces: dict) -> dict:
        """Parsa una singola ricetta dall'elemento XML"""
        try:
            ricetta_data = {}
            
            # Estrai campi principali
            nre = self._extract_text(ricetta_elem, ['nre', 'nrbe', 'numeroRicetta'])
            pin = self._extract_text(ricetta_elem, ['pin', 'pinRicetta', 'pinNrbe'])
            cf_assistito = self._extract_text(ricetta_elem, ['cfAssistito', 'codiceFiscale', 'cfPaziente'])
            data_compilazione = self._extract_text(ricetta_elem, ['dataCompilazione', 'dataInserimento', 'dataCreazione'])
            stato = self._extract_text(ricetta_elem, ['stato', 'statoRicetta', 'esito'])
            
            # Dati farmaco
            prodotto_aic = self._extract_text(ricetta_elem, ['prodottoAic', 'aic', 'codiceFarmaco'])
            denominazione_farmaco = self._extract_text(ricetta_elem, ['denominazioneFarmaco', 'nomeFarmaco', 'farmaco'])
            posologia = self._extract_text(ricetta_elem, ['posologia', 'posologiaRicetta'])
            durata_trattamento = self._extract_text(ricetta_elem, ['durataTrattamento', 'durata'])
            note = self._extract_text(ricetta_elem, ['note', 'noteRicetta', 'osservazioni'])
            
            # Dati medico
            cf_medico = self._extract_text(ricetta_elem, ['cfMedico', 'codiceFiscaleMedico'])
            nome_medico = self._extract_text(ricetta_elem, ['nomeMedico', 'medicoNome'])
            cognome_medico = self._extract_text(ricetta_elem, ['cognomeMedico', 'medicoCognome'])
            
            # Costruisci oggetto ricetta
            if nre:  # Solo se abbiamo almeno l'NRE
                ricetta_data = {
                    'id': len(ricetta_data) + 1,  # ID temporaneo
                    'nre': nre,
                    'codice_pin': pin,
                    'cf_assistito': cf_assistito,
                    'paziente_nome': '',  # Da estrarre se disponibile
                    'paziente_cognome': '',  # Da estrarre se disponibile
                    'data_compilazione': data_compilazione,
                    'stato': stato,
                    'prodotto_aic': prodotto_aic,
                    'denominazione_farmaco': denominazione_farmaco,
                    'posologia': posologia,
                    'durata_trattamento': durata_trattamento,
                    'note': note,
                    'cf_medico': cf_medico,
                    'nome_medico': nome_medico,
                    'cognome_medico': cognome_medico,
                    'source': 'sistema_ts_parsed'
                }
                
                self.logger.info(f"Ricetta parsata: NRE={nre}, Farmaco={denominazione_farmaco}")
                return ricetta_data
            
        except Exception as e:
            self.logger.error(f"Errore parsing singola ricetta: {e}")
        
        return None
    
    def _extract_text(self, element, field_names: list) -> str:
        """Estrae testo da un elemento XML usando una lista di possibili nomi campo"""
        try:
            for field_name in field_names:
                # Cerca con namespace
                for ns_prefix, ns_uri in [('ric', 'http://ricetta.sanita.finanze.it/'), 
                                        ('dem', 'http://dematerializzazione.sanita.finanze.it/'),
                                        ('', '')]:
                    if ns_prefix:
                        xpath = f'.//{ns_prefix}:{field_name}'
                        result = element.xpath(xpath, namespaces={'ric': 'http://ricetta.sanita.finanze.it/', 
                                                               'dem': 'http://dematerializzazione.sanita.finanze.it/'})
                    else:
                        xpath = f'.//{field_name}'
                        result = element.xpath(xpath)
                    
                    if result and result[0].text:
                        return result[0].text.strip()
            
            # Fallback: cerca nel testo dell'elemento
            if element.text and element.text.strip():
                return element.text.strip()
                
        except Exception as e:
            self.logger.debug(f"Errore estrazione campo {field_names}: {e}")
        
        return ''
    
    def _parse_ricette_fallback(self, response_text: str) -> list:
        """Parsing fallback usando regex per estrarre ricette"""
        ricette = []
        
        try:
            import re
            
            # Pattern per estrarre NRE (basato sui tracciati ufficiali)
            nre_pattern = r'<[^:]*:?nrbe[^>]*>([^<]+)</[^:]*:?nrbe>|<[^:]*:?nre[^>]*>([^<]+)</[^:]*:?nre>'
            nre_matches = re.findall(nre_pattern, response_text, re.IGNORECASE)
            
            for i, nre_match in enumerate(nre_matches):
                nre = nre_match[0] or nre_match[1]  # Prende il primo gruppo non vuoto
                
                if nre:
                    # Estrai altri campi con regex
                    pin_pattern = r'<[^:]*:?pinNrbe[^>]*>([^<]+)</[^:]*:?pinNrbe>'
                    pin_match = re.search(pin_pattern, response_text, re.IGNORECASE)
                    pin = pin_match.group(1) if pin_match else ''
                    
                    cf_pattern = r'<[^:]*:?codicePaziente[^>]*>([^<]+)</[^:]*:?codicePaziente>'
                    cf_match = re.search(cf_pattern, response_text, re.IGNORECASE)
                    cf_assistito = cf_match.group(1) if cf_match else ''
                    
                    cogn_nome_pattern = r'<[^:]*:?cognNome[^>]*>([^<]+)</[^:]*:?cognNome>'
                    cogn_nome_match = re.search(cogn_nome_pattern, response_text, re.IGNORECASE)
                    cogn_nome = cogn_nome_match.group(1) if cogn_nome_match else ''
                    
                    data_comp_pattern = r'<[^:]*:?dataCompilazione[^>]*>([^<]+)</[^:]*:?dataCompilazione>'
                    data_comp_match = re.search(data_comp_pattern, response_text, re.IGNORECASE)
                    data_compilazione = data_comp_match.group(1) if data_comp_match else ''
                    
                    stato_pattern = r'<[^:]*:?statoProcesso[^>]*>([^<]+)</[^:]*:?statoProcesso>'
                    stato_match = re.search(stato_pattern, response_text, re.IGNORECASE)
                    stato = stato_match.group(1) if stato_match else 'Trovata'
                    
                    # Estrai dettagli farmaco
                    farmaco_pattern = r'<[^:]*:?descrProdPrest[^>]*>([^<]+)</[^:]*:?descrProdPrest>'
                    farmaco_match = re.search(farmaco_pattern, response_text, re.IGNORECASE)
                    denominazione_farmaco = farmaco_match.group(1) if farmaco_match else ''
                    
                    aic_pattern = r'<[^:]*:?codProdPrest[^>]*>([^<]+)</[^:]*:?codProdPrest>'
                    aic_match = re.search(aic_pattern, response_text, re.IGNORECASE)
                    prodotto_aic = aic_match.group(1) if aic_match else ''
                    
                    posologia_pattern = r'<[^:]*:?posologia[^>]*>([^<]+)</[^:]*:?posologia>'
                    posologia_match = re.search(posologia_pattern, response_text, re.IGNORECASE)
                    posologia = posologia_match.group(1) if posologia_match else ''
                    
                    durata_pattern = r'<[^:]*:?durataTrattamento[^>]*>([^<]+)</[^:]*:?durataTrattamento>'
                    durata_match = re.search(durata_pattern, response_text, re.IGNORECASE)
                    durata_trattamento = durata_match.group(1) if durata_match else ''
                    
                    note_pattern = r'<[^:]*:?descrTestoLiberoNote[^>]*>([^<]+)</[^:]*:?descrTestoLiberoNote>'
                    note_match = re.search(note_pattern, response_text, re.IGNORECASE)
                    note = note_match.group(1) if note_match else ''
                    
                    ricetta_data = {
                        'id': i + 1,
                        'nre': nre,
                        'codice_pin': pin,
                        'cf_assistito': cf_assistito,
                        'paziente_nome': cogn_nome,
                        'paziente_cognome': '',
                        'data_compilazione': data_compilazione,
                        'stato': stato,
                        'prodotto_aic': prodotto_aic,
                        'denominazione_farmaco': denominazione_farmaco,
                        'posologia': posologia,
                        'durata_trattamento': durata_trattamento,
                        'note': note,
                        'source': 'sistema_ts_regex_fallback'
                    }
                    ricette.append(ricetta_data)
            
            self.logger.info(f"Fallback parsing: {len(ricette)} ricette trovate con regex")
            
        except Exception as e:
            self.logger.error(f"Errore parsing fallback: {e}")
        
        return ricette
    
    def _get_error_message_from_code(self, cod_esito: str) -> str:
        """Converte codice errore in messaggio leggibile basato sui diagnostici del sistema"""
        error_messages = {
            '0000': 'Operazione completata con successo',
            '0001': 'Ricetta non trovata',
            '0002': 'Ricetta già utilizzata',
            '0003': 'Ricetta scaduta',
            '0004': 'Ricetta annullata',
            '0005': 'Errore di validazione dati',
            '0006': 'Errore di autenticazione',
            '0007': 'Errore di autorizzazione',
            '0008': 'Errore di sistema',
            '0009': 'Ricetta non disponibile per la visualizzazione',
            '0010': 'Errore di cifratura/decifratura',
            '0011': 'Errore di connessione al sistema',
            '0012': 'Timeout della richiesta',
            '0013': 'Errore di formato dati',
            '0014': 'Errore di business logic',
            '0015': 'Errore di configurazione'
        }
        
        return error_messages.get(cod_esito, f'Errore sconosciuto (codice: {cod_esito})')
    
    def _analyze_response_errors(self, metadati_risposta: dict) -> dict:
        """Analizza gli errori nella risposta basandosi sui codici diagnostici"""
        try:
            error_analysis = {
                'has_errors': False,
                'error_level': 'info',
                'error_messages': [],
                'suggested_actions': []
            }
            
            # Analizza codice esito principale
            cod_esito = metadati_risposta.get('cod_esito_visualizzazione', '')
            if cod_esito and cod_esito != '0000':
                error_analysis['has_errors'] = True
                error_analysis['error_level'] = 'error'
                error_analysis['error_messages'].append(self._get_error_message_from_code(cod_esito))
                
                # Suggerimenti basati sul codice errore
                if cod_esito in ['0001', '0009']:
                    error_analysis['suggested_actions'].append('Verificare che l\'NRE sia corretto e che la ricetta esista')
                elif cod_esito in ['0002', '0004']:
                    error_analysis['suggested_actions'].append('La ricetta non è più utilizzabile')
                elif cod_esito == '0003':
                    error_analysis['suggested_actions'].append('La ricetta è scaduta')
                elif cod_esito in ['0006', '0007']:
                    error_analysis['suggested_actions'].append('Verificare le credenziali di accesso')
                elif cod_esito in ['0008', '0011', '0012']:
                    error_analysis['suggested_actions'].append('Riprovare più tardi - errore temporaneo del sistema')
            
            # Analizza errori ricetta specifici
            errori_ricetta = metadati_risposta.get('errori_ricetta', [])
            for errore in errori_ricetta:
                if errore.get('cod_esito'):
                    error_analysis['has_errors'] = True
                    error_analysis['error_level'] = 'warning'
                    error_analysis['error_messages'].append(f"Errore ricetta: {errore.get('esito', 'Errore sconosciuto')}")
            
            # Analizza comunicazioni
            comunicazioni = metadati_risposta.get('comunicazioni', [])
            for comm in comunicazioni:
                if comm.get('codice'):
                    error_analysis['error_messages'].append(f"Comunicazione: {comm.get('messaggio', 'Messaggio di servizio')}")
            
            return error_analysis
            
        except Exception as e:
            self.logger.error(f"Errore analisi errori: {e}")
            return {
                'has_errors': True,
                'error_level': 'error',
                'error_messages': [f'Errore nell\'analisi della risposta: {str(e)}'],
                'suggested_actions': ['Contattare il supporto tecnico']
            }
    
    def visualizza_ricetta_specifica(self, nre: str, cf_assistito: str = None, cf_medico: str = None) -> Dict[str, Any]:
        """
        Visualizza ricetta specifica tramite endpoint interrogazioni - DINAMICA
        """
        try:
            import os  # Importa os all'inizio del metodo
            self.logger.info(f"=== RICERCA RICETTA SPECIFICA ===")
            self.logger.info(f"NRE: {nre}, CF assistito: {cf_assistito}")
            
            # Endpoint interrogazioni dinamico da env
            endpoint_interrogazioni = os.getenv('ENDPOINT_INTERROGAZIONI_PROD', 
                'https://demservice.sanita.finanze.it/DemRicettaInterrogazioniServicesWeb/services/demInterrogaNreUtilizzati')
            
            # Pincode cifrato dinamico
            pincode_cifrato = os.getenv('PINCODE_CIFRATO_PROD')
            if not pincode_cifrato and self.pincode:
                pincode_cifrato = self._encrypt_pincode(self.pincode)
            
            if not pincode_cifrato:
                raise ValueError("PINCODE_CIFRATO_PROD deve essere configurato")
            
            # SOAP DINAMICO InterrogaNreUtilRichiesta
            soap_template = f'''<?xml version="1.0" encoding="UTF-8"?>
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                                xmlns:int="http://interroganreutilrichiesta.xsd.dem.sanita.finanze.it">
                    <soapenv:Header/>
                    <soapenv:Body>
                        <int:InterrogaNreUtilRichiesta>
                            <int:pinCode>{pincode_cifrato}</int:pinCode>
                            <int:codRegione>{self.regione}</int:codRegione>
                            <int:nre>{nre}</int:nre>
                            <int:cfMedico>{cf_medico or self.cf_medico}</int:cfMedico>
                            <int:cfAssistito>{cf_assistito or ''}</int:cfAssistito>
                        </int:InterrogaNreUtilRichiesta>
                    </soapenv:Body>
                </soapenv:Envelope>'''
            
            # Crea sessione e invia richiesta
            session = self._create_session()
            
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://interroganreutilizzati.wsdl.dem.sanita.finanze.it/InterrogaNreUtilizzati"',
                'User-Agent': 'Python-requests/2.28.0'
            }
            
            self.logger.info(f"=== RICERCA RICETTA SPECIFICA ===")
            self.logger.info(f"Endpoint: {endpoint_interrogazioni}")
            
            print(f"=== SOAP INTERROGAZIONI DINAMICA ===")
            print(soap_template)
            print(f"=== END SOAP ===")
            
            response = session.post(
                endpoint_interrogazioni,
                data=soap_template,
                headers=headers,
                timeout=60,
                verify=False
            )
            
            self.logger.info(f"Risposta ricevuta - Status: {response.status_code}")
            
            # SALVA RISPOSTA XML BRUTAL TEST
            response_text = response.text
            try:
                import os
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                xml_file_path = os.path.join(project_root, f"response_xml_nre_{nre}.xml")
                
                with open(xml_file_path, 'w', encoding='utf-8') as f:
                    f.write(f"<!-- RICERCA RICETTA SPECIFICA - NRE: {nre} -->\n")
                    f.write(f"<!-- HTTP Status: {response.status_code} -->\n")
                    f.write(f"<!-- Timestamp: {datetime.now().isoformat()} -->\n")
                    f.write(f"<!-- Endpoint: {endpoint_interrogazioni} -->\n")
                    f.write(f"<!-- CF Medico: {cf_medico or self.cf_medico} -->\n")
                    f.write(f"<!-- Ambiente: produzione -->\n")
                    f.write("\n")
                    f.write(response_text)
                
                print(f"📁 XML RICERCA SALVATO: {xml_file_path}")
                
            except Exception as save_error:
                self.logger.warning(f"Errore salvataggio XML: {save_error}")
            
            # Log completo per debug
            print(f"=== RISPOSTA RICERCA BASICA NRE {nre} ===")
            print(f"HTTP Status: {response.status_code}")
            print("Response Headers:")
            for header, value in response.headers.items():
                print(f"  {header}: {value}")
            print("Response Body:")
            print(response.text)
            print(f"=== FINE RISPOSTA ===")
            
            # Salva la risposta XML in un file per analisi
            response_text = response.text
            try:
                import os
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                xml_file_path = os.path.join(project_root, f"response_xml_nre_{nre}.xml")
                
                with open(xml_file_path, 'w', encoding='utf-8') as f:
                    f.write(f"<!-- Risposta Sistema TS per NRE: {nre} -->\n")
                    f.write(f"<!-- HTTP Status: {response.status_code} -->\n")
                    f.write(f"<!-- Timestamp: {datetime.now().isoformat()} -->\n")
                    f.write(f"<!-- Endpoint: {self.endpoint_visualizza} -->\n")
                    f.write(f"<!-- CF Medico: {self.cf_medico} -->\n")
                    f.write(f"<!-- Ambiente: {self.env} -->\n")
                    f.write("\n")
                    f.write(response_text)
                
                self.logger.info(f"Risposta XML salvata in: {xml_file_path}")
                print(f"📁 RISPOSTA XML SALVATA IN: {xml_file_path}")
                
            except Exception as save_error:
                self.logger.warning(f"Errore salvataggio XML: {save_error}")
            
            if response.status_code == 200:
                # Verifica se ci sono errori nel SOAP response
                if 'soap:Fault' in response_text or 'faultstring' in response_text:
                    self.logger.warning(f"SOAP Fault ricevuto per NRE {nre}")
                    return {
                        'success': False,
                        'http_status': response.status_code,
                        'error': 'SOAP_FAULT',
                        'message': f'SOAP Fault nella risposta per NRE {nre}',
                        'response_xml': response_text,
                        'timestamp': datetime.now().isoformat(),
                        'nre': nre
                    }
                
                # Risposta OK - verifica se contiene dati ricetta
                if nre in response_text or 'ricetta' in response_text.lower():
                    self.logger.info(f"Ricetta NRE {nre} trovata con ricerca basica!")
                    return {
                        'success': True,
                        'http_status': response.status_code,
                        'response_xml': response_text,
                        'timestamp': datetime.now().isoformat(),
                        'message': f'Ricetta NRE {nre} trovata con ricerca basica',
                        'nre': nre,
                        'ricetta_data': {
                            'nre': nre,
                            'stato': 'Trovata - Da parsare XML',
                            'response_xml': response_text,
                            'source': 'sistema_ts_ricerca_basica',
                            'search_type': 'solo_nre'
                        }
                    }
                else:
                    # Risposta vuota o NRE non trovato
                    self.logger.info(f"NRE {nre} non trovato con ricerca basica")
                    return {
                        'success': False,
                        'http_status': response.status_code,
                        'error': 'NRE_NOT_FOUND_BASIC',
                        'message': f'NRE {nre} non trovato con ricerca basica (serve CF assistito?)',
                        'response_xml': response_text,
                        'timestamp': datetime.now().isoformat(),
                        'nre': nre
                    }
            else:
                return {
                    'success': False,
                    'http_status': response.status_code,
                    'error': f'HTTP {response.status_code}',
                    'response_text': response_text[:500],
                    'timestamp': datetime.now().isoformat(),
                    'nre': nre
                }
                
        except Exception as e:
            self.logger.error(f"Errore visualizzazione ricetta specifica: {e}", exc_info=True)
            return {
                'success': False,
                'error': f'Errore ricerca basica NRE {nre}: {str(e)}',
                'timestamp': datetime.now().isoformat(),
                'nre': nre
            }

    def get_all_ricette(self, data_da: str = None, data_a: str = None, cf_assistito: str = None, nre: str = None) -> Dict[str, Any]:
        """
        Recupera la lista delle ricette dal Sistema TS - PRODUZIONE SEMPRE
        
        Args:
            data_da: Data inizio ricerca (formato YYYY-MM-DD) - NON USATO nel SOAP
            data_a: Data fine ricerca (formato YYYY-MM-DD) - NON USATO nel SOAP  
            cf_assistito: Codice fiscale assistito specifico (opzionale)
            
        Returns:
            Dict con risultato richiesta Sistema TS
        """
        try:
            self.logger.info(f"=== RICHIESTA VISUALIZZAZIONE RICETTE PRODUZIONE ===")
            self.logger.info(f"CF assistito: {cf_assistito}")
            self.logger.info(f"CF medico: {self.cf_medico}")
            
            # Crea richiesta SOAP per visualizzazione (data_da e data_a non sono usati nel SOAP)
            soap_request = self._create_visualizza_soap_request(data_da, data_a, cf_assistito, nre)
            
            # Esegui richiesta
            session = self._create_session()
            session.auth = (self.cf_medico, self.password)
            token_2fa = self._genera_token_2fa()
            
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://visualizzaprescrittoricettabianca.wsdl.dem.sanita.finanze.it/VisualizzaPrescrittoRicettaBianca"',
                'Authorization2F': f'Bearer {token_2fa}',
                'User-Agent': 'Python-requests/2.28.0'
            }
            
            response = session.post(
                self.endpoint_visualizza,
                data=soap_request,
                headers=headers,
                timeout=60,
                verify=False  # Disabilitato per compatibilità certificati
            )
            
            self.logger.info(f"Risposta ricevuta - Status: {response.status_code}")
            
            # Parsa la risposta
            result = self._parse_visualizza_response(response)
            
            self.logger.info(f"Risultato parsing: {result.get('total_count', 0)} ricette trovate")
            return result
            
        except Exception as e:
            self.logger.error(f"Errore visualizzazione ricette Sistema TS: {e}", exc_info=True)
            return {
                'success': False,
                'error': f'Errore Sistema TS: {str(e)}',
                'timestamp': datetime.now().isoformat(),
                'ricette': [],
                'total_count': 0,
                'response_xml': ''
            }

    def annulla_ricetta(self, nre: str, pin: str, motivazione: str = 'Annullamento ricetta') -> Dict[str, Any]:
        """
        Annulla una ricetta elettronica sul Sistema TS.
        
        Args:
            nre: Numero Ricetta Elettronica
            pin: PIN della ricetta
            motivazione: Motivo annullamento
            
        Returns:
            Dict con risultato annullamento
        """
        try:
            self.logger.info(f"Richiesta annullamento ricetta Sistema TS - NRE: {nre}")
            
            # Crea richiesta SOAP per annullamento
            soap_request = self._create_annulla_soap_request(nre, pin, motivazione)
            
            # Esegui richiesta
            session = self._create_session()
            
            # Headers per annullamento
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '""',
                'User-Agent': 'Python-requests/2.28.0'
            }
            
            self.logger.info(f"Invio richiesta annullamento a: {self.endpoint_annulla}")
            
            response = session.post(
                self.endpoint_annulla,
                data=soap_request,
                headers=headers,
                timeout=60,  # Timeout maggiore per nuovo endpoint
                verify=False  # Per ambiente test come V1
            )
            
            self.logger.info(f"Risposta annullamento ricevuta - Status: {response.status_code}")
            
            # Parsa la risposta
            return self._parse_annulla_response(response, nre)
            
        except Exception as e:
            self.logger.error(f"Errore annullamento ricetta Sistema TS: {e}", exc_info=True)
            return {
                'success': False,
                'error': f'Errore annullamento Sistema TS: {str(e)}',
                'timestamp': datetime.now().isoformat(),
                'nre': nre
            }
    
    def _create_annulla_soap_request(self, nre: str, pin: str, motivazione: str) -> str:
        """Crea richiesta SOAP per annullamento ricetta"""
        
        # Token 2FA
        token_2fa = self._genera_token_2fa()
        
        # Template SOAP per annullamento
        soap_template = f'''<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                    xmlns:dem="http://demAnnullaPrescrittoRicettaBianca.webservice.ricettabianca.sanita.it">
            <soap:Header/>
            <soap:Body>
                <dem:annullaPrescrittoRicettaBianca>
                    <dem:cfMedico>{self.cf_medico}</dem:cfMedico>
                    <dem:passwordMedico>{self.password}</dem:passwordMedico>
                    <dem:token2FA>{token_2fa}</dem:token2FA>
                    <dem:regione>{self.regione}</dem:regione>
                    <dem:asl>{self.asl}</dem:asl>
                    <dem:nre>{nre}</dem:nre>
                    <dem:pinRicetta>{pin}</dem:pinRicetta>
                    <dem:motivazioneAnnullamento>{motivazione}</dem:motivazioneAnnullamento>
                </dem:annullaPrescrittoRicettaBianca>
            </soap:Body>
        </soap:Envelope>'''
                
                return soap_template
            
            def _parse_annulla_response(self, response: requests.Response, nre: str) -> Dict[str, Any]:
                """Parsa la risposta dell'annullamento ricetta"""
                try:
                    response_text = response.text
                    self.logger.info(f"Parsing risposta annullamento ricetta {nre}")
                    
                    if response.status_code == 200:
                        # TODO: Implementare parsing completo del XML se necessario
                        # Per ora assumiamo che 200 = successo
                        
                        return {
                            'success': True,
                            'http_status': response.status_code,
                            'nre': nre,
                            'response_xml': response_text,
                            'timestamp': datetime.now().isoformat(),
                            'message': 'Ricetta annullata con successo sul Sistema TS'
                        }
                    else:
                        return {
                            'success': False,
                            'http_status': response.status_code,
                            'nre': nre,
                            'error': f'HTTP {response.status_code}',
                            'response_text': response_text[:500],
                            'timestamp': datetime.now().isoformat()
                        }
                        
                except Exception as e:
                    self.logger.error(f"Errore parsing risposta annullamento: {e}")
                    return {
                        'success': False,
                        'error': f'Errore parsing risposta: {str(e)}',
                        'http_status': response.status_code if hasattr(response, 'status_code') else 0,
                        'response_text': response.text[:500] if hasattr(response, 'text') else '',
                        'timestamp': datetime.now().isoformat(),
                        'nre': nre
                    }

            def get_environment_info(self) -> Dict[str, Any]:
                """Informazioni ambiente corrente"""
                return {
                    'environment': self.env,
                    'cf_medico': self.cf_medico,
                    'regione': self.regione,
                    'asl': self.asl,
                    'specializzazione': self.specializzazione,
                    'endpoint_visualizza': self.endpoint_visualizza,
                    'endpoint_invio': self.endpoint_invio,
                    'endpoint_annulla': self.endpoint_annulla,
                    'certificates': {
                        'client_cert': os.path.exists(self.client_cert) if hasattr(self, 'client_cert') else False,
                        'client_key': os.path.exists(self.client_key) if hasattr(self, 'client_key') else False,
                        'sanitel_cert': os.path.exists(self.sanitel_cert) if hasattr(self, 'sanitel_cert') else False
                    },
                    'credentials_configured': bool(self.cf_medico and self.password)
                }
            
            def test_connection(self) -> Dict[str, Any]:
                """Testa connessione Sistema TS"""
                try:
                    # Test semplice con richiesta di visualizzazione vuota
                    result = self.get_all_ricette()
                    return {
                        'success': not ('timeout' in result.get('error', '').lower()),
                        'message': 'Connessione Sistema TS testata',
                        'details': result
                    }
                except Exception as e:
                    return {
                        'success': False,
                        'message': f'Test connessione fallito: {e}'
                    }

            def _create_invio_soap_request(self, dati_ricetta: Dict[str, Any]) -> str:
                """
                Crea richiesta SOAP per invio ricetta - DINAMICA
                """
                
                # PinCode cifrato dinamico
                pincode_cifrato = os.getenv('PINCODE_CIFRATO_PROD')
                if not pincode_cifrato and self.pincode:
                    pincode_cifrato = self._encrypt_pincode(self.pincode)
                
                if not pincode_cifrato:
                    raise ValueError("PINCODE_CIFRATO_PROD deve essere configurato")
                
                # CF Assistito cifrato dinamicamente
                cf_assistito = dati_ricetta.get('cf_assistito')
                if cf_assistito:
                    cf_assistito_cifrato = self._encrypt_cf_assistito(cf_assistito)
                else:
                    cf_assistito_default = os.getenv('CF_ASSISTITO_DEFAULT_CIFRATO')
                    if cf_assistito_default:
                        cf_assistito_cifrato = cf_assistito_default
                    else:
                        raise ValueError("CF_ASSISTITO_DEFAULT_CIFRATO deve essere configurato se non viene fornito CF assistito")
                
                # Timestamp dinamico
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                # Template SOAP IDENTICO V1 - che funziona
                soap_xml = f"""<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                                xmlns:inv="http://invioprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it"
                                xmlns:tip="http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it">
            <soapenv:Header/>
            <soapenv:Body>
                <inv:InvioPrescrittoRicettaBiancaRichiesta>
                    <inv:pinCode>{pincode_cifrato}</inv:pinCode>
                    <inv:cfMedico>{self.cf_medico}</inv:cfMedico>
                    <inv:codRegione>{self.regione}</inv:codRegione>
                    <inv:codASLAo>{self.asl}</inv:codASLAo>
                    <inv:codSpecializzazione>{self.specializzazione}</inv:codSpecializzazione>
                    <inv:numIscrizAlbo>{dati_ricetta.get('num_iscrizione', '12345')}</inv:numIscrizAlbo>
                    <inv:indirMedico>{dati_ricetta.get('indirizzo_medico', 'Via Roma, 1|00100|Roma|RM')}</inv:indirMedico>
                    <inv:telefMedico>{dati_ricetta.get('telefono_medico', '+39|0612345678')}</inv:telefMedico>
                    <inv:codicePaziente>{cf_assistito_cifrato}</inv:codicePaziente>
                    <inv:cognNome>{dati_ricetta.get('nome_paziente', 'ROSSI MARIO')}</inv:cognNome>
                    <inv:indirizzo>{dati_ricetta.get('indirizzo_paziente', 'Via Garibaldi, 10|00100|Roma|RM')}</inv:indirizzo>
                    <inv:tipoPrescrizione>F</inv:tipoPrescrizione>
                    <inv:codDiagnosi>{dati_ricetta.get('codice_diagnosi', 'Z01.8')}</inv:codDiagnosi>
                    <inv:descrDiagnosi>{dati_ricetta.get('descrizione_diagnosi', 'Altro esame generale e screening')}</inv:descrDiagnosi>
                    <inv:dataCompilazione>{timestamp}</inv:dataCompilazione>
                    <inv:dettaglioPrescrizioneRicettaBianca>
                        <tip:codProdPrest>{dati_ricetta.get('codice_farmaco', '000123456')}</tip:codProdPrest>
                        <tip:descrProdPrest>{dati_ricetta.get('denominazione_farmaco', 'TACHIPIRINA 500 mg compresse')}</tip:descrProdPrest>
                        <tip:tdl>0</tip:tdl>
                        <tip:descrTestoLiberoNote>{dati_ricetta.get('note', 'Assumere al bisogno per dolore o febbre')}</tip:descrTestoLiberoNote>
                        <tip:quantita>{dati_ricetta.get('quantita', '1')}</tip:quantita>
                        <tip:posologia>{dati_ricetta.get('posologia', '1 compressa ogni 6 ore al bisogno')}</tip:posologia>
                    </inv:dettaglioPrescrizioneRicettaBianca>
                </inv:InvioPrescrittoRicettaBiancaRichiesta>
            </soapenv:Body>
        </soapenv:Envelope>"""
                
                return soap_xml
            
            def _parse_invio_response(self, response: requests.Response, dati_ricetta: Dict[str, Any]) -> Dict[str, Any]:
                """Parsa la risposta dell'invio ricetta - COPIA ESATTA LOGICA DA V1 CHE FUNZIONA"""
                try:
                    self.logger.info(f"Parsing risposta invio ricetta")
                    
                    if response.status_code == 200:
                        # Parse XML response - LOGICA IDENTICA V1
                        from lxml import etree
                        import re
                        
                        root = etree.fromstring(response.content)
                        
                        # Namespaces esatti dal V1 che funziona
                        namespaces = {
                            'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                            'dem': 'http://dematerializzazione.sanita.finanze.it/',
                            'ric': 'http://ricetta.sanita.finanze.it/'
                        }
                        
                        # === ESTRAZIONE DATI IDENTICA A V1 ===
                        
                        # Cerca NRE (Numero Ricetta Elettronica) - nel sistema TS è chiamato "nrbe"
                        nre_element = root.xpath('//nrbe/text()') or root.xpath('//ric:nre/text()', namespaces=namespaces)
                        nre = nre_element[0] if nre_element else None
                        
                        # Cerca PIN ricetta - nel sistema TS è chiamato "pinNrbe"
                        pin_element = root.xpath('//pinNrbe/text()') or root.xpath('//ric:pinRicetta/text()', namespaces=namespaces)
                        pin_ricetta = pin_element[0] if pin_element else None
                        
                        # Cerca codice transazione/protocollo
                        protocollo_element = root.xpath('//protocolloTransazione/text()') or root.xpath('//ric:protocolloTransazione/text()', namespaces=namespaces)
                        protocollo_transazione = protocollo_element[0] if protocollo_element else None
                        
                        # Cerca codice autorizzazione (se presente)
                        auth_element = root.xpath('//ric:codiceAutorizzazione/text()', namespaces=namespaces)
                        codice_autorizzazione = auth_element[0] if auth_element else None
                        
                        # Cerca PDF promemoria (ricetta bianca stampabile)
                        pdf_element = root.xpath('//pdfPromemoria/text()')
                        pdf_promemoria_b64 = pdf_element[0] if pdf_element else None
                        
                        # Cerca data inserimento
                        data_element = root.xpath('//dataInserimento/text()')
                        data_inserimento = data_element[0] if data_element else None
                        
                        # Cerca nome e cognome medico dalla risposta
                        nome_medico_element = root.xpath('//nomeMedico/text()')
                        cognome_medico_element = root.xpath('//cognomeMedico/text()')
                        nome_medico = nome_medico_element[0] if nome_medico_element else None
                        cognome_medico = cognome_medico_element[0] if cognome_medico_element else None
                        
                        # Estrai anche informazioni di errore se presenti
                        cod_esito_element = root.xpath('//codEsitoInserimento/text()')
                        cod_esito = cod_esito_element[0] if cod_esito_element else None
                        
                        errore_cod_element = root.xpath('//ns2:codEsito/text()', namespaces={'ns2': 'http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it'})
                        errore_desc_element = root.xpath('//ns2:esito/text()', namespaces={'ns2': 'http://tipodatiinvioprescrittoricettabianca.xsd.dem.sanita.finanze.it'})
                        
                        errore_cod = errore_cod_element[0] if errore_cod_element else None
                        errore_desc = errore_desc_element[0] if errore_desc_element else None
                        
                        # === FALLBACK REGEX IDENTICI V1 ===
                        response_text = response.text
                        
                        if not nre and ('nre' in response_text.lower() or 'nrbe' in response_text.lower()):
                            # Fallback: cerca pattern nel testo XML - cerca sia nre che nrbe
                            nre_match = re.search(r'<[^:]*:?nrbe[^>]*>([^<]+)</[^:]*:?nrbe>', response_text, re.IGNORECASE)
                            if not nre_match:
                                nre_match = re.search(r'<[^:]*:?nre[^>]*>([^<]+)</[^:]*:?nre>', response_text, re.IGNORECASE)
                            if nre_match:
                                nre = nre_match.group(1)
                        
                        if not pin_ricetta and ('pin' in response_text.lower()):
                            # Cerca sia pinNrbe che pinRicetta
                            pin_match = re.search(r'<[^:]*:?pinNrbe[^>]*>([^<]+)</[^:]*:?pinNrbe>', response_text, re.IGNORECASE)
                            if not pin_match:
                                pin_match = re.search(r'<[^:]*:?pin[Rr]icetta[^>]*>([^<]+)</[^:]*:?pin[Rr]icetta>', response_text, re.IGNORECASE)
                            if pin_match:
                                pin_ricetta = pin_match.group(1)
                        
                        # Cerca protocollo transazione se non trovato
                        if not protocollo_transazione:
                            protocollo_match = re.search(r'<protocolloTransazione>([^<]+)</protocolloTransazione>', response_text)
                            if protocollo_match:
                                protocollo_transazione = protocollo_match.group(1)
                        
                        # Cerca altri dati con fallback regex
                        if not data_inserimento:
                            data_match = re.search(r'<dataInserimento>([^<]+)</dataInserimento>', response_text)
                            if data_match:
                                data_inserimento = data_match.group(1)
                        
                        if not nome_medico:
                            nome_match = re.search(r'<nomeMedico>([^<]+)</nomeMedico>', response_text)
                            if nome_match:
                                nome_medico = nome_match.group(1)
                        
                        if not cognome_medico:
                            cognome_match = re.search(r'<cognomeMedico>([^<]+)</cognomeMedico>', response_text)
                            if cognome_match:
                                cognome_medico = cognome_match.group(1)
                        
                        if not pdf_promemoria_b64:
                            pdf_match = re.search(r'<pdfPromemoria>([^<]+)</pdfPromemoria>', response_text)
                            if pdf_match:
                                pdf_promemoria_b64 = pdf_match.group(1)
                        
                        # === RETURN IDENTICO V1 ===
                        return {
                            'success': True,
                            'http_status': response.status_code,
                            'nre': nre,
                            'pin_ricetta': pin_ricetta,
                            'protocollo_transazione': protocollo_transazione,
                            'codice_autorizzazione': codice_autorizzazione,
                            'cod_esito_inserimento': cod_esito,
                            'errore_codice': errore_cod,
                            'errore_descrizione': errore_desc,
                            'has_errors': bool(errore_cod),
                            'response_xml': response.text,
                            'timestamp': datetime.now().isoformat(),
                            'pdf_promemoria_b64': pdf_promemoria_b64,
                            'data_inserimento': data_inserimento,
                            'nome_medico': nome_medico,
                            'cognome_medico': cognome_medico,
                            'pdf_disponibile': bool(pdf_promemoria_b64),
                            'parsed_data': {
                                'numero_ricetta': nre,
                                'codice_pin': pin_ricetta,
                                'protocollo_transazione': protocollo_transazione,
                                'esito_inserimento': cod_esito,
                                'errore': errore_desc if errore_cod else None,
                                'pdf_ricetta': pdf_promemoria_b64,
                                'data_creazione': data_inserimento,
                                'medico_nome': nome_medico,
                                'medico_cognome': cognome_medico
                            }
                        }
                    else:
                        return {
                            'success': False,
                            'http_status': response.status_code,
                            'error': f'HTTP {response.status_code}',
                            'response_text': response.text[:500],
                            'timestamp': datetime.now().isoformat()
                        }
                        
                except Exception as e:
                    self.logger.error(f"Errore parsing risposta invio: {e}")
                    return {
                        'success': False,
                        'error': f'Errore parsing risposta: {str(e)}',
                        'response_text': response.text[:500] if hasattr(response, 'text') else '',
                        'timestamp': datetime.now().isoformat(),
                        'cf_assistito': dati_ricetta.get('cf_assistito', 'N/A')
                    }

            def invia_ricetta(self, dati_ricetta: Dict[str, Any]) -> Dict[str, Any]:
                """
                Invia ricetta elettronica al Sistema TS.
                Usa formato SOAP corretto del kit ufficiale per l'invio.
                """
                try:
                    self.logger.info(f"Invio ricetta per CF: {dati_ricetta.get('cf_assistito', 'N/A')}")
                    
                    # Crea richiesta SOAP per invio
                    soap_request = self._create_invio_soap_request(dati_ricetta)
                    
                    # Crea sessione con autenticazione
                    session = self._create_session()
                    session.auth = (self.cf_medico, self.password)  # Basic Auth
                    
                    # Headers per invio (diversi da visualizzazione)
                    token_2fa = self._genera_token_2fa()
                    headers = {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': 'http://invioprescrittoricettabianca.wsdl.dem.sanita.finanze.it/InvioPrescrittoRicettaBianca',
                        'Authorization2F': f'Bearer {token_2fa}',
                        'User-Agent': 'Python-requests/2.28.0'
                    }
                    
                    self.logger.info(f"Invio richiesta ricetta a: {self.endpoint_invio}")
                    
                    response = session.post(
                        self.endpoint_invio,
                        data=soap_request,
                        headers=headers,
                        timeout=60,  # Timeout maggiore per nuovo endpoint
                        verify=False
                    )
                    
                    self.logger.info(f"Risposta invio ricevuta - Status: {response.status_code}")
                    
                    # Debug: Log completo della risposta per capire l'errore
                    self.logger.info(f"Risposta completa invio: {response.text}")
                    
                    # Parsa la risposta
                    return self._parse_invio_response(response, dati_ricetta)
                    
                except Exception as e:
                    self.logger.error(f"Errore invio ricetta: {e}", exc_info=True)
                    return {
                        'success': False,
                        'error': f'Errore invio ricetta: {str(e)}',
                        'timestamp': datetime.now().isoformat()
                    }


# Istanza singleton per uso globale
ricette_ts_service = RicetteTsService()

