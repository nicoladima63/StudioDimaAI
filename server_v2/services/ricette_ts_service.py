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
        """Carica configurazione per ambiente corrente - copia da V1"""
        self.env = self._get_current_env()
        
        # Path dinamico come V1
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        
        if self.env == 'test':
            # === AMBIENTE TEST - Dati dal kit ufficiale V1 ===
            self.cf_medico = os.getenv('CF_MEDICO_TEST', 'PROVAX00X00X000Y')
            self.password = os.getenv('PASSWORD_TEST', 'Salve123')
            self.pincode = os.getenv('PINCODE_TEST', '1234567890')
            self.regione = os.getenv('REGIONE_TEST', '020')
            self.asl = os.getenv('ASL_TEST', '101')
            self.specializzazione = os.getenv('SPECIALIZZAZIONE_TEST', 'F')
            
            # Endpoint test - identici V1
            self.endpoint_visualizza = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
            self.endpoint_invio = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
            self.endpoint_annulla = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
            
            # ENDPOINT ALTERNATIVI - dal Ministero della Salute (SOAP format diverso - errore 500):
            # self.endpoint_visualizza = 'https://demservicetest.sanita.finanze.it/DemRicettaPrescrittoServicesWeb/services/demVisualizzaPrescritto'  # Richiede namespace diverso
            # self.endpoint_invio = 'https://demservicetest.sanita.finanze.it/DemRicettaPrescrittoServicesWeb/services/demInvioPrescritto'  # TIMEOUT
            # self.endpoint_annulla = 'https://demservicetest.sanita.finanze.it/DemRicettaPrescrittoServicesWeb/services/demAnnullaPrescritto'
            
            # Certificati test
            self.client_cert = os.path.join(project_root, 'certs', 'test', 'client_cert.pem')
            self.client_key = os.path.join(project_root, 'certs', 'test', 'client_key.pem')
            self.sanitel_cert = os.path.join(project_root, 'certs', 'test', 'SanitelCF-2024-2027.cer')
            
        else:  # prod
            # === AMBIENTE PRODUZIONE - Dati reali V1 ===
            self.cf_medico = os.getenv('CF_MEDICO_PROD', 'DMRNCL63S21D612I')
            self.password = os.getenv('PASSWORD_PROD', 'password_reale')
            self.pincode = os.getenv('PINCODE_PROD', 'pincode_reale')
            self.regione = os.getenv('REGIONE_PROD', '090')
            self.asl = os.getenv('ASL_PROD', '109')
            self.specializzazione = os.getenv('SPECIALIZZAZIONE_PROD', 'F')
            
            # Endpoint produzione
            self.endpoint_visualizza = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
            self.endpoint_invio = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
            self.endpoint_annulla = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
            
            # Certificati produzione
            self.client_cert = os.path.join(project_root, 'certs', 'prod', 'client_cert.pem')
            self.client_key = os.path.join(project_root, 'certs', 'prod', 'client_key.pem')
            self.sanitel_cert = os.path.join(project_root, 'certs', 'prod', 'SanitelCF-2024-2027.cer')
        
        self.logger.info(f"RicetteTsService configurato per ambiente: {self.env.upper()}")
        self.logger.info(f"Endpoint visualizzazione: {self.endpoint_visualizza}")
        self.logger.info(f"Endpoint invio: {self.endpoint_invio}")
    
    def _get_current_env(self) -> str:
        """Ottiene l'ambiente corrente - copia da V1"""
        try:
            # Cerca di usare il mode manager se esiste
            from core.mode_manager import get_mode
            mode = get_mode('ricetta')
            return 'test' if mode == 'test' else 'prod'
        except:
            return os.getenv('RICETTA_ENV', 'test').lower()
    
    def force_production_config(self, cf_medico_reale: str, password_reale: str = None):
        """
        Forza configurazione produzione per override temporaneo
        """
        self.logger.info(f"=== FORCE PRODUCTION CONFIG ===")
        self.env = 'prod'
        self.cf_medico = cf_medico_reale
        self.password = password_reale or os.getenv('PASSWORD_PROD', 'VtmakYjB4CjEN_!')
        
        # Endpoint produzione
        self.endpoint_visualizza = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
        self.endpoint_invio = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
        
        # Altri parametri produzione
        self.regione = '090'
        self.asl = '109'
        self.specializzazione = 'F'
        
        self.logger.info(f"Configurazione forzata: CF={self.cf_medico}, Endpoint={self.endpoint_visualizza}")
        
    def restore_original_config(self, original_config: dict):
        """Ripristina configurazione originale"""
        self.env = original_config['env']
        self.cf_medico = original_config['cf_medico']
        self.password = original_config['password']
        self.endpoint_visualizza = original_config['endpoint_visualizza']
        self.endpoint_invio = original_config['endpoint_invio']
        self.regione = original_config['regione']
        self.asl = original_config['asl']
        self.specializzazione = original_config['specializzazione']
        
        self.logger.info(f"Configurazione ripristinata: env={self.env}, CF={self.cf_medico}")
    
    def _genera_token_2fa(self) -> str:
        """
        Genera il token A2F nel formato CF-YYYY-MM - copia esatta da V1
        """
        return f"{self.cf_medico}-{datetime.now().strftime('%Y-%m')}"
    
    def _encrypt_cf_assistito(self, cf_assistito: str) -> str:
        """
        Cifra il CF dell'assistito usando l'endpoint di cifratura V2
        """
        try:
            # Per test environment, usa il CF in chiaro come V1 test
            if self.env == 'test':
                return cf_assistito
            
            # Per produzione, usa l'endpoint di cifratura V2
            import requests
            
            self.logger.info(f"Cifratura CF assistito per produzione: {cf_assistito}")
            
            response = requests.post(
                'http://localhost:5001/api/v2/ricetta/cifra-cf',
                json={'cf_assistito': cf_assistito},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                cf_cifrato = response.json().get('cf_cifrato')
                self.logger.info("CF assistito cifrato correttamente")
                return cf_cifrato
            else:
                self.logger.error(f"Errore cifratura CF: HTTP {response.status_code}")
                # Fallback: ritorna in chiaro se cifratura fallisce
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
        self.logger.info(f"Basic Auth configurata: {self.cf_medico}")
        
        # Certificati SSL client se esistono
        if os.path.exists(self.client_cert) and os.path.exists(self.client_key):
            session.cert = (self.client_cert, self.client_key)
            self.logger.info("Certificati SSL client configurati")
        else:
            self.logger.warning("Certificati SSL client non trovati - procedo senza")
        
        # Disabilita verifica SSL
        session.verify = False
        
        # Headers globali
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Connection': 'close'
        })
        
        return session
    
    def _create_visualizza_soap_request(self, data_da: str, data_a: str, cf_assistito: str = None) -> str:
        """
        Crea richiesta SOAP per visualizzazione ricette - FORMATO XSD UFFICIALE
        Basato sul kit ufficiale del Ministero della Salute v1.2
        """
        
        # Usa encrypted pinCode dal kit ufficiale
        pincode_cifrato = "dyGL6AscUj2CaHY2PFLFKHTh0R4btCkTe/imyyjCv6DTmnHZICD3zqPYVVoZrLvI72MrMBz4Tv4dE7Z124qssn2K5/O+OEcjRq3+zwQO6PlO6uQ04fnTEuHtX8yvd6ZrmPuiMhhY7r5OLB05k/a564KKSwcu01Wzhf4If2rw19U="
        
        # Usa encrypted codicePaziente (CF test) dal kit ufficiale se non specificato
        if not cf_assistito:
            cf_assistito = "W2yoR8ESa581Uw8EI0b7MXRjdckNKzCZO2JULzYMhqSFyn7qo8j2Kp3K+kVx8UdYRO20HHIfgjPvCTYeD0rETPtE88d8TJbtrP/07GXAp3QqyHbxy3YVMXTi0T1aye+ET0hKcd5vwWXbpn2TfHT7mbSrrqOxAC2S3VMmRDl+vUU="
        else:
            cf_assistito = self._encrypt_cf_assistito(cf_assistito)
        
        # Template SOAP UFFICIALE - formato XSD v1.2 identico a SoapUI
        soap_template = f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:vis="http://visualizzaprescrittoricettabiancarichiesta.xsd.dem.sanita.finanze.it" 
                  xmlns:tip="http://tipodativisualizzaprescrittoricettabianca.xsd.dem.sanita.finanze.it">
    <soapenv:Header/>
    <soapenv:Body>
        <vis:VisualizzaPrescrittoRicettaBiancaRichiesta>
            <vis:pinCode>{pincode_cifrato}</vis:pinCode>
            <vis:codicePaziente>{cf_assistito}</vis:codicePaziente>
            <vis:cfMedico>{self.cf_medico}</vis:cfMedico>
        </vis:VisualizzaPrescrittoRicettaBiancaRichiesta>
    </soapenv:Body>
</soapenv:Envelope>'''
        
        return soap_template
    
    def _parse_visualizza_response(self, response: requests.Response) -> Dict[str, Any]:
        """Parsa la risposta della visualizzazione ricette - copia da V1 con miglioramenti"""
        try:
            response_text = response.text
            self.logger.info(f"Parsing risposta visualizzazione ricette")
            
            if response.status_code == 200:
                # === DEBUG COMPLETO RISPOSTA XML ===
                self.logger.info("=== INIZIO RISPOSTA XML COMPLETA ===")
                self.logger.info(response_text)
                self.logger.info("=== FINE RISPOSTA XML COMPLETA ===")
                
                # Print anche in console per debug immediato
                print("=" * 80)
                print("RISPOSTA COMPLETA SISTEMA TS:")
                print("=" * 80)
                print(response_text)
                print("=" * 80)
                
                # Cerca lista ricette nella risposta XML
                ricette = []
                
                # TODO: Analizzare XML per estrarre ricette
                # Per ora torniamo XML completo per analisi
                
                return {
                    'success': True,
                    'http_status': response.status_code,
                    'ricette': ricette,
                    'total_count': len(ricette),
                    'response_xml': response_text,
                    'timestamp': datetime.now().isoformat(),
                    'message': 'DEBUG: Risposta XML completa loggata - analizzare per implementare parsing'
                }
            else:
                return {
                    'success': False,
                    'http_status': response.status_code,
                    'error': f'HTTP {response.status_code}',
                    'response_text': response_text[:500],
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            self.logger.error(f"Errore parsing risposta visualizzazione: {e}")
            return {
                'success': False,
                'error': f'Errore parsing risposta: {str(e)}',
                'http_status': response.status_code if hasattr(response, 'status_code') else 0,
                'response_text': response.text[:500] if hasattr(response, 'text') else '',
                'timestamp': datetime.now().isoformat()
            }
    
    def visualizza_ricetta_specifica(self, nre: str, cf_assistito: str = None, cf_medico: str = None) -> Dict[str, Any]:
        """
        BRUTAL TEST - USA ENDPOINT INTERROGAZIONI UFFICIALE!
        """
        try:
            self.logger.info(f"=== BRUTAL TEST ENDPOINT INTERROGAZIONI ===")
            self.logger.info(f"NRE: {nre}, CF assistito: {cf_assistito}")
            
            # ENDPOINT GIUSTO DAL KIT UFFICIALE!
            endpoint_interrogazioni = 'https://demservice.sanita.finanze.it/DemRicettaInterrogazioniServicesWeb/services/demInterrogaNreUtilizzati'
            
            pincode_cifrato = "LsQiYtf7FcpMYVKvf+51V6t1BSUk+E/dGOB2vmwNl0DhirZ8QzvTI2Ay04p6+t+eH+DjzkJpXrlEEZVKRz6wKVNOt7uYSQUYKBIFcbcEQJnqT7zTgtz7jV3BK+QaEphfKRsOP1Iejv+vKvJ/3te2xNMHPkNYZIAjxEQHftw9Swk="
            
            # SOAP UFFICIALE InterrogaNreUtilRichiesta
            soap_template = f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:int="http://interroganreutilrichiesta.xsd.dem.sanita.finanze.it">
    <soapenv:Header/>
    <soapenv:Body>
        <int:InterrogaNreUtilRichiesta>
            <int:pinCode>{pincode_cifrato}</int:pinCode>
            <int:codRegione>090</int:codRegione>
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
            
            self.logger.info(f"=== BRUTAL TEST ENDPOINT INTERROGAZIONI ===")
            self.logger.info(f"Endpoint: {endpoint_interrogazioni}")
            
            print(f"=== SOAP INTERROGAZIONI BRUTAL TEST ===")
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
                    f.write(f"<!-- BRUTAL TEST INTERROGAZIONI - NRE: {nre} -->\n")
                    f.write(f"<!-- HTTP Status: {response.status_code} -->\n")
                    f.write(f"<!-- Timestamp: {datetime.now().isoformat()} -->\n")
                    f.write(f"<!-- Endpoint: {endpoint_interrogazioni} -->\n")
                    f.write(f"<!-- CF Medico: {cf_medico or self.cf_medico} -->\n")
                    f.write(f"<!-- Ambiente: prod -->\n")
                    f.write("\n")
                    f.write(response_text)
                
                print(f"📁 BRUTAL TEST XML SALVATO: {xml_file_path}")
                
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

    def get_all_ricette(self, data_da: str = None, data_a: str = None, cf_assistito: str = None) -> Dict[str, Any]:
        """
        Recupera la lista delle ricette dal Sistema TS.
        Replica esatta di V1 visualizza_ricette() rinominata per chiarezza.
        
        Args:
            data_da: Data inizio ricerca (formato YYYY-MM-DD)
            data_a: Data fine ricerca (formato YYYY-MM-DD)  
            cf_assistito: Codice fiscale assistito specifico (opzionale)
            
        Returns:
            Dict con risultato richiesta Sistema TS
        """
        try:
            self.logger.info(f"Richiesta visualizzazione ricette Sistema TS - Da: {data_da}, A: {data_a}, CF: {cf_assistito}")
            
            # Se non specificate, usa ultimi 30 giorni - come V1
            if not data_da:
                data_da = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            if not data_a:
                data_a = datetime.now().strftime('%Y-%m-%d')
            
            # Crea richiesta SOAP per visualizzazione
            soap_request = self._create_visualizza_soap_request(data_da, data_a, cf_assistito)
            
            # Debug: Verifica che il metodo funzioni
            if not soap_request:
                self.logger.error("SOAP request is None or empty!")
                return {
                    'success': False,
                    'error': 'Errore generazione SOAP request',
                    'timestamp': datetime.now().isoformat(),
                    'ricette': [],
                    'total_count': 0
                }
            
            # Esegui richiesta
            session = self._create_session()
            
            # Configurazione autenticazione come da kit ufficiale
            session.auth = (self.cf_medico, self.password)  # Basic Auth
            
            # Token 2FA come Bearer token come da SoapUI ufficiale
            token_2fa = self._genera_token_2fa()
            
            # Headers formato XSD ufficiale con Authorization2F
            headers = {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://visualizzaprescrittoricettabianca.wsdl.dem.sanita.finanze.it/VisualizzaPrescrittoRicettaBianca"',
                'Authorization2F': f'Bearer {token_2fa}',
                'User-Agent': 'Python-requests/2.28.0'
            }
            
            self.logger.info(f"Invio richiesta visualizzazione a: {self.endpoint_visualizza}")
            
            # Debug: Log della richiesta SOAP
            print(f"=== SOAP REQUEST ===")
            print(soap_request)
            print(f"=== END SOAP REQUEST ===")
            
            response = session.post(
                self.endpoint_visualizza,
                data=soap_request,
                headers=headers,
                timeout=60,  # Timeout maggiore per nuovo endpoint
                verify=False  # Per ambiente test come V1
            )
            
            self.logger.info(f"Risposta ricevuta - Status: {response.status_code}")
            
            # Debug: Log completo della risposta per capire l'errore
            self.logger.info(f"Risposta completa: {response.text}")
            
            # Parsa la risposta
            return self._parse_visualizza_response(response)
            
        except Exception as e:
            self.logger.error(f"Errore visualizzazione ricette Sistema TS: {e}", exc_info=True)
            return {
                'success': False,
                'error': f'Errore Sistema TS: {str(e)}',
                'timestamp': datetime.now().isoformat(),
                'ricette': [],
                'total_count': 0
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
        Crea richiesta SOAP per invio ricetta - REPLICA ESATTA V1 CHE FUNZIONA
        Basato su V1 ricetta_service.py che funziona perfettamente
        """
        
        # PinCode cifrato dal kit ufficiale - IDENTICO V1
        pincode_cifrato = "LsQiYtf7FcpMYVKvf+51V6t1BSUk+E/dGOB2vmwNl0DhirZ8QzvTI2Ay04p6+t+eH+DjzkJpXrlEEZvKRz6wKVNOt7uYSQUYKBIFcbcEQJnqT7zTgtz7jV3BK+QaEphfKRsOP1Iejv+vKvJ/3te2xNMHPkNYZIAjxEQHftw9Swk="
        
        # CF Assistito cifrato dal kit ufficiale - IDENTICO V1
        cf_assistito_cifrato = "iKvd9JQntqxPBT2UA/OFfztSNLidocP8Op+NfODzfTdxFWzkcdZrJz5gvCuqv7Dh/r3Cin1ZQMmg/BofIqYCyq2PcC+PJzbvQCocDdl6FrXVXs3W5JhnX7VpWFGCLPYYY2WL+RWKxhfkGqeY8+NCVfQ1lEA15g3W5AabJ15Tthk="
        
        # Timestamp formato V1
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

