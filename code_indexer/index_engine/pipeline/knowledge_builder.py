from collections import Counter, defaultdict
from pathlib import Path


def _feature_name(path: str) -> str | None:
    parts = Path(path).parts
    if 'features' in parts:
        index = parts.index('features')
        if len(parts) > index + 1:
            return parts[index + 1]
    return None


def build_features(files, entities, relationships):
    """Group frontend feature folders into first-class KB concepts."""
    groups = defaultdict(list)
    for file in files:
        feature = _feature_name(file['path'])
        if feature:
            groups[feature].append(file)

    features = []
    for name, feature_files in sorted(groups.items()):
        paths = {file['path'] for file in feature_files}
        features.append({
            'id': f'feature:{name}',
            'name': name,
            'files': sorted(paths),
            'roles': dict(Counter(file['role'] for file in feature_files)),
            'entities_count': sum(entity['path'] in paths for entity in entities),
            'relationships_count': sum(
                relation.get('source', '').removeprefix('file:') in paths
                for relation in relationships
            ),
        })
    return features


def build_summaries(files, entities, relationships):
    """Produce deterministic summaries usable without an LLM generation pass."""
    symbols_by_path = defaultdict(list)
    for entity in entities:
        symbols_by_path[entity['path']].append(entity['name'])

    imports_by_path = Counter(
        relation.get('source', '').removeprefix('file:')
        for relation in relationships
        if relation.get('relation') == 'imports'
    )

    return [
        {
            'path': file['path'],
            'role': file['role'],
            'summary': (
                f"{file['role']} {file['language']} con "
                f"{file['symbols_count']} simboli e {imports_by_path[file['path']]} import."
            ),
            'symbols': sorted(symbols_by_path[file['path']])[:20],
        }
        for file in files
    ]
