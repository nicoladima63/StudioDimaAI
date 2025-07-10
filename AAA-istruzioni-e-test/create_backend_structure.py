import os

base_path = "analytics/app"

folders = [
    base_path,
    os.path.join(base_path, "auth"),
    os.path.join(base_path, "routes"),
    os.path.join(base_path, "logs"),
]

files = [
    os.path.join(base_path, "__init__.py"),
    os.path.join(base_path, "config.py"),
    os.path.join(base_path, "run.py"),
    os.path.join(base_path, "auth", "__init__.py"),
    os.path.join(base_path, "auth", "models.py"),
    os.path.join(base_path, "auth", "routes.py"),
    os.path.join(base_path, "auth", "utils.py"),
    os.path.join(base_path, "routes", "__init__.py"),
    os.path.join(base_path, "routes", "tests.py"),
]

for folder in folders:
    os.makedirs(folder, exist_ok=True)

for file in files:
    if not os.path.exists(file):
        with open(file, "w") as f:
            pass  # crea file vuoto

print("Struttura backend creata correttamente.")
