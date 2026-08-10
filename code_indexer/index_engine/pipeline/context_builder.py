from collections import Counter
from pathlib import Path


def build_project_context(
    files,
    entities,
    graph
):
    """
    Costruisce una panoramica del progetto
    per agenti AI.
    """

    context = {}

    # statistiche generali

    context["statistics"] = {
        "files": len(files),
        "entities": len(entities),
        "relationships": len(graph),
    }

    
    # linguaggi

    languages = Counter()

    for file in files:
        languages[file["language"]] += 1

    context["languages"] = dict(languages)

    # ruoli dei file

    roles = Counter()

    for file in files:
        roles[file.get("role", "unknown")] += 1

    context["file_roles"] = dict(
        roles.most_common()
    )

    # statistiche relazioni

    relations = Counter()

    for edge in graph:
        relations[edge["relation"]] += 1

    context["relationships"] = dict(relations)

    # aree principali del progetto

    areas = Counter()

    for file in files:

        parts = Path(
            file["path"]
        ).parts

        if len(parts) > 1:
            areas[parts[-2]] += 1


    context["main_directories"] = dict(
        areas.most_common(15)
    )


    # file più importanti

    important_files = sorted(
        files,
        key=lambda x: x.get(
            "symbols_count",
            0
        ),
        reverse=True
    )


    context["important_files"] = [
        {
            "path": f["path"],
            "symbols": f["symbols_count"]
        }
        for f in important_files[:20]
    ]

    # file più referenziati

    imported = Counter()

    for edge in graph:

        if edge["relation"] == "imports":
            imported[edge["target"]] += 1


    context["most_imported_files"] = [
        {
            "file": file,
            "imports": count
        }
        for file, count in imported.most_common(20)
    ]

    return context