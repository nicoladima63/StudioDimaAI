import re


DOMAIN_ALIASES = {
    "calendario": ["calendar"],
    "calendari": ["calendar", "calendars"],
    "calendar": ["calendario"],
    "lavorazione": ["work", "works"],
    "lavorazioni": ["work", "works"],
    "work": ["lavorazione", "lavorazioni"],
    "works": ["work", "lavorazione", "lavorazioni"],
    "paziente": ["patient", "patients"],
    "pazienti": ["patient", "patients"],
    "patient": ["paziente", "pazienti"],
    "patients": ["patient", "paziente", "pazienti"],
    "ricetta": ["prescription"],
    "ricette": ["prescription", "prescriptions"],
    "prescription": ["ricetta", "ricette"],
    "prescriptions": ["prescription", "ricetta", "ricette"],
    "notifica": ["notification", "notifications", "push"],
    "notifiche": ["notification", "notifications", "push"],
    "notification": ["notifica", "notifiche", "push"],
    "notifications": ["notification", "notifica", "notifiche", "push"],
    "richiamo": ["recall", "reminder"],
    "richiami": ["recall", "reminder", "reminders"],
    "recall": ["richiamo", "richiami"],
    "reminder": ["richiamo", "richiami"],
    "reminders": ["reminder", "richiamo", "richiami"],
    "impostazione": ["setting", "settings"],
    "impostazioni": ["setting", "settings"],
    "setting": ["impostazione", "impostazioni"],
    "settings": ["setting", "impostazione", "impostazioni"],
    "fornitore": ["provider", "supplier", "vendor"],
    "fornitori": ["provider", "providers", "supplier", "suppliers", "vendor", "vendors"],
    "provider": ["fornitore", "fornitori"],
    "providers": ["provider", "fornitore", "fornitori"],
    "spesa": ["expense", "expenses"],
    "spese": ["expense", "expenses"],
    "expense": ["spesa", "spese"],
    "expenses": ["expense", "spesa", "spese"],
}


def _base_form(word):
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"

    if (
        word.endswith("s")
        and not word.endswith(("ss", "us", "is"))
    ):
        return word[:-1]

    return word


def _add_unique(terms, word):
    if word and word not in terms:
        terms.append(word)


def tokenize_text(text):
    spaced = re.sub(
        r"(?<=[a-z0-9])(?=[A-Z])",
        " ",
        str(text)
    )
    raw_words = re.findall(
        r"[A-Za-z0-9]+",
        spaced
    )

    terms = []

    for raw_word in raw_words:
        word = raw_word.lower()

        if len(word) <= 2:
            continue

        _add_unique(terms, word)
        _add_unique(terms, _base_form(word))

    return terms


def matched_terms(text, query_terms):
    text_terms = set(
        tokenize_text(text)
    )

    return [
        term for term in query_terms
        if term in text_terms
    ]


def text_matches_query(text, query_terms):
    return bool(
        matched_terms(
            text,
            query_terms
        )
    )


def related_terms(term):
    related = []
    _add_unique(related, term)

    for alias in DOMAIN_ALIASES.get(term, []):
        _add_unique(related, alias)

    for source, aliases in DOMAIN_ALIASES.items():
        if term in aliases:
            _add_unique(related, source)

            for alias in aliases:
                _add_unique(related, alias)

    return related


def normalize_query_terms(query):

    terms = []

    for word in tokenize_text(query):

        if len(word) <= 2:
            continue

        word = _base_form(word)

        _add_unique(terms, word)

        for alias in DOMAIN_ALIASES.get(word, []):
            _add_unique(terms, alias)

    return terms
