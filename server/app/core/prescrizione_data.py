import json
from pathlib import Path

BASE_PATH = Path(__file__).resolve().parent.parent / "data"

def load_json_file(filename):
    file_path = BASE_PATH / filename
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def cerca_diagnosi(query: str):
    data = load_json_file("icd9_odontoiatria.json")
    return [
        item for item in data
        if query.lower() in item["descrizione"].lower() or query in item["codice"]
    ]

def cerca_farmaci(query: str):
    data = load_json_file("atc_farmaci.json")
    return [
        item for item in data
        if query.lower() in item["principio_attivo"].lower()
        or query.lower() in item["descrizione"].lower()
        or query in item["codice"]
    ]
