from .information_score import calculate_information_score, calculate_score_breakdown
from .symbol_score import calculate_symbol_score
from .symbol_classifier import classify_symbol


GENERIC_PATHS = {
    'components/ui', 'components/modals', 'components/tables', 'components/layout',
    'components/selects', 'services/api/client.ts', 'store/prestazioni.store.ts',
}
EXCLUDED_ROLES = {'configuration', 'unknown', 'certificate'}


def is_generic_file(file):
    path = file.get('path', '').replace('\\', '/')
    return any(item in path for item in GENERIC_PATHS)


def _can_expand(file):
    return file.get('role') not in EXCLUDED_ROLES and not is_generic_file(file)


def expand_context(matched_files, files, entities, relationships, query='', depth=1):
    """Build a compact context by following internal imports in both directions."""
    file_map = {file['id']: file for file in files}
    selected_ids = {file['id'] for file in matched_files}
    connections = []
    visited = set(selected_ids)
    frontier = set(selected_ids)

    for _ in range(depth):
        next_frontier = set()
        for relation in relationships:
            if relation.get('relation') != 'imports' or relation.get('resolved') is not True:
                continue
            source = relation.get('source')
            target = relation.get('target')
            if source not in frontier and target not in frontier:
                continue
            connections.append(relation)
            connected = target if source in frontier else source
            file = file_map.get(connected)
            if file and connected not in visited and _can_expand(file):
                visited.add(connected)
                next_frontier.add(connected)
        frontier = next_frontier
        if not frontier:
            break

    context_files = [file_map[file_id] for file_id in visited if file_id in file_map]
    selected_paths = {file['path'] for file in context_files}
    file_scores = {
        file['path']: calculate_information_score(file, connections, [], query)
        for file in context_files
    }
    context_symbols = []
    for entity in entities:
        if entity.get('path') not in selected_paths:
            continue
        scored = dict(entity)
        scored['information_score'] = calculate_symbol_score(
            scored, query, file_scores.get(scored.get('path'), 0)
        )
        scored['category'] = classify_symbol(scored)
        context_symbols.append(scored)

    context_symbols.sort(key=lambda item: item.get('information_score', 0), reverse=True)
    for file in context_files:
        file.update(calculate_score_breakdown(file, connections, context_symbols, query))
    context_files.sort(key=lambda item: item.get('information_score', 0), reverse=True)

    return {'files': context_files, 'symbols': context_symbols, 'connections': connections}
