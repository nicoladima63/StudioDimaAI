from collections import Counter


def build_architecture_map(files, graph):

    architecture = {}


    # distribuzione ruoli

    roles = Counter()

    for file in files:
        roles[file.get("role", "unknown")] += 1


    architecture["roles"] = dict(
        roles.most_common()
    )


    # file più centrali

    imported = Counter()

    for edge in graph:

        if edge.get("relation") == "imports":

            imported[edge["target"]] += 1


    architecture["central_files"] = [
        {
            "file": file,
            "imports": count
        }
        for file, count in imported.most_common(20)
    ]


    # entry point

    architecture["entry_points"] = [
        file["path"]
        for file in files
        if file.get("role") == "entry_point"
    ]


    # layer applicativi

    layers = {}

    for role, count in roles.items():

        layers[role] = count


    architecture["layers"] = layers

    # complex_files

    architecture["complex_files"] = sorted(
        [
            {
                "file": file["path"],
                "symbols": file.get("symbols_count", 0),
                "role": file.get("role")
            }
            for file in files
        ],
        key=lambda x: x["symbols"],
        reverse=True
    )[:20]

    return architecture