"""Lettura delle righe fattura Windent (VOCISPES) per il catalogo materiali. Funzioni pure, senza I/O.

Windent appiattisce CodiceTipo/CodiceValore dell'XML in una riga ausiliaria "<tipo> <valore>"
(quantita e prezzo 0) prima della riga prodotto; per alcuni fornitori il codice e' invece il primo
token della descrizione.
"""
import re
import unicodedata

# Ordine = priorita' del tipo di codice quando una riga prodotto ne ha piu' di uno.
TIPI_CODICE = ['Codice Art. fornitore', 'SKU', 'COD_FORNITORE', 'REF', 'AswArtFor', 'Cod.', 'Codice interno', 'EAN']

_TIPO_RE = re.compile(r'^(' + '|'.join(re.escape(t) for t in TIPI_CODICE) + r')\s*:?\s*(\S+)$', re.I)
_TESTA_RE = re.compile(r'^([A-Za-z0-9/][A-Za-z0-9\-\./,]{2,14})\s+(\S.*)$')
_LOTTO_RE = re.compile(r'\s*[-,;/]?\s*\bLOTTO\b\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-/\.]*).*$', re.I)
_LOTTO_AUX_RE = re.compile(r'^Lotto\s+(\S+)', re.I)
_PAZIENTE_RE = re.compile(r'\bPAZIENTE\b|\bPAZ\.|\bRIF\.?\s*DDT\b', re.I)
_NON_MATERIALE_RE = re.compile(
    r'(^/[A-Z]\d*\b)|\b(SPESE|TRAN?S?PORT\w*|IMBALL\w*|SPEDIZ\w*|ADDEBITO|BOLLO|BOLLI|SCONTO|ABBUONO|CONTRIBUTO|'
    r'CONTRASSEGNO|INCASSO|AMMINISTRAZIONE|MINIMO ORDINE|ARROTONDAMENT\w*|CORSO|CATALOGO)\b')


def norm_desc(text):
    """Maiuscolo, senza accenti, spazi singoli. La punteggiatura resta: fa parte della descrizione."""
    text = unicodedata.normalize('NFKD', str(text or '')).encode('ascii', 'ignore').decode()
    return ' '.join(text.upper().split())


def norm_code(text):
    return re.sub(r'\s+', '', str(text or '').upper())


def strip_lotto(name):
    """Toglie il suffisso 'Lotto: ...' dalla descrizione. Ritorna (nome, lotto)."""
    match = _LOTTO_RE.search(name)
    if not match:
        return name.strip(), ''
    return name[:match.start()].strip(' -,;/'), match.group(1)


def is_paziente(text):
    return bool(_PAZIENTE_RE.search(text or ''))


def is_non_materiale(text):
    return bool(_NON_MATERIALE_RE.search((text or '').upper()))


def parse_invoice_lines(lines, code_in_head=False):
    """Trasforma le righe di UNA fattura (in ordine) in righe classificate.

    lines: lista di dict con chiavi desc, qta, prezzo, sconto.
    Ritorna lista di dict con kind in prodotto | non_materiale | paziente | reso.
    Per kind=paziente la descrizione non e' mai riportata.
    """
    out, pending, last_product = [], [], None
    for index, line in enumerate(lines):
        desc = str(line.get('desc') or '').strip()
        qta, prezzo = line.get('qta') or 0, line.get('prezzo') or 0
        if qta == 0 and prezzo == 0:
            lotto = _LOTTO_AUX_RE.match(desc)
            if lotto and last_product is not None and not last_product['lotto']:
                last_product['lotto'] = lotto.group(1)
            else:
                pending.append(desc)
            continue
        base = {'riga': index, 'quantita': qta, 'prezzo': prezzo, 'sconto': line.get('sconto') or 0}
        if is_paziente(desc) or any(is_paziente(a) for a in pending):
            out.append({**base, 'kind': 'paziente'})
            pending, last_product = [], None
            continue
        if is_non_materiale(desc):
            out.append({**base, 'kind': 'non_materiale', 'nome': desc})
            pending, last_product = [], None
            continue
        if prezzo < 0 or qta < 0:
            out.append({**base, 'kind': 'reso', 'nome': desc})
            pending, last_product = [], None
            continue
        code, name = '', desc
        if code_in_head:
            match = _TESTA_RE.match(desc)
            if match and re.search(r'\d', match.group(1)):
                code, name = match.group(1), match.group(2)
        else:
            found = {}
            for aux in pending:
                match = _TIPO_RE.match(aux)
                if match:
                    found.setdefault(match.group(1).lower(), match.group(2))
            for tipo in TIPI_CODICE:
                if tipo.lower() in found:
                    code = found[tipo.lower()]
                    break
        name, lotto = strip_lotto(name)
        last_product = {**base, 'kind': 'prodotto', 'codice': code, 'nome': name, 'lotto': lotto, 'originale': desc}
        out.append(last_product)
        pending = []
    return out
