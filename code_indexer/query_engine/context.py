from collections import defaultdict
from .scorer import score_file
from .information_score import (
    calculate_information_score,
    calculate_score_breakdown
)
from .symbol_score import calculate_symbol_score
from .symbol_classifier import classify_symbol


GENERIC_ROLES = {
    "utility",
    "types",
    "configuration",
    "component"
}

GENERIC_PATHS = {
    "components/ui",
    "components/modals",
    "components/tables",
    "components/layout",
    "components/selects",
    "services/api/client.ts",
    "store/prestazioni.store.ts"
}
EXTERNAL_IMPORTS = {
    "react",
    "axios",
    "flask",
    "logging",
    "pandas",
    "zustand",
    "pathlib",
    "typing",
    "sqlite3",
    "os",
    "dbf"
}


def is_generic_file(file):

    path = file.get("path", "").replace("\\", "/")

    for item in GENERIC_PATHS:

        if item in path:
            return True

    return False


def expand_context(
    matched_files,
    files,
    entities,
    relationships,
    query=""
):

    file_map = {
        file["id"]: file
        for file in files
    }


    context = {
        "files": [],
        "symbols": [],
        "connections": []
    }


    selected_ids = set()


    # file iniziali trovati dalla query

    for file in matched_files:

        file_id = file["id"]

        selected_ids.add(file_id)

        context["files"].append(file)


    # espansione grafo con profondità

    frontier = set(selected_ids)

    visited = set(selected_ids)

    depth = 1

    for _ in range(depth):

        next_frontier = set()


        for relation in relationships:

            source = relation.get("source")
            target = relation.get("target")

            if source in frontier:

                if relation.get("relation") != "imports":
                    continue

                context["connections"].append(
                    relation
                )


                if source in file_map and source not in visited:

                    file = file_map[source]

                    if (
                        file.get("role") not in [
                            "configuration",
                            "unknown",
                            "certificate"
                        ]
                        and not is_generic_file(file)
                    ):
                        visited.add(source)
                        next_frontier.add(source)


                if target in file_map and target not in visited:

                    file = file_map[target]

                    if (
                        file.get("role") not in [
                            "configuration",
                            "unknown",
                            "certificate"
                        ]
                        and not is_generic_file(file)
                    ):
                        visited.add(target)
                        next_frontier.add(target)


        frontier = next_frontier


        if not frontier:
            break


    selected_ids.update(
        visited
    )


    # aggiunge file collegati con filtro importanza

    for file_id in selected_ids:

        if file_id in file_map:

            file = file_map[file_id]

            if file not in context["files"]:

                if file.get("role") not in [
                    "configuration",
                    "unknown",
                    "certificate"
                ]:
                    context["files"].append(file)


    # simboli appartenenti ai file

    selected_paths = {
        file["path"]
        for file in context["files"]
    }


    file_scores = {
        file["path"]: calculate_information_score(
            file,
            context["connections"],
            []
        )
        for file in context["files"]
    }


    for entity in entities:

        if entity.get("path") in selected_paths:

            entity["information_score"] = calculate_symbol_score(
                entity,
                query,
                file_scores.get(
                    entity.get("path"),
                    0
                )
            )

            entity["category"] = classify_symbol(
                entity
            )

            context["symbols"].append(
                entity
            )


    context["symbols"] = sorted(
        context["symbols"],
        key=lambda x: x.get(
            "information_score",
            0
        ),
        reverse=True
    )


    for file in context["files"]:

        file.update(calculate_score_breakdown(
            file,
            context["connections"],
            context["symbols"],
            query
        ))


    context["files"] = sorted(
        context["files"],
        key=lambda x: x.get(
            "information_score",
            0
        ),
        reverse=True
    )

    return context
