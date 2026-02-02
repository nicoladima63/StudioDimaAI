"""
📦 Implementazioni delle Azioni di Sistema
==========================================

Questo modulo contiene le implementazioni concrete per le azioni di automazione di base del sistema.
Ogni azione è decorata con `@register_action` per essere automaticamente disponibile nel motore di automazione.

Author: Gemini Code Architect
Version: 1.2.0
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
from services.link_tracker_service import link_tracker_service # 1. Importa il servizio di tracking
from core.constants_v2 import COLONNE

logger = logging.getLogger(__name__)

def _enrich_context_with_patient_data(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Arricchisce il contesto con i dati del paziente in modo dinamico.
    Se 'telefono' è già presente, lo usa. Altrimenti, cerca un ID paziente
    attraverso tutte le tabelle definite in COLONNE. Gestisce anche il caso
    di nuovi pazienti dove l'ID è vuoto ma nome e telefono sono in DB_APDESCR e DB_NOTE.
    """
    enriched_context = context.copy()

    # Caso 1: Telefono già presente nel contesto (prioritario)
    if 'telefono' in enriched_context and enriched_context['telefono']:
        if 'nome_completo' not in enriched_context:
            enriched_context['nome_completo'] = enriched_context.get('nome', 'Gentile Paziente')
        return enriched_context

    dbf_data_service = get_dbf_data_service()
    patient_id = None

    # Cerca dinamicamente la chiave dell'ID paziente nel contesto
    for table, columns in COLONNE.items():
        id_key = columns.get('id_paziente')
        if id_key and id_key in enriched_context:
            patient_id = enriched_context[id_key]
            # FIX: Considera vuoto anche se contiene solo spazi (pazienti nuovi hanno DB_APPACOD = "      ")
            if patient_id and str(patient_id).strip():
                break
            else:
                patient_id = None  # Reset se era solo spazi

    # Caso 2: ID paziente vuoto (nuovo paziente) - cerca nome in DB_APDESCR e telefono in DB_NOTE
    if not patient_id:
        # Estrai nome da DB_APDESCR
        desc_key = COLONNE.get('appuntamenti', {}).get('descrizione', 'DB_APDESCR')
        if desc_key in enriched_context and enriched_context[desc_key]:
            enriched_context['nome_completo'] = str(enriched_context[desc_key]).strip()
        else:
            enriched_context['nome_completo'] = 'Gentile Paziente'

        # Estrai telefono dalla prima riga di DB_NOTE
        note_key = COLONNE.get('appuntamenti', {}).get('note', 'DB_NOTE')
        if note_key in enriched_context and enriched_context[note_key]:
            notes_content = str(enriched_context[note_key]).strip()
            first_line = notes_content.split('\n')[0].strip()
            # FIX REGEX: Matcha numeri italiani (10 cifre) con o senza prefisso +39
            # Supporta formati: 3755445058, +393755445058, 375 544 5058, 375-544-5058
            phone_match = re.search(r'(?:\+39)?[\s-]?3\d[\d\s-]{7,9}', first_line)
            if phone_match:
                enriched_context['telefono'] = phone_match.group(0).strip()
        
        # Se dopo questi tentativi non abbiamo un telefono, solleva errore
        if 'telefono' not in enriched_context or not enriched_context['telefono']:
            raise ValidationError("Arricchimento fallito: Impossibile determinare un numero di telefono valido per il nuovo paziente.")
        
        return enriched_context # Abbiamo nome e telefono, possiamo procedere

    # Caso 3: ID paziente trovato - recupera dati dal DB
    patient_data = dbf_data_service.get_patient_by_id(patient_id)
    if not patient_data:
        raise ValidationError(f"Dati paziente non trovati per ID '{patient_id}'.")
    
    enriched_context.update(patient_data)

    mobile_key = COLONNE.get('pazienti', {}).get('cellulare', 'DB_PACELLU')
    mobile_phone = enriched_context.get(mobile_key)

    if mobile_phone and str(mobile_phone).strip():
        enriched_context['telefono'] = str(mobile_phone).strip()
    else:
        raise ValidationError(f"Arricchimento fallito: Numero di cellulare (DB_PACELLU) non trovato per il paziente ID '{patient_id}'.")

    if 'nome_completo' not in enriched_context:
        nome_key = COLONNE.get('pazienti', {}).get('nome', 'DB_PANOME')
        nome = enriched_context.get(nome_key, '')
        if nome:
            enriched_context['nome_completo'] = nome.strip()
        else:
            desc_key = COLONNE.get('appuntamenti', {}).get('descrizione', 'DB_APDESCR')
            enriched_context['nome_completo'] = enriched_context.get(desc_key, 'Gentile Paziente').strip()

    return enriched_context


@register_action(
    name='send_sms_link',
    description="Invia un SMS con un link a una pagina specifica.",
    parameters=[
        {'name': 'template_id', 'type': 'number', 'required': True, 'label': 'ID Template SMS'},
        {'name': 'page_slug', 'type': 'string', 'required': False, 'label': 'Slug Pagina Destinazione'},
        {'name': 'url_params', 'type': 'json', 'required': False, 'label': 'Parametri URL (JSON)'},
        {'name': 'tempo_richiamo', 'type': 'string', 'required': False, 'label': 'Tempo richiamo (es. 6 mesi)'}
    ]
)
def impl_send_sms_link(context_data: Dict[str, Any], **params):
    """Implementazione REALE per inviare un SMS con link."""
    #logger.debug(f"[AZIONE REALE] Esecuzione send_sms_link... Dati grezzi ricevuti: {context_data}")
    
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
    base_url = f'https://studiodimartino.eu/#/{page_slug.lstrip("/")}'
    query = urlencode(rendered_params) if rendered_params else ''
    original_url = f"{base_url}?{query}" if query else base_url

    # 2. Crea il link tracciato invece del link diretto (FUNZIONALITÀ DISATTIVATA)
    # tracked_link = link_tracker_service.create_tracked_link(
    #     original_url=original_url,
    #     context_data={'trigger_context': context_data, 'action_params': params}
    # )
    tracked_link = original_url # Segnaposto per riattivazione

    # 4. Renderizza il messaggio del template (senza fallback: se fallisce, segnala errore)
    template_manager = get_template_manager()
    template_data = {'url': original_url, **full_context} # Usa original_url
    message = template_manager.render_template_by_id(template_id, template_data)

    # 5. Invia l'SMS
    logger.info(f"Invio SMS a {phone} con messaggio: '{message[:50]}...'")
    result = sms_service.send_sms(phone, message, tag='auto_link')
    
    return {**result, 'final_url': original_url, 'original_url': original_url} # Usa original_url

@register_action(
    name='send_appointment_sms',
    description="Invia un SMS di promemoria per un appuntamento.",
    parameters=[
        {'name': 'template_id', 'type': 'number', 'required': True, 'label': 'ID Template SMS'},
        {'name': 'tempo_richiamo', 'type': 'string', 'required': False, 'label': 'Tempo richiamo (es. 6 mesi)'}
    ]
)
def impl_send_appointment_sms(context_data: Dict[str, Any], **params):
    """Implementazione REALE per inviare un SMS di appuntamento."""
    #logger.debug("[AZIONE REALE] Esecuzione send_appointment_sms...")

    # 1. Arricchisci il contesto
    full_context = _enrich_context_with_patient_data(context_data)
    full_context.update(params)

    # 2. Estrai dati
    phone = full_context.get('telefono')
    template_id = full_context.get('template_id')
    nome = full_context.get('nome_completo', 'Gentile Paziente')

    if not template_id:
        raise ValidationError("Il parametro 'template_id' è obbligatorio.")

    # 3. Renderizza il template (senza fallback: se fallisce, segnala errore)
    template_manager = get_template_manager()
    message = template_manager.render_template_by_id(template_id, full_context)

    # 4. Invia SMS
    logger.info(f"Invio SMS appuntamento a {phone} con messaggio: '{message[:50]}...'")
    result = sms_service.send_sms(phone, message, tag='appuntamento_auto')
    
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


from core.database_manager import get_database_manager
from services.work_service import WorkService
from repositories.prestazione_work_mapping_repository import PrestazioneWorkMappingRepository

@register_action(
    name='create_task_from_work',
    description="Crea un Task da un Work Template quando scatta un evento.",
    parameters=[
        {'name': 'work_id', 'type': 'number', 'required': False, 'label': 'ID Work Template (opzionale se mappato)'},
        {'name': 'description', 'type': 'string', 'required': False, 'label': 'Descrizione Task (opzionale)'}
    ]
)
def impl_create_task_from_work(context_data: Dict[str, Any], **params):
    """Implementazione per creare un Task da un Work."""
    logger.info(f"[AZIONE] Creazione Task da Work richiesta. Params: {params}")

    # 1. Ottieni work_id (da parametri o da mapping automatico)
    work_id = params.get('work_id')

    # Se work_id non è nei parametri, cerca nel mapping automatico usando il trigger_id
    if not work_id:
        # Il trigger_id dovrebbe essere il codice prestazione (es. ZZZZDJ)
        # Cerchiamo nel context se c'è DB_PRCODICE o deduciamo dal trigger
        codice_prestazione = context_data.get('trigger_id') or context_data.get('DB_PRCODICE')

        if codice_prestazione:
            try:
                db_manager = get_database_manager()
                mapping_repo = PrestazioneWorkMappingRepository(db_manager)
                work_id = mapping_repo.get_work_id_by_prestazione(codice_prestazione)

                if work_id:
                    logger.info(f"work_id={work_id} trovato tramite mapping per prestazione {codice_prestazione}")
                else:
                    logger.warning(f"Nessun mapping trovato per prestazione {codice_prestazione}")
            except Exception as e:
                logger.error(f"Errore ricerca mapping: {e}")

    if not work_id:
        raise ValidationError("Parametro 'work_id' mancante e nessun mapping automatico trovato per questa prestazione.")
    
    try:
        work_id = int(work_id)
    except (ValueError, TypeError):
        raise ValidationError(f"Parametro 'work_id' non valido: {work_id}")

    # 2. Ottieni ID Paziente dal contesto
    # NON usiamo _enrich_context_with_patient_data perché richiede telefono (per SMS)
    # Per i task serve solo il patient_id che è già nel context_data
    patient_id = None

    # Cerca ID paziente nel context_data (già arricchito dal monitor)
    # Prova prima 'id_paziente' (aggiunto dal monitor con enrichment)
    if 'id_paziente' in context_data and context_data['id_paziente']:
        patient_id = context_data['id_paziente']
        logger.debug(f"Trovato id_paziente nel contesto: {patient_id}")
    else:
        # Fallback: cerca nelle colonne standard
        for table, cols in COLONNE.items():
            k = cols.get('id_paziente')
            if k and k in context_data and context_data[k]:
                patient_id = context_data[k]
                logger.debug(f"Trovato {k} nel contesto: {patient_id}")
                break

    # Se viene da PREVENTIVI, potremmo avere DB_PRELCOD
    if not patient_id and 'DB_PRELCOD' in context_data and context_data['DB_PRELCOD']:
        patient_id = context_data['DB_PRELCOD']
        logger.debug(f"Usato DB_PRELCOD come patient_id: {patient_id}")

    if not patient_id:
        raise ValidationError(f"Impossibile determinare patient_id dal contesto del trigger. Context keys: {list(context_data.keys())}")

    # 3. Ottieni ID Prestazione (Se trigger da Preventivi) e Context Ref
    prestazione_id = context_data.get('DB_PRONCOD') # Codice univoco riga preventivo/prestazione
    
    # 4. Istanzia Service e Crea
    try:
        db_manager = get_database_manager()
        service = WorkService(db_manager)
        
        task = service.create_task_from_work(
            patient_id=str(patient_id),
            work_id=work_id,
            description=params.get('description'),
            prestazione_id=str(prestazione_id) if prestazione_id else None,
            # Passiamo anche il contesto come external ref se utile? No.
        )
        
        return {'status': 'success', 'task_id': task['id'], 'message': f"Creato Task #{task['id']} per Work #{work_id}"}
        
    except Exception as e:
        logger.error(f"Errore creazione Task da Work: {e}", exc_info=True)
        return {'status': 'error', 'message': str(e)}

from services.notification_service import NotificationService

@register_action(
    name='send_system_notification',
    description="Invia una notifica di sistema (visibile nella dashboard). Utile per debug.",
    parameters=[
        {'name': 'message', 'type': 'string', 'required': True, 'label': 'Messaggio Notifica'},
        {'name': 'user_id', 'type': 'number', 'required': False, 'label': 'ID Utente (Default: 1)'}
    ]
)
def impl_send_system_notification(context_data: Dict[str, Any], **params):
    """Crea una notifica nel database."""
    message = params.get('message', 'Trigger attivato!')
    user_id = params.get('user_id', 1) # Default admin
    
    try:
        user_id = int(user_id)
    except:
        user_id = 1
        
    # Usiamo WARNING per essere sicuri che appaia nel terminale anche col default log level
    logger.warning(f"[AZIONE DEBUG] Invio notifica a user {user_id}: {message}")
    
    # Arricchisci messaggio con valori contesto se presenti {chiave}
    try:
        message = message.format(**context_data)
    except:
        pass # Ignora errori format
        
    db_manager = get_database_manager()
    service = NotificationService(db_manager)
    service.notify_user(user_id, message, type='info')
    
    # 3. PUSH to UI Log: Ottieni l'istanza singleton di MonitoringService e aggiungi un log visibile nel Frontend
    try:
        from services.monitoring_service import get_monitoring_service
        from datetime import datetime
        mon_service = get_monitoring_service()
        # Aggiungi manuamente il log alla lista che il frontend polla
        mon_service.logs.append({
            'timestamp': datetime.now().isoformat(),
            'message': f"🔔 NOTIFICA INVIATA: {message}",
            'type': 'success'
        })
    except Exception as e:
        logger.error(f"Impossibile aggiornare UI logs: {e}")
    
    return {'status': 'success', 'message': f'Notifica inviata a user {user_id}'}
