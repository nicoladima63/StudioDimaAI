from collections import defaultdict
from ..core.context_models import QueryContext


def _format_connections(connections, focus_paths):

    grouped = defaultdict(lambda: {
        "internal": set(),
        "external": set()
    })

    for connection in connections:

        if connection.get("relation") != "imports":
            continue

        source = connection.get("source", "")
        source_path = source.removeprefix("file:")

        if source_path not in focus_paths:
            continue

        target = connection.get("target", "").strip()
        target_value = target.removeprefix("file:").strip(",;")

        if target in {"", "{", "}"}:
            continue

        if not target_value:
            continue

        if (
            target_value[0].isupper()
            and "/" not in target_value
        ):
            continue

        is_internal = (
            target.startswith("file:")
            or target.startswith("./")
            or target.startswith("../")
            or target.startswith("@/")
        )

        grouped[source_path][
            "internal" if is_internal else "external"
        ].add(target_value)

    lines = []

    for source_path, imports in grouped.items():

        lines.append(f"- {source_path}")

        if imports["internal"]:
            lines.append("  internal:")
            for target in sorted(imports["internal"]):
                lines.append(f"    - {target}")

        if imports["external"]:
            lines.append("  external:")
            for target in sorted(imports["external"]):
                lines.append(f"    - {target}")

    return lines


def build_prompt_context(context: QueryContext):

    lines = []


    lines.append(
        f"QUERY: {context.query}"
    )

    lines.append(
        "\n=== PRIORITY FILES ==="
    )

    priority_files = context.focus_files or context.files

    for file in priority_files[:50]:

        matched_terms = ", ".join(
            file.get("matched_query_terms", [])
        ) or "none"

        lines.append(
            f"- {file.get('path')} | "
            f"role={file.get('role', 'unknown')} | "
            f"score={file.get('information_score', 0)} | "
            f"structural={file.get('structural_score', 0)} | "
            f"query={file.get('query_relevance', 0)} | "
            f"matched={matched_terms}"
        )


    lines.append(
        "\n=== ARCHITECTURE ==="
    )

    focus_paths = {
        file.get("path")
        for file in priority_files
    }

    for role, files in context.architecture.items():

        lines.append(
            f"\n{role.upper()}"
        )

        for file in files:

            if file not in focus_paths:
                continue

            lines.append(
                f"- {file}"
            )


    lines.append(
        "\n=== SYMBOLS ==="
    )

    focus_symbols = [
        symbol for symbol in context.symbols
        if symbol.get("path") in focus_paths
    ]

    for symbol in focus_symbols[:50]:

        lines.append(
            f"- {symbol.get('name')} | {symbol.get('path')} | "
            f"kind={symbol.get('kind')} | "
            f"category={symbol.get('category')} | "
            f"score={symbol.get('information_score', 0)}"
        )

    lines.append(
        "\n=== RELEVANT CODE ==="
    )

    for code_slice in context.code_slices:

        lines.append(
            f"\n--- {code_slice.get('path')}::"
            f"{code_slice.get('symbol')} "
            f"(lines {code_slice.get('start_line')}-"
            f"{code_slice.get('end_line')}) ---"
        )
        lines.append(code_slice.get("code", ""))


    lines.append(
        "\n=== CONNECTIONS ==="
    )

    lines.extend(
        _format_connections(
            context.connections,
            focus_paths
        )
    )

    return "\n".join(lines)
