"""
📦 Implementazioni delle Azioni di Sistema
==========================================

Questo modulo contiene le implementazioni concrete per le azioni di automazione di base del sistema.
Ogni azione è decorata con `@register_action` per essere automaticamente disponibile nel motore di automazione.

Author: Gemini Code Architect
Version: 1.1.0
"""

import logging
import re
from typing import Dict, Any
from urllib.parse import urlencode

from core.action_registry import register_action
from core.exceptions import ValidationError
from services.sms_service import sms_service
from core.template_manager import get_template_manager
from services.dbf_data_service import get_dbf_data_service
from core.constants_v2 import COLONNE

logger = logging.getLogger(__name__)

def _enrich_context_with_patient_data(context: Dict[str, Any]) -> Dict[str, Any]:
    """Arricchisce il contesto con i dati del paziente, incluso il telefono."""
    dbf_data_service = get_dbf_data_service()
    enriched_context = context.copy()

    patient_id_key = COLONNE.get('appuntamenti', {}).get('id_paziente', 'DB_APPACOD')
    patient_id = enriched_context.get(patient_id_key)

    if patient_id:
        logger.info(f"Arricchimento: ID paziente '{patient_id}' trovato. Recupero dati dal DB.")
        patient_data = dbf_data_service.get_patient_by_id(patient_id)
        if not patient_data:
            raise ValidationError(f"Dati paziente non trovati per ID '{patient_id}'.")
        enriched_context.update(patient_data)
    else:
        logger.info("Arricchimento: ID paziente non trovato. Tentativo di estrazione da altri campi.")

    # Assicura che 'telefono' e 'nome_completo' siano presenti
    if 'telefono' not in enriched_context:
        phone_key = COLONNE.get('pazienti', {}).get('cellulare', 'DB_CELL')
        extracted_phone = enriched_context.get(phone_key)
        if extracted_phone:
            enriched_context['telefono'] = extracted_phone
        else:
            # Fallback: cerca un numero di 10 cifre nelle note se presenti
            note_key = COLONNE.get('appuntamenti', {}).get('note', 'DB_NOTE')
            note_content = enriched_context.get(note_key, '')
            phone_match = re.search(r'\d{10}', note_content)
            if phone_match:
                enriched_context['telefono'] = phone_match.group(0)

    if 'nome_completo' not in enriched_context:
        nome_key = COLONNE.get('pazienti', {}).get('nome', 'DB_NOME')
        cognome_key = COLONNE.get('pazienti', {}).get('cognome', 'DB_COGNOME')
        nome = enriched_context.get(nome_key, '')
        cognome = enriched_context.get(cognome_key, '')
        if nome or cognome:
            enriched_context['nome_completo'] = f"{cognome} {nome}".strip()
        else:
            # Fallback dalla descrizione appuntamento
            desc_key = COLONNE.get('appuntamenti', {}).get('descrizione', 'DB_APDESCR')
            enriched_context['nome_completo'] = enriched_context.get(desc_key, 'Gentile Paziente').strip()

    if not enriched_context.get('telefono'):
        raise ValidationError("Arricchimento fallito: Numero di telefono non trovato nel contesto.")

    logger.info(f"Contesto arricchito: Nome='{enriched_context.get('nome_completo')}', Telefono='{enriched_context.get('telefono')}'")
    return enriched_context


@register_action(
    name='send_sms_link',
    description="Invia un SMS con un link a una pagina specifica.",
    parameters=[
        {'name': 'template_id', 'type': 'number', 'required': True, 'label': 'ID Template SMS'},
        {'name': 'page_slug', 'type': 'string', 'required': False, 'label': 'Slug Pagina Destinazione'},
        {'name': 'url_params', 'type': 'json', 'required': False, 'label': 'Parametri URL (JSON)'}
    ]
)
def impl_send_sms_link(context_data: Dict[str, Any], **params):
    """Implementazione REALE per inviare un SMS con link."""
    logger.info("[AZIONE REALE] Esecuzione send_sms_link...")
    
    # 1. Arricchisci il contesto per ottenere i dati del paziente
    full_context = _enrich_context_with_patient_data(context_data)
    full_context.update(params)

    # 2. Estrai i dati necessari
    phone = full_context.get('telefono')
    template_id = full_context.get('template_id')
    page_slug = full_context.get('page_slug', 'informazioni')
    url_params = full_context.get('url_params', {})
    nome = full_context.get('nome_completo', 'Gentile Paziente')

    if not template_id:
        raise ValidationError("Il parametro 'template_id' è obbligatorio.")

    # 3. Costruisci l'URL finale
    rendered_params = {k: str(v).format(**full_context) for k, v in url_params.items()}
    base_url = f'https://studiodimartino.eu/{page_slug.lstrip("/")}'
    query = urlencode(rendered_params) if rendered_params else ''
    final_url = f"{base_url}?{query}" if query else base_url

    # 4. Renderizza il messaggio del template
    template_manager = get_template_manager()
    template_data = {'url': final_url, **full_context}
    
    try:
        message = template_manager.render_template_by_id(template_id, template_data)
    except Exception as e:
        logger.error(f"Errore rendering template ID {template_id}: {e}. Uso messaggio di fallback.")
        message = f"Ciao {nome}, ecco le informazioni richieste: {final_url}"

    # 5. Invia l'SMS
    logger.info(f"Invio SMS a {phone} con messaggio: '{message[:50]}...'")
    result = sms_service.send_sms(phone, message, tag='auto_link')
    
    return {**result, 'final_url': final_url}

@register_action(
    name='send_appointment_sms',
    description="Invia un SMS di promemoria per un appuntamento.",
    parameters=[
        {'name': 'template_id', 'type': 'number', 'required': True, 'label': 'ID Template SMS'}
    ]
)
def impl_send_appointment_sms(context_data: Dict[str, Any], **params):
    """Implementazione REALE per inviare un SMS di appuntamento."""
    logger.info("[AZIONE REALE] Esecuzione send_appointment_sms...")

    # 1. Arricchisci il contesto
    full_context = _enrich_context_with_patient_data(context_data)
    full_context.update(params)

    # 2. Estrai dati
    phone = full_context.get('telefono')
    template_id = full_context.get('template_id')
    nome = full_context.get('nome_completo', 'Gentile Paziente')

    if not template_id:
        raise ValidationError("Il parametro 'template_id' è obbligatorio.")

    # 3. Renderizza il template
    template_manager = get_template_manager()
    try:
        message = template_manager.render_template_by_id(template_id, full_context)
    except Exception as e:
        logger.error(f"Errore rendering template ID {template_id}: {e}. Uso messaggio di fallback.")
        data_app = full_context.get(COLONNE.get('appuntamenti', {}).get('data', 'DB_APDATA'), 'N/D')
        ora_app = full_context.get(COLONNE.get('appuntamenti', {}).get('ora_inizio', 'DB_APOREIN'), 'N/D')
        message = f"Ciao {nome}, ti confermiamo il tuo appuntamento per il giorno {data_app} alle ore {ora_app}."

    # 4. Invia SMS
    logger.info(f"Invio SMS appuntamento a {phone} con messaggio: '{message[:50]}...'")
    result = sms_service.send_sms(phone, message, sender='StudioDima', tag='appuntamento_auto')
    
    return {**result, 'phone_sent': phone}

@register_action(
    name='log_prestazione_eseguita',
    description="Registra un messaggio di log quando una prestazione viene eseguita.",
    parameters=[
        {'name': 'message', 'type': 'string', 'required': True, 'label': 'Messaggio di Log'}
    ]
)
def impl_log_prestazione_eseguita(context_data: Dict[str, Any], **params):
    """Implementazione per loggare l'esecuzione di una prestazione."""
    message = params.get('message', 'Nessun messaggio specificato.')
    log_message = f"[LOG AZIONE] {message} | Contesto: {context_data}"
    logger.info(log_message)
    return {'status': 'success', 'message': 'Log registrato.'}

