"""
Anagrafica prime visite: recupero da Gmail dell'email del modulo del sito.

Il sito (studiodimartino-next) manda a "segreteria" un'email con oggetto
"Nuova anagrafica paziente - <Cognome> <Nome>" e corpo in righe "Etichetta: valore".
Qui la si collega al messaggio con il link al modulo inviato dall'automazione.
"""
import re
from datetime import datetime, timezone
from typing import Any, Dict, List

ANAGRAFICA_SUBJECT = 'Nuova anagrafica paziente'

# Stesse etichette e stesso ordine di src/app/api/anagrafica/route.js del sito
ANAGRAFICA_LABELS = [
    'Cognome', 'Nome', 'Data di nascita', 'Comune di nascita', 'Codice fiscale', 'Sesso',
    'Indirizzo', 'CAP', 'Citta', 'Provincia', 'Cellulare', 'Email', 'Informativa privacy',
]

EMPTY_VALUE = '-'  # lo stesso segnaposto che scrive il sito per un campo vuoto
MAX_CANDIDATES = 15
# chi compila il modulo lo fa entro pochi giorni: senza un limite superiore le email recenti riempiono le 15 candidate e quelle piu' vecchie spariscono
SEARCH_WINDOW_DAYS = 30
PHONE_DIGITS_COMPARED = 9


def parse_anagrafica_text(body_text: Any) -> List[Dict[str, str]]:
    """I 13 campi nell'ordine fisso; un campo non trovato vale '-'."""
    found: Dict[str, str] = {}
    for line in str(body_text or '').splitlines():
        for label in ANAGRAFICA_LABELS:
            prefix = f'{label}: '
            if line.startswith(prefix) and label not in found:
                found[label] = line[len(prefix):].strip() or EMPTY_VALUE
                break
    return [{'label': label, 'value': found.get(label, EMPTY_VALUE)} for label in ANAGRAFICA_LABELS]


def _digits(value: Any) -> str:
    return re.sub(r'\D', '', str(value or ''))


def phone_matches(recipient: Any, cellulare: Any) -> bool:
    """Stesse ultime 9 cifre: ignora +39, spazi e simboli."""
    a, b = _digits(recipient), _digits(cellulare)
    if len(a) < PHONE_DIGITS_COMPARED or len(b) < PHONE_DIGITS_COMPARED:
        return False
    return a[-PHONE_DIGITS_COMPARED:] == b[-PHONE_DIGITS_COMPARED:]


def _created_at_epoch(created_at: Any) -> int:
    """created_at del registro e' UTC senza offset ('YYYY-MM-DD HH:MM:SS')."""
    parsed = datetime.strptime(str(created_at).replace('T', ' ')[:19], '%Y-%m-%d %H:%M:%S')
    return int(parsed.replace(tzinfo=timezone.utc).timestamp())


def find_submissions(row: Dict[str, Any], email_service) -> List[Dict[str, Any]]:
    """Anagrafiche arrivate dopo l'invio del messaggio `row`, con prime quelle dello stesso numero.

    Niente '-from:me' ne' 'in:inbox': il sito puo' spedire dalla stessa casella e la
    posta puo' essere archiviata.
    """
    sent = _created_at_epoch(row["created_at"])
    query = f'subject:"{ANAGRAFICA_SUBJECT}" after:{sent} before:{sent + SEARCH_WINDOW_DAYS * 86400}'
    summaries = email_service.get_emails(max_results=MAX_CANDIDATES, query=query).get('emails', [])

    submissions: List[Dict[str, Any]] = []
    for summary in summaries:
        detail = email_service.get_email_detail(summary['id'])
        fields = parse_anagrafica_text(detail.get('body_text', ''))
        if all(field['value'] == EMPTY_VALUE for field in fields):
            continue  # non e' un modulo leggibile
        cellulare = next(field['value'] for field in fields if field['label'] == 'Cellulare')
        submissions.append({
            'email_id': summary['id'],
            'received_at': detail.get('date', ''),
            'phone_match': phone_matches(row.get('recipient'), cellulare),
            'fields': fields,
        })

    # Ordinamento stabile: Gmail restituisce gia' le piu' recenti per prime
    submissions.sort(key=lambda submission: not submission['phone_match'])
    return submissions
