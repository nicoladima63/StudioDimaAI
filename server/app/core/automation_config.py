import os
import json
from typing import Dict, Any

SETTINGS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../instance/automation_settings.json'))

# Aggiungi default per le nuove modalità
DEFAULT_AUTOMATION_SETTINGS = {
    'reminder_enabled': True,
    'reminder_hour': 15,
    'reminder_minute': 0,
    'sms_promemoria_mode': 'prod',
    'sms_richiami_mode': 'prod',
    'recall_enabled': True,
    'recall_hour': 16,
    'recall_minute': 0
}

def get_automation_settings() -> Dict[str, Any]:
    if not os.path.exists(SETTINGS_PATH):
        set_automation_settings(DEFAULT_AUTOMATION_SETTINGS)
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

def set_automation_settings(new_settings):
    settings = get_automation_settings()
    settings.update(new_settings)
    with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2) 