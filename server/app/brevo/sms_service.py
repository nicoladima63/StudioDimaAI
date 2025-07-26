import os
import logging
from typing import Dict, Optional
from dotenv import load_dotenv
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

from server.app.core.mode_manager import get_mode, get_env_params
from server.app.core.utils import costruisci_messaggio_richiamo

logger = logging.getLogger(__name__)

# Cache per evitare messaggi ripetuti
_api_key_warned = False

# Carica le variabili d'ambiente dal file .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

class SMSService:
    """Servizio per l'invio di SMS tramite Brevo con gestione modalità"""
    
    def __init__(self):
        self.mode = get_mode('sms')
        self.params = get_env_params('sms', self.mode)
        self._setup_client()
    
    def _setup_client(self):
        """Configura il client Brevo in base alla modalità corrente"""
        if not self.params.get('ENABLED'):
            logger.info(f"SMS Service in modalità {self.mode} - SMS disabilitati")
            self.api_instance = None
            return
            
        api_key = self.params.get('API_KEY')
        if not api_key:
            global _api_key_warned
            if not _api_key_warned:
                logger.error(f"API Key Brevo non trovata per modalità {self.mode}")
                _api_key_warned = True
            self.api_instance = None
            return
            
        try:
            configuration = sib_api_v3_sdk.Configuration()
            configuration.api_key['api-key'] = api_key
            self.api_instance = sib_api_v3_sdk.TransactionalSMSApi(
                sib_api_v3_sdk.ApiClient(configuration)
            )
            logger.info(f"SMS Service configurato per modalità {self.mode}")
        except Exception as e:
            logger.error(f"Errore configurazione client Brevo: {e}")
            self.api_instance = None
    
    def get_current_mode(self) -> str:
        """Ritorna la modalità SMS corrente"""
        return self.mode
    
    def is_enabled(self) -> bool:
        """Verifica se l'invio SMS è abilitato"""
        return self.params.get('ENABLED', False) and self.api_instance is not None
    
    def send_sms(self, to_number: str, message: str, sender: Optional[str] = None) -> Dict:
        """
        Invia un SMS tramite Brevo
        
        Args:
            to_number: Numero di telefono destinatario
            message: Testo del messaggio
            sender: Mittente (opzionale, usa quello configurato se None)
            
        Returns:
            Dict con risultato dell'invio
        """
        if not self.is_enabled():
            return {
                'success': False, 
                'error': f'SMS disabilitato in modalità {self.mode}',
                'mode': self.mode
            }
        
        if not to_number or not message:
            return {
                'success': False, 
                'error': 'Numero telefono o messaggio mancante'
            }
        
        sender = sender or self.params.get('SENDER', 'StudioDima')
        
        try:
            sms = sib_api_v3_sdk.SendTransacSms(
                sender=sender,
                recipient=to_number,
                content=message,
                type="transactional"
            )
            
            api_response = self.api_instance.send_transac_sms(sms)
            
            logger.info(f"SMS inviato con successo a {to_number} (modalità {self.mode})")
            
            return {
                'success': True,
                'result': api_response.to_dict() if hasattr(api_response, 'to_dict') else str(api_response),
                'mode': self.mode,
                'message_id': getattr(api_response, 'message_id', None)
            }
            
        except ApiException as e:
            error_msg = f"Errore API Brevo: {e}"
            logger.error(error_msg)
            logger.error(f"Dettagli errore: {e.body if hasattr(e, 'body') else 'N/A'}")
            
            return {
                'success': False,
                'error': error_msg,
                'mode': self.mode
            }
        except Exception as e:
            error_msg = f"Errore generico invio SMS: {e}"
            logger.error(error_msg)
            
            return {
                'success': False,
                'error': error_msg,
                'mode': self.mode
            }
    
    def send_recall_sms(self, richiamo_data: Dict) -> Dict:
        """
        Invia un SMS di richiamo basato sui dati del richiamo
        
        Args:
            richiamo_data: Dizionario con dati del richiamo
            
        Returns:
            Dict con risultato dell'invio
        """
        if not richiamo_data:
            return {
                'success': False,
                'error': 'Dati richiamo mancanti'
            }
        
        telefono = richiamo_data.get('telefono')
        if not telefono:
            return {
                'success': False,
                'error': 'Numero telefono non trovato nel richiamo'
            }
        
        try:
            messaggio = costruisci_messaggio_richiamo(richiamo_data)
            return self.send_sms(telefono, messaggio)
            
        except Exception as e:
            error_msg = f"Errore costruzione messaggio richiamo: {e}"
            logger.error(error_msg)
            
            return {
                'success': False,
                'error': error_msg
            }
    
    def test_connection(self) -> Dict:
        """
        Testa la connessione all'API Brevo
        
        Returns:
            Dict con risultato del test
        """
        if not self.is_enabled():
            return {
                'success': False,
                'error': f'SMS disabilitato in modalità {self.mode}',
                'mode': self.mode
            }
        
        try:
            # Test con un numero di telefono fittizio per verificare la configurazione
            # (non verrà inviato davvero perché il numero non è valido)
            test_sms = sib_api_v3_sdk.SendTransacSms(
                sender=self.params.get('SENDER', 'StudioDima'),
                recipient="+390000000000",  # Numero di test non valido
                content="Test connessione",
                type="transactional"
            )
            
            # Questo dovrebbe fallire con un errore specifico sul numero non valido
            # Ma conferma che l'API key è corretta
            self.api_instance.send_transac_sms(test_sms)
            
            return {
                'success': True,
                'message': 'Connessione API Brevo OK',
                'mode': self.mode
            }
            
        except ApiException as e:
            # Se l'errore è sul numero non valido, la connessione funziona
            if "invalid" in str(e).lower() and "recipient" in str(e).lower():
                return {
                    'success': True,
                    'message': 'Connessione API Brevo OK (errore numero di test atteso)',
                    'mode': self.mode
                }
            else:
                return {
                    'success': False,
                    'error': f'Errore connessione API Brevo: {e}',
                    'mode': self.mode
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'Errore test connessione: {e}',
                'mode': self.mode
            }

# Istanza globale del servizio
sms_service = SMSService()

# Funzioni di compatibilità per codice esistente
def send_sms_brevo(to_number: str, message: str, sender: str = "StudioDima"):
    """Funzione di compatibilità per il codice esistente"""
    return sms_service.send_sms(to_number, message, sender)

def send_recall_sms(richiamo_data: Dict) -> Dict:
    """Funzione di compatibilità per l'invio richiami"""
    return sms_service.send_recall_sms(richiamo_data)