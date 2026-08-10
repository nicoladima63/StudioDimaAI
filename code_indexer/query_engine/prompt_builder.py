from ..core.context_models import QueryContext


def build_prompt_context(context: QueryContext):

    lines = []


    lines.append(
        f"QUERY: {context.query}"
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
            f"- {symbol.get('name')} | {symbol.get('path')}"
        )


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