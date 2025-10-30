import os
import json
from typing import Dict, Any

SETTINGS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../instance/automation_settings.json'))

# Default settings per V2 - identici a V1 per compatibilità
DEFAULT_AUTOMATION_SETTINGS = {
    'reminder_enabled': True,
    'reminder_hour': 15,
    'reminder_minute': 0,
    'sms_promemoria_mode': 'prod',
    'sms_richiami_mode': 'prod',
    'recall_enabled': True,
    'recall_hour': 16,
    'recall_minute': 0,
    'calendar_sync_enabled': True,
    'calendar_sync_hour': 21,
    'calendar_sync_minute': 0,
    'calendar_sync_weeks_to_sync': 3,
    'calendar_studio_blu_id': 'a60fdd2c5ea45c5575bea897a32d25a0309e8d61db566353aa8b95b2111d4a4e@group.calendar.google.com',
    'calendar_studio_giallo_id': '6b34420df23351c1dc0225cb912d7fb5a8e8aaa5bd0e9a7285a22b86010354b2@group.calendar.google.com'
}

def get_automation_settings() -> Dict[str, Any]:
    """Ottieni impostazioni automazione - logica identica V1"""
    if not os.path.exists(SETTINGS_PATH):
        # Se il file non esiste, lo creiamo direttamente qui per evitare la ricorsione.
        os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
        with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_AUTOMATION_SETTINGS, f, ensure_ascii=False, indent=2)
        return DEFAULT_AUTOMATION_SETTINGS.copy()
    try:
        with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
            settings = json.load(f)
        updated = False
        for k, v in DEFAULT_AUTOMATION_SETTINGS.items():
            if k not in settings:
                settings[k] = v
                updated = True
        if updated:
            with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
        return settings
    except Exception:
        return DEFAULT_AUTOMATION_SETTINGS.copy()

def save_automation_settings(new_settings: Dict[str, Any]):
    """Salva impostazioni automazione - nome compatibile V2"""
    settings = get_automation_settings()
    settings.update(new_settings)
    # Crea directory se non esiste
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)

# Alias per compatibilità V1
def set_automation_settings(new_settings):
    """Alias per compatibilità con V1"""
    return save_automation_settings(new_settings)