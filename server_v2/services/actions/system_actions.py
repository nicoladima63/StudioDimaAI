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
import time
from typing import Dict, Any, Optional
from urllib.parse import urlencode

from core.action_registry import register_action
from core.exceptions import ValidationError
from services.sms_service import sms_service
from core.template_manager import get_template_manager
from services.dbf_data_service import get_dbf_data_service
from services.link_tracker_service import link_tracker_service # 1. Importa il servizio di tracking
from core.constants_v2 import COLONNE

logger = logging.getLogger(__name__)

# Evita log ripetuti per lo stesso paziente senza telefono (monitor ogni 30s)
_SKIP_WARN_CACHE: dict[str, float] = {}
_SKIP_WARN_TTL_SEC = 6 * 3600


def _log_skip_no_phone_once(nome: str):
    key = (nome or '?').strip().lower()
    now = time.time()
    if key in _SKIP_WARN_CACHE and now - _SKIP_WARN_CACHE[key] < _SKIP_WARN_TTL_SEC:
        return
    _SKIP_WARN_CACHE[key] = now
    logger.warning(
        f"Nuovo paziente '{nome}' senza telefono in DB_NOTE: azione saltata."
    )


def _phone_from_patient_record(patient_data: Dict[str, Any]) -> Optional[str]:
    mobile_key = COLONNE.get('pazienti', {}).get('cellulare', 'DB_PACELLU')
    tel_key = COLONNE.get('pazienti', {}).get('telefono', 'DB_PATELEF')
    for key in (mobile_key, tel_key, 'DB_PACELLU', 'DB_PATELEF'):
        val = str(patient_data.get(key, '')).strip()
        if val:
            return val
    return None


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

    # Caso 2a: Contesto da preventivi - risali tramite ELENCO (piano di cura) al paziente
    if not patient_id:
        piano_key = COLONNE.get('preventivi', {}).get('id_piano')  # DB_PRELCOD
        if piano_key and piano_key in enriched_context:
            piano_id = enriched_context[piano_key]
            if piano_id and str(piano_id).strip():
                patient_id = dbf_data_service.get_patient_id_from_piano(str(piano_id).strip())
                if patient_id:
                    logger.info(f"Paziente {patient_id} trovato tramite piano di cura {piano_id}")

    # Caso 2b: ID paziente vuoto (nuovo paziente) - cerca nome in DB_APDESCR e telefono in DB_NOTE
    if not patient_id:
        # Estrai nome da DB_APDESCR
        desc_key = COLONNE.get('appuntamenti', {}).get('descrizione', 'DB_APDESCR')
        if desc_key in enriched_context and enriched_context[desc_key]:
            enriched_context['nome_completo'] = str(enriched_context[desc_key]).strip()
        else:
            enriched_context['nome_completo'] = 'Gentile Paziente'

        # Scansiona tutte le righe di DB_NOTE alla ricerca del numero di telefono
        note_key = COLONNE.get('appuntamenti', {}).get('note', 'DB_NOTE')
        phone_pattern = re.compile(r'(?:\+39)?[\s-]?3\d[\d\s-]{7,9}')
        if note_key in enriched_context and enriched_context[note_key]:
            notes_content = str(enriched_context[note_key]).strip()
            for line in notes_content.splitlines():
                phone_match = phone_pattern.search(line.strip())
                if phone_match:
                    enriched_context['telefono'] = phone_match.group(0).strip()
                    break

        # Fallback: cerca il paziente in PAZIENTI.DBF per nome (es. già anagrafato)
        if ('telefono' not in enriched_context or not enriched_context['telefono']) and enriched_context.get('nome_completo'):
            paz = dbf_data_service.get_patient_by_name(enriched_context['nome_completo'])
            if paz:
                phone = _phone_from_patient_record(paz)
                if phone:
                    enriched_context['telefono'] = phone
                    pid_key = COLONNE.get('pazienti', {}).get('id', 'DB_CODE')
                    if paz.get(pid_key):
                        enriched_context[pid_key] = str(paz[pid_key]).strip()
                    return enriched_context

        # Nessun telefono trovato: skip senza errore (log al massimo una volta ogni 6h)
        if 'telefono' not in enriched_context or not enriched_context['telefono']:
            _log_skip_no_phone_once(enriched_context.get('nome_completo', '?'))
            return None

        return enriched_context

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
    # 1. Arricchisci il contesto per ottenere i dati del paziente
    full_context = _enrich_context_with_patient_data(context_data)
    if full_context is None:
        return {'status': 'skipped', 'message': 'Telefono non trovato, SMS non inviato.'}
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
    # 1. Arricchisci il contesto
    full_context = _enrich_context_with_patient_data(context_data)
    if full_context is None:
        return {'status': 'skipped', 'message': 'Telefono non trovato, SMS non inviato.'}
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

    # Se viene da PREVENTIVI, risali tramite ELENCO (piano di cura) al paziente
    if not patient_id and 'DB_PRELCOD' in context_data and context_data['DB_PRELCOD']:
        piano_id = str(context_data['DB_PRELCOD']).strip()
        if piano_id:
            patient_id = get_dbf_data_service().get_patient_id_from_piano(piano_id)
            if patient_id:
                logger.info(f"Paziente {patient_id} trovato tramite piano di cura {piano_id}")
            else:
                logger.warning(f"Nessun paziente trovato per piano di cura {piano_id}")

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


from services.richiami_service import RichiamiService
from datetime import datetime as _datetime

@register_action(
    name='mark_richiamo_ok',
    description="Marca il paziente come richiamato quando viene registrata la prestazione RIOK.",
    parameters=[]
)
def impl_mark_richiamo_ok(context_data: Dict[str, Any], **params):
    """
    Scatta quando DB_PRLAVOR == 'riok' transisce a DB_GUARDIA == 3.
    Aggiorna la tabella richiami di studio_dima.db impostando da_richiamare='R'.
    """
    # Filtra: agisce solo sulla prestazione RIOK
    lavor = str(context_data.get('DB_PRLAVOR', '')).strip().lower()
    if lavor != 'riok':
        return {'status': 'skipped', 'message': f'Prestazione ignorata (DB_PRLAVOR={lavor})'}

    # Recupera patient_id — stesso pattern di create_task_from_work
    patient_id = None

    if 'id_paziente' in context_data and context_data['id_paziente']:
        patient_id = str(context_data['id_paziente']).strip()
    else:
        for table, cols in COLONNE.items():
            k = cols.get('id_paziente')
            if k and k in context_data and str(context_data[k]).strip():
                patient_id = str(context_data[k]).strip()
                break

    if not patient_id and context_data.get('DB_PRELCOD'):
        piano_id = str(context_data['DB_PRELCOD']).strip()
        if piano_id:
            patient_id = get_dbf_data_service().get_patient_id_from_piano(piano_id)

    if not patient_id:
        raise ValidationError(
            f"mark_richiamo_ok: impossibile determinare patient_id. "
            f"Context keys: {list(context_data.keys())}"
        )

    # Data prestazione (DB_PRDATA) o oggi come fallback
    raw_date = context_data.get('DB_PRDATA')
    try:
        if raw_date:
            data_richiamo = str(raw_date)[:10]
        else:
            data_richiamo = _datetime.now().strftime('%Y-%m-%d')
    except Exception:
        data_richiamo = _datetime.now().strftime('%Y-%m-%d')

    # Aggiorna (o crea) il record in richiami
    service = RichiamiService()
    result = service.update_richiamo_status(patient_id, 'R', data_richiamo)

    if result.get('success'):
        logger.info(f"mark_richiamo_ok: paziente {patient_id} segnato come richiamato il {data_richiamo}")
        return {'status': 'success', 'patient_id': patient_id, 'data_richiamo': data_richiamo}
    else:
        raise ValidationError(f"mark_richiamo_ok: errore aggiornamento richiami — {result.get('error')}")
