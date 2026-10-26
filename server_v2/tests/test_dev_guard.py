"""
Test dell'interruttore locale delle automazioni (nessuna rete: ogni invio e' simulato).
Uso (dalla cartella server_v2): python -m unittest tests.test_dev_guard -v
"""
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core import dev_guard  # noqa: E402
from core.paths import DATA_DIR  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]


class FlagTestCase(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.flag = Path(tmp.name) / 'disable_automations'
        patcher = mock.patch.object(dev_guard, 'FLAG_PATH', self.flag)
        patcher.start()
        self.addCleanup(patcher.stop)

    def disable(self):
        self.flag.write_text('')


class TestFlag(FlagTestCase):
    def test_follows_the_flag_file_without_restart(self):
        self.assertFalse(dev_guard.automations_disabled())
        self.assertFalse(dev_guard.blocked('sms'))
        self.disable()
        self.assertTrue(dev_guard.automations_disabled())
        self.assertTrue(dev_guard.blocked('sms'))
        self.flag.unlink()
        self.assertFalse(dev_guard.blocked('sms'))

    def test_flag_lives_in_the_instance_folder(self):
        self.assertEqual(Path(dev_guard.__file__).name, 'dev_guard.py')
        real = Path(DATA_DIR / 'disable_automations')
        self.assertEqual(real.parent.name, 'instance')


class TestOutboundBlocked(FlagTestCase):
    def test_whatsapp_not_sent(self):
        from services import appointment_reminder_service as ars
        self.disable()
        with mock.patch.object(ars.requests, 'post', side_effect=AssertionError('rete usata')):
            result = ars.send_whatsapp_text('3331234567', 'ciao')
        self.assertEqual(result, {'success': False, 'error': dev_guard.BLOCKED_ERROR})

    def test_whatsapp_sent_when_flag_absent(self):
        from services import appointment_reminder_service as ars
        response = mock.Mock(status_code=201, text='{}')
        response.json.return_value = {'key': {'id': 'abc'}}
        with mock.patch.object(ars.requests, 'post', return_value=response) as post, \
                mock.patch('core.automation_config.get_automation_settings', return_value={}):
            result = ars.send_whatsapp_text('3331234567', 'ciao')
        post.assert_called_once()
        self.assertTrue(result['success'])

    def test_sms_not_sent(self):
        from services.sms_service import SMSService
        self.disable()
        result = SMSService.send_sms(object.__new__(SMSService), '393331234567', 'ciao')
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], dev_guard.BLOCKED_ERROR)

    def test_push_not_sent(self):
        from services.push_notification_service import PushNotificationService
        self.disable()
        service = object.__new__(PushNotificationService)  # senza db: se il blocco fallisse, esplode
        single = service.send_notification(1, 'titolo', 'testo')
        broadcast = service.send_notification_to_all('titolo', 'testo')
        self.assertEqual((single['success'], single['sent_count']), (False, 0))
        self.assertEqual((broadcast['success'], broadcast['sent_count']), (False, 0))

    def test_scheduler_does_not_start(self):
        from services.scheduler_service import SchedulerService
        self.disable()
        service = SchedulerService()
        service.start()
        self.assertFalse(service.scheduler.running)

    def test_dbf_monitors_do_not_start(self):
        from services.monitoring_service import MonitoringService
        self.disable()
        service = object.__new__(MonitoringService)  # senza lock ne' config: il blocco deve scattare prima
        self.assertFalse(service.start_monitor('qualsiasi'))


class TestDeployCannotCarryTheFlag(unittest.TestCase):
    """Il flag e' sicuro solo finche' il deploy non copia instance/ e git non lo traccia."""

    def test_robocopy_excludes_instance_folder(self):
        bat = (REPO_ROOT / 'deploy_v2.bat').read_text(encoding='utf-8', errors='replace')
        block = bat[bat.index('robocopy "server_v2"'):]
        xd_line = re.search(r'/XD\s+(.+)', block).group(1)
        self.assertIn('"instance"', xd_line)

    def test_instance_folder_is_git_ignored(self):
        lines = (REPO_ROOT / '.gitignore').read_text(encoding='utf-8').splitlines()
        self.assertIn('server_v2/instance/', [line.strip() for line in lines])


if __name__ == '__main__':
    unittest.main()
