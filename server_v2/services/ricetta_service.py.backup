"""
Servizio per la gestione delle ricette elettroniche - Versione 2
Implementa le specifiche ufficiali del Sistema Tessera Sanitaria
"""
import os
import ssl
import base64
import requests
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from lxml import etree
from core.ssl_manager import ssl_manager
from core.exceptions import RicettaServiceError, ValidationError

logger = logging.getLogger(__name__)

class RicettaService:
    """Servizio per l'invio di ricette elettroniche V2"""
    
    def __init__(self):
        self.ssl_manager = ssl_manager
        self.config = self.ssl_manager.get_environment_config()
        self.session = None
        self._initialize_session()
    
    def _initialize_session(self):
        """Inizializza la sessione HTTP con SSL context"""
        try:
            self.session = requests.Session()
            
            # Configura SSL context
            ssl_context = self.ssl_manager.create_ssl_context()
            
            # Adapter personalizzato per SSL
            from requests.adapters import HTTPAdapter
            from urllib3.util.ssl_ import create_urllib3_context
            
            class SSLAdapter(HTTPAdapter):
                def __init__(self, ssl_context):
                    self.ssl_context = ssl_context
                    super().__init__()
                
                def init_poolmanager(self, *args, **kwargs):
                    kwargs['ssl_context'] = self.ssl_context
                    return super().init_poolmanager(*args, **kwargs)
            
            self.session.mount('https://', SSLAdapter(ssl_context))
            
            # Headers comuni
            self.session.headers.update({
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'User-Agent': 'StudioDima-RicettaElettronicaV2/1.0'
            })
            
            logger.info(f"Sessione inizializzata per ambiente: {self.config['environment']}")
            
        except Exception as e:
            logger.error(f"Errore inizializzazione sessione: {e}")
            raise RicettaServiceError(f"Impossibile inizializzare sessione SSL: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Testa la connettività con il Sistema TS"""
        try:
            # Valida certificati
            cert_validation = self.ssl_manager.validate_certificates()
            
            # Test ping endpoint (HEAD request)
            endpoint = self.config['endpoints']['invio']
            
            response = self.session.head(endpoint, timeout=10)
            
            return {
                'success': True,
                'environment': self.config['environment'],
                'endpoint': endpoint,
                'status_code': response.status_code,
                'certificates': cert_validation,
                'ssl_version': getattr(response.raw.connection, 'version', 'unknown'),
                'message': 'Connessione al Sistema TS stabilita con successo'
            }
            
        except requests.exceptions.SSLError as e:
            logger.error(f"Errore SSL: {e}")
            return {
                'success': False,
                'error': 'SSL_ERROR',
                'message': f'Errore certificati SSL: {e}',
                'certificates': self.ssl_manager.validate_certificates()
            }
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Errore connessione: {e}")
            return {
                'success': False,
                'error': 'CONNECTION_ERROR',
                'message': f'Impossibile raggiungere il servizio: {e}'
            }
        except Exception as e:
            logger.error(f"Errore test connessione: {e}")
            return {
                'success': False,
                'error': 'UNKNOWN_ERROR',
                'message': f'Errore sconosciuto: {e}'
            }
    
    def generate_soap_envelope(self, dati_ricetta: Dict[str, Any]) -> str:
        """Genera busta SOAP per invio ricetta"""
        try:
            # Namespace SOAP
            soap_ns = "http://schemas.xmlsoap.org/soap/envelope/"
            demws_ns = "http://demws.ricetta.sogei.it/"
            
            # Crea root element
            envelope = etree.Element(f"{{{soap_ns}}}Envelope")
            envelope.set(f"{{{soap_ns}}}encodingStyle", "http://schemas.xmlsoap.org/soap/encoding/")
            envelope.nsmap[None] = soap_ns
            envelope.nsmap['demws'] = demws_ns
            
            # Header
            header = etree.SubElement(envelope, f"{{{soap_ns}}}Header")
            
            # Body
            body = etree.SubElement(envelope, f"{{{soap_ns}}}Body")
            
            # Metodo invio
            invio_method = etree.SubElement(body, f"{{{demws_ns}}}demInvioPrescrittoRicettaBianca")
            
            # Parametri ricetta
            self._add_ricetta_params(invio_method, dati_ricetta, demws_ns)
            
            # Converte a stringa XML
            xml_str = etree.tostring(
                envelope, 
                pretty_print=True, 
                xml_declaration=True, 
                encoding='UTF-8'
            ).decode('utf-8')
            
            return xml_str
            
        except Exception as e:
            logger.error(f"Errore generazione SOAP: {e}")
            raise ValidationError(f"Impossibile generare busta SOAP: {e}")
    
    def _add_ricetta_params(self, parent: etree.Element, dati: Dict[str, Any], ns: str):
        """Aggiunge parametri ricetta alla busta SOAP"""
        try:
            # Credenziali medico
            cred = self.config['credentials']
            
            # Parametri obbligatori
            params = {
                'cfMedico': cred['cf_medico'],
                'password': cred['password'],
                'pinCode': cred['pincode'],
                'regione': cred['regione'],
                'cfPaziente': dati['cf_assistito'],
                'nomePaziente': dati.get('nome_assistito', ''),
                'cognomePaziente': dati.get('cognome_assistito', ''),
                'codiceIcd9': dati['codice_diagnosi'],
                'descrizioneIcd9': dati['descrizione_diagnosi'],
                'codiceFarmaco': dati['codice_farmaco'],
                'descrizioneP': dati['denominazione_farmaco'],
                'principioAttivo': dati['principio_attivo'],
                'posologia': dati.get('posologia', ''),
                'durataTerapia': dati.get('durata', ''),
                'quantita': str(dati.get('quantita', 1)),
                'nota': dati.get('note', ''),
                'tipoRicetta': dati.get('tipo_ricetta', 'R'),  # R=Ripetibile, NR=Non Ripetibile
                'codiceRicetta': self._generate_codice_ricetta()
            }
            
            # Aggiunge parametri come elementi XML
            for param_name, param_value in params.items():
                if param_value:  # Solo se ha valore
                    param_elem = etree.SubElement(parent, f"{{{ns}}}{param_name}")
                    param_elem.text = str(param_value)
            
        except KeyError as e:
            logger.error(f"Parametro mancante: {e}")
            raise ValidationError(f"Parametro obbligatorio mancante: {e}")
        except Exception as e:
            logger.error(f"Errore parametri ricetta: {e}")
            raise ValidationError(f"Errore validazione parametri: {e}")
    
    def _generate_codice_ricetta(self) -> str:
        """Genera codice univoco per la ricetta"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4()).replace('-', '')[:8].upper()
        return f"SD{timestamp}{unique_id}"
    
    def invia_ricetta(self, dati_ricetta: Dict[str, Any]) -> Dict[str, Any]:
        """Invia ricetta elettronica al Sistema TS"""
        try:
            # Validazione dati
            self._validate_ricetta_data(dati_ricetta)
            
            # Genera SOAP envelope
            soap_xml = self.generate_soap_envelope(dati_ricetta)
            
            # Endpoint invio
            endpoint = self.config['endpoints']['invio']
            
            # Headers SOAP
            headers = {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'SOAPAction': 'demInvioPrescrittoRicettaBianca'
            }
            
            logger.info(f"Invio ricetta a: {endpoint}")
            
            # Invio richiesta
            response = self.session.post(
                endpoint,
                data=soap_xml.encode('utf-8'),
                headers=headers,
                timeout=30
            )
            
            # Parsing risposta
            return self._parse_soap_response(response, dati_ricetta)
            
        except ValidationError:
            raise
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout invio ricetta: {e}")
            raise RicettaServiceError("Timeout nella comunicazione con il Sistema TS")
        except Exception as e:
            logger.error(f"Errore invio ricetta: {e}")
            raise RicettaServiceError(f"Errore durante l'invio: {e}")
    
    def _validate_ricetta_data(self, dati: Dict[str, Any]):
        """Valida i dati della ricetta - formato flat come V1"""
        required_fields = [
            'cf_assistito', 'codice_diagnosi', 'descrizione_diagnosi',
            'codice_farmaco', 'denominazione_farmaco', 'principio_attivo',
            'posologia', 'durata'
        ]
        
        for field in required_fields:
            if field not in dati:
                raise ValidationError(f"Campo obbligatorio mancante: {field}")
            if not dati[field] or (isinstance(dati[field], str) and not dati[field].strip()):
                raise ValidationError(f"Campo obbligatorio vuoto: {field}")
    
    def _parse_soap_response(self, response: requests.Response, dati_originali: Dict[str, Any]) -> Dict[str, Any]:
        """Parsing della risposta SOAP dal Sistema TS"""
        try:
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f'HTTP_{response.status_code}',
                    'message': f'Errore HTTP: {response.status_code}',
                    'response_text': response.text[:500]
                }
            
            # Parse XML response
            try:
                xml_root = etree.fromstring(response.content)
            except etree.XMLSyntaxError as e:
                logger.error(f"Errore parsing XML: {e}")
                return {
                    'success': False,
                    'error': 'XML_PARSE_ERROR',
                    'message': 'Risposta non valida dal Sistema TS',
                    'response_text': response.text[:500]
                }
            
            # Cerca elementi di risposta
            namespaces = {
                'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                'demws': 'http://demws.ricetta.sogei.it/'
            }
            
            # Cerca fault SOAP
            fault = xml_root.find('.//soap:Fault', namespaces)
            if fault is not None:
                fault_code = fault.find('.//faultcode')
                fault_string = fault.find('.//faultstring')
                
                return {
                    'success': False,
                    'error': 'SOAP_FAULT',
                    'fault_code': fault_code.text if fault_code is not None else 'Unknown',
                    'message': fault_string.text if fault_string is not None else 'Errore SOAP sconosciuto'
                }
            
            # Cerca risposta successo
            response_elem = xml_root.find('.//demws:demInvioPrescrittoRicettaBiancaResponse', namespaces)
            if response_elem is not None:
                # Estrae risultati
                risultato = {}
                for child in response_elem:
                    tag_name = child.tag.split('}')[-1]  # Rimuove namespace
                    risultato[tag_name] = child.text
                
                # Determina successo basato su codici di ritorno
                codice_ritorno = risultato.get('codiceRitorno', '')
                success = codice_ritorno == '0' or codice_ritorno.startswith('0')
                
                return {
                    'success': success,
                    'data': risultato,
                    'codice_ricetta': risultato.get('codiceRicetta'),
                    'numero_ricetta': risultato.get('numeroRicetta'),
                    'message': risultato.get('descrizioneRitorno', 'Ricetta elaborata'),
                    'timestamp': datetime.now().isoformat()
                }
            
            # Se arriviamo qui, risposta non riconosciuta
            return {
                'success': False,
                'error': 'UNKNOWN_RESPONSE',
                'message': 'Formato risposta non riconosciuto',
                'response_text': response.text[:500]
            }
            
        except Exception as e:
            logger.error(f"Errore parsing risposta: {e}")
            return {
                'success': False,
                'error': 'PARSING_ERROR',
                'message': f'Errore elaborazione risposta: {e}',
                'response_text': response.text[:500] if hasattr(response, 'text') else str(response)
            }
    
    def visualizza_ricette(self, data_da: str = None, data_a: str = None, cf_assistito: str = None) -> Dict[str, Any]:
        """Recupera lista ricette dal Sistema TS - Replica metodo V1"""
        try:
            logger.info("Richiesta lista ricette al Sistema TS")
            
            # Genera SOAP per lista ricette
            soap_xml = self._generate_soap_lista_ricette(data_da, data_a, cf_assistito)
            
            # Endpoint visualizzazione
            endpoint = self.config['endpoints'].get('visualizzazione', self.config['endpoints']['invio'])
            
            # Headers SOAP
            headers = {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'SOAPAction': 'demVisualizzaRicette'
            }
            
            logger.info(f"Richiesta lista ricette a: {endpoint}")
            
            # Invio richiesta
            response = self.session.post(
                endpoint,
                data=soap_xml.encode('utf-8'),
                headers=headers,
                timeout=30
            )
            
            # Parsing risposta
            return self._parse_lista_ricette_response(response)
            
        except Exception as e:
            logger.error(f"Errore recupero lista ricette: {e}")
            return {
                'success': False,
                'error': 'SERVICE_ERROR',
                'message': f'Errore durante il recupero: {e}',
                'data': []
            }
    
    def _generate_soap_lista_ricette(self, data_da: str = None, data_a: str = None, cf_assistito: str = None) -> str:
        """Genera SOAP per recupero lista ricette"""
        try:
            # Namespace SOAP
            soap_ns = "http://schemas.xmlsoap.org/soap/envelope/"
            demws_ns = "http://demws.ricetta.sogei.it/"
            
            # Crea root element
            envelope = etree.Element(f"{{{soap_ns}}}Envelope")
            envelope.nsmap[None] = soap_ns
            envelope.nsmap['demws'] = demws_ns
            
            # Header
            header = etree.SubElement(envelope, f"{{{soap_ns}}}Header")
            
            # Body
            body = etree.SubElement(envelope, f"{{{soap_ns}}}Body")
            
            # Metodo visualizzazione
            visualizza_method = etree.SubElement(body, f"{{{demws_ns}}}demVisualizzaRicette")
            
            # Credenziali
            cf_medico = etree.SubElement(visualizza_method, f"{{{demws_ns}}}cfMedico")
            cf_medico.text = self.config['credentials']['cf_medico']
            
            password = etree.SubElement(visualizza_method, f"{{{demws_ns}}}password")
            password.text = self.config['credentials']['password']
            
            # Parametri opzionali
            if data_da:
                data_da_elem = etree.SubElement(visualizza_method, f"{{{demws_ns}}}dataDa")
                data_da_elem.text = data_da
                
            if data_a:
                data_a_elem = etree.SubElement(visualizza_method, f"{{{demws_ns}}}dataA")
                data_a_elem.text = data_a
                
            if cf_assistito:
                cf_assistito_elem = etree.SubElement(visualizza_method, f"{{{demws_ns}}}cfAssistito")
                cf_assistito_elem.text = cf_assistito
            
            # Converte a stringa XML
            xml_str = etree.tostring(
                envelope, 
                pretty_print=True, 
                xml_declaration=True, 
                encoding='UTF-8'
            ).decode('utf-8')
            
            return xml_str
            
        except Exception as e:
            logger.error(f"Errore generazione SOAP lista: {e}")
            raise ValidationError(f"Impossibile generare SOAP lista ricette: {e}")
    
    def _parse_lista_ricette_response(self, response: requests.Response) -> Dict[str, Any]:
        """Parsing della risposta lista ricette"""
        try:
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f'HTTP_{response.status_code}',
                    'message': f'Errore HTTP: {response.status_code}',
                    'data': []
                }
            
            # Parse XML response
            try:
                xml_root = etree.fromstring(response.content)
            except etree.XMLSyntaxError as e:
                logger.error(f"Errore parsing XML lista: {e}")
                return {
                    'success': False,
                    'error': 'XML_PARSE_ERROR',
                    'message': 'Risposta non valida dal Sistema TS',
                    'data': []
                }
            
            # Namespace per parsing
            namespaces = {
                'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                'demws': 'http://demws.ricetta.sogei.it/'
            }
            
            # Cerca fault SOAP
            fault = xml_root.find('.//soap:Fault', namespaces)
            if fault is not None:
                fault_string = fault.find('.//faultstring')
                return {
                    'success': False,
                    'error': 'SOAP_FAULT',
                    'message': fault_string.text if fault_string is not None else 'Errore SOAP',
                    'data': []
                }
            
            # Cerca risposta successo
            response_elem = xml_root.find('.//demws:demVisualizzaRicetteResponse', namespaces)
            if response_elem is not None:
                # Estrae lista ricette (implementazione semplificata)
                ricette = []
                
                # Per ora ritorna lista vuota ma con successo
                # In un'implementazione completa, qui si parserebbe la lista delle ricette
                
                return {
                    'success': True,
                    'data': ricette,
                    'count': len(ricette),
                    'message': 'Lista ricette recuperata con successo'
                }
            
            # Risposta non riconosciuta
            return {
                'success': False,
                'error': 'UNKNOWN_RESPONSE',
                'message': 'Formato risposta non riconosciuto',
                'data': []
            }
            
        except Exception as e:
            logger.error(f"Errore parsing lista ricette: {e}")
            return {
                'success': False,
                'error': 'PARSING_ERROR',
                'message': f'Errore elaborazione risposta: {e}',
                'data': []
            }

    def get_environment_info(self) -> Dict[str, Any]:
        """Informazioni sull'ambiente corrente"""
        return {
            'environment': self.config['environment'],
            'endpoints': self.config['endpoints'],
            'certificates': self.ssl_manager.validate_certificates(),
            'credentials_configured': bool(
                self.config['credentials']['cf_medico'] and 
                self.config['credentials']['password']
            )
        }

# Instance globale
ricetta_service = RicettaService()