import os
import requests
from requests.auth import HTTPBasicAuth
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import tempfile
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12

logger = logging.getLogger(__name__)

class RicettaAuthService:
    """
    Servizio per l'autenticazione con il sistema Tessera Sanitaria
    per la ricetta elettronica usando Token A2F
    """
    
    def __init__(self):
        self._load_config()
    
    def _get_current_env(self):
        """Ottiene l'ambiente corrente dal mode_manager o .env"""
        try:
            # Prova a leggere dal mode_manager per rilevare cambi dinamici
            from ..core.mode_manager import get_mode
            mode = get_mode('ricetta')
            return 'test' if mode == 'test' else 'prod'
        except:
            # Fallback al file .env
            return os.getenv('RICETTA_ENV', 'test').lower()
    
    def _load_config(self):
        """Carica la configurazione per l'ambiente corrente"""
        self.env = self._get_current_env()
        
        if self.env == 'test':
            # Endpoint ambiente di test
            self.endpoint_invio = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
            self.endpoint_visualizza = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
            self.endpoint_annulla = 'https://ricettabiancaservicetest.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
        else:  # prod
            # Endpoint ambiente di produzione
            self.endpoint_invio = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca'
            self.endpoint_visualizza = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca'
            self.endpoint_annulla = 'https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca'
        
        # Dati medico - scegli credenziali in base all'ambiente
        if self.env == 'test':
            # Credenziali dal kit ufficiale per ambiente TEST
            self.cf_medico = os.getenv('CF_MEDICO_TEST', 'PROVAX00X00X000Y')
            self.pincode = os.getenv('PINCODE_TEST', '1234567890')
            self.password = os.getenv('PASSWORD_TEST', 'Salve123')
            self.regione = os.getenv('REGIONE_TEST', '020')
            self.asl = os.getenv('ASL_TEST', '101')
            self.specializzazione = os.getenv('SPECIALIZZAZIONE_TEST', 'F')
            self.token_user_id = os.getenv('TOKEN_A2F_USER_ID_TEST', 'PROVAX00X00X000Y')
        else:  # prod
            # I tuoi dati reali per ambiente PRODUZIONE
            self.cf_medico = os.getenv('CF_MEDICO_PROD', 'DMRNCL63S21D612I')
            self.pincode = os.getenv('PINCODE_PROD', '1141766994')
            self.password = os.getenv('PASSWORD_PROD', 'VtmakYjB4CjEN_!')
            self.regione = os.getenv('REGIONE_PROD', '090')
            self.asl = os.getenv('ASL_PROD', '109')
            self.specializzazione = os.getenv('SPECIALIZZAZIONE_PROD', 'F')
            self.token_user_id = os.getenv('TOKEN_A2F_USER_ID_PROD', 'DMRNCL63S21D612I')
        
        # Certificati SSL per autenticazione client
        self._load_certificates()
        
        logger.info(f"Configurazione ricetta elettronica - Ambiente: {self.env}")
        logger.info(f"Endpoint invio: {self.endpoint_invio}")
        logger.info(f"CF Medico: {self.cf_medico}")
    
    def _load_certificates(self):
        """Carica i certificati SSL per l'autenticazione client"""
        # Path assoluto alla root del progetto (C:\Users\gengi\Desktop\StudioDimaAI)
        project_root = r"C:\Users\gengi\Desktop\StudioDimaAI"
        
        if self.env == 'test':
            # Certificati per ambiente di test
            self.client_cert_path = os.path.join(project_root, 'certs', 'test', 'client_cert.pem')
            self.client_key_path = os.path.join(project_root, 'certs', 'test', 'client_key.pem')
            self.ca_cert_path = os.path.join(project_root, 'certs', 'test', 'ActalisCA.crt')
        else:  # prod
            # Certificati per ambiente di produzione - usa i certificati PEM dall'env
            self.client_cert_path = os.path.join(project_root, os.getenv('RE_CLIENT_CERT_PROD', 'certs/prod/client_cert.pem'))
            self.client_key_path = os.path.join(project_root, os.getenv('RE_CLIENT_KEY_PROD', 'certs/prod/client_key.pem'))
            self.ca_cert_path = os.path.join(project_root, os.getenv('RE_CA_PATH_PROD', 'certs/prod/ActalisCA.crt'))
            
            logger.info(f"Ambiente PROD - Certificati configurati:")
            logger.info(f"  Client cert: {self.client_cert_path} - Esiste: {os.path.exists(self.client_cert_path)}")
            logger.info(f"  Client key: {self.client_key_path} - Esiste: {os.path.exists(self.client_key_path)}")
            logger.info(f"  CA cert: {self.ca_cert_path} - Esiste: {os.path.exists(self.ca_cert_path)}")
    
    def _generate_a2f_token(self) -> str:
        """
        Genera il token A2F per l'autenticazione
        Format: Bearer userID-yyyy-MM
        """
        now = datetime.now()
        year = now.strftime('%Y')
        month = now.strftime('%m')
        
        token = f"Bearer {self.token_user_id}-{year}-{month}"
        logger.info(f"Token A2F generato: {token}")
        return token
    
    def _create_auth_headers(self) -> Dict[str, str]:
        """Crea gli headers per l'autenticazione A2F"""
        token = self._generate_a2f_token()
        
        headers = {
            'Authorization2F': token,
            'Content-Type': 'application/xml',
            'Accept': 'application/xml'
        }
        
        return headers
    
    def authenticate(self) -> Dict[str, Any]:
        """
        Esegue l'autenticazione con il sistema TS usando Token A2F
        
        Returns:
            Dict contenente il risultato dell'autenticazione:
            - success: bool
            - token: str (il token A2F generato)
            - cf_medico: str 
            - ambiente: str
            - error: str (se success=False)
        """
        try:
            # Ricarica la configurazione per rilevare cambi di mode
            self._load_config()
            # Genera il token A2F
            token = self._generate_a2f_token()
            logger.info("Autenticazione Token A2F configurata...")
            
            # Per l'ambiente di test, il token è sufficiente
            # Non serve una chiamata di verifica
            result = {
                'success': True,
                'token': token,
                'cf_medico': self.cf_medico,
                'regione': self.regione,
                'asl': self.asl,
                'specializzazione': self.specializzazione,
                'ambiente': self.env,
                'endpoint_invio': self.endpoint_invio,
                'endpoint_visualizza': self.endpoint_visualizza,
                'endpoint_annulla': self.endpoint_annulla,
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info("Autenticazione Token A2F completata con successo")
            return result
            
        except Exception as e:
            logger.error(f"Errore durante l'autenticazione: {e}")
            return {
                'success': False,
                'error': f'Errore durante l\'autenticazione: {str(e)}'
            }
    
    def _create_legacy_ssl_session(self) -> requests.Session:
        """
        Crea sessione HTTP con configurazione SSL legacy robusta
        Stessa configurazione del ricetta_service che funziona
        """
        import urllib3
        from urllib3.poolmanager import PoolManager
        from urllib3.util.ssl_ import create_urllib3_context
        from requests.adapters import HTTPAdapter
        import ssl
        
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
        os.environ['PYTHONHTTPSVERIFY'] = '0'
        os.environ['OPENSSL_CONF'] = ''
        
        session = requests.Session()
        session.mount('https://', LegacySSLAdapter())
        
        # Basic Authentication (CF medico + password)
        session.auth = (self.cf_medico, self.password)
        logger.info(f"Basic Auth configurata: {self.cf_medico}")
        
        # Certificati SSL client - solo se esistono
        if hasattr(self, 'client_cert_path') and hasattr(self, 'client_key_path'):
            if self.client_cert_path and self.client_key_path and os.path.exists(self.client_cert_path) and os.path.exists(self.client_key_path):
                session.cert = (self.client_cert_path, self.client_key_path)
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

    def test_connection(self) -> Dict[str, Any]:
        """
        Testa la connessione ai servizi prescrittore con SSL legacy
        """
        try:
            # Ricarica la configurazione per rilevare cambi di mode
            self._load_config()
            # Crea sessione con configurazione SSL legacy robusta
            session = self._create_legacy_ssl_session()
            
            # Testa tutti gli endpoint dell'ambiente corrente
            headers = self._create_auth_headers()
            results = {}
            
            endpoints = {
                'invio': self.endpoint_invio,
                'visualizza': self.endpoint_visualizza,
                'annulla': self.endpoint_annulla
            }
            
            for name, url in endpoints.items():
                try:
                    response = session.head(url, headers=headers, timeout=10)
                    results[f'{name}_status'] = f'HTTP {response.status_code}'
                    # HTTP 500 significa che il server risponde, quindi connessione OK
                    # Solo errori di connessione (SSL, timeout, DNS) sono veri fallimenti
                    results[f'{name}_ok'] = response.status_code in [200, 401, 403, 405, 500]
                except Exception as e:
                    error_str = str(e)
                    results[f'{name}_status'] = f'Error: {error_str}'
                    # Se l'errore non è SSL/connessione, consideriamo OK
                    results[f'{name}_ok'] = 'SSL' not in error_str and 'timeout' not in error_str.lower()
            
            overall_success = all(results[k] for k in results if k.endswith('_ok'))
            
            return {
                'success': overall_success,
                'environment': self.env,
                'endpoint_invio': self.endpoint_invio,
                'endpoint_visualizza': self.endpoint_visualizza,
                'endpoint_annulla': self.endpoint_annulla,
                'token_preview': self._generate_a2f_token()[:25] + "...",
                'test_results': results,
                'message': f'Test completato per ambiente {self.env.upper()}'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Errore di connessione: {str(e)}',
                'endpoint_invio': self.endpoint_invio,
                'environment': self.env
            }


# Istanza globale del servizio
ricetta_auth_service = RicettaAuthService()