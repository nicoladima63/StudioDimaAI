"""Configurable, incremental repository indexer."""

from dataclasses import asdict
from hashlib import sha256
import json
from pathlib import Path
from datetime import datetime, timezone

from .core.path_utils import normalize_path
from .parsers.python_parser import parse_python_file
from .parsers.typescript_parser import parse_typescript_file
from .pipeline.architecture_builder import build_architecture_map
from .pipeline.context_builder import build_project_context
from .pipeline.entity_builder import build_entities
from .pipeline.file_builder import build_files
from .pipeline.graph_builder import build_graph
from .pipeline.import_resolver import resolve_relationships
from .pipeline.knowledge_builder import build_features, build_summaries
from .pipeline.relationship_builder import build_import_relationships
from .pipeline.semantic_relationship_builder import build_semantic_relationships


INDEX_ENGINE_DIR = Path(__file__).parent
CODE_INDEXER_DIR = INDEX_ENGINE_DIR.parent
PROJECT_ROOT = CODE_INDEXER_DIR.parent
CONFIG_FILE = CODE_INDEXER_DIR / 'config' / 'index_config.json'
PROJECT_CONFIG_FILE = CODE_INDEXER_DIR / 'config' / 'project_config.json'
OUTPUT_DIR = PROJECT_ROOT / 'knowledge' / 'output'
MANIFEST_FILE = OUTPUT_DIR / 'index_manifest.json'


def _load_config():
    with CONFIG_FILE.open(encoding='utf-8') as file:
        return json.load(file)


def _file_hash(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def scan_repository(root_path: Path, config: dict):
    """Scan only configured workspaces, honoring the configured exclusions."""
    files = []
    excluded_dirs = set(config.get('excluded_dirs', []))
    extensions = set(config.get('extensions', []))

    for workspace in config.get('workspaces', []):
        workspace_path = root_path / workspace['path']
        if not workspace_path.exists():
            continue
        for file in workspace_path.rglob('*'):
            if not file.is_file() or any(part in excluded_dirs for part in file.parts):
                continue
            if file.suffix.lower() in extensions:
                files.append(file)
    return sorted(files)


def parse_file(file: Path):
    if file.suffix == '.py':
        return parse_python_file(file)
    if file.suffix in {'.js', '.jsx', '.ts', '.tsx'}:
        return parse_typescript_file(file)
    return []


def _load_json(path: Path, default):
    try:
        with path.open(encoding='utf-8') as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return default


def _load_previous_symbols():
    manifest = _load_json(MANIFEST_FILE, {'files': {}})
    symbols = _load_json(OUTPUT_DIR / 'symbols.json', [])
    by_path = {}
    for symbol in symbols:
        by_path.setdefault(symbol['file'], []).append(symbol)
    return manifest.get('files', {}), by_path


def save_json(filename: str, data):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / filename
    output_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    return output_file


def main(force: bool = False):
    config = _load_config()
    files = scan_repository(PROJECT_ROOT, config)
    previous_manifest, previous_symbols = _load_previous_symbols()
    symbols = []
    manifest_files = {}
    parsed_count = 0

    print('Avvio indicizzazione repository...')
    print(f'Root progetto: {PROJECT_ROOT}')
    print(f'Trovati {len(files)} file nelle workspace configurate')

    for file in files:
        relative_path = normalize_path(file, PROJECT_ROOT)
        digest = _file_hash(file)
        old = previous_manifest.get(relative_path, {})
        if not force and old.get('hash') == digest:
            file_symbols = previous_symbols.get(relative_path, [])
        else:
            parsed_count += 1
            try:
                file_symbols = [
                    {**asdict(symbol), 'file': relative_path}
                    for symbol in parse_file(file)
                ]
            except Exception as error:
                print(f'Errore parsing {relative_path}: {error}')
                file_symbols = []
        symbols.extend(file_symbols)
        manifest_files[relative_path] = {'hash': digest, 'symbols': len(file_symbols)}

    entities = build_entities(symbols)
    files_data = build_files(files, [
        type('SymbolData', (), {
            'file': str(PROJECT_ROOT / symbol['file'])
        })() for symbol in symbols
    ], PROJECT_ROOT)
    relationships = build_import_relationships(files, PROJECT_ROOT)
    resolved_relationships = resolve_relationships(relationships, files_data, PROJECT_CONFIG_FILE)
    semantic_relationships = build_semantic_relationships(files, entities, PROJECT_ROOT)
    all_relationships = [*resolved_relationships, *semantic_relationships]
    graph = build_graph(entities, files_data, all_relationships)
    context = build_project_context(files_data, entities, graph)
    architecture = build_architecture_map(files_data, graph)
    features = build_features(files_data, entities, all_relationships)
    summaries = build_summaries(files_data, entities, all_relationships)

    outputs = {
        'symbols.json': symbols,
        'entities.json': entities,
        'files.json': files_data,
        'relationships.json': relationships,
        'resolved_relationships.json': resolved_relationships,
        'semantic_relationships.json': semantic_relationships,
        'graph.json': graph,
        'project_context.json': context,
        'architecture_map.json': architecture,
        'features.json': features,
        'summaries.json': summaries,
        'index_manifest.json': {
            'schema_version': 2,
            'project_root': str(PROJECT_ROOT),
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'files': manifest_files,
        },
    }
    for filename, data in outputs.items():
        save_json(filename, data)

    print(f'File riparsati: {parsed_count}; riusati dalla cache: {len(files) - parsed_count}')
    print(f'Simboli: {len(symbols)} | Entità: {len(entities)} | Relazioni: {len(all_relationships)}')
    print(f'Feature: {len(features)} | Output: {OUTPUT_DIR}')


if __name__ == '__main__':
    main()
