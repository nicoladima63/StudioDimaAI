def build_entity(symbol):
    """Create a stable, repository-wide unique entity for a parsed symbol."""
    entity_id = ':'.join((
        symbol['language'],
        symbol['symbol_type'],
        symbol['file'],
        str(symbol['line']),
        symbol['name'],
    ))
    return {
        'id': entity_id,
        'name': symbol['name'],
        'kind': symbol['symbol_type'],
        'language': symbol['language'],
        'path': symbol['file'],
        'line': symbol['line'],
        'summary': None,
    }


def build_entities(symbols):
    return [build_entity(symbol) for symbol in symbols]
