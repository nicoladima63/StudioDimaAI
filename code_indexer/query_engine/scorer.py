RELATION_WEIGHTS = {
    "imports": 5,
    "contains": 2
}


ROLE_WEIGHTS = {
    "api": 5,
    "service": 5,
    "state": 4,
    "repository": 4,
    "component": 3,
    "page": 3,
    "utility": 1,
    "configuration": 0
}

def score_file(file, connections, query=None):

    print("\n--- FILE XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX---")
    print(file)
    print("------------")

    raise SystemExit

    structural_score = 0

    role = file.get("role")

    structural_score += ROLE_WEIGHTS.get(
        role,
        1
    )

    file_id = file.get("id")

    for connection in connections:

        if (
            connection.get("source") == file_id
            or
            connection.get("target") == file_id
        ):
            structural_score += RELATION_WEIGHTS.get(
                connection.get("relation"),
                1
            )

    return structural_score