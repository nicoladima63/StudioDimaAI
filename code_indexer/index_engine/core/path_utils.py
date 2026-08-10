from pathlib import Path


def normalize_path(path, root):
    """
    Restituisce un path relativo alla root del progetto.
    """

    try:
        return str(
            Path(path)
            .resolve()
            .relative_to(
                Path(root).resolve()
            )
        ).replace("\\", "/")

    except ValueError:
        return str(path).replace("\\", "/")