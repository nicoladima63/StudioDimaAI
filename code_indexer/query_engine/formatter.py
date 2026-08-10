from collections import defaultdict
from ..core.context_models import QueryContext
from .code_extractor import extract_context_code


def format_context(context):

    result = QueryContext(query="")
    result.files = context.get("files", [])
    
    files_by_role = defaultdict(list)


    for file in context["files"]:

        files_by_role[
            file.get("role", "unknown")
        ].append(
            file["path"]
        )


    result.architecture = dict(
        files_by_role
    )


    result.symbols = [
        {
            "name": symbol["name"],
            "kind": symbol.get("kind"),
            "path": symbol["path"],
            "line": symbol.get("line"),
            "information_score": symbol.get(
                "information_score",
                0
            ),
            "category": symbol.get(
                "category",
                "unknown"
            )
        }
        for symbol in context["symbols"]
    ]

    result.core_symbols = [
        s for s in result.symbols
        if s.get("category") == "core"
    ]

    result.domain_symbols = [
        s for s in result.symbols
        if s.get("category") == "domain"
    ]

    result.support_symbols = [
        s for s in result.symbols
        if s.get("category") == "support"
    ]

    result.internal_symbols = [
        s for s in result.symbols
        if s.get("category") == "internal"
    ]

    result.code_slices = extract_context_code(
        result.symbols
    )

    result.connections = [
        {
            "source": r["source"],
            "target": r["target"],
            "relation": r["relation"],
            "from": r["source"],
            "to": r["target"],
            "type": r["relation"]
        }
        for r in context["connections"]
    ]


    return result
