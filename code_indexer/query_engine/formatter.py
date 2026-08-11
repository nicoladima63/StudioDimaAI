from collections import defaultdict
from ..core.context_models import QueryContext
from .code_extractor import extract_context_code
from .query_terms import related_terms


def format_context(context):

    result = QueryContext(query="")
    result.files = context.get("files", [])

    query_terms = defaultdict(int)

    for file in result.files:
        for term in file.get("matched_query_terms", []):
            query_terms[term] += 1

    if len(query_terms) > 1:
        primary_term = max(
            query_terms,
            key=query_terms.get
        )
        focus_terms = set(
            related_terms(primary_term)
        )
        result.focus_files = [
            file for file in result.files
            if focus_terms.intersection(file.get(
                "matched_query_terms",
                []
            ))
        ]
    else:
        result.focus_files = list(result.files)
    
    files_by_role = defaultdict(list)


    for file in result.focus_files:

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

    focus_paths = {
        file.get("path")
        for file in result.focus_files
    }
    result.code_slices = extract_context_code(
        [
            symbol for symbol in result.symbols
            if symbol.get("path") in focus_paths
        ]
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
