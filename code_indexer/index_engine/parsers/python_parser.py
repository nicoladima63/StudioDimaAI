from tree_sitter import Language, Parser
import tree_sitter_python

from ..core.models import Symbol


PY_LANGUAGE = Language(tree_sitter_python.language())


parser = Parser()
parser.language = PY_LANGUAGE


def parse_python_file(file_path):

    symbols = []

    source = file_path.read_text(encoding="utf-8")

    tree = parser.parse(bytes(source, "utf8"))

    root = tree.root_node


    def walk(node):

        if node.type == "function_definition":

            name_node = node.child_by_field_name("name")

            symbols.append(
                Symbol(
                    name=name_node.text.decode(),
                    symbol_type="function",
                    file=str(file_path),
                    line=node.start_point[0] + 1,
                    language="python"
                )
            )


        if node.type == "class_definition":

            name_node = node.child_by_field_name("name")

            symbols.append(
                Symbol(
                    name=name_node.text.decode(),
                    symbol_type="class",
                    file=str(file_path),
                    line=node.start_point[0] + 1,
                    language="python"
                )
            )


        for child in node.children:
            walk(child)


    walk(root)

    return symbols