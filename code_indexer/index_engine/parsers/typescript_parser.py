from tree_sitter import Language, Parser
import tree_sitter_typescript
from ..classifiers.symbol_classifier import classify_typescript_symbol
from ..core.models import Symbol


TS_LANGUAGE = Language(
    tree_sitter_typescript.language_typescript()
)

parser = Parser()
parser.language = TS_LANGUAGE


def parse_typescript_file(file_path):

    symbols = []

    source = file_path.read_text(encoding="utf-8")

    tree = parser.parse(bytes(source, "utf8"))

    root = tree.root_node


    def walk(node):

        # function nome()
        if node.type == "function_declaration":

            name_node = node.child_by_field_name("name")

            if name_node:
                symbols.append(
                    Symbol(
                        name=name_node.text.decode(),
                        symbol_type="function",
                        file=str(file_path),
                        line=node.start_point[0] + 1,
                        language="typescript"
                    )
                )


        # const Nome = () =>
        if node.type == "variable_declarator":

            name_node = node.child_by_field_name("name")
            value_node = node.child_by_field_name("value")

            if name_node and value_node:

                if value_node.type in (
                    "arrow_function",
                    "function"
                ):
                    name = name_node.text.decode()
                    symbol_type = classify_typescript_symbol(
                        name=name,
                        file_path=str(file_path)
                    )

                    symbols.append(
                        Symbol(
                            name=name,
                            symbol_type=symbol_type,
                            file=str(file_path),
                            line=node.start_point[0] + 1,
                            language="typescript"
                        )
                    )


        for child in node.children:
            walk(child)


    walk(root)

    return symbols