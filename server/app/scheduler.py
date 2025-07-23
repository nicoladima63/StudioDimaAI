import time
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from server.app.core.automation_config import get_automation_settings
from server.app.core.db_calendar import get_tomorrow_appointments_for_reminder
from server.app.services.recalls_service import RecallService
from server.app.services.calendar_service import CalendarService
import json

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()

_current_job = None
_current_recall_job = None
_current_calendar_sync_job = None


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


def schedule_calendar_sync_job():
    """Schedula il job di sincronizzazione automatica del calendario"""
    global _current_calendar_sync_job
    settings = get_automation_settings()
    hour = int(settings.get("calendar_sync_hour", 21))
    minute = int(settings.get("calendar_sync_minute", 0))
    enabled = settings.get("calendar_sync_enabled", True)
    
    # Rimuovi job precedente se esiste
    if _current_calendar_sync_job:
        try:
            scheduler.remove_job(_current_calendar_sync_job.id)
        except Exception:
            pass
        _current_calendar_sync_job = None

    if not enabled:
        logger.info("Automazione sincronizzazione calendario disattivata.")
        return

    def job():
        """Job di sincronizzazione automatica calendario"""
        now = datetime.now()
        
        # Controlla se è weekend (sabato=5, domenica=6)
        if now.weekday() >= 5:
            logger.info(f"[CALENDAR SYNC] Saltato: è weekend ({now.strftime('%A')})")
            return
            
        logger.info(f"[CALENDAR SYNC] Avvio sincronizzazione automatica alle {now.strftime('%H:%M')}")
        
        # Ottieni ID calendari dalla configurazione
        studio_blu_calendar = settings.get("calendar_studio_blu_id")
        studio_giallo_calendar = settings.get("calendar_studio_giallo_id")
        
        if not studio_blu_calendar or not studio_giallo_calendar:
            logger.error("[CALENDAR SYNC] ID calendari non configurati in automation_settings.json")
            return
            
        # Sincronizza mese corrente e prossimo mese
        current_month = now.month
        current_year = now.year
        next_month = current_month + 1 if current_month < 12 else 1
        next_year = current_year if current_month < 12 else current_year + 1
        
        months_to_sync = [
            (current_month, current_year),
            (next_month, next_year)
        ]
        
        total_synced = 0
        total_errors = 0
        
        for month, year in months_to_sync:
            logger.info(f"[CALENDAR SYNC] Sincronizzazione {month:02d}/{year}")
            
            # Ottieni tutti gli appuntamenti del mese
            all_appointments = CalendarService.get_db_appointments_for_month(month, year)
            
            # Sincronizza Studio Blu (studio_id=1)
            try:
                logger.info(f"[CALENDAR SYNC] Studio Blu -> {studio_blu_calendar}")
                # Filtra appuntamenti per Studio Blu
                studio_blu_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == 1]
                logger.info(f"[CALENDAR SYNC] Studio Blu: {len(studio_blu_appointments)} appuntamenti da sincronizzare")
                
                result_blu = CalendarService.sync_appointments_for_month(
                    month, year, 
                    {1: studio_blu_calendar},  # Studio 1 -> Calendario Blu
                    studio_blu_appointments
                )
                total_synced += result_blu.get('success', 0)
                logger.info(f"[CALENDAR SYNC] Studio Blu: {result_blu.get('message', 'Completato')}")
            except Exception as e:
                logger.error(f"[CALENDAR SYNC] Errore Studio Blu {month:02d}/{year}: {e}")
                total_errors += 1
                
            # Sincronizza Studio Giallo (studio_id=2)  
            try:
                logger.info(f"[CALENDAR SYNC] Studio Giallo -> {studio_giallo_calendar}")
                # Filtra appuntamenti per Studio Giallo
                studio_giallo_appointments = [app for app in all_appointments if int(app.get('STUDIO', 0)) == 2]
                logger.info(f"[CALENDAR SYNC] Studio Giallo: {len(studio_giallo_appointments)} appuntamenti da sincronizzare")
                
                result_giallo = CalendarService.sync_appointments_for_month(
                    month, year,
                    {2: studio_giallo_calendar},  # Studio 2 -> Calendario Giallo
                    studio_giallo_appointments
                )
                total_synced += result_giallo.get('success', 0)
                logger.info(f"[CALENDAR SYNC] Studio Giallo: {result_giallo.get('message', 'Completato')}")
            except Exception as e:
                logger.error(f"[CALENDAR SYNC] Errore Studio Giallo {month:02d}/{year}: {e}")
                total_errors += 1
                
        # Log finale
        log_entry = {
            'timestamp': now.strftime('%Y-%m-%dT%H:%M:%S'),
            'total_synced': total_synced,
            'total_errors': total_errors,
            'months_processed': len(months_to_sync)
        }
        
        try:
            with open('automation_calendar_sync.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
        except Exception as e:
            logger.error(f"[CALENDAR SYNC] Errore scrittura log: {e}")
            
        logger.info(f"[CALENDAR SYNC] Completato: {total_synced} sincronizzati, {total_errors} errori")

    # Programma il job
    trigger = CronTrigger(hour=hour, minute=minute)
    _current_calendar_sync_job = scheduler.add_job(job, trigger, id="calendar_sync_job", replace_existing=True)
    logger.info(f"Automazione sincronizzazione calendario schedulata alle {hour}:{minute:02d}.")

# Avvia lo scheduler e programma i job all'avvio
scheduler.start()
schedule_reminder_job()
schedule_recall_job()
schedule_calendar_sync_job()

# Funzione da chiamare ogni volta che la config richiami cambia
# (es: dopo una POST/PUT alle API di settings richiami)
def reschedule_recall_job():
    schedule_recall_job()

# Funzione da chiamare ogni volta che la config cambia
# (es: dopo una POST/PUT alle API di settings)
def reschedule_reminder_job():
    schedule_reminder_job()

# Funzione da chiamare ogni volta che la config calendario sync cambia
def reschedule_calendar_sync_job():
    schedule_calendar_sync_job() 