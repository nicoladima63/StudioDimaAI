"""
Motore dei richiami dei todo.

Un todo aperto con scadenza viene ricordato al destinatario in modo sempre piu
insistente: il giorno prima, il giorno stesso e, dopo la scadenza, ad ogni fascia
oraria dello studio finche non viene completato. Il posticipo (massimo
MAX_SNOOZES volte) sposta la scadenza e fa ripartire lo schema.

Tutto deterministico: nessuna AI, nessuna dipendenza dalla rete.
Gli orari vengono da studio_opening_hours: i richiami partono ogni 2 ore a
partire dall'apertura di ogni fascia (es. 9-13 e 15-19 -> 09, 11, 15, 17).
"""

import logging
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import pytz

from repositories.todo_repository import MAX_SNOOZES

logger = logging.getLogger(__name__)

ROME_TZ = pytz.timezone('Europe/Rome')

SLOT_STEP_HOURS = 2
# Dal 2o giorno di ritardo l'admin riceve una copia (e, appena disponibile, parte WhatsApp/SMS)
ESCALATION_MIN_DAYS_OVERDUE = 2
# Dal 3o giorno di ritardo la notifica di sistema resta a schermo finche non viene aperta
PERSISTENT_MIN_DAYS_OVERDUE = 3
# Oltre questi giorni di anticipo non serve nemmeno controllare il todo
LOOKAHEAD_DAYS = 5

KIND_BEFORE = 'before'
KIND_DUE = 'due'
KIND_OVERDUE = 'overdue'


def window_slot_hours(config: Optional[Dict[str, Any]]) -> List[int]:
    """
    Ore di richiamo di un giorno, ogni SLOT_STEP_HOURS dall'apertura di ciascuna fascia,
    ora di chiusura esclusa. Giorno chiuso o configurazione mancante -> nessuna ora.
    """
    if not config or config.get('enabled') != 1:
        return []

    if config.get('continuous_hours') == 1:
        windows = [(config.get('fascia_unica_start'), config.get('fascia_unica_end'))]
    else:
        windows = [
            (config.get('morning_start'), config.get('morning_end')),
            (config.get('afternoon_start'), config.get('afternoon_end')),
        ]

    hours: List[int] = []
    for start, end in windows:
        if not start or not end:
            continue
        try:
            hour, end_hour = int(str(start)[:2]), int(str(end)[:2])
        except ValueError:
            continue
        while hour < end_hour:
            hours.append(hour)
            hour += SLOT_STEP_HOURS
    return hours


def reminder_kind(
    days_to_due: int,
    slot_index: int,
    slot_count: int,
    is_last_open_day_before_due: bool,
) -> Optional[str]:
    """
    Decide se in questa fascia va mandato un richiamo e di che tipo.

    - dopo la scadenza: ad ogni fascia
    - il giorno della scadenza: alla prima fascia e a quella di meta' giornata
    - il giorno prima (ultimo giorno di apertura prima della scadenza): alla prima fascia
    """
    if days_to_due < 0:
        return KIND_OVERDUE
    if days_to_due == 0:
        return KIND_DUE if slot_index in (0, slot_count // 2) else None
    if is_last_open_day_before_due and slot_index == 0:
        return KIND_BEFORE
    return None


def build_message(kind: str, subject: str, days_overdue: int, snoozes_left: int) -> str:
    """Testo del richiamo, sempre piu' netto con il ritardo. Solo ASCII."""
    if kind == KIND_BEFORE:
        text = f"Domani scade: '{subject}'. Ricordati di completarla."
    elif kind == KIND_DUE:
        text = f"Scade oggi: '{subject}'. Completala entro la giornata."
    elif days_overdue >= PERSISTENT_MIN_DAYS_OVERDUE:
        text = f"URGENTE: '{subject}' e' in ritardo di {days_overdue} giorni lavorativi. Va completata."
    else:
        giorni = 'giorno lavorativo' if days_overdue == 1 else 'giorni lavorativi'
        text = f"In ritardo di {days_overdue} {giorni}: '{subject}'. Completala o posticipala."

    if kind != KIND_BEFORE and snoozes_left <= 0:
        text += " Non e' piu' posticipabile."
    return text


def notification_type(kind: str, days_overdue: int) -> str:
    """Tipo di notifica: 'error' (persistente) solo dal PERSISTENT_MIN_DAYS_OVERDUE giorno di ritardo."""
    if kind == KIND_BEFORE:
        return 'info'
    if kind == KIND_OVERDUE and days_overdue >= PERSISTENT_MIN_DAYS_OVERDUE:
        return 'error'
    return 'warning'


def urgency_for(kind: str, days_overdue: int) -> Optional[str]:
    """Livello di urgenza mostrato nelle liste (colori); None = non cambiarlo."""
    if kind == KIND_OVERDUE:
        return 'critical' if days_overdue >= PERSISTENT_MIN_DAYS_OVERDUE else 'urgent'
    if kind == KIND_DUE:
        return 'attention'
    return None


def parse_due_date(value: Any) -> Optional[date]:
    """La scadenza conta solo come giorno: accetta 'YYYY-MM-DD' e datetime ISO."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def parse_timestamp(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:19], '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return None


def send_staff_message(phone: str, text: str) -> Dict[str, Any]:
    """
    Invia un messaggio a un collega: WhatsApp (Evolution) e, se non riesce, SMS (Brevo).
    Entrambi i servizi rispettano la modalita' teorica: in quel caso non esce nulla.
    """
    from services.appointment_reminder_service import send_whatsapp_text

    result = send_whatsapp_text(phone, text)
    if result.get('success'):
        return result

    logger.warning(f"WhatsApp non riuscito ({result.get('error')}): provo con l'SMS")
    from core.environment_manager import environment_manager, ServiceType, Environment
    from services.sms_service import SMSService

    environment_manager.set_environment(ServiceType.SMS, Environment('prod'))
    sms = SMSService().send_sms(phone, text, tag='todo')
    return {
        'success': sms.get('success', False),
        'channel': 'sms',
        'error': None if sms.get('success') else sms.get('message'),
    }


class TodoReminderEngine:
    """Un passaggio del motore per ogni fascia oraria: vedi run()."""

    def __init__(
        self,
        todo_repository,
        notification_service,
        user_repository,
        get_day_config: Callable[[int], Optional[Dict[str, Any]]],
        channel_sender: Optional[Callable[[str, str], Dict[str, Any]]] = None,
    ):
        self.todo_repository = todo_repository
        self.notification_service = notification_service
        self.user_repository = user_repository
        self.get_day_config = get_day_config
        # Invia un testo a un numero (WhatsApp, poi SMS). Senza, resta solo la notifica in app.
        self.channel_sender = channel_sender
        self._slots_cache: Dict[int, List[int]] = {}

    def _slots_for(self, day_of_week: int) -> List[int]:
        """Ore di richiamo di un giorno (1=Lun..7=Dom), lette una sola volta per passaggio."""
        if day_of_week not in self._slots_cache:
            self._slots_cache[day_of_week] = window_slot_hours(self.get_day_config(day_of_week))
        return self._slots_cache[day_of_week]

    def run(self, now: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Manda i richiami dovuti nella fascia oraria corrente.
        Fuori dagli orari dello studio non fa nulla. E' idempotente nella stessa
        fascia: ogni todo riceve al massimo un richiamo per fascia.
        """
        now = (now or datetime.now(ROME_TZ)).replace(tzinfo=None)
        today = now.date()
        self._slots_cache = {}

        slots = self._slots_for(now.isoweekday())
        if now.hour not in slots:
            return {'success': True, 'skipped': 'fuori dagli orari dello studio', 'sent': 0}

        slot_index = slots.index(now.hour)
        slot_start = now.replace(minute=0, second=0, microsecond=0)

        stats = {'success': True, 'examined': 0, 'sent': 0, 'already_sent': 0,
                 'recipient_missing': 0, 'escalated': 0, 'channel_sent': 0, 'channel_failed': 0}
        admins: Optional[List[Dict[str, Any]]] = None

        for todo in self.todo_repository.get_open_with_due_date():
            try:
                due = parse_due_date(todo.get('due_date'))
                if due is None:
                    continue
                days_to_due = (due - today).days
                if days_to_due > LOOKAHEAD_DAYS:
                    continue
                stats['examined'] += 1

                kind = reminder_kind(
                    days_to_due, slot_index, len(slots),
                    self._is_last_open_day_before_due(today, due),
                )
                if kind is None:
                    continue

                last = parse_timestamp(todo.get('last_reminder_at'))
                if last is not None and last >= slot_start:
                    stats['already_sent'] += 1
                    continue

                recipient = self.user_repository.find_by_id(int(todo['recipient_id']))
                if not recipient:
                    stats['recipient_missing'] += 1
                    continue

                days_overdue = self._open_days_overdue(due, today)
                snoozes_left = MAX_SNOOZES - int(todo.get('snooze_count') or 0)
                subject = todo.get('subject') or 'Todo'

                self.notification_service.notify_user(
                    user_id=int(todo['recipient_id']),
                    message=build_message(kind, subject, days_overdue, snoozes_left),
                    type=notification_type(kind, days_overdue),
                    link=f"/todos?open={todo['id']}",
                )

                new_urgency = urgency_for(kind, days_overdue)
                if new_urgency and new_urgency != todo.get('urgency_level'):
                    self.todo_repository.update_urgency_level(todo['id'], new_urgency)

                self.todo_repository.record_reminder(todo['id'], now.strftime('%Y-%m-%d %H:%M:%S'))
                stats['sent'] += 1

                if kind == KIND_OVERDUE and days_overdue >= ESCALATION_MIN_DAYS_OVERDUE and slot_index == 0:
                    if admins is None:
                        admins = [u for u in self.user_repository.get_all() if u.get('role') == 'admin']
                    stats['escalated'] += self._copy_to_admins(admins, recipient, todo, days_overdue)

                    delivered = self._send_to_channels(recipient, todo, days_overdue)
                    if delivered is True:
                        stats['channel_sent'] += 1
                    elif delivered is False:
                        stats['channel_failed'] += 1

            except Exception as e:
                logger.error(f"Richiamo todo {todo.get('id')} fallito: {e}")

        return stats

    def _copy_to_admins(
        self,
        admins: List[Dict[str, Any]],
        recipient: Dict[str, Any],
        todo: Dict[str, Any],
        days_overdue: int,
    ) -> int:
        """Per conoscenza agli admin (una volta al giorno), tranne se l'admin e' il destinatario."""
        sent = 0
        for admin in admins:
            if admin.get('id') == recipient.get('id'):
                continue
            self.notification_service.notify_user(
                user_id=int(admin['id']),
                message=(
                    f"Per conoscenza: '{todo.get('subject') or 'Todo'}' di "
                    f"{recipient.get('username', 'utente')} e' in ritardo di {days_overdue} giorni lavorativi."
                ),
                type='warning',
                link=f"/todos?open={todo['id']}",
            )
            sent += 1
        return sent

    def _send_to_channels(
        self,
        recipient: Dict[str, Any],
        todo: Dict[str, Any],
        days_overdue: int,
    ) -> Optional[bool]:
        """
        WhatsApp (poi SMS) al destinatario, una volta al giorno dal 2o giorno di ritardo.
        None = canale non disponibile (nessun mittente o nessun numero), True/False = esito.
        """
        phone = (recipient.get('phone') or '').strip()
        if not self.channel_sender or not phone:
            return None

        subject = (todo.get('subject') or 'Todo')[:60]
        text = (
            f"Studio Dima: il todo '{subject}' e' in ritardo di {days_overdue} giorni lavorativi. "
            "Completalo nel gestionale."
        )
        try:
            result = self.channel_sender(phone, text)
        except Exception as e:
            logger.error(f"Invio canale per todo {todo.get('id')} fallito: {e}")
            return False
        if not result.get('success'):
            logger.warning(f"Todo {todo.get('id')}: invio a {recipient.get('username')} non riuscito: {result.get('error')}")
        return bool(result.get('success'))

    def _is_last_open_day_before_due(self, today: date, due: date) -> bool:
        """Vero se oggi e' l'ultimo giorno di apertura prima della scadenza (es. venerdi' per un lunedi')."""
        if due <= today:
            return False
        day = today + timedelta(days=1)
        while day < due:
            if self._slots_for(day.isoweekday()):
                return False
            day += timedelta(days=1)
        return True

    def _open_days_overdue(self, due: date, today: date) -> int:
        """
        Giorni di apertura trascorsi dalla scadenza, oggi compreso. Il weekend non conta:
        un todo in scadenza venerdi' non diventa 'urgente' per il solo passaggio del sabato.
        """
        count = 0
        day = due + timedelta(days=1)
        while day <= today:
            if self._slots_for(day.isoweekday()):
                count += 1
            day += timedelta(days=1)
        return count
