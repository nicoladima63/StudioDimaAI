"""
Avvisi sulle email importanti.

Ogni scopo email (fatture, ordini, ...) puo' avere una modalita': nessuna, alert
(notifica) oppure todo (compito con scadenza) verso un utente, di default CristinaB.
Un job controlla la posta nuova e applica la modalita' dello scopo.

Tutto deterministico: le email si riconoscono solo con le regole dello scopo
(email_filter_rules), nessuna AI e nessun dato inviato a terzi.
"""

import logging
import time
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Dict, List, Optional

import pytz

from core.exceptions import GmailApiError, GmailCredentialsNotFoundError, ValidationError
from repositories.email_alert_repository import (
    MODE_ALERT,
    MODE_NONE,
    MODE_TODO,
    VALID_MODES,
    VALID_PRIORITIES,
)
from services.todo_reminder_engine import window_slot_hours

logger = logging.getLogger(__name__)

ROME_TZ = pytz.timezone('Europe/Rome')

DEFAULT_RECIPIENT_USERNAME = 'CristinaB'
# Stesso mittente di sistema usato dai todo generati dalle lavorazioni
SYSTEM_SENDER_ID = 1
DEFAULT_DUE_DAYS = 1
MAX_DUE_DAYS = 30
# Email piu' vecchie non vengono mai considerate (il registro si ripulisce oltre 45 giorni)
MAX_LOOKBACK_DAYS = 30
# Tetto di email elaborate per passaggio: il resto viene ripreso al giro successivo
MAX_NEW_PER_RUN = 100
SUBJECT_MAX = 120


def is_open_at(config: Optional[Dict[str, Any]], now: datetime) -> bool:
    """True se `now` cade in una fascia di apertura dello studio per quel giorno."""
    if not config or config.get('enabled') != 1:
        return False

    if config.get('continuous_hours') == 1:
        windows = [(config.get('fascia_unica_start'), config.get('fascia_unica_end'))]
    else:
        windows = [
            (config.get('morning_start'), config.get('morning_end')),
            (config.get('afternoon_start'), config.get('afternoon_end')),
        ]

    current = now.strftime('%H:%M')
    for start, end in windows:
        if start and end and str(start)[:5] <= current < str(end)[:5]:
            return True
    return False


def _clean(text: Any, limit: int = SUBJECT_MAX) -> str:
    text = ' '.join(str(text or '').split())
    return text if len(text) <= limit else text[:limit - 3] + '...'


def _received_epoch(email_data: Dict[str, Any]) -> Optional[int]:
    """Quando e' stata inviata l'email, dall'header Date; None se illeggibile."""
    try:
        sent = parsedate_to_datetime(email_data.get('date', ''))
    except (TypeError, ValueError):
        return None
    # Header senza fuso ("-0000"): si legge come UTC, non come ora locale del server
    if sent.tzinfo is None:
        sent = sent.replace(tzinfo=timezone.utc)
    return int(sent.timestamp())


class EmailAlertService:
    def __init__(
        self,
        email_service,
        alert_repository,
        todo_service,
        notification_service,
        user_repository,
        get_day_config: Callable[[int], Optional[Dict[str, Any]]],
    ):
        self.email_service = email_service
        self.alert_repository = alert_repository
        self.todo_service = todo_service
        self.notification_service = notification_service
        self.user_repository = user_repository
        self.get_day_config = get_day_config

    # ------------------------------------------------------------------
    # Configurazione
    # ------------------------------------------------------------------

    def _default_recipient_id(self) -> Optional[int]:
        for user in self.user_repository.get_all():
            if str(user.get('username') or '').strip().lower() == DEFAULT_RECIPIENT_USERNAME.lower():
                return user.get('id')
        return None

    def get_config(self) -> Dict[str, Any]:
        """Una riga per scopo, con i default dove non e' ancora configurato nulla."""
        saved = self.alert_repository.get_all_configs()
        default_recipient = self._default_recipient_id()
        users = {u['id']: u.get('username') for u in self.user_repository.get_all()}

        items = []
        for scope in self.email_service.get_scopes():
            cfg = saved.get(scope['id'])
            recipient_id = cfg['recipient_id'] if cfg and cfg.get('recipient_id') else default_recipient
            items.append({
                'scope_id': scope['id'],
                'scope_label': scope['label'],
                'scope_color': scope.get('color'),
                'scope_active': bool(scope.get('active', 1)),
                'mode': cfg['mode'] if cfg else MODE_NONE,
                'recipient_id': recipient_id,
                'recipient_username': users.get(recipient_id),
                'priority': cfg['priority'] if cfg else 'medium',
                'due_days': cfg['due_days'] if cfg else DEFAULT_DUE_DAYS,
            })
        return {'items': items, 'default_recipient_id': default_recipient}

    def save_config(self, scope_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        scope = next((s for s in self.email_service.get_scopes() if s['id'] == scope_id), None)
        if not scope:
            raise ValidationError('Scopo non trovato')

        mode = data.get('mode', MODE_NONE)
        if mode not in VALID_MODES:
            raise ValidationError('Modalita non valida')

        priority = data.get('priority', 'medium')
        if priority not in VALID_PRIORITIES:
            raise ValidationError('Priorita non valida')

        try:
            due_days = int(data.get('due_days', DEFAULT_DUE_DAYS))
        except (TypeError, ValueError):
            raise ValidationError('Giorni di scadenza non validi')
        if not 0 <= due_days <= MAX_DUE_DAYS:
            raise ValidationError(f'I giorni di scadenza vanno da 0 a {MAX_DUE_DAYS}')

        recipient_id = data.get('recipient_id') or self._default_recipient_id()
        if mode != MODE_NONE:
            if not recipient_id or not self.user_repository.find_by_id(int(recipient_id)):
                raise ValidationError('Destinatario mancante o non valido')

        self.alert_repository.save_config(
            scope_id, mode, int(recipient_id) if recipient_id else None, priority, due_days
        )
        return next(i for i in self.get_config()['items'] if i['scope_id'] == scope_id)

    # ------------------------------------------------------------------
    # Esecuzione
    # ------------------------------------------------------------------

    def run(self, dry_run: bool = False, force: bool = False,
            now: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Controlla la posta nuova e manda gli avvisi dovuti.

        dry_run: non invia e non registra niente, elenca cosa scatterebbe.
        force: ignora gli orari dello studio (uso manuale).
        """
        now = (now or datetime.now(ROME_TZ)).replace(tzinfo=None)
        stats: Dict[str, Any] = {
            'state': 'success', 'message': '', 'checked': 0, 'matched': 0,
            'alerts': 0, 'todos': 0, 'failed': 0, 'would_send': [],
        }

        active = {
            sid: cfg for sid, cfg in self.alert_repository.get_all_configs().items()
            if cfg['mode'] != MODE_NONE and cfg.get('since_at')
        }
        if not active:
            stats['message'] = 'Nessun avviso email attivo'
            return stats

        if not force and not is_open_at(self.get_day_config(now.isoweekday()), now):
            stats['message'] = 'Fuori dagli orari dello studio'
            return stats

        if not self.email_service.get_oauth_status().get('authenticated'):
            stats['state'] = 'warning'
            stats['message'] = 'Gmail non connesso: avvisi sospesi'
            return stats

        oldest_allowed = int(time.time()) - MAX_LOOKBACK_DAYS * 86400
        since = max(min(cfg['since_at'] for cfg in active.values()), oldest_allowed)

        try:
            ids = self.email_service.list_inbox_message_ids(since)
            known = self.alert_repository.get_known_ids(ids)
            new_ids = [i for i in ids if i not in known][:MAX_NEW_PER_RUN]
            emails = self.email_service.get_message_summaries(new_ids)
        except (GmailCredentialsNotFoundError, GmailApiError) as e:
            logger.warning(f"Avvisi email sospesi, Gmail non raggiungibile: {e}")
            stats['state'] = 'warning'
            stats['message'] = 'Gmail non raggiungibile: riprovo al prossimo giro'
            return stats

        scopes = {s['id']: s for s in self.email_service.get_scopes()}
        for email_data in emails:
            stats['checked'] += 1
            message_id = email_data['id']
            match = self.email_service.classify_email_by_rules(email_data)
            cfg = active.get(match['scope_id']) if match else None
            received = _received_epoch(email_data)

            if not cfg or (received is not None and received < cfg['since_at']):
                if not dry_run:
                    self.alert_repository.log_message(message_id, match['scope_id'] if match else None, 'none')
                continue

            stats['matched'] += 1
            scope_label = scopes.get(cfg['scope_id'], {}).get('label', '')
            if dry_run:
                stats['would_send'].append({
                    'message_id': message_id,
                    'mode': cfg['mode'],
                    'scope_label': scope_label,
                    'sender': _clean(email_data.get('from_name') or email_data.get('from_email'), 80),
                    'subject': _clean(email_data.get('subject')),
                })
                continue

            try:
                todo_id = self._dispatch(cfg, scope_label, email_data, now)
            except Exception as e:
                # Non si registra: l'email viene ripresa al prossimo giro
                logger.error(f"Avviso email {message_id} non inviato: {e}")
                stats['failed'] += 1
                continue

            stats['todos' if cfg['mode'] == MODE_TODO else 'alerts'] += 1
            self.alert_repository.log_message(
                message_id, cfg['scope_id'], cfg['mode'], cfg['recipient_id'], todo_id,
                _clean(email_data.get('subject')),
                _clean(email_data.get('from_name') or email_data.get('from_email'), 80),
            )

        if not dry_run:
            self.alert_repository.prune_log()

        if stats['failed']:
            stats['state'] = 'warning'
            stats['message'] = f"{stats['failed']} avvisi non inviati, riprovo al prossimo giro"
        elif not stats['message']:
            stats['message'] = f"{stats['alerts'] + stats['todos']} avvisi inviati"
        return stats

    def _dispatch(self, cfg: Dict[str, Any], scope_label: str,
                  email_data: Dict[str, Any], now: datetime) -> Optional[int]:
        """Manda l'avviso di una email. Ritorna l'id del todo (solo modalita todo)."""
        recipient_id = cfg.get('recipient_id')
        if not recipient_id or not self.user_repository.find_by_id(int(recipient_id)):
            raise ValidationError('Destinatario non valido')

        sender = _clean(email_data.get('from_name') or email_data.get('from_email'), 80)
        subject = _clean(email_data.get('subject'))

        if cfg['mode'] == MODE_ALERT:
            self.notification_service.notify_user(
                user_id=int(recipient_id),
                message=f"Email importante ({scope_label}) da {sender}: {subject}",
                type='warning',
                link=f"/email?message={email_data['id']}",
            )
            return None

        due = self._due_date(now.date(), int(cfg.get('due_days') or 0))
        todo = self.todo_service.create_todo(
            sender_id=SYSTEM_SENDER_ID,
            recipient_id=int(recipient_id),
            subject=f"Email {scope_label}: {subject}",
            message=f"Da: {sender}\nOggetto: {subject}\n\n{_clean(email_data.get('snippet'), 400)}",
            priority=cfg.get('priority') or 'medium',
            due_date=due.isoformat(),
            type='email',
            notification_message=f"Nuova email da gestire ({scope_label}): {subject}",
            related_email_id=email_data['id'],
        )
        return todo.get('id')

    def _due_date(self, today: date, due_days: int) -> date:
        """Scadenza in giorni di apertura dello studio (0 = oggi)."""
        day = today
        remaining = due_days
        # Il tetto evita cicli infiniti se lo studio risultasse sempre chiuso
        for _ in range(60):
            if remaining <= 0:
                break
            day += timedelta(days=1)
            if window_slot_hours(self.get_day_config(day.isoweekday())):
                remaining -= 1
        else:
            return today + timedelta(days=due_days)
        return day

    def get_recent_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        users = {u['id']: u.get('username') for u in self.user_repository.get_all()}
        alerts = self.alert_repository.get_recent_alerts(limit)
        for alert in alerts:
            alert['recipient_username'] = users.get(alert.get('recipient_id'))
        return alerts


def build_email_alert_service() -> 'EmailAlertService':
    """Assembla il servizio con le dipendenze reali (usato da endpoint e scheduler)."""
    from core.database_manager import get_database_manager
    from repositories.email_alert_repository import EmailAlertRepository
    from repositories.user_repository import UserRepository
    from services.email_service import email_service
    from services.notification_service import NotificationService
    from services.reminder_dispatch_engine import get_dispatch_engine
    from services.todo_service import TodoService

    db_manager = get_database_manager()
    return EmailAlertService(
        email_service=email_service,
        alert_repository=EmailAlertRepository(),
        todo_service=TodoService(db_manager),
        notification_service=NotificationService(db_manager),
        user_repository=UserRepository(),
        get_day_config=get_dispatch_engine().get_config,
    )
