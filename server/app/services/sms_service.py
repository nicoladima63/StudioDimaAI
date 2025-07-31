# server/app/services/sms_service.py - Updated with Template Support

import os
import logging
from typing import Dict, Optional
from dotenv import load_dotenv
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

from server.app.core.mode_manager import get_mode, get_env_params
from server.app.core.template_manager import template_manager

logger = logging.getLogger(__name__)

# Cache per evitare messaggi ripetuti
_api_key_warned_service = False

# Carica le variabili d'ambiente dal file .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../../.env'))

class SMSService:
    """Servizio per l'invio di SMS tramite Brevo con gestione modalità e template"""
    
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
            global _api_key_warned_service
            if not _api_key_warned_service:
                logger.error(f"API Key Brevo non trovata per modalità {self.mode}")
                _api_key_warned_service = True
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
    
    def send_recall_sms(self, richiamo_data: Dict, custom_message: Optional[str] = None) -> Dict:
        """
        Invia un SMS di richiamo basato sui dati del richiamo
        
        Args:
            richiamo_data: Dizionario con dati del richiamo
            custom_message: Messaggio personalizzato (opzionale, usa template se None)
            
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
            # Usa messaggio personalizzato o genera da template
            if custom_message:
                messaggio = custom_message
            else:
                messaggio = self.generate_recall_message(richiamo_data)
            
            return self.send_sms(telefono, messaggio)
            
        except Exception as e:
            error_msg = f"Errore invio SMS richiamo: {e}"
            logger.error(error_msg)
            
            return {
                'success': False,
                'error': error_msg
            }
    
    def send_appointment_reminder_sms(self, appuntamento_data: Dict, custom_message: Optional[str] = None) -> Dict:
        """
        Invia un SMS promemoria appuntamento
        
        Args:
            appuntamento_data: Dizionario con dati dell'appuntamento
            custom_message: Messaggio personalizzato (opzionale, usa template se None)
            
        Returns:
            Dict con risultato dell'invio
        """
        if not appuntamento_data:
            return {
                'success': False,
                'error': 'Dati appuntamento mancanti'
            }
        
        telefono = appuntamento_data.get('telefono')
        if not telefono:
            return {
                'success': False,
                'error': 'Numero telefono non trovato nell\'appuntamento'
            }
        
        try:
            # Usa messaggio personalizzato o genera da template
            if custom_message:
                messaggio = custom_message
            else:
                messaggio = self.generate_appointment_reminder_message(appuntamento_data)
            
            return self.send_sms(telefono, messaggio)
            
        except Exception as e:
            error_msg = f"Errore invio SMS promemoria: {e}"
            logger.error(error_msg)
            
            return {
                'success': False,
                'error': error_msg
            }
    
    def generate_recall_message(self, richiamo_data: Dict) -> str:
        """
        Genera messaggio di richiamo usando i template
        
        Args:
            richiamo_data: Dati del richiamo
            
        Returns:
            Messaggio renderizzato
        """
        try:
            return template_manager.render_template('richiamo', richiamo_data)
        except Exception as e:
            logger.error(f"Errore generazione messaggio richiamo: {e}")
            # Fallback a messaggio di base
            nome = richiamo_data.get('nome_completo', 'Gentile paziente')
            return f"Ciao {nome}, è tempo per il tuo richiamo. Contattaci per fissare un appuntamento. Studio Dima"
    
    def generate_appointment_reminder_message(self, appuntamento_data: Dict) -> str:
        """
        Genera messaggio promemoria appuntamento usando i template
        
        Args:
            appuntamento_data: Dati dell'appuntamento
            
        Returns:
            Messaggio renderizzato
        """
        try:
            return template_manager.render_template('promemoria', appuntamento_data)
        except Exception as e:
            logger.error(f"Errore generazione messaggio promemoria: {e}")
            # Fallback a messaggio di base
            nome = appuntamento_data.get('nome_completo', 'Gentile paziente')
            return f"Ciao {nome}, ti ricordiamo l'appuntamento di domani. Studio Dima"
    
    def preview_recall_message(self, richiamo_data: Dict) -> Dict:
        """
        Genera anteprima messaggio richiamo senza inviarlo
        
        Args:
            richiamo_data: Dati del richiamo
            
        Returns:
            Dict con messaggio e statistiche
        """
        try:
            message = self.generate_recall_message(richiamo_data)
            
            return {
                'success': True,
                'message': message,
                'length': len(message),
                'estimated_sms_parts': (len(message) // 160) + 1,
                'variables_used': list(richiamo_data.keys())
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Errore generazione anteprima: {str(e)}'
            }
    
    def preview_appointment_reminder_message(self, appuntamento_data: Dict) -> Dict:
        """
        Genera anteprima messaggio promemoria senza inviarlo
        
        Args:
            appuntamento_data: Dati dell'appuntamento
            
        Returns:
            Dict con messaggio e statistiche
        """
        try:
            message = self.generate_appointment_reminder_message(appuntamento_data)
            
            return {
                'success': True,
                'message': message,
                'length': len(message),
                'estimated_sms_parts': (len(message) // 160) + 1,
                'variables_used': list(appuntamento_data.keys())
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Errore generazione anteprima: {str(e)}'
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
            test_sms = sib_api_v3_sdk.SendTransacSms(
                sender=self.params.get('SENDER', 'StudioDima'),
                recipient="+390000000000",
                content="Test connessione",
                type="transactional"
            )
            
            self.api_instance.send_transac_sms(test_sms)
            
            return {
                'success': True,
                'message': 'Connessione API Brevo OK',
                'mode': self.mode
            }
            
        except ApiException as e:
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

def send_recall_sms(richiamo_data: Dict, custom_message: str = None) -> Dict:
    """Funzione di compatibilità per l'invio richiami"""
    return sms_service.send_recall_sms(richiamo_data, custom_message)