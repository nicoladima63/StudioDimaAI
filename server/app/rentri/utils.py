# Funzioni di utilità condivise per i servizi RENTRI 
import os

INSTANCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../instance'))
RENTRI_MODE_FILE_PATH = os.path.join(INSTANCE_DIR, 'rentri_mode.txt')

def get_rentri_mode():
    try:
        with open(RENTRI_MODE_FILE_PATH, 'r') as f:
            mode = f.read().strip()
            if mode in ['dev', 'prod']:
                return mode
    except Exception:
        pass
    return 'dev' 