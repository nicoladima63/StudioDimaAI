"""
SMS Service V2 
Servizio unificato per invio SMS con gestione ambienti
"""
import requests
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from ..core.environment_manager import environment_manager, ServiceType, Environment
from ..core.config import get_config_value
from ..core.exceptions import ValidationError, ServiceError

logger = logging.getLogger(__name__)

class SMSService:
    """Servizio SMS con environment switching"""
    
    def __init__(self):
        self.service_type = ServiceType.SMS
        self._current_config = None
        self._current_environment = None
        self._reload_configuration()
    
    def _reload_configuration(self):
        """Ricarica configurazione basata su ambiente corrente"""
        self._current_environment = environment_manager.get_environment(self.service_type)
        self._current_config = environment_manager.get_service_config(self.service_type)
        logger.info(f"SMS Service configurato per ambiente: {self._current_environment.value}")
    
    def get_current_environment(self) -> Environment:
        """Ottiene ambiente corrente"""
        return self._current_environment
    
    def get_current_config(self) -> Dict[str, Any]:
        """Ottiene configurazione corrente"""
        if self._current_environment != environment_manager.get_environment(self.service_type):
            self._reload_configuration()
        return self._current_config.copy()
    
    def is_enabled(self) -> bool:
        """Verifica se servizio è abilitato"""
        config = self.get_current_config()
        return config.get('enabled', False) and bool(config.get('api_key'))
    
    def get_service_status(self) -> Dict[str, Any]:
        """Ottiene stato completo del servizio"""
        config = self.get_current_config()
        validation = environment_manager.validate_service_config(self.service_type)
        
        return {
            'environment': self._current_environment.value,
            'enabled': self.is_enabled(),
            'api_key_configured': bool(config.get('api_key')),
            'sender': config.get('sender', ''),
            'url': config.get('url', ''),
            'validation': {
                'valid': validation.valid,
                'errors': validation.errors,
                'warnings': validation.warnings,
                'checks': validation.checks
            }
        }
    
    def test_connection(self) -> Dict[str, Any]:
        """Testa connessione al servizio Brevo"""
        try:
            config = self.get_current_config()
            api_key = config.get('api_key', '')
            
            if not api_key:
                return {
                    'success': False,
                    'error': 'API_KEY_MISSING',
                    'message': 'API key Brevo non configurata'
                }
            
            # Test con endpoint account info Brevo
            headers = {
                'api-key': api_key,
                'Content-Type': 'application/json'
            }
            
            response = requests.get(
                'https://api.brevo.com/v3/account',
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                account_data = response.json()
                return {
                    'success': True,
                    'environment': self._current_environment.value,
                    'account_info': {
                        'company_name': account_data.get('companyName', ''),
                        'email': account_data.get('email', ''),
                        'plan_type': account_data.get('plan', [{}])[0].get('type', '') if account_data.get('plan') else ''
                    },
                    'sender': config.get('sender', ''),
                    'message': 'Connessione SMS attiva'
                }
            else:
                return {
                    'success': False,
                    'error': 'API_ERROR',
                    'status_code': response.status_code,
                    'message': f'Errore API Brevo: {response.status_code}'
                }
                
        except requests.RequestException as e:
            return {
                'success': False,
                'error': 'CONNECTION_ERROR',
                'message': f'Errore connessione: {e}'
            }
        except Exception as e:
            logger.error(f"Errore test SMS: {e}")
            return {
                'success': False,
                'error': 'TEST_ERROR',
                'message': f'Errore test connessione: {e}'
            }
    
    def send_sms(self, 
                 recipient: str, 
                 message: str, 
                 sender: Optional[str] = None,
                 tag: Optional[str] = None) -> Dict[str, Any]:
        """
        Invia SMS tramite Brevo
        
        Args:
            recipient: Numero telefono destinatario (formato internazionale)
            message: Testo messaggio
            sender: Mittente personalizzato (opzionale)
            tag: Tag per categorizzazione (opzionale)
            
        Returns:
            Risultato invio con dettagli
        """
        try:
            if not self.is_enabled():
                return {
                    'success': False,
                    'error': 'SERVICE_DISABLED',
                    'message': 'Servizio SMS non abilitato o non configurato'
                }
            
            # Validazione input
            if not recipient or not message:
                raise ValidationError("Destinatario e messaggio sono obbligatori")
            
            # Pulisci numero telefono
            clean_recipient = self._clean_phone_number(recipient)
            if not clean_recipient:
                raise ValidationError("Numero telefono non valido")
            
            config = self.get_current_config()
            sender = sender or config.get('sender', 'StudioDima')
            
            # Prepara payload Brevo
            payload = {
                'type': 'transactional',
                'content': message,
                'recipient': clean_recipient,
                'sender': sender
            }
            
            if tag:
                payload['tag'] = tag
            
            headers = {
                'api-key': config.get('api_key'),
                'Content-Type': 'application/json'
            }
            
            # Invia SMS
            response = requests.post(
                config.get('url', 'https://api.brevo.com/v3/transactionalSMS/sms'),
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 201:
                response_data = response.json()
                return {
                    'success': True,
                    'message_id': response_data.get('messageId'),
                    'reference': response_data.get('reference'),
                    'recipient': clean_recipient,
                    'sender': sender,
                    'environment': self._current_environment.value,
                    'message': 'SMS inviato con successo'
                }
            else:
                error_data = response.json() if response.content else {}
                return {
                    'success': False,
                    'error': 'SEND_FAILED',
                    'status_code': response.status_code,
                    'api_error': error_data.get('message', 'Errore sconosciuto'),
                    'message': f'Errore invio SMS: {response.status_code}'
                }
                
        except ValidationError as e:
            return {
                'success': False,
                'error': 'VALIDATION_ERROR',
                'message': str(e)
            }
        except requests.RequestException as e:
            logger.error(f"Errore rete invio SMS: {e}")
            return {
                'success': False,
                'error': 'NETWORK_ERROR',
                'message': f'Errore di rete: {e}'
            }
        except Exception as e:
            logger.error(f"Errore invio SMS: {e}")
            return {
                'success': False,
                'error': 'SEND_ERROR',
                'message': f'Errore invio SMS: {e}'
            }
    
    def send_bulk_sms(self, 
                      recipients: List[str], 
                      message: str,
                      sender: Optional[str] = None,
                      tag: Optional[str] = None) -> Dict[str, Any]:
        """
        Invia SMS a più destinatari
        
        Args:
            recipients: Lista numeri telefono
            message: Testo messaggio
            sender: Mittente personalizzato (opzionale)
            tag: Tag per categorizzazione (opzionale)
            
        Returns:
            Risultato invio bulk con dettagli per ogni destinatario
        """
        if not recipients:
            return {
                'success': False,
                'error': 'NO_RECIPIENTS',
                'message': 'Nessun destinatario specificato'
            }
        
        results = []
        successful = 0
        failed = 0
        
        for recipient in recipients:
            result = self.send_sms(recipient, message, sender, tag)
            results.append({
                'recipient': recipient,
                'success': result['success'],
                'message_id': result.get('message_id'),
                'error': result.get('error'),
                'message': result.get('message')
            })
            
            if result['success']:
                successful += 1
            else:
                failed += 1
        
        return {
            'success': failed == 0,
            'total_recipients': len(recipients),
            'successful_sends': successful,
            'failed_sends': failed,
            'environment': self._current_environment.value,
            'results': results,
            'message': f'Invio bulk completato: {successful} successi, {failed} errori'
        }
    
    def get_sms_templates(self) -> Dict[str, str]:
        """Ottiene template SMS predefiniti"""
        return {
            'appointment_reminder': 'Gentile {nome}, ricordiamo il suo appuntamento del {data} alle ore {ora}. Studio Dima',
            'appointment_confirmation': 'Gentile {nome}, confermiamo il suo appuntamento del {data} alle ore {ora}. Studio Dima',
            'appointment_cancellation': 'Gentile {nome}, il suo appuntamento del {data} alle ore {ora} è stato annullato. Studio Dima',
            'recall_reminder': 'Gentile {nome}, è tempo per il suo {tipo_richiamo}. Contatti lo studio per fissare un appuntamento. Studio Dima',
            'treatment_reminder': 'Gentile {nome}, ricordiamo di completare il trattamento come concordato. Studio Dima'
        }
    
    def format_message_with_template(self, 
                                   template_key: str, 
                                   variables: Dict[str, str]) -> str:
        """
        Formatta messaggio usando template predefinito
        
        Args:
            template_key: Chiave template
            variables: Variabili da sostituire
            
        Returns:
            Messaggio formattato
        """
        templates = self.get_sms_templates()
        
        if template_key not in templates:
            raise ValidationError(f"Template {template_key} non trovato")
        
        template = templates[template_key]
        
        try:
            return template.format(**variables)
        except KeyError as e:
            raise ValidationError(f"Variabile mancante per template: {e}")
    
    def _clean_phone_number(self, phone: str) -> Optional[str]:
        """Pulisce e valida numero telefono"""
        if not phone:
            return None
        
        # Rimuovi spazi, trattini, parentesi
        clean = ''.join(char for char in phone if char.isdigit() or char == '+')
        
        # Aggiungi prefisso internazionale se mancante
        if clean.startswith('3') and len(clean) == 10:
            clean = '+39' + clean
        elif clean.startswith('003'):
            clean = '+' + clean[2:]
        elif not clean.startswith('+'):
            if len(clean) >= 10:
                clean = '+39' + clean
        
        # Validazione base lunghezza
        if len(clean) < 10 or len(clean) > 15:
            return None
        
        return clean
    
    def get_automation_settings(self) -> Dict[str, Any]:
        """Ottiene impostazioni automazione SMS"""
        return environment_manager.get_automation_settings()
    
    def set_automation_settings(self, settings: Dict[str, Any]):
        """Imposta impostazioni automazione SMS"""
        environment_manager.set_automation_settings(settings)

# Instance globale singleton
sms_service = SMSService()