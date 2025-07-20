import time
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from server.app.core.automation_config import get_automation_settings
from server.app.core.db_calendar import get_tomorrow_appointments_for_reminder
from server.app.services.recalls_service import RecallService
import json

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()

_current_job = None
_current_recall_job = None


def schedule_reminder_job():
    global _current_job
    settings = get_automation_settings()
    hour = int(settings.get("reminder_hour", 15))
    enabled = settings.get("reminder_enabled", True)

    # Rimuovi job precedente se esiste
    if _current_job:
        try:
            scheduler.remove_job(_current_job.id)
        except Exception:
            pass
        _current_job = None

    if not enabled:
        logger.info("Automazione promemoria appuntamenti disattivata.")
        return

    def job():
        logger.info(f"[AUTOMAZIONE] Invio promemoria appuntamenti: ora={hour}")
        log = get_tomorrow_appointments_for_reminder()
        for line in log:
            logger.info(f"[PROMEMORIA] {line}")

    minute = int(settings.get("reminder_minute", 0))
    trigger = CronTrigger(hour=hour, minute=minute)
    _current_job = scheduler.add_job(job, trigger, id="reminder_job", replace_existing=True)
    logger.info(f"Automazione promemoria appuntamenti schedulata alle {hour}:00.")


def schedule_recall_job():
    global _current_recall_job
    settings = get_automation_settings()
    hour = int(settings.get("recall_hour", 16))
    minute = int(settings.get("recall_minute", 0))
    enabled = settings.get("recall_enabled", True)

    # Rimuovi job precedente se esiste
    if _current_recall_job:
        try:
            scheduler.remove_job(_current_recall_job.id)
        except Exception:
            pass
        _current_recall_job = None

    if not enabled:
        logger.info("Automazione richiami disattivata.")
        return

    def job():
        logger.info(f"[AUTOMAZIONE] Invio richiami: ora={hour}:{minute:02d}")
        recall_service = RecallService()
        recalls = recall_service.get_all_recalls()
        sent = 0
        errors = []
        for recall in recalls:
            # Qui puoi filtrare solo quelli da inviare oggi, se serve
            try:
                from server.app.services.sms_service import sms_service
                mode = settings.get('sms_richiami_mode', 'prod')
                sms_service.mode = mode
                sms_service.params = sms_service.get_env_params('sms', mode)
                sms_service._setup_client()
                result = sms_service.send_recall_sms(recall)
                if result.get('success'):
                    sent += 1
                else:
                    errors.append({
                        'paziente': recall.get('nome_completo', ''),
                        'numero': recall.get('telefono', ''),
                        'errore': result.get('error', 'Errore invio')
                    })
            except Exception as e:
                errors.append({
                    'paziente': recall.get('nome_completo', ''),
                    'numero': recall.get('telefono', ''),
                    'errore': str(e)
                })
        log_entry = {
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'sent': sent,
            'errors': errors
        }
        try:
            with open('automation_recall.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
        except Exception as e:
            logger.error(f"Errore scrittura log richiami: {e}")
        logger.info(f"[RICHIMI] Inviati: {sent}, Errori: {len(errors)}")

    trigger = CronTrigger(hour=hour, minute=minute)
    _current_recall_job = scheduler.add_job(job, trigger, id="recall_job", replace_existing=True)
    logger.info(f"Automazione richiami schedulata alle {hour}:{minute:02d}.")

# Avvia lo scheduler e programma i job all'avvio
scheduler.start()
schedule_reminder_job()
schedule_recall_job()

# Funzione da chiamare ogni volta che la config richiami cambia
# (es: dopo una POST/PUT alle API di settings richiami)
def reschedule_recall_job():
    schedule_recall_job()

# Funzione da chiamare ogni volta che la config cambia
# (es: dopo una POST/PUT alle API di settings)
def reschedule_reminder_job():
    schedule_reminder_job() 