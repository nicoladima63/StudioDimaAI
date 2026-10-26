import pytest

from .app_cache import get_test_app
from core.database_manager import close_database_manager

URL = '/api/v2/push/test-simple?user_id=2&title=x&body=y'


@pytest.fixture(scope='module')
def client():
    yield get_test_app().test_client()
    close_database_manager()  # le richieste creano il gestore DB globale: non va lasciato agli altri test


@pytest.mark.parametrize('method', ['get', 'post'])
def test_test_simple_richiede_il_login(client, method):
    # Senza il login la vista parte: nel test non c'e' il servizio push e risponde 503, in produzione invierebbe la notifica
    assert getattr(client, method)(URL).status_code == 401
