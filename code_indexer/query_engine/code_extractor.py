from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_python
import tree_sitter_typescript


PY_LANGUAGE = Language(tree_sitter_python.language())
TS_LANGUAGE = Language(tree_sitter_typescript.language_typescript())


def _parser(language):
    parser = Parser()
    parser.language = language
    return parser


def _symbol_node(root, symbol):
    wanted_name = symbol.get("name")
    wanted_line = symbol.get("line")
    candidates = {
        "function_definition",
        "class_definition",
        "function_declaration",
        "variable_declarator",
        "method_definition"
    }

    match = None

    def walk(node):
        nonlocal match

        if match is not None:
            return

        if (
            node.type in candidates
            and node.start_point[0] + 1 == wanted_line
        ):
            name_node = node.child_by_field_name("name")
            if name_node and name_node.text.decode() == wanted_name:
                match = node
                return

        for child in node.children:
            walk(child)

    walk(root)
    return match


def extract_symbol_code(symbol):
    path = Path(symbol.get("path", ""))

    if not path.is_file():
        return None

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None

    language = (
        PY_LANGUAGE
        if path.suffix == ".py"
        else TS_LANGUAGE
        if path.suffix in {".ts", ".tsx", ".js", ".jsx"}
        else None
    )

    if language is None:
        return None

    tree = _parser(language).parse(bytes(source, "utf-8"))
    node = _symbol_node(tree.root_node, symbol)

    if node is None:
        return None

    start_line = node.start_point[0] + 1
    end_line = node.end_point[0] + 1
    source_lines = source.splitlines()

    return {
        "path": str(path),
        "symbol": symbol.get("name"),
        "kind": symbol.get("kind"),
        "start_line": start_line,
        "end_line": end_line,
        "code": "\n".join(source_lines[start_line - 1:end_line])
    }


def extract_context_code(symbols, limit=20):
    slices = []

    for symbol in symbols[:limit]:
        code_slice = extract_symbol_code(symbol)

        if code_slice is not None:
            slices.append(code_slice)

    return slices
