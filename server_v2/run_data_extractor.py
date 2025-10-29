import os
import argparse
import logging
from core.data_extractor import extract_data, export_data
from core.config_manager import get_config

def main():
    parser = argparse.ArgumentParser(description="Estrae dati DBF in formato JSON o CSV")
    parser.add_argument("--path", type=str, help="Percorso base dei DBF (override opzionale)")
    parser.add_argument("--table", type=str, required=True, help="Nome della tabella da estrarre")
    parser.add_argument("--format", type=str, choices=["json", "csv"], default="json", help="Formato output")
    parser.add_argument("--limit", type=int, help="Numero massimo di record da estrarre")
    args = parser.parse_args()

    # Inizializza configurazione globale
    config = get_config()
    mode = config.get_mode()
    base_path = args.path or config.get('DEV_DB_BASE_PATH' if mode == 'dev' else 'PROD_DB_BASE_PATH')

    logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
    logging.info(f"Esecuzione in modalità {mode.upper()} con base_path={base_path}")

    # Esegue estrazione
    data = extract_data(args.table, base_path=base_path, limit=args.limit)

    if args.format == "json":
        output_file = f"{args.table}.json"
        export_data(args.table, data, output_dir=os.path.dirname(output_file), fmt="json")
    else:
        output_file = f"{args.table}.csv"
        export_data(args.table, data, output_dir=os.path.dirname(output_file), fmt="csv")

    logging.info(f"File generato: {output_file}")

if __name__ == "__main__":
    main()
