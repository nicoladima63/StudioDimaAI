"""
SMS Service V2 
Servizio unificato per invio SMS con gestione ambienti e template system
"""
import requests
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from core.environment_manager import environment_manager, ServiceType, Environment
from core.config import get_config_value
from core.exceptions import ValidationError
from core.template_manager import template_manager

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
    
    def send_recall_sms(self, richiamo_data: Dict[str, Any], 
                       custom_message: Optional[str] = None) -> Dict[str, Any]:
        """
        Invia SMS di richiamo basato sui dati del richiamo
        
        Args:
            richiamo_data: Dati del richiamo dal database
            custom_message: Messaggio personalizzato (opzionale)
            
        Returns:
            Risultato invio SMS
        """
        try:
            if not richiamo_data:
                return {
                    'success': False,
                    'error': 'RICHIAMO_DATA_MISSING',
                    'message': 'Dati richiamo mancanti'
                }
            
            # Estrai dati necessari
            telefono = richiamo_data.get('telefono')
            nome = richiamo_data.get('nome') or richiamo_data.get('nome_completo', 'Gentile paziente')
            tipo_richiamo = richiamo_data.get('tipo_richiamo', 'controllo')
            
            if not telefono:
                return {
                    'success': False,
                    'error': 'PHONE_MISSING',
                    'message': 'Numero telefono non trovato nel richiamo'
                }
            
            # Usa messaggio personalizzato o genera da template
            if custom_message:
                message = custom_message
            else:
                message = self._generate_recall_message(richiamo_data)
            
            return self.send_sms(telefono, message, tag='richiamo')
            
        except Exception as e:
            logger.error(f"Errore invio SMS richiamo: {e}")
            return {
                'success': False,
                'error': 'RECALL_SMS_ERROR',
                'message': f'Errore invio SMS richiamo: {str(e)}'
            }
    
    def send_bulk_recall_sms(self, richiami_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Invia SMS di richiamo in blocco
        
        Args:
            richiami_data: Lista dati richiami
            
        Returns:
            Risultato invio bulk con dettagli per ogni richiamo
        """
        if not richiami_data:
            return {
                'success': False,
                'error': 'NO_RICHIAMI',
                'message': 'Nessun richiamo specificato'
            }
        
        results = []
        successful = 0
        failed = 0
        
        for richiamo in richiami_data:
            result = self.send_recall_sms(richiamo)
            results.append({
                'richiamo_id': richiamo.get('id'),
                'paziente_id': richiamo.get('paziente_id'),
                'telefono': richiamo.get('telefono'),
                'nome': richiamo.get('nome'),
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
            'total_richiami': len(richiami_data),
            'successful_sends': successful,
            'failed_sends': failed,
            'environment': self._current_environment.value,
            'results': results,
            'message': f'Invio richiami completato: {successful} successi, {failed} errori'
        }
    
    def preview_recall_message(self, richiamo_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Genera anteprima messaggio richiamo usando template manager V2
        
        Args:
            richiamo_data: Dati del richiamo
            
        Returns:
            Anteprima messaggio con statistiche
        """
        try:
            if not richiamo_data:
                return {
                    'success': False,
                    'error': 'RICHIAMO_DATA_MISSING',
                    'message': 'Dati richiamo mancanti'
                }
            
            # Usa template manager per preview completo
            preview_result = template_manager.preview_template(
                tipo='richiamo',
                data=richiamo_data
            )
            
            if preview_result['success']:
                # Aggiungi informazioni specifiche per richiamo
                preview_result.update({
                    'recipient': richiamo_data.get('telefono'),
                    'recipient_name': richiamo_data.get('nome') or richiamo_data.get('nome_completo'),
                    'template_used': 'richiamo'
                })
                return preview_result
            else:
                # Fallback se template manager fallisce
                message = self._generate_recall_message(richiamo_data)
                
                return {
                    'success': True,
                    'message': message,
                    'length': len(message),
                    'estimated_sms_parts': (len(message) // 160) + 1,
                    'recipient': richiamo_data.get('telefono'),
                    'recipient_name': richiamo_data.get('nome') or richiamo_data.get('nome_completo'),
                    'variables_used': list(richiamo_data.keys()),
                    'template_used': 'richiamo_fallback'
                }
                
        except Exception as e:
            logger.error(f"Errore preview messaggio richiamo: {e}")
            return {
                'success': False,
                'error': 'PREVIEW_ERROR',
                'message': f'Errore generazione anteprima: {str(e)}'
            }
    
    def _generate_recall_message(self, richiamo_data: Dict[str, Any]) -> str:
        """
        Genera messaggio di richiamo usando template manager V2
        
        Args:
            richiamo_data: Dati del richiamo
            
        Returns:
            Messaggio formattato
        """
        try:
            # Mappa tipo richiamo da codice a testo leggibile
            tipo_map = {
                '1': 'controllo periodico',
                '2': 'richiamo igiene', 
                '3': 'controllo post-trattamento',
                '4': 'controllo ortodontico',
                '5': 'visita di follow-up',
                '21': 'controllo + igiene',
                '12': 'igiene + controllo'
            }
            
            nome = richiamo_data.get('nome') or richiamo_data.get('nome_completo', 'Gentile paziente')
            tipo_richiamo_code = str(richiamo_data.get('tipo_richiamo', '1'))
            tipo_richiamo = tipo_map.get(tipo_richiamo_code, 'controllo')
            
            # Calcola data richiamo se non presente
            data_richiamo = richiamo_data.get('data_richiamo', 'da concordare')
            if data_richiamo and isinstance(data_richiamo, str) and len(data_richiamo) >= 10:
                # Format date from YYYY-MM-DD to DD/MM/YYYY
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(data_richiamo[:10])
                    data_richiamo = dt.strftime('%d/%m/%Y')
                except:
                    data_richiamo = 'da concordare'
            else:
                data_richiamo = 'da concordare'
            
            # Prepara dati per template
            template_data = {
                'nome_completo': nome,
                'tipo_richiamo': tipo_richiamo,
                'data_richiamo': data_richiamo
            }
            
            # Usa template manager V2 per generare messaggio
            return template_manager.render_template('richiamo', template_data)
            
        except Exception as e:
            logger.error(f"Errore generazione messaggio richiamo con template: {e}")
            # Fallback a messaggio di base
            nome = richiamo_data.get('nome') or richiamo_data.get('nome_completo', 'Gentile paziente')
            return f"Gentile {nome}, è tempo per il suo controllo. Contatti lo studio per fissare un appuntamento. Studio Dima"
    
    def get_automation_settings(self) -> Dict[str, Any]:
        """Ottiene impostazioni automazione SMS"""
        return environment_manager.get_automation_settings()
    
    def set_automation_settings(self, settings: Dict[str, Any]):
        """Imposta impostazioni automazione SMS"""
        environment_manager.set_automation_settings(settings)
    
    # Template integration methods
    def get_template(self, tipo: str) -> Optional[Dict[str, Any]]:
        """Get SMS template via template manager"""
        return template_manager.get_template(tipo)
    
    def get_all_templates(self) -> Dict[str, Any]:
        """Get all SMS templates via template manager"""
        return template_manager.get_all_templates()
    
    def update_template(self, tipo: str, content: str, description: str = None) -> bool:
        """Update SMS template via template manager"""
        return template_manager.update_template(tipo, content, description)
    
    def reset_template(self, tipo: str) -> bool:
        """Reset SMS template to default via template manager"""
        return template_manager.reset_template(tipo)
    
    def validate_template(self, content: str) -> Dict[str, Any]:
        """Validate template content via template manager"""
        return template_manager.validate_template(content)
    
    def preview_template(self, tipo: str, data: Dict[str, Any] = None, 
                        custom_content: str = None) -> Dict[str, Any]:
        """Preview template with data via template manager"""
        return template_manager.preview_template(tipo, data, custom_content)
    
    def send_appointment_reminder_sms(self, appuntamento_data: Dict[str, Any], 
                                    custom_message: Optional[str] = None) -> Dict[str, Any]:
        """
        Invia SMS promemoria appuntamento usando template V2
        
        Args:
            appuntamento_data: Dati dell'appuntamento
            custom_message: Messaggio personalizzato (opzionale)
            
        Returns:
            Risultato invio SMS
        """
        try:
            if not appuntamento_data:
                return {
                    'success': False,
                    'error': 'APPUNTAMENTO_DATA_MISSING',
                    'message': 'Dati appuntamento mancanti'
                }
            
            telefono = appuntamento_data.get('telefono')
            if not telefono:
                return {
                    'success': False,
                    'error': 'PHONE_MISSING',
                    'message': 'Numero telefono non trovato nell\'appuntamento'
                }
            
            # Usa messaggio personalizzato o genera da template
            if custom_message:
                message = custom_message
            else:
                message = self._generate_appointment_reminder_message(appuntamento_data)
            
            return self.send_sms(telefono, message, tag='promemoria')
            
        except Exception as e:
            logger.error(f"Errore invio SMS promemoria: {e}")
            return {
                'success': False,
                'error': 'REMINDER_SMS_ERROR',
                'message': f'Errore invio SMS promemoria: {str(e)}'
            }
    
    def _generate_appointment_reminder_message(self, appuntamento_data: Dict[str, Any]) -> str:
        """
        Genera messaggio promemoria appuntamento usando template manager V2
        
        Args:
            appuntamento_data: Dati dell'appuntamento
            
        Returns:
            Messaggio formattato
        """
        try:
            nome = appuntamento_data.get('nome_completo') or appuntamento_data.get('nome', 'Gentile paziente')
            
            # Prepara dati per template promemoria
            template_data = {
                'nome_completo': nome,
                'data_appuntamento': appuntamento_data.get('data_appuntamento', 'da confermare'),
                'ora_appuntamento': appuntamento_data.get('ora_appuntamento', 'da confermare'),
                'tipo_appuntamento': appuntamento_data.get('tipo_appuntamento', 'visita'),
                'medico': appuntamento_data.get('medico', 'Studio Dima')
            }
            
            # Usa template manager V2
            return template_manager.render_template('promemoria', template_data)
            
        except Exception as e:
            logger.error(f"Errore generazione messaggio promemoria con template: {e}")
            # Fallback a messaggio di base
            nome = appuntamento_data.get('nome_completo') or appuntamento_data.get('nome', 'Gentile paziente')
            return f"Gentile {nome}, ricordiamo l'appuntamento di domani. Studio Dima"

# Instance globale singleton
sms_service = SMSService()