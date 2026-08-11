from .query_terms import matched_terms, normalize_query_terms, tokenize_text


def rank_files(files, query):

    words = normalize_query_terms(query)

    scored = []


    for file in files:

        path = file.get(
            "path",
            ""
        )

        role = file.get(
            "role",
            ""
        )


        score = 0


        path_terms = set(
            tokenize_text(path)
        )

        filename_terms = set(
            tokenize_text(path.split("/")[-1])
        )

        for word in words:

            if word in path_terms:
                score += 10


            if word in filename_terms:
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

        matched_words = len(
            matched_terms(
                path,
                words
            )
        )


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
