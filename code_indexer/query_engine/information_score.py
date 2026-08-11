from collections import defaultdict
from .query_terms import matched_terms, normalize_query_terms


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


def _query_words(query):
    return normalize_query_terms(query)



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

    query_words = _query_words(query)

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

    score += 6 * len(
        matched_terms(
            file_text,
            query_words
        )
    )

    file_symbols = [
        s for s in symbols
        if s.get("path") == file.get("path")
    ]

    symbol_text = " ".join(
        str(symbol.get("name", ""))
        for symbol in file_symbols
    ).lower()

    score += 4 * len(
        matched_terms(
            symbol_text,
            query_words
        )
    )

    return min(
        score,
        20
    )


def calculate_score_breakdown(
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

    query_words = _query_words(query)
    file_text = " ".join(
        [
            str(file.get("id", "")),
            str(file.get("path", "")),
            str(file.get("role", ""))
        ]
    ).lower()

    file_symbols = [
        symbol for symbol in symbols
        if symbol.get("path") == file.get("path")
    ]

    symbol_text = " ".join(
        str(symbol.get("name", ""))
        for symbol in file_symbols
    ).lower()

    matched_query_terms = []

    for word in matched_terms(file_text, query_words):
        if word not in matched_query_terms:
            matched_query_terms.append(word)

    for word in matched_terms(symbol_text, query_words):
        if word not in matched_query_terms:
            matched_query_terms.append(word)

    query_relevance = calculate_query_relevance(
        file,
        symbols,
        query
    )

    return {
        "structural_score": structural_score,
        "query_relevance": query_relevance,
        "information_score": structural_score + query_relevance,
        "matched_query_terms": matched_query_terms
    }


def calculate_information_score(
    file,
    connections,
    symbols,
    query=""
):
    breakdown = calculate_score_breakdown(
        file,
        connections,
        symbols,
        query
    )

    return breakdown["information_score"]
