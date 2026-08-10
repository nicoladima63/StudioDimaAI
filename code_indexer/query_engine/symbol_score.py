ROLE_VALUE = {

    "class": 15,
    "function": 8,
    "method": 8,
    "component": 7,
    "hook": 7,
    "variable": 2,
    "constant": 1
}



def calculate_symbol_score(
    symbol,
    query,
    file_score=0
):

    score = 0


    kind = symbol.get(
        "kind",
        ""
    )


    name = symbol.get(
        "name",
        ""
    )


    name_lower = name.lower()


    score += ROLE_VALUE.get(
        kind,
        1
    )


    # nomi privati = dettagli interni

    if name.startswith("_"):
        score -= 15


    # gestione errori e validazioni

    technical_names = [
        "error",
        "exception",
        "validate",
        "format",
        "handle",
        "parse",
        "toggle",
        "reset",
        "close",
        "set",
        "gettokens"
    ]

    if any(
        x in name_lower
        for x in technical_names
    ):
        score -= 10



    # corrispondenza query

    for word in query.lower().split():

        if word in name_lower:
            score += 15



    # eredita importanza file

    score += file_score


    return score