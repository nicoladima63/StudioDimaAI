"""Un'unica app di test per processo.

create_app_v2 non si puo' chiamare due volte nello stesso processo: i blueprint gia'
registrati non accettano un nuovo before_request. I file di test condividono questa app.
"""
from app_v2 import create_app_v2

_app = None


def get_test_app():
    global _app
    if _app is None:
        _app = create_app_v2('testing')
    return _app
