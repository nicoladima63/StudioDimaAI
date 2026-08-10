import json
from pathlib import Path
from .context import expand_context
from .formatter import format_context
from .ranker import rank_files

BASE = Path(__file__).parent.parent.parent

KNOWLEDGE = BASE / "knowledge" / "output"


def load_json(name):

    with open(
        KNOWLEDGE / name,
        encoding="utf-8"
    ) as f:
        return json.load(f)



def search_text(query, items, fields):

    query = query.lower()

    results = []

    for item in items:

        text = " ".join(
            str(item.get(field, ""))
            for field in fields
        ).lower()


        if any(
            word in text
            for word in query.split()
        ):
            results.append(item)


    return results



def query(
    term,
    debug=False
):

    files = load_json(
        "files.json"
    )

    entities = load_json(
        "entities.json"
    )

    relationships = load_json(
        "resolved_relationships.json"
    )


    matched_files = rank_files(
        search_text(
            term,
            files,
            [
                "path",
                "role"
            ]
        ),
        term
    )

    matched_files = matched_files[:20]


    matched_entities = search_text(
        term,
        entities,
        [
            "name",
            "path",
            "kind"
        ]
    )


    if debug:

        print("\n=== FILES ===")

        for file in matched_files[:20]:
            print(
                file["path"],
                "|",
                file.get("role")
            )


        print("\n=== SYMBOLS ===")

        for entity in matched_entities[:20]:
            print(
                entity["name"],
                "|",
                entity["path"]
            )


    context = expand_context(
        matched_files,
        files,
        entities,
        relationships,
        term
    )


    if debug:

        print("\n=== CONTEXT FILES ===")

        for file in context["files"][:30]:
            print(
                file["path"],
                "|",
                file.get("role")
            )


        print("\n=== CONNECTIONS ===")

        for relation in context["connections"][:30]:
            print(
                relation
            )


        print("\n=== CONTEXT SYMBOLS ===")

        for symbol in context["symbols"][:30]:
            print(
                symbol["name"],
                "|",
                symbol["path"]
            )


    formatted = format_context(
        context
    )

    formatted.query = term

    if debug:

        print("\n=== ARCHITECTURE ===")

        for role, files in formatted.architecture.items():

            print("\n", role)

            for file in files[:10]:
                print(" -", file)


        print("\n=== CORE SYMBOLS ===")

        for symbol in formatted.core_symbols[:10]:

            print(
                symbol["name"],
                "|",
                symbol["path"]
            )


        print("\n=== DOMAIN SYMBOLS ===")

        for symbol in formatted.domain_symbols[:20]:

            print(
                symbol["name"],
                "|",
                symbol["path"]
            )


    return formatted



if __name__ == "__main__":

    import sys

    query(
        " ".join(sys.argv[1:]),
        debug=True
    )
