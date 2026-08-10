from pathlib import Path


def build_entity(symbol):

    entity_id = (
        f"{symbol['language']}:"
        f"{symbol['symbol_type']}:"
        f"{symbol['name']}"
    )

    return {
        "id": entity_id,
        "name": symbol["name"],
        "kind": symbol["symbol_type"],
        "language": symbol["language"],
        "path": symbol["file"],
        "line": symbol["line"],
        "summary": None
    }


def build_entities(symbols):

    entities = []

    for symbol in symbols:
        entities.append(
            build_entity(symbol)
        )

    return entities