from pathlib import Path


def classify_file(path):

    path = Path(path).as_posix().lower()


    if "app_v2.py" in path or path.endswith("/main.py"):
        return "entry_point"


    if "/api/" in path:
        return "api"


    if "/services/" in path:
        return "service"


    if "/repositories/" in path:
        return "repository"


    if "/components/" in path:
        return "component"


    if "/store/" in path:
        return "state"


    if "/hooks/" in path:
        return "hook"


    if "/tests/" in path or path.startswith("tests/"):
        return "test"


    if "config" in path:
        return "configuration"


    if "/utils/" in path or "/lib/" in path:
        return "utility"

    if "/scripts/" in path:
        return "script"


    if "/core/" in path:
        return "core_module"


    if "/types/" in path:
        return "types"


    if "/pages/" in path:
        return "page"


    if "/features/" in path:
        return "feature"


    if "/legacy_ricetta/" in path:
        return "legacy"


    if "/certs/" in path:
        return "certificate"


    if ".claude/skills/" in path:
        return "ai_skill"

    if "/models/" in path:
        return "model"

    if "/schemas/" in path:
        return "schema"


    if "/database/" in path or "/db/" in path:
        return "database"


    if "/middleware/" in path:
        return "middleware"


    if "/workers/" in path:
        return "worker"


    if "/migrations/" in path:
        return "migration"

    
    return "unknown"