"""Proposta di classificazione per famiglia di prodotti simili (funzioni pure, solo layer deterministico).

Un prodotto nuovo viene confrontato con i nomi gia' presenti nel catalogo, di qualsiasi fornitore.
I token rari ("RECIPROC") pesano di piu' di quelli comuni ("STERILE"); i token con cifre (colori,
misure: A2, 25MM, 6X) pesano poco perche' le varianti della stessa famiglia li cambiano.
I vicini migliori votano livello per livello (conto, branca, sottoconto): ci si ferma al livello
fino al quale c'e' accordo, quindi una famiglia con sottoconti diversi produce una proposta parziale.
"""
import math
import re
from collections import Counter, defaultdict

from .catalogo_materiali_parser import norm_desc

STOPWORDS = {
    'DA', 'DI', 'DEL', 'DELLA', 'DEI', 'E', 'PER', 'CON', 'IL', 'LA', 'LO', 'LE', 'GLI', 'UN', 'UNA', 'IN', 'AL', 'NEL',
    'X', 'PZ', 'PZ.', 'PEZZI', 'CONF', 'CONFEZIONE', 'MM', 'ML', 'GR', 'G', 'KG', 'CM', 'N', 'NR', 'ART', 'REF', 'COD',
    'TIPO', 'MIS', 'MISURA', 'COPP', 'CONFEZ', 'ST',
}
VARIANT_WEIGHT = 0.35
MIN_SCORE = 0.45
SAME_SUPPLIER_BONUS = 0.05
CODE_PREFIX_BONUS = 0.08   # stesso fornitore e codici con prefisso comune (es. MF7-D08420 / MF7-D06420)
MIN_CODE_PREFIX = 4
MAX_NEIGHBORS = 12
WINDOW = 0.12          # vicini entro questa distanza dal migliore partecipano al voto
CONSENSUS = 0.6        # quota di voto minima per scendere di livello


def stem(token):
    if len(token) > 4 and token[-1] in 'IEOAS':
        return token[:-1]
    return token


def tokens(text):
    """Token normalizzati e senza rumore; i numeri puri sono scartati."""
    result = []
    for raw in re.split(r'[^A-Z0-9]+', norm_desc(text)):
        if len(raw) < 2 or raw in STOPWORDS or raw.isdigit():
            continue
        result.append(stem(raw))
    return result


def common_prefix_len(a, b):
    a, b = re.sub(r'[^A-Z0-9]', '', (a or '').upper()), re.sub(r'[^A-Z0-9]', '', (b or '').upper())
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def _same_code_family(a, b):
    n = common_prefix_len(a, b)
    shortest = min(len(re.sub(r'[^A-Z0-9]', '', (a or '').upper())), len(re.sub(r'[^A-Z0-9]', '', (b or '').upper())))
    return shortest > 0 and n >= MIN_CODE_PREFIX and n >= 0.5 * shortest


def _is_variant(token):
    return any(ch.isdigit() for ch in token)


class FamilyIndex:
    """Indice sui nomi del catalogo. entries: dict con prodotto_id, nome, fornitore_id, contoid, brancaid, sottocontoid."""

    def __init__(self, entries):
        self.entries = []
        df = Counter()
        for e in entries:
            toks = set(tokens(e['nome']))
            if not toks:
                continue
            self.entries.append({**e, 'toks': toks})
            df.update(toks)
        total = len(self.entries)
        self.idf = {t: math.log((total + 1) / (n + 1)) + 1 for t, n in df.items()}

    def _weight(self, token):
        base = self.idf.get(token, math.log(len(self.entries) + 2) + 1)  # token mai visto: raro
        return base * (VARIANT_WEIGHT if _is_variant(token) else 1.0)

    def _score(self, new_tokens, entry):
        shared = new_tokens & entry['toks']
        if not shared or all(_is_variant(t) for t in shared):
            return 0.0
        w_shared = sum(self._weight(t) for t in shared)
        w_new = sum(self._weight(t) for t in new_tokens)
        w_entry = sum(self._weight(t) for t in entry['toks'])
        return 0.7 * (w_shared / w_new) + 0.3 * (w_shared / w_entry)

    def neighbors(self, name, fornitore_id=None, exclude_product=None, codice=None):
        new_tokens = set(tokens(name))
        if not new_tokens:
            return []
        best = {}
        for e in self.entries:
            if e['prodotto_id'] == exclude_product:
                continue
            score = self._score(new_tokens, e)
            if fornitore_id and e.get('fornitore_id') == fornitore_id and score > 0:
                score = min(1.0, score + SAME_SUPPLIER_BONUS)
                if codice and _same_code_family(codice, e.get('codice')):
                    score = min(1.0, score + CODE_PREFIX_BONUS)
            if score > 0 and score > best.get(e['prodotto_id'], (0, None, None))[0]:
                best[e['prodotto_id']] = (score, e, frozenset(new_tokens & e['toks']))
        ranked = sorted(best.values(), key=lambda x: -x[0])
        if not ranked or ranked[0][0] < MIN_SCORE:
            return []
        top_shared = ranked[0][2]
        # restano i vicini sopra soglia e quelli che condividono gli stessi token del migliore
        return [r for r in ranked if r[0] >= MIN_SCORE or r[2] == top_shared][:MAX_NEIGHBORS]

    def propose(self, name, fornitore_id=None, exclude_product=None, codice=None):
        ranked = self.neighbors(name, fornitore_id, exclude_product, codice)
        if not ranked:
            return None
        top, _, top_shared = ranked[0]
        # votano i vicini quasi pari al migliore e quelli che condividono gli stessi token del migliore:
        # la differenza di punteggio tra loro dipende solo dalla lunghezza del resto del nome.
        voters = [(s, e) for s, e, shared in ranked if top - s <= WINDOW or shared == top_shared]
        result = {'contoid': None, 'brancaid': None, 'sottocontoid': None}
        pool = voters
        depth = 0
        for level in ('contoid', 'brancaid', 'sottocontoid'):
            votes = defaultdict(float)
            for score, e in pool:
                votes[e[level]] += score * score
            total = sum(votes.values())
            winner, weight = max(votes.items(), key=lambda kv: kv[1])
            if winner is None or weight / total < CONSENSUS:
                break
            result[level] = winner
            pool = [(s, e) for s, e in pool if e[level] == winner]
            depth += 1
        if depth == 0:
            return None
        riferimenti = [e['nome'] for _, e in pool[:3]]
        # Confidenza calibrata sul catalogo (leave-one-out): una proposta completa e' giusta circa 94% delle volte,
        # quasi a prescindere dal punteggio; gli errori sono soprattutto incoerenze gia' presenti nel catalogo.
        # Piu' vicini d'accordo e nomi molto simili alzano la fiducia, la profondita' ridotta la abbassa.
        vicini = len(pool)
        if depth == 3:
            confidence = 90 + (4 if vicini >= 3 else 0) + (3 if top >= 0.8 else 0)
        elif depth == 2:
            confidence = 78 + (4 if vicini >= 3 else 0)
        else:
            confidence = 62
        return {**result, 'depth': depth, 'score': round(top, 3), 'confidence': confidence, 'riferimenti': riferimenti,
                'vicini': len(pool)}
