"""
Servizio completo per l'invio di ricette elettroniche al Sistema TS
Implementa le specifiche ufficiali del Ministero della Salute
"""
import os
import ssl
import base64
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography import x509
from lxml import etree
import uuid

logger = logging.getLogger(__name__)

class RicettaElettronicaService:
    """
    Servizio per l'invio di ricette elettroniche seguendo le specifiche ufficiali
    """
    
    def __init__(self):
        self.env = self._get_current_env()
        self._load_configuration()
        self._setup_ssl_context()
        
    def _get_current_env(self) -> str:
        """Ottiene l'ambiente corrente"""
        try:
            from ..core.mode_manager import get_mode
            mode = get_mode('ricetta')
            return 'test' if mode == 'test' else 'prod'
        except:
            return os.getenv('RICETTA_ENV', 'test').lower()
    
    def _load_configuration(self):
        """Carica configurazione per ambiente corrente"""
        # Path dinamico invece di hardcodato
        import os
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
        
        if self.env == 'test':
            # === AMBIENTE TEST - Dati dal kit ufficiale ===
            self.cf_medico = os.getenv('CF_MEDICO_TEST', 'PROVAX00X00X000Y')
            self.password = os.getenv('PASSWORD_TEST', 'Salve123')
            self.pincode = os.getenv('PINCODE_TEST', '1234567890')
            self.regione = os.getenv('REGIONE_TEST', '020')
            self.asl = os.getenv('ASL_TEST', '101')
            self.specializzazione = os.getenv('SPECIALIZZAZIONE_TEST', 'F')
            
            # Endpoint test
            self.endpoint_invio = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
            self.endpoint_visualizza = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
            self.endpoint_annulla = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
            
            # Certificati test
            self.client_cert = os.path.join(project_root, 'certs', 'test', 'client_cert.pem')
            self.client_key = os.path.join(project_root, 'certs', 'test', 'client_key.pem')
            self.sanitel_cert = os.path.join(project_root, 'certs', 'test', 'SanitelCF-2024-2027.cer')
            
            # CF assistito test
            self.cf_assistito_test = 'PNIMRA70A01H501P'
            
        else:  # prod
            # === AMBIENTE PRODUZIONE - Dati reali ===
            self.cf_medico = os.getenv('CF_MEDICO_PROD', 'DMRNCL63S21D612I')
            self.password = os.getenv('PASSWORD_PROD', 'password_reale')
            self.pincode = os.getenv('PINCODE_PROD', 'pincode_reale')
            self.regione = os.getenv('REGIONE_PROD', '090')
            self.asl = os.getenv('ASL_PROD', '109')
            self.specializzazione = os.getenv('SPECIALIZZAZIONE_PROD', 'F')
            
            # Endpoint produzione
            self.endpoint_invio = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
            self.endpoint_visualizza = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
            self.endpoint_annulla = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
            
            # Certificati produzione
            self.client_cert = os.path.join(project_root, 'certs', 'prod', 'client_cert.pem')
            self.client_key = os.path.join(project_root, 'certs', 'prod', 'client_key.pem')
            self.sanitel_cert = os.path.join(project_root, 'certs', 'prod', 'SanitelCF-2024-2027.cer')
        
        logger.info(f"Ricetta Elettronica configurata per ambiente: {self.env.upper()}")
        logger.info(f"CF Medico: {self.cf_medico}")
        logger.info(f"Endpoint: {self.endpoint_invio}")
    
    def _setup_ssl_context(self):
        """Configura contesto SSL per certificati legacy"""
        self.ssl_context = ssl.create_default_context()
        self.ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')
        self.ssl_context.check_hostname = False
        self.ssl_context.verify_mode = ssl.CERT_NONE
    
    def _encrypt_pincode(self, pincode: str) -> str:
        """
        Cifra il pincode usando il certificato SanitelCF
        Seguendo le specifiche del kit ufficiale
        """
        try:
            # Carica il certificato SanitelCF
            with open(self.sanitel_cert, 'rb') as f:
                cert_data = f.read()
                
            # Se è un file .cer_, rinominalo
            if self.sanitel_cert.endswith('.cer_'):
                cert_path_fixed = self.sanitel_cert.replace('.cer_', '.cer')
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
            return encrypted_b64
            
        except Exception as e:
            logger.error(f"Errore cifratura pincode: {e}")
            # Fallback: usa il pincode in chiaro (solo per test)
            if self.env == 'test':
                logger.warning("Usando pincode in chiaro per test")
                return pincode
            raise
    
    def _encrypt_cf_assistito(self, cf_assistito: str) -> str:
        """
        Cifra il CF dell'assistito usando il certificato SanitelCF
        """
        try:
            return self._encrypt_pincode(cf_assistito)  # Stesso metodo di cifratura
        except Exception as e:
            logger.error(f"Errore cifratura CF assistito: {e}")
            # Fallback per test
            if self.env == 'test':
                return cf_assistito
            raise
    
    def _create_soap_request(self, ricetta_data: Dict[str, Any]) -> str:
        """
        Crea la richiesta SOAP XML seguendo le specifiche ufficiali
        """
        try:
            # Cifra dati sensibili
            pincode_cifrato = self._encrypt_pincode(self.pincode)
            cf_assistito_cifrato = self._encrypt_cf_assistito(ricetta_data['cf_assistito'])
            
            # Genera ID univoco per la ricetta
            ricetta_id = str(uuid.uuid4())
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Template SOAP seguendo il formato che funziona nei test
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
            <inv:numIscrizAlbo>{ricetta_data.get('num_iscrizione', '591')}</inv:numIscrizAlbo>
            <inv:indirMedico>Via Michelangelo Buonarroti, 15|51031|AGLIANA|PT</inv:indirMedico>
            <inv:telefMedico>+39|0574712060</inv:telefMedico>
            <inv:codicePaziente>{cf_assistito_cifrato}</inv:codicePaziente>
            <inv:cognNome>TIZIO CAIO</inv:cognNome>
            <inv:indirizzo>Via Tizio Caio, 24|00065|Fiano Romano|RM</inv:indirizzo>
            <inv:tipoPrescrizione>F</inv:tipoPrescrizione>
            <inv:codDiagnosi>{ricetta_data['codice_diagnosi']}</inv:codDiagnosi>
            <inv:descrDiagnosi>{ricetta_data['descrizione_diagnosi']}</inv:descrDiagnosi>
            <inv:dataCompilazione>{timestamp}</inv:dataCompilazione>
            <inv:dettaglioPrescrizioneRicettaBianca>
                <tip:codProdPrest>{ricetta_data['codice_farmaco']}</tip:codProdPrest>
                <tip:descrProdPrest>{ricetta_data['denominazione_farmaco']}</tip:descrProdPrest>
                <tip:tdl>0</tip:tdl>
                <tip:descrTestoLiberoNote>{ricetta_data.get('note', '')}</tip:descrTestoLiberoNote>
                <tip:quantita>1</tip:quantita>
                <tip:posologia>{ricetta_data['posologia']}</tip:posologia>
            </inv:dettaglioPrescrizioneRicettaBianca>
        </inv:InvioPrescrittoRicettaBiancaRichiesta>
    </soapenv:Body>
</soapenv:Envelope>"""
            
            logger.info(f"SOAP XML creato per ricetta ID: {ricetta_id}")
            return soap_xml
            
        except Exception as e:
            logger.error(f"Errore creazione SOAP XML: {e}")
            raise
    
    def _genera_token_2fa(self) -> str:
        """
        Genera il token A2F nel formato CF-YYYY-MM come richiesto dal sistema
        """
        return f"{self.cf_medico}-{datetime.now().strftime('%Y-%m')}"
    
    def _create_session(self) -> requests.Session:
        """
        Crea sessione HTTP con Basic Auth e certificati SSL
        Configurazione speciale per certificati legacy del Ministero
        """
        import urllib3
        from urllib3.poolmanager import PoolManager
        from urllib3.util.ssl_ import create_urllib3_context
        from requests.adapters import HTTPAdapter
        
        # Disabilita completamente gli avvisi SSL
        urllib3.disable_warnings()
        
        # Configurazione SSL estremamente permissiva per ambiente di test
        class LegacySSLAdapter(HTTPAdapter):
            def init_poolmanager(self, *args, **kwargs):
                # Crea contesto SSL con security level 0 (massima compatibilità)
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                
                # Configurazione ultra-permissiva
                context.set_ciphers('ALL:@SECLEVEL=0')
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                
                # Opzioni aggiuntive per certificati molto vecchi
                context.options |= ssl.OP_LEGACY_SERVER_CONNECT
                if hasattr(ssl, 'OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION'):
                    context.options |= ssl.OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION
                
                kwargs['ssl_context'] = context
                
                return super().init_poolmanager(*args, **kwargs)
        
        # Configurazione a livello di ambiente
        import os
        os.environ['PYTHONHTTPSVERIFY'] = '0'
        os.environ['OPENSSL_CONF'] = ''
        
        session = requests.Session()
        session.mount('https://', LegacySSLAdapter())
        
        # Basic Authentication (CF medico + password)
        session.auth = (self.cf_medico, self.password)
        logger.info(f"Basic Auth configurata: {self.cf_medico}")
        
        # Certificati SSL client - solo se esistono
        if os.path.exists(self.client_cert) and os.path.exists(self.client_key):
            session.cert = (self.client_cert, self.client_key)
            logger.info("Certificati SSL client configurati")
        else:
            logger.warning("Certificati SSL client non trovati - procedo senza")
        
        # Disabilita completamente la verifica SSL
        session.verify = False
        
        # Headers globali per migliorare compatibilità
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Connection': 'close'
        })
        
        return session
    
    def invia_ricetta(self, ricetta_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invia una ricetta elettronica al Sistema TS
        
        Args:
            ricetta_data: Dati della ricetta {
                'cf_assistito': str,
                'codice_diagnosi': str,
                'descrizione_diagnosi': str,
                'codice_farmaco': str,
                'denominazione_farmaco': str,
                'principio_attivo': str,
                'posologia': str,
                'durata': str,
                'note': str (opzionale),
                'num_iscrizione': str (opzionale)
            }
        
        Returns:
            Dict con risultato invio
        """
        try:
            logger.info(f"Avvio invio ricetta per CF: {ricetta_data['cf_assistito']}")
            
            # Crea SOAP XML
            soap_xml = self._create_soap_request(ricetta_data)
            
            # Log dell'XML per debug (primi 500 caratteri)
            logger.info(f"XML generato: {soap_xml[:500]}...")
            
            # Crea sessione HTTP
            session = self._create_session()
            
            # Genera token 2FA
            token_2fa = self._genera_token_2fa()
            logger.info(f"Token 2FA generato: {token_2fa}")
            
            # Headers SOAP
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://invioprescrittoricettabianca.wsdl.dem.sanita.finanze.it/InvioPrescrittoRicettaBianca',
                'Authorization2F': f'Bearer {token_2fa}',
                'Accept': 'text/xml',
                'User-Agent': 'StudioDimaAI-RicettaElettronica/1.0'
            }
            
            # Invio richiesta - prima prova il metodo standard
            logger.info(f"Invio a: {self.endpoint_invio}")
            
            try:
                response = session.post(
                    self.endpoint_invio,
                    data=soap_xml.encode('utf-8'),
                    headers=headers,
                    timeout=30
                )
                
                logger.info(f"Risposta HTTP: {response.status_code}")
                
                # Log della risposta per debug
                if response.status_code != 200:
                    logger.error(f"Risposta errore: {response.text[:1000]}")
                
                return self._parse_response(response)
                
            except Exception as ssl_error:
                logger.warning(f"Metodo standard fallito: {ssl_error}")
                logger.info("Provo con helper SSL legacy...")
                
                # Fallback con helper SSL legacy
                from .ssl_legacy_helper import send_soap_request
                
                result = send_soap_request(
                    self.endpoint_invio,
                    soap_xml,
                    self.cf_medico,
                    self.password,
                    self.client_cert if os.path.exists(self.client_cert) else None,
                    self.client_key if os.path.exists(self.client_key) else None
                )
                
                # Converti risultato helper nel formato standard
                return {
                    'success': result['success'] and result.get('http_code', 0) == 200,
                    'http_status': result.get('http_code', 0),
                    'response_xml': result.get('response_body', ''),
                    'error': result.get('error') if not result['success'] else None,
                    'method': 'ssl_legacy_helper',
                    'timestamp': datetime.now().isoformat()
                }
            
        except Exception as e:
            logger.error(f"Errore invio ricetta: {e}")
            return {
                'success': False,
                'error': f'Errore invio ricetta: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }
    
    def _parse_response(self, response: requests.Response) -> Dict[str, Any]:
        """
        Analizza la risposta del Sistema TS ed estrae i dati critici
        """
        try:
            if response.status_code == 200:
                # Parse XML response
                root = etree.fromstring(response.content)
                
                # Estrai dati critici dal XML (namespace-aware)
                namespaces = {
                    'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                    'dem': 'http://dematerializzazione.sanita.finanze.it/',
                    'ric': 'http://ricetta.sanita.finanze.it/'
                }
                
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
                
                # Se non trova i dati con xpath, prova ricerca generale nel testo
                response_text = response.text
                
                # Import re qui per evitare errori
                import re
                
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
            logger.error(f"Errore parsing risposta: {e}")
            return {
                'success': False,
                'error': f'Errore parsing risposta: {str(e)}',
                'http_status': response.status_code,
                'response_text': response.text[:500],
                'timestamp': datetime.now().isoformat()
            }

# Istanza globale del servizio
ricetta_service = RicettaElettronicaService()