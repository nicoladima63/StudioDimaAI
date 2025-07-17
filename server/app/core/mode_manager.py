import os

INSTANCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../instance'))
MODE_FILES = {
    'database': 'database_mode.txt',
    'rentri': 'rentri_mode.txt',
    'ricetta': 'ricetta_mode.txt',
    'sms': 'sms_mode.txt',  # Aggiunto supporto SMS
}

VALID_MODES = ['dev', 'prod', 'test']

def get_mode(tipo: str) -> str:
    path = os.path.join(INSTANCE_DIR, MODE_FILES[tipo])
    try:
        with open(path, 'r') as f:
            mode = f.read().strip()
            if mode in VALID_MODES:
                return mode
    except Exception:
        pass
    return 'dev'

def set_mode(tipo: str, modo: str):
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    path = os.path.join(INSTANCE_DIR, MODE_FILES[tipo])
    with open(path, 'w') as f:
        f.write(modo)

def get_env_params(tipo: str, modo: str) -> dict:
    """Centralizza qui la logica per rentri, ricetta, sms, ecc."""
    params = {}
    
    if tipo == 'rentri':
        if modo == 'prod':
            params['PRIVATE_KEY_PATH'] = os.getenv('RENTRI_PRIVATE_KEY_PATH_PROD')
            params['CLIENT_ID'] = os.getenv('RENTRI_CLIENT_ID_PROD')
            params['CLIENT_AUDIENCE'] = os.getenv('RENTRI_CLIENT_AUDIENCE_PROD')
            params['TOKEN_URL'] = os.getenv('RENTRI_TOKEN_URL_PROD', 'https://api.rentri.gov.it/auth/token')
        else:
            params['PRIVATE_KEY_PATH'] = os.getenv('RENTRI_PRIVATE_KEY_PATH_TEST')
            params['CLIENT_ID'] = os.getenv('RENTRI_CLIENT_ID_TEST')
            params['CLIENT_AUDIENCE'] = os.getenv('RENTRI_CLIENT_AUDIENCE_TEST')
            params['TOKEN_URL'] = os.getenv('RENTRI_TOKEN_URL_TEST', 'https://demoapi.rentri.gov.it/token')
    
    elif tipo == 'sms':
        if modo == 'prod':
            params['API_KEY'] = os.getenv('BREVO_API_KEY')
            params['SENDER'] = os.getenv('SMS_SENDER_PROD', 'StudioDima')
            params['ENABLED'] = True
        else:  # dev
            params['API_KEY'] = os.getenv('BREVO_API_KEY')
            params['SENDER'] = os.getenv('SMS_SENDER_TEST', 'TestSMS')
            params['ENABLED'] = True
    
    return params