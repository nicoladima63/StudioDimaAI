from datetime import datetime, timedelta

from services import appointment_reminder_service as reminders


def _appointment(patient_id, recovery_type, cell='3291111111'):
    return {
        'patient_id': patient_id,
        'patient_name': 'Mario Rossi',
        'appointment_date': '2026-09-04',
        'appointment_time': '10:00',
        'recovery_type': recovery_type,
        'cell': cell,
    }


def test_recovery_time_window_uses_tomorrow_or_today_within_eight_hours():
    now = datetime(2026, 9, 3, 14, 0)

    assert reminders._recovery_reminder_type(now + timedelta(hours=7, minutes=59), now) == '2h'
    assert reminders._recovery_reminder_type(now + timedelta(hours=8), now) is None
    assert reminders._recovery_reminder_type(datetime(2026, 9, 4, 9, 0), now) == '24h'
    assert reminders._recovery_reminder_type(now - timedelta(minutes=1), now) is None


def test_recovery_sends_only_not_already_logged_whatsapp_reminders(monkeypatch):
    appointments = [_appointment('P1', '24h'), _appointment('P2', '2h')]
    sent = []
    logged = []

    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)
    monkeypatch.setattr(reminders, 'get_upcoming_appointments', lambda *args, **kwargs: appointments)
    monkeypatch.setattr(reminders, '_already_sent', lambda patient_id, *args: patient_id == 'P1')
    monkeypatch.setattr(reminders, 'is_appointment_confirmed', lambda *args: False)
    monkeypatch.setattr(reminders, 'check_whatsapp', lambda *args: (True, 'jid'))
    monkeypatch.setattr(reminders, 'send_whatsapp_reminder', lambda *args: sent.append('24h') or {'success': True, 'message_id': 'a'})
    monkeypatch.setattr(reminders, 'send_whatsapp_text', lambda *args: sent.append('2h') or {'success': True, 'message_id': 'b'})
    monkeypatch.setattr(reminders, '_log_communication', lambda *args: logged.append(args) or 1)
    monkeypatch.setattr(reminders, '_write_log', lambda *args: None)

    stats = reminders.run_missed_whatsapp_reminders()

    assert stats['examined'] == 2
    assert stats['already_sent'] == 1
    assert stats['sent_wa'] == 1
    assert sent == ['2h']
    assert logged[0][4] == '2h'
    assert logged[0][7] == 'sent'


def test_recovery_never_falls_back_to_sms(monkeypatch):
    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)
    monkeypatch.setattr(reminders, 'get_upcoming_appointments', lambda *args, **kwargs: [_appointment('P1', '24h')])
    monkeypatch.setattr(reminders, '_already_sent', lambda *args: False)
    monkeypatch.setattr(reminders, 'check_whatsapp', lambda *args: (False, None))
    monkeypatch.setattr(reminders, 'send_sms_reminder', lambda *args: (_ for _ in ()).throw(AssertionError('SMS fallback not allowed')))
    monkeypatch.setattr(reminders, '_write_log', lambda *args: None)

    stats = reminders.run_missed_whatsapp_reminders()

    assert stats['sent_wa'] == 0
    assert [p['patient_id'] for p in stats['skipped_no_whatsapp']] == ['P1']


def test_dry_run_returns_the_same_snapshot_without_sending(monkeypatch):
    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)
    monkeypatch.setattr(reminders, 'get_upcoming_appointments', lambda *args, **kwargs: [_appointment('P1', '24h')])
    monkeypatch.setattr(reminders, '_already_sent', lambda *args: False)
    monkeypatch.setattr(reminders, 'send_whatsapp_text', lambda *args: (_ for _ in ()).throw(AssertionError('dry run must not send')))
    monkeypatch.setattr(reminders, '_write_log', lambda *args: (_ for _ in ()).throw(AssertionError('dry run must not log')))

    stats = reminders.run_missed_whatsapp_reminders(dry_run=True)

    assert stats['dry_run'] is True
    assert stats['sent_wa'] == 0
    assert stats['simulated_actions'][0]['type'] == '24h'
    assert stats['snapshot_appointments'][0]['patient_id'] == 'P1'
