import os
from dotenv import load_dotenv
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

# Carica le variabili d'ambiente dal file .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

def send_sms_brevo(to_number, message, sender="StudioDima"):
    api_key = os.getenv("BREVO_API_KEY")
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = api_key

    api_instance = sib_api_v3_sdk.TransactionalSMSApi(sib_api_v3_sdk.ApiClient(configuration))
    sms = sib_api_v3_sdk.SendTransacSms(
        sender=sender,
        recipient=to_number,
        content=message,
        type="transactional"
    )
    try:
        api_response = api_instance.send_transac_sms(sms)
        return api_response
    except ApiException as e:
        print(f"Errore nell'invio SMS: {e}")
        print(e.body)
        return None

def send_recall_sms(self, richiamo_id: str) -> dict:
    """
    Invia un SMS di richiamo al paziente selezionato.
    """
    data = self.prepare_recall_message(richiamo_id)
    if not data or not data.get('telefono'):
        return {'success': False, 'error': 'Richiamo o telefono non trovato'}
    # Invio SMS
    sms_result = send_sms_brevo(data['telefono'], data['messaggio'])
    if sms_result:
        return {'success': True, 'result': str(sms_result)}
    else:
        return {'success': False, 'error': 'Errore invio SMS'}