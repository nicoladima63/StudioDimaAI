import re
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
import sys
import os

# Aggiungi il path per gli import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.config.constants import COLONNE, TIPO_RICHIAMI
except ImportError:
    # Fallback per esecuzione diretta
    from config.constants import COLONNE, TIPO_RICHIAMI


def normalizza_numero_telefono(numero_telefono: str) -> Optional[str]:
    """
    Normalizza un numero di telefono nel formato internazionale italiano (+39...)
    """
    if not numero_telefono or numero_telefono.strip() == '':
        return None
    
    numero_pulito = re.sub(r'[^\d+]', '', str(numero_telefono)).lstrip('+')
    
    # Gestione numeri italiani
    if numero_pulito.startswith('00'):
        numero_pulito = numero_pulito[2:]
    
    # Se inizia con 39, è già nel formato corretto
    if numero_pulito.startswith('39'):
        numero_pulito = numero_pulito
    # Se inizia con 3 e ha 10 cifre, aggiungi 39
    elif numero_pulito.startswith('3') and len(numero_pulito) == 10:
        numero_pulito = '39' + numero_pulito
    # Se ha 10 cifre e inizia con 3, aggiungi 39
    elif len(numero_pulito) == 10 and numero_pulito.startswith('3'):
        numero_pulito = '39' + numero_pulito
    # Se ha 9 cifre e inizia con 3, aggiungi 39
    elif len(numero_pulito) == 9 and numero_pulito.startswith('3'):
        numero_pulito = '39' + numero_pulito
    # Altrimenti, aggiungi 39 se non è già presente
    elif not numero_pulito.startswith('39'):
        numero_pulito = '39' + numero_pulito
    
    # Validazione lunghezza finale - accetta anche 10 cifre (39xxxxxxxxx)
    if len(numero_pulito) < 10 or len(numero_pulito) > 13:
        logging.warning(f"Numero {numero_telefono} -> {numero_pulito} ha lunghezza anomala ({len(numero_pulito)} cifre)")
        return None
    
    return '+' + numero_pulito


def costruisci_messaggio_richiamo(richiamo: Dict[str, Any]) -> str:
    """
    Costruisce un messaggio personalizzato per il richiamo del paziente
    """
    col = COLONNE['richiami']
    try:
        nome = richiamo.get('nome_completo', 'Gentile paziente')
        tipo_stringa = richiamo.get(col['tipo'], '')
        tipi_descrizione = get_descrizione_tipi_richiamo(tipo_stringa)
        data_richiamo = richiamo.get(col['data1'])
        
        if isinstance(data_richiamo, (datetime, date)):
            data_str = data_richiamo.strftime('%d/%m/%Y')
        else:
            data_str = 'una prossima data'
        
        # Gestisce tipi multipli
        if len(tipi_descrizione) > 1:
            tipo_text = f"richiami ({', '.join(tipi_descrizione)})"
        elif len(tipi_descrizione) == 1:
            tipo_text = f"richiamo ({tipi_descrizione[0]})"
        else:
            tipo_text = "richiamo"
        
        return (
            f"Ciao {nome},\n"
            f"Ti ricordiamo che è tempo per il tuo {tipo_text}.\n"
            f"Ti proponiamo un appuntamento intorno al {data_str}.\n"
            f"Contattaci per fissarlo. Grazie!"
        )
    except Exception as e:
        logging.error(f"Errore costruzione messaggio richiamo: {str(e)}")
        return "Gentile paziente, è il momento di programmare un richiamo. Contattaci per fissare l'appuntamento."


def calcola_data_richiamo(ultima_visita: date, mesi_richiamo: int) -> date:
    """
    Calcola la data del prossimo richiamo basandosi sull'ultima visita e i mesi di richiamo
    """
    if not ultima_visita or not mesi_richiamo:
        return None
    
    try:
        return ultima_visita + timedelta(days=mesi_richiamo * 30)
    except Exception as e:
        logging.error(f"Errore calcolo data richiamo: {str(e)}")
        return None


def formatta_richiamo_per_frontend(richiamo: Dict[str, Any]) -> Dict[str, Any]:
    """
    Formatta i dati del richiamo per il frontend, valorizzando sempre i campi e aggiungendo fallback chiari.
    """
    col = COLONNE['richiami']
    # Telefono: prima cellulare, poi telefono fisso
    telefono = richiamo.get('DB_PACELLU') or richiamo.get('DB_PATELEF') or ''
    telefono_norm = normalizza_numero_telefono(telefono)
    tipo_stringa = richiamo.get(col['tipo'], '')
    tipi_codice = decodifica_tipi_richiamo(tipo_stringa)
    tipi_descrizione = get_descrizione_tipi_richiamo(tipo_stringa)
    mesi_richiamo = richiamo.get(col['mesi'], 0)
    return {
        'id_paziente': richiamo.get(col['id_paziente']),
        'nome_completo': richiamo.get('DB_PANOME', ''),
        'telefono': telefono_norm or '-',
        'tipo_codice': tipo_stringa or '',
        'tipi_codice': tipi_codice,
        'tipo_descrizione': ', '.join(tipi_descrizione) if tipi_descrizione else 'Nessun tipo assegnato',
        'tipi_descrizione': tipi_descrizione if tipi_descrizione else ['Nessun tipo assegnato'],
        'mesi_richiamo': mesi_richiamo,
        'ultima_visita': richiamo.get(col['ultima_visita']),
        'data_richiamo': richiamo.get(col['data1']) or 'Non disponibile',
        'data_richiamo_2': richiamo.get(col['data2']) or 'Non disponibile',
        'da_richiamare': richiamo.get(col['da_richiamare'], False),
        'giorni_scadenza': calcola_giorni_scadenza(richiamo.get(col['data1'])),
        'stato': determina_stato_richiamo(richiamo.get(col['data1'])) if richiamo.get(col['data1']) else 'non calcolabile'
    }


def calcola_giorni_scadenza(data_richiamo: date) -> int:
    """
    Calcola quanti giorni mancano alla scadenza del richiamo
    """
    if not data_richiamo:
        return None
    
    oggi = date.today()
    delta = data_richiamo - oggi
    return delta.days


def determina_stato_richiamo(data_richiamo: date) -> str:
    """
    Determina lo stato del richiamo: 'scaduto', 'in_scadenza', 'futuro'
    """
    if not data_richiamo:
        return 'sconosciuto'
    
    giorni = calcola_giorni_scadenza(data_richiamo)
    
    if giorni < 0:
        return 'scaduto'
    elif giorni <= 30:
        return 'in_scadenza'
    else:
        return 'futuro'


def decodifica_tipi_richiamo(tipo_stringa: str) -> List[str]:
    """
    Decodifica i tipi di richiamo da una stringa (es. "21" -> ["2", "1"])
    Gestisce anche stringhe con spazi (es. "1 1" -> ["1"])
    """
    if not tipo_stringa:
        return []
    # Rimuove spazi e caratteri non numerici
    tipo_str = re.sub(r'[^0-9]', '', str(tipo_stringa))
    # Ogni cifra rappresenta un tipo
    tipi = list(sorted(set(tipo_str)))
    return tipi


def get_descrizione_tipi_richiamo(tipo_stringa: str) -> List[str]:
    """
    Ottiene le descrizioni dei tipi di richiamo da una stringa
    """
    tipi_codice = decodifica_tipi_richiamo(tipo_stringa)
    descrizioni = []
    for codice in tipi_codice:
        descrizione = TIPO_RICHIAMI.get(codice, f'Tipo {codice}')
        descrizioni.append(descrizione)
    return descrizioni 