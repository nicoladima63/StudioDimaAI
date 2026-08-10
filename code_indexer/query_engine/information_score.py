from collections import defaultdict


ROLE_VALUE = {

    "service": 10,
    "api": 9,
    "repository": 8,
    "state": 7,
    "feature": 6,
    "page": 5,
    "component": 4,
    "hook": 4,
    "utility": 2,
    "types": 2,
    "configuration": 0,
    "unknown": 0
}



def calculate_structural_score(
    file,
    connections,
    symbols
):

    score = 0


    # valore architetturale

    score += ROLE_VALUE.get(
        file.get("role"),
        1
    )


    file_id = file.get("id")


    # connessioni

    for relation in connections:

        if (
            relation.get("source") == file_id
            or
            relation.get("target") == file_id
        ):
            score += 2


    # densità simboli

    file_symbols = [
        s for s in symbols
        if s.get("path") == file.get("path")
    ]


    score += min(
        len(file_symbols),
        10
    )


    return score


def calculate_query_relevance(
    file,
    symbols,
    query=""
):

    query_words = [
        word
        for word in query.lower().split()
        if len(word) > 2
    ]

    if not query_words:
        return 0

    score = 0

    file_text = " ".join(
        [
            str(file.get("id", "")),
            str(file.get("path", "")),
            str(file.get("role", ""))
        ]
    ).lower()

    for word in query_words:

        if word in file_text:
            score += 6

    file_symbols = [
        s for s in symbols
        if s.get("path") == file.get("path")
    ]

    symbol_text = " ".join(
        str(symbol.get("name", ""))
        for symbol in file_symbols
    ).lower()

    for word in query_words:

        if word in symbol_text:
            score += 4

    return min(
        score,
        20
    )


def calculate_information_score(
    file,
    connections,
    symbols,
    query=""
):

    structural_score = calculate_structural_score(
        file,
        connections,
        symbols
    )

    query_relevance = calculate_query_relevance(
        file,
        symbols,
        query
    )

    return structural_score + query_relevance
