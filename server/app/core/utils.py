#server/app/core/utils.py

import re
import pandas as pd
import json
from datetime import datetime, date, timedelta, time

from server.app.config.constants import TIPI_APPUNTAMENTO, MEDICI, COLONNE
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

def normalizza_numero_telefono_old(numero_telefono):
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

def normalizza_numero_telefono(numero_telefono, origine='cellulare'):
    if pd.isna(numero_telefono):
        return None

    numero_str = str(numero_telefono).strip()

    # Escludi segnaposto palesi
    if numero_str in {".", "-", "", "0"}:
        return None

    # Rimuove tutto ciò che non è cifra o +
    numero_pulito = re.sub(r"[^\d+]", "", numero_str).lstrip("+")

    # Gestione prefisso internazionale
    if numero_pulito.startswith("00"):
        numero_pulito = numero_pulito[2:]
    if not numero_pulito.startswith("39"):
        numero_pulito = "39" + numero_pulito

    # Validazione comune
    def is_falso(n):
        return len(set(n)) <= 2  # Es: solo zeri o ripetuti

    # Logica differenziata per origine
    if origine == 'telefono' or numero_str.startswith("0"):
        if len(numero_pulito) < 11 or len(numero_pulito) > 13:
            logger.warning(f"[FISSO ANOMALO] Orig: '{numero_telefono}' -> '{numero_pulito}'")
            return None
        if is_falso(numero_pulito):
            logger.warning(f"[FISSO FASULLO] '{numero_telefono}' ->'{numero_pulito}'")
            return None
        return "+" + numero_pulito

    # Caso default: cellulare
    if len(numero_pulito) < 11 or len(numero_pulito) > 13:
        logger.warning(f"[CELL ANOMALO] Orig: '{numero_telefono}' -> '{numero_pulito}'")
        return None

    if is_falso(numero_pulito):
        logger.warning(f"[CELL FASULLO] '{numero_telefono}' -> '{numero_pulito}'")
        return None

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

def calcola_data_richiamo(ultima_visita, mesi_richiamo):
    """
    Calcola la data del prossimo richiamo a partire dalla data dell'ultima visita e dal numero di mesi di intervallo.
    """
    if not ultima_visita or not isinstance(ultima_visita, (datetime, date)) or not mesi_richiamo:
        return None
    try:
        return ultima_visita + timedelta(days=int(mesi_richiamo) * 30)
    except Exception as e:
        logger.warning(f"Errore calcolo data richiamo: {e}")
        return None

def formatta_richiamo_per_frontend_2(record):
    """
    Trasforma un record DBF di richiamo in un dict pronto per il frontend.
    """
    col = COLONNE['richiami']
    col_paz = COLONNE['pazienti']
    id_paziente = record.get(col['id_paziente'])
    tipo_codice = record.get(col['tipo'], '')
    tipi_descrizione = []
    if tipo_codice:
        tipi_descrizione.append(str(tipo_codice))
    telefono = record.get(col_paz.get('telefono', ''), '') or record.get(col_paz.get('cellulare', ''), '')
    stato = 'futuro'
    data_richiamo = record.get(col['data1'])
    oggi = date.today()
    if data_richiamo:
        if data_richiamo < oggi:
            stato = 'scaduto'
        elif (data_richiamo - oggi).days <= 30:
            stato = 'in_scadenza'
    return {
        'id_paziente': id_paziente,
        'tipo_codice': tipo_codice,
        'tipi_descrizione': tipi_descrizione,
        'telefono': normalizza_numero_telefono(telefono),
        'stato': stato,
        'data_richiamo': data_richiamo.strftime('%Y-%m-%d') if isinstance(data_richiamo, (datetime, date)) else data_richiamo,
        # altri campi utili...
    }

def formatta_richiamo_per_frontend(record):
    """
    Trasforma un record DBF di richiamo in un dict pronto per il frontend.
    """
    col = COLONNE['richiami']
    col_paz = COLONNE['pazienti']
    id_paziente = record.get(col['id_paziente'])
    tipo_codice = record.get(col['tipo'], '')
    tipi_descrizione = [str(tipo_codice)] if tipo_codice else []

    # Recupera telefono e cellulare separatamente
    telefono_raw = record.get(col_paz.get('telefono', ''), '')
    cellulare_raw = record.get(col_paz.get('cellulare', ''), '')

    # Prima prova a normalizzare il fisso (origine='telefono'), poi il cellulare
    numero_telefono = normalizza_numero_telefono(telefono_raw, origine='telefono') or \
                      normalizza_numero_telefono(cellulare_raw, origine='cellulare')

    # Calcolo stato richiamo
    stato = 'futuro'
    data_richiamo = record.get(col['data1'])
    oggi = date.today()
    giorni_scadenza = None
    if data_richiamo:
        if data_richiamo < oggi:
            stato = 'scaduto'
            giorni_scadenza = (oggi - data_richiamo).days
        elif (data_richiamo - oggi).days <= 30:
            stato = 'in_scadenza'
            giorni_scadenza = (data_richiamo - oggi).days
        else:
            giorni_scadenza = (data_richiamo - oggi).days

    nome_paziente = record.get(col_paz.get('nome', ''), 'Paziente non specificato').strip()

    mesi_richiamo = record.get(col.get('mesi'), 0)

    risultato = {
        'id_paziente': id_paziente,
        'nome_completo': nome_paziente,
        'tipo_codice': tipo_codice,
        'tipi_descrizione': tipi_descrizione,
        'telefono': numero_telefono,
        'stato': stato,
        'data_richiamo': data_richiamo.strftime('%Y-%m-%d') if isinstance(data_richiamo, (datetime, date)) else None,
        'giorni_scadenza': giorni_scadenza,
        'ultima_visita': record.get(col_paz.get('ultima_visita')).strftime('%Y-%m-%d') if isinstance(record.get(col_paz.get('ultima_visita')), (datetime, date)) else None,
        'mesi_richiamo': int(mesi_richiamo) if mesi_richiamo else 0
    }

    # Debug: salvataggio su file JSON
    try:
        with open("debug_richiamo.json", "a", encoding="utf-8") as f:
            f.write(json.dumps(risultato, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[DEBUG FILE ERROR] {e}")

    return risultato