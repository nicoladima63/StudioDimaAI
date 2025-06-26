#server/app/core/utils.py

import re
import pandas as pd
from datetime import datetime, date, timedelta, time

from config.constants import TIPI_APPUNTAMENTO, MEDICI, COLONNE
import logging

logger = logging.getLogger(__name__)


def decodifica_tipo_appuntamento(codice_guardia):
    if pd.isna(codice_guardia):
        return "Sconosciuto"
    return TIPI_APPUNTAMENTO.get(str(codice_guardia).strip().upper(), "Sconosciuto")


def decodifica_medico(numero_medico):
    try:
        return MEDICI.get(int(numero_medico), "Sconosciuto")
    except (ValueError, TypeError):
        return "Sconosciuto"


def calcola_giorni_prenotazione(data_inserimento):
    if pd.isna(data_inserimento):
        return 0
    try:
        data_inserimento_dt = (
            datetime.combine(data_inserimento, datetime.min.time()).date()
            if isinstance(data_inserimento, (datetime, date))
            else datetime.strptime(data_inserimento, "%Y-%m-%d").date()
        )
        return (date.today() - data_inserimento_dt).days
    except Exception as e:
        logger.warning(f"Errore calcolo giorni prenotazione: {e}")
        return 0


def normalizza_numero_telefono(numero_telefono):
    if pd.isna(numero_telefono):
        return None
    numero_pulito = re.sub(r"[^\d+]", "", str(numero_telefono)).lstrip("+")
    if numero_pulito.startswith("00"):
        numero_pulito = numero_pulito[2:]
    if not numero_pulito.startswith("39"):
        numero_pulito = "39" + numero_pulito
    if len(numero_pulito) < 11 or len(numero_pulito) > 13:
        logger.warning(f"Numero {numero_telefono} → {numero_pulito} ha lunghezza anomala")
    return "+" + numero_pulito


def costruisci_messaggio_promemoria(appuntamento):
    col = COLONNE["appuntamenti"]
    try:
        nome_paziente = appuntamento.get("nome_completo", "Gentile paziente")
        data_app = appuntamento.get(col["data"], datetime.now())
        ora_app = appuntamento.get(col["ora_inizio"], None)
        tipo_app = decodifica_tipo_appuntamento(appuntamento.get(col["tipo"]))
        medico = decodifica_medico(appuntamento.get(col["medico"]))

        # Formattazione ora robusta
        if isinstance(ora_app, (datetime, time)):
            ora_str = ora_app.strftime("%H:%M")
        elif isinstance(ora_app, (int, float)):
            ore = int(ora_app)
            minuti = int(round((ora_app - ore) * 60))
            ora_str = f"{ore:02d}:{minuti:02d}"
        elif isinstance(ora_app, str):
            ora_str = ora_app.strip()
        else:
            ora_str = "ora non specificata"

        data_str = data_app.strftime("%d/%m/%Y") if isinstance(data_app, (datetime, date)) else str(data_app)

        return (
            f"Ciao {nome_paziente},\n"
            f"Ti ricordiamo l'appuntamento di domani {data_str} alle ore {ora_str}.\n"
            f"Tipo di appuntamento: {tipo_app}.\n"
            f"Con il {medico}.\n"
            f"Per qualsiasi necessità, contattaci. Grazie."
        )
    except Exception as e:
        logger.error(f"Errore costruzione messaggio promemoria: {e}")
        return "Ciao! Ti ricordiamo un appuntamento programmato per domani. Contattaci per conferma. Grazie."


def costruisci_messaggio_richiamo(richiamo):
    col = COLONNE["richiami"]
    try:
        nome = richiamo.get("NOME", "Gentile paziente")
        tipo = richiamo.get(col["tipo"], "controllo")
        data_richiamo = richiamo.get(col["data1"], None)

        if isinstance(data_richiamo, (datetime, date)):
            data_str = data_richiamo.strftime("%d/%m/%Y")
        else:
            data_str = "una prossima data"

        return (
            f"Ciao {nome},\n"
            f"Ti ricordiamo che è tempo per il tuo richiamo ({tipo}).\n"
            f"Ti proponiamo un appuntamento intorno al {data_str}.\n"
            f"Contattaci per fissarlo. Grazie!"
        )
    except Exception as e:
        logger.error(f"Errore costruzione messaggio richiamo: {e}")
        return "Gentile paziente, è il momento di programmare un richiamo. Contattaci per fissare l'appuntamento."

