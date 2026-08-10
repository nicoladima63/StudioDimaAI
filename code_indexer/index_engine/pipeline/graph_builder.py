def build_graph(entities, files,relationships):
    """
    Costruisce il grafo semantico base.

    Relazione:
    FILE contains ENTITY
    """

    graph = []

    # mappa file -> id entità file

    file_entities = {}

    for file in files:

        file_id = file["id"]

        file_entities[file["path"]] = file_id


    # collega file e simboli

    for entity in entities:

        entity_path = entity.get(
            "path"
        )

        if entity_path in file_entities:

            graph.append(
                {
                    "source": file_entities[entity_path],
                    "relation": "contains",
                    "target": entity["id"]
                }
            )

    # collega import tra file

    for relation in relationships:

        if (
            relation.get("relation") == "imports"
            and relation.get("resolved") is True
        ):

            graph.append(
                {
                    "source": relation["source"],
                    "relation": "imports",
                    "target": relation["target"]
                }
            )


    return graph