from pathlib import Path


def classify_typescript_symbol(name: str, file_path: str) -> str:
    """
    Classifica un simbolo TypeScript in base al nome
    e, in futuro, anche al percorso del file.
    """

    path = Path(file_path)

    # Hook React
    if name.startswith("use"):
        return "hook"

    # Per ora tutto il resto è un componente
    return "component"