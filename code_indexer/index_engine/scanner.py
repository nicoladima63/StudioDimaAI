from pathlib import Path
from dataclasses import asdict
import json

from .parsers.python_parser import parse_python_file
from .parsers.typescript_parser import parse_typescript_file
from .pipeline.entity_builder import build_entities
from .pipeline.file_builder import build_files
from .pipeline.relationship_builder import build_import_relationships
from .pipeline.graph_builder import build_graph
from .pipeline.context_builder import build_project_context
from .pipeline.import_resolver import resolve_relationships
from .pipeline.architecture_builder import build_architecture_map
from .core.path_utils import normalize_path


# ==========================
# PATH CONFIGURATION
# ==========================

INDEX_ENGINE_DIR = Path(__file__).parent
CODE_INDEXER_DIR = INDEX_ENGINE_DIR.parent
PROJECT_ROOT = CODE_INDEXER_DIR.parent

OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge" / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ==========================
# FILE CONFIGURATION
# ==========================

SUPPORTED_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
}

EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "__pycache__",
    "venv",
    ".venv",
}


# ==========================
# REPOSITORY SCANNER
# ==========================

def scan_repository(root_path: Path):

    files = []

    for file in root_path.rglob("*"):

        if not file.is_file():
            continue

        if any(
            excluded in file.parts
            for excluded in EXCLUDED_DIRS
        ):
            continue

        if file.suffix in SUPPORTED_EXTENSIONS:
            files.append(file)

    return files


# ==========================
# PARSER ROUTER
# ==========================

def parse_file(file: Path):

    if file.suffix == ".py":
        return parse_python_file(file)

    if file.suffix in {
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
    }:
        return parse_typescript_file(file)

    return []


# ==========================
# SAVE JSON
# ==========================

def save_json(filename: str, data):

    output_file = OUTPUT_DIR / filename

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            data,
            f,
            indent=2,
            ensure_ascii=False
        )

    return output_file


# ==========================
# MAIN
# ==========================

def main():

    print("Avvio indicizzazione repository...")
    print(f"Root progetto: {PROJECT_ROOT}")


    files = scan_repository(PROJECT_ROOT)

    print(f"Trovati {len(files)} file")


    symbols = []


    for file in files:

        try:

            symbols.extend(
                parse_file(file)
            )

        except Exception as e:

            print(
                f"Errore parsing {file}: {e}"
            )


    print(
        f"Simboli trovati: {len(symbols)}"
    )


    # SYMBOL INDEX

    symbol_data = []

    for symbol in symbols:

        data = asdict(symbol)

        data["file"] = normalize_path(
            symbol.file,
            PROJECT_ROOT
        )

        symbol_data.append(data)

    symbols_file = save_json(
        "symbols.json",
        symbol_data
    )


    # ENTITY INDEX

    entities = build_entities(
        symbol_data
    )

    entities_file = save_json(
        "entities.json",
        entities
    )
    
    


    # FILES INDEX
    
    files_data = build_files(
        files,
        symbols,
        PROJECT_ROOT
    )
    
    files_file = save_json(
        "files.json",
        files_data
    )
    
    relationships = build_import_relationships(
        files,
        PROJECT_ROOT
    )

    relationships_file = save_json(
        "relationships.json",
        relationships
    )

    resolved_relationships = resolve_relationships(
        relationships,
        files_data,
        CODE_INDEXER_DIR / "config" / "project_config.json"
    )

    save_json(
        "resolved_relationships.json",
        resolved_relationships
    )
    
    graph = build_graph(
        entities,
        files_data,
        resolved_relationships
    )
    
    graph_file = save_json(
        "graph.json",
        graph
    )

    context = build_project_context(
        files_data,
        entities,
        graph
    )

    context_file = save_json(
        "project_context.json",
        context
    )

    
    architecture = build_architecture_map(
    files_data,
    graph
    )


    architecture_file = save_json(
        "architecture_map.json",
        architecture
    )

    print(
        f"Entità create: {len(entities)}"
    )
    
    print(
        f"Files indicizzati: {len(files_data)}"
    )

    print(
        f"Relazioni create: {len(relationships)}"
    )

    print(
        f"Nodi grafo creati: {len(graph)}"
    )

    print(
        f"Symbols: {symbols_file}"
    )

    print(
        f"Entities: {entities_file}"
    )

    print(
        f"Files: {files_file}"
    )

    print(
        f"Relationships: {relationships_file}"
    )
    
    print(
        f"Graph: {graph_file}"
    )

    print(
        f"Context: {context_file}"
    )

    print(
        f"Architecture: {architecture_file}"
    )

if __name__ == "__main__":
    main()