import json
from pathlib import Path

BASE_PATH = Path(__file__).resolve().parent / "data"

def load_json_file(filename):
    file_path = BASE_PATH / filename
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def cerca_diagnosi(query: str):
    data = load_json_file("icd9_odontoiatria.json")
    risultati = []
    query_lower = query.lower()
    for codice, item in data.items():
        # Cerca nella descrizione principale
        if query_lower in item["descrizione"].lower() or query in codice:
            risultati.append({"codice": codice, "descrizione": item["descrizione"]})
        # Cerca nei sottocodici
        for sub_codice, sub_descr in item.get("sottocodici", {}).items():
            if query_lower in sub_descr.lower() or query in sub_codice:
                risultati.append({"codice": sub_codice, "descrizione": sub_descr})
    return risultati

def cerca_farmaci(query: str):
    data = load_json_file("atc_farmaci.json")
    risultati = []
    query_lower = query.lower()
    for codice_macro, macro in data.items():
        # Cerca nella descrizione macro
        if query_lower in macro["descrizione"].lower() or query in codice_macro:
            risultati.append({
                "codice": codice_macro,
                "principio_attivo": "",
                "descrizione": macro["descrizione"]
            })
        for codice_gruppo, gruppo in macro.get("gruppi_rilevanti", {}).items():
            # Cerca nel nome del gruppo
            if query_lower in gruppo["nome"].lower() or query in codice_gruppo:
                risultati.append({
                    "codice": codice_gruppo,
                    "principio_attivo": "",
                    "descrizione": gruppo["nome"]
                })
            for codice_pa, pa_nome in gruppo.get("principi_attivi", {}).items():
                if query_lower in pa_nome.lower() or query in codice_pa:
                    risultati.append({
                        "codice": codice_pa,
                        "principio_attivo": pa_nome,
                        "descrizione": gruppo["nome"]
                    })
    return risultati 