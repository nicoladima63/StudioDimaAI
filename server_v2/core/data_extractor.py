"""
Modulo: data_extractor
Legge direttamente file .DBF dal gestionale, applica mapping campi e opzionalmente esporta in CSV/JSON.
Compatibile con config_manager.py e constants.py.
"""

import os
import json
import csv
from dbfread import DBF
from datetime import date,datetime
from core.config_manager import get_config
from core.constants_v2 import DBF_TABLES, COLONNE

def extract_data(table_name: str, base_path: str = None, limit: int = None):
    """
    Legge i dati da un file .DBF in base alla configurazione in DBF_TABLES e COLONNE.
    """
    if table_name not in DBF_TABLES:
        raise ValueError(f"Tabella '{table_name}' non trovata in DBF_TABLES")

    table_info = DBF_TABLES[table_name]
    dbf_filename = table_info.get("file")
    dbf_directory = table_info.get("categoria")

    # usa il mapping da COLONNE, se disponibile
    mapping = COLONNE.get(table_name.lower(), {})

    config = get_config()
    dbf_path = base_path or config["paths"]["dbf_dir"]
    file_path = os.path.join(dbf_path, dbf_directory, dbf_filename)

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File DBF non trovato: {file_path}")

    records = []
    for record in DBF(file_path, encoding='cp1252', ignore_missing_memofile=True):
        mapped = {}
        for logical_field, dbf_field in mapping.items():
            value = record.get(dbf_field)

            # Se è una data, converti in stringa
            if isinstance(value, (date, datetime)):
                value = value.strftime("%d/%m/%Y")  # oppure "%Y-%m-%d"

            mapped[logical_field] = value
        records.append(mapped)
        if limit and len(records) >= limit:
            break
    return records


def extract_data2(table_name: str, base_path: str = None, limit: int = None):
    """
    Legge i dati da un file .DBF in base alla configurazione in DBF_TABLES.

    Args:
        table_name (str): nome logico della tabella, es. "pazienti".
        base_path (str): percorso base ai file DBF.
        limit (int): numero massimo di record da leggere (debug).
    Returns:
        list[dict]: elenco di record mappati.
    """
    if table_name not in DBF_TABLES:
        raise ValueError(f"Tabella '{table_name}' non trovata in DBF_TABLES")

    table_info = DBF_TABLES[table_name]
    dbf_filename = table_info.get("file")
    dbf_directory= table_info.get("categoria")
    mapping = table_info.get("fields", {})

    config = get_config()
    dbf_path = base_path or config["paths"]["dbf_dir"]
    file_path = os.path.join(dbf_path, dbf_directory, dbf_filename)

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File DBF non trovato: {file_path}")

    records = []
    for record in DBF(file_path, encoding='cp1252', ignore_missing_memofile=True):
        mapped = {}
        for logical_field, dbf_field in mapping.items():
            mapped[logical_field] = record.get(dbf_field)
        records.append(mapped)
        if limit and len(records) >= limit:
            break

    return records


def export_data(table_name: str, records: list, output_dir: str = None, fmt: str = "csv", filename: str = None):
    """
    Esporta i record estratti in CSV o JSON.

    Args:
        table_name (str): nome logico della tabella, es. "pazienti"
        records (list): elenco di dizionari da esportare
        output_dir (str): cartella in cui salvare il file; se None, usa cartella corrente
        fmt (str): "csv" o "json"
        filename (str): nome file completo opzionale; se fornito, `output_dir` e timestamp vengono ignorati
    Returns:
        str: percorso completo del file creato
    """
    if not records:
        raise ValueError("Nessun record da esportare")

    # Se non c'è output_dir, usa cartella corrente
    output_dir = output_dir or "."

    # Se non esiste la cartella, la crea
    os.makedirs(output_dir, exist_ok=True)

    # Se non è fornito filename, generalo automaticamente
    if filename is None:
        filename = f"{table_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{fmt}"

    output_path = os.path.join(output_dir, filename)

    if fmt == "csv":
        with open(output_path, "w", newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)
    elif fmt == "json":
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)
    else:
        raise ValueError("Formato non supportato (usa 'csv' o 'json')")

    return output_path
