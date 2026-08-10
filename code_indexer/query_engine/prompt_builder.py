from ..core.context_models import QueryContext


def build_prompt_context(context: QueryContext):

    lines = []


    lines.append(
        f"QUERY: {context.query}"
    )

    lines.append(
        "\n=== PRIORITY FILES ==="
    )

    for file in context.files[:50]:

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

    for role, files in context.architecture.items():

        lines.append(
            f"\n{role.upper()}"
        )

        for file in files:

            lines.append(
                f"- {file}"
            )


    lines.append(
        "\n=== SYMBOLS ==="
    )

    for symbol in context.symbols[:50]:

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

    for connection in context.connections[:50]:

        lines.append(
            f"- {connection.get('source')} "
            f"--{connection.get('relation')}--> "
            f"{connection.get('target')}"
        )

    return "\n".join(lines)
