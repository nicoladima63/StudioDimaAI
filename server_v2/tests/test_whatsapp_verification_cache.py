import sqlite3
from datetime import datetime, timedelta

from services import appointment_reminder_service as reminders


def _create_cache(path):
    conn = sqlite3.connect(path)
    conn.execute('''
        CREATE TABLE pazienti_wa_cache (
            patient_id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            has_whatsapp INTEGER,
            wa_jid TEXT,
            checked_at TEXT,
            verified_at TEXT
        )
    ''')
    conn.commit()
    conn.close()


def test_cached_verification_is_used_only_for_the_same_number(tmp_path, monkeypatch):
    db_path = tmp_path / 'reminders.db'
    _create_cache(db_path)
    now = datetime.now().isoformat()
    conn = sqlite3.connect(db_path)
    conn.execute(
        'INSERT INTO pazienti_wa_cache VALUES (?, ?, ?, ?, ?, ?)',
        ('P001', '393291111111', 1, '393291111111@s.whatsapp.net', now, now),
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(reminders, 'STUDIO_DIMA_DB_PATH', db_path)
    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)

    def unexpected_request(*args, **kwargs):
        raise AssertionError('Evolution must not be called for a current verification')

    monkeypatch.setattr(reminders.requests, 'post', unexpected_request)
    assert reminders.check_whatsapp('P001', '3291111111') == (True, '393291111111@s.whatsapp.net')


def test_phone_change_forces_a_new_evolution_verification(tmp_path, monkeypatch):
    db_path = tmp_path / 'reminders.db'
    _create_cache(db_path)
    now = datetime.now().isoformat()
    conn = sqlite3.connect(db_path)
    conn.execute(
        'INSERT INTO pazienti_wa_cache VALUES (?, ?, ?, ?, ?, ?)',
        ('P001', '393291111111', 0, None, now, now),
    )
    conn.commit()
    conn.close()

    class Response:
        status_code = 200
        text = 'ok'

        @staticmethod
        def json():
            return [{'exists': True, 'jid': '393292222222@s.whatsapp.net'}]

    monkeypatch.setattr(reminders, 'STUDIO_DIMA_DB_PATH', db_path)
    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)
    monkeypatch.setattr(reminders.requests, 'post', lambda *args, **kwargs: Response())

    assert reminders.check_whatsapp('P001', '3292222222') == (True, '393292222222@s.whatsapp.net')
    conn = sqlite3.connect(db_path)
    row = conn.execute('SELECT phone, has_whatsapp FROM pazienti_wa_cache WHERE patient_id=?', ('P001',)).fetchone()
    conn.close()
    assert row == ('393292222222', 1)


def test_evolution_failure_is_not_cached_as_a_positive_result(tmp_path, monkeypatch):
    db_path = tmp_path / 'reminders.db'
    _create_cache(db_path)
    monkeypatch.setattr(reminders, 'STUDIO_DIMA_DB_PATH', db_path)
    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)
    monkeypatch.setattr(reminders.requests, 'post', lambda *args, **kwargs: (_ for _ in ()).throw(OSError('offline')))

    assert reminders.check_whatsapp('P001', '3292222222') == (False, None)
    conn = sqlite3.connect(db_path)
    assert conn.execute('SELECT COUNT(*) FROM pazienti_wa_cache').fetchone()[0] == 0
    conn.close()


def test_expired_verification_is_refreshed(tmp_path, monkeypatch):
    db_path = tmp_path / 'reminders.db'
    _create_cache(db_path)
    old = (datetime.now() - timedelta(days=reminders.WA_CACHE_TTL_DAYS + 1)).isoformat()
    conn = sqlite3.connect(db_path)
    conn.execute(
        'INSERT INTO pazienti_wa_cache VALUES (?, ?, ?, ?, ?, ?)',
        ('P001', '393291111111', 1, '393291111111@s.whatsapp.net', old, old),
    )
    conn.commit()
    conn.close()

    class Response:
        status_code = 200
        text = 'ok'

        @staticmethod
        def json():
            return [{'exists': False}]

    monkeypatch.setattr(reminders, 'STUDIO_DIMA_DB_PATH', db_path)
    monkeypatch.setattr(reminders, 'ensure_reminder_tables', lambda: None)
    monkeypatch.setattr(reminders.requests, 'post', lambda *args, **kwargs: Response())

    assert reminders.check_whatsapp('P001', '3291111111') == (False, None)
