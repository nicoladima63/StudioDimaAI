from pathlib import Path
from ..core.path_utils import normalize_path
from ..classifiers.file_classifier import classify_file

def detect_language(file_path: Path):

    suffix = file_path.suffix.lower()

    if suffix == ".py":
        return "python"

    if suffix in {".js", ".jsx", ".ts", ".tsx"}:
        return "typescript"

    return "unknown"


def build_files(files, symbols,project_root):

    files_map = {}

    for file in files:

        path = normalize_path(
            file,
            project_root
        )

        files_map[path] = {
            "id": f"file:{path}",
            "path": path,
            "language": detect_language(file),
            "role": classify_file(file),
            "symbols_count": 0
        }


    for symbol in symbols:

        symbol_path = normalize_path(
            symbol.file,
            project_root
        )

        if symbol_path in files_map:
            files_map[symbol_path]["symbols_count"] += 1


    return list(files_map.values())