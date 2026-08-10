from pathlib import Path
import json


SUPPORTED_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
]


def load_aliases(config_file):

    with open(
        config_file,
        encoding="utf-8"
    ) as f:
        config = json.load(f)

    return config.get(
        "aliases",
        {}
    )


def resolve_target(
    source,
    target,
    files,
    aliases
):

    # import esterno
    if not target.startswith(".") and not target.startswith("@"):
        return target, False


    source_dir = Path(source.replace(
        "file:",
        ""
    )).parent


    # alias @
    for alias, destination in aliases.items():

        if target.startswith(alias):

            relative = target.replace(
                alias,
                destination,
                1
            )

            candidate = find_file(
                relative,
                files
            )

            if candidate:
                return (
                    f"file:{candidate}",
                    True
                )


    # import relativo
    if target.startswith("."):

        candidate_path = (
            source_dir / target
        ).as_posix()

        candidate = find_file(
            candidate_path,
            files
        )

        if candidate:
            return (
                f"file:{candidate}",
                True
            )


    return target, False


def find_file(path, files):

    path = path.replace("\\", "/")

    candidates = []

    p = Path(path)

    # file già completo
    if p.suffix in SUPPORTED_EXTENSIONS:
        candidates.append(
            p.as_posix()
        )

    else:
        # aggiunge estensione senza eliminare .store
        for ext in SUPPORTED_EXTENSIONS:
            candidates.append(
                path + ext
            )

        # gestione index
        for ext in SUPPORTED_EXTENSIONS:
            candidates.append(
                f"{path}/index{ext}"
            )


    for file in files:

        file_path = file["path"].replace("\\", "/")

        if file_path in candidates:
            return file_path


    return None


def resolve_relationships(
    relationships,
    files,
    config_file
):

    aliases = load_aliases(
        config_file
    )


    resolved = []


    for rel in relationships:

        target, ok = resolve_target(
            rel["source"],
            rel["target"],
            files,
            aliases
        )

        resolved.append(
            {
                **rel,
                "target": target,
                "resolved": ok
            }
        )


    return resolved