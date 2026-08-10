from pathlib import Path
import re

from ..core.path_utils import normalize_path


def build_import_relationships(files, project_root):
    """
    Costruisce relazioni di import.

    Relazione:
    file -> imports -> module
    """

    relationships = []

    for file in files:

        if file.suffix not in {
            ".py",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
        }:
            continue

        try:
            content = file.read_text(
                encoding="utf-8"
            )

        except Exception:
            continue


        source = normalize_path(
            file,
            project_root
        )


        for line in content.splitlines():

            line = line.strip()


            target = None


            # Python
            match = re.match(
                r"^(?:from|import)\s+([^\s;]+)",
                line
            )

            if match:
                target = match.group(1)


            # Javascript / Typescript
            match = re.search(
                r"from\s+[\"'](.+?)[\"']",
                line
            )

            if match:
                target = match.group(1)


            if target:

                relationships.append(
                    {
                        "source": f"file:{source}",
                        "relation": "imports",
                        "target": target
                    }
                )


    return relationships