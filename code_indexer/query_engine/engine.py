"""Public Query Engine API and CLI for the code knowledge base."""

import argparse
import json
import re
from pathlib import Path

from .context import expand_context
from .formatter import format_context
from .prompt_builder import build_prompt_context
from .query_terms import normalize_query_terms, text_matches_query
from .ranker import rank_files


PROJECT_ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE = PROJECT_ROOT / 'knowledge' / 'output'
CONTEXT_CACHE = PROJECT_ROOT / 'knowledge' / 'context_cache'


def load_json(name, default=None):
    try:
        return json.loads((KNOWLEDGE / name).read_text(encoding='utf-8'))
    except FileNotFoundError:
        if default is not None:
            return default
        raise RuntimeError('Knowledge Base non trovata: esegui `python -m code_indexer index` prima della query.')


def search_text(query, items, fields):
    query_words = normalize_query_terms(query)
    return [
        item for item in items
        if text_matches_query(' '.join(str(item.get(field, '')) for field in fields).lower(), query_words)
    ]


def find_entity(term, limit=20):
    return search_text(term, load_json('entities.json'), ['name', 'path', 'kind'])[:limit]


def find_file(term, limit=20, include_tests=False):
    files = search_text(term, load_json('files.json'), ['path', 'role'])
    if not include_tests:
        files = [file for file in files if file.get('role') != 'test']
    return rank_files(files, term)[:limit]


def find_feature(term, limit=20):
    return search_text(term, load_json('features.json', []), ['name', 'files'])[:limit]


def _file_id(value):
    return value if value.startswith('file:') else f'file:{value}'


def find_dependencies(path, limit=30):
    source = _file_id(path)
    relationships = load_json('resolved_relationships.json', [])
    return [relation for relation in relationships if relation.get('source') == source][:limit]


def find_callers(path, limit=30):
    target = _file_id(path)
    relationships = load_json('resolved_relationships.json', [])
    return [relation for relation in relationships if relation.get('target') == target][:limit]


def _save_context(term, text, packet):
    CONTEXT_CACHE.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', term.lower()).strip('_') or 'query'
    text_path = CONTEXT_CACHE / f'{slug}.txt'
    packet_path = CONTEXT_CACHE / f'{slug}.json'
    text_path.write_text(text, encoding='utf-8')
    packet_path.write_text(json.dumps(packet, indent=2, ensure_ascii=False), encoding='utf-8')
    return text_path, packet_path


def build_context(task, limit=12, include_tests=False):
    """Return a compact, agent-ready task packet for a domain or natural-language task."""
    files = load_json('files.json')
    entities = load_json('entities.json')
    relationships = load_json('resolved_relationships.json', [])
    semantic_relationships = load_json('semantic_relationships.json', [])
    matches = search_text(task, files, ['path', 'role'])
    if not include_tests and 'test' not in normalize_query_terms(task):
        matches = [file for file in matches if file.get('role') != 'test']
    matched_files = rank_files(matches, task)[:limit]
    context = expand_context(matched_files, files, entities, relationships, task)
    formatted = format_context(context)
    formatted.query = task

    selected_paths = {file['path'] for file in formatted.focus_files or formatted.files}
    selected_ids = {f'file:{path}' for path in selected_paths}
    relevant_semantic = [
        relation for relation in semantic_relationships
        if relation.get('source') in selected_ids
        or any(entity['id'] == relation.get('source') and entity['path'] in selected_paths for entity in entities)
    ]
    manifest = load_json('index_manifest.json', {})
    packet = {
        'schema_version': 1,
        'task': task,
        'files': [
            {
                'path': file['path'],
                'role': file.get('role'),
                'score': file.get('information_score', 0),
                'matched_terms': file.get('matched_query_terms', []),
                'dependencies': [item['target'] for item in find_dependencies(file['path'], 10)],
                'callers': [item['source'] for item in find_callers(file['path'], 10)],
            }
            for file in (formatted.focus_files or formatted.files)[:limit]
        ],
        'symbols': formatted.symbols[:30],
        'connections': formatted.connections[:50],
        'semantic_relationships': relevant_semantic[:50],
        'features': find_feature(task),
        'index': {
            'schema_version': manifest.get('schema_version'),
            'project_root': manifest.get('project_root'),
            'indexed_files': len(manifest.get('files', {})),
        },
    }
    prompt = build_prompt_context(formatted)
    text_path, packet_path = _save_context(task, prompt, packet)
    formatted.context_file = str(text_path)
    packet['context_file'] = str(text_path)
    packet['packet_file'] = str(packet_path)
    packet_path.write_text(json.dumps(packet, indent=2, ensure_ascii=False), encoding='utf-8')
    return formatted, packet


def query(term, debug=False):
    formatted, packet = build_context(term)
    if debug:
        print('\n=== TASK PACKET ===')
        for file in packet['files']:
            print(f"- {file['path']} | {file['role']} | score={file['score']}")
        print('\n=== SEMANTIC RELATIONSHIPS ===')
        for relation in packet['semantic_relationships']:
            print(f"- {relation['source']} --{relation['relation']}--> {relation['target']}")
        print(f"\nContext: {packet['context_file']}")
        print(f"Packet: {packet['packet_file']}")
    return formatted


def main():
    parser = argparse.ArgumentParser(description='Build a minimal code context for an agent task.')
    parser.add_argument('task', nargs='+', help='Domain or task description, e.g. calendar')
    parser.add_argument('--tests', action='store_true', help='Include test files in the initial context')
    parser.add_argument('--json', action='store_true', help='Print the task packet as JSON')
    args = parser.parse_args()
    _, packet = build_context(' '.join(args.task), include_tests=args.tests)
    if args.json:
        print(json.dumps(packet, indent=2, ensure_ascii=False))
    else:
        print(f"Context: {packet['context_file']}")
        print(f"Packet: {packet['packet_file']}")
        for file in packet['files']:
            print(f"- {file['path']} ({file['role']})")


if __name__ == '__main__':
    main()
