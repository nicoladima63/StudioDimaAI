"""Interruttore locale: con il flag attivo questo server non emette nulla verso l'esterno.

Il flag e' il file `disable_automations` nella cartella dati (instance/). Quella cartella
e' ignorata da git ed esclusa dal robocopy del deploy: il flag resta sul PC dove lo crei
e non puo' arrivare in produzione. Non usare .env: il deploy lo copia sul server.

Il blocco sta nei punti da cui esce qualcosa (WhatsApp, SMS, push) e nell'avvio di
scheduler e monitor DBF; il flag si legge a ogni chiamata, senza riavvio.
"""
import logging

from core.paths import DATA_DIR

logger = logging.getLogger(__name__)

FLAG_PATH = DATA_DIR / 'disable_automations'
BLOCKED_ERROR = 'AUTOMAZIONI_DISABILITATE'


def automations_disabled() -> bool:
    return FLAG_PATH.exists()


def blocked(channel: str) -> bool:
    """True se l'azione in uscita va bloccata; registra il blocco (senza dati personali)."""
    if not automations_disabled():
        return False
    logger.warning('[AUTOMAZIONI DISABILITATE] %s bloccato (flag %s)', channel, FLAG_PATH.name)
    return True
