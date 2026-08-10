def rank_files(files, query):

    query = query.lower()

    words = query.split()

    scored = []


    for file in files:

        path = file.get(
            "path",
            ""
        ).lower()

        role = file.get(
            "role",
            ""
        )


        score = 0


        for word in words:

            if word in path:
                score += 10


            if word in path.split("/")[-1]:
                score += 20


        role_bonus = {
            "api": 50,
            "service": 45,
            "state": 35,
            "repository": 30,
            "page": 20,
            "component": 5
        }


        matched_words = 0

        for word in words:
            if word in path:
                matched_words += 1


        # bonus architettura solo se il file parla davvero del dominio

        if matched_words:
            score += role_bonus.get(
                role,
                0
            )
        else:
            score -= 30


        scored.append(
            (
                score,
                file
            )
        )


    scored.sort(
        key=lambda x: x[0],
        reverse=True
    )

    scored = [
        item
        for item in scored
        if item[0] > 0
    ]

    return [
        item[1]
        for item in scored
    ]