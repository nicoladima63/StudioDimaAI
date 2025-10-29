import os
import argparse
import json
import logging
from core.data_extractor import extract_data
from core.performance_analyzer import PerformanceAnalyzer
from core.config_manager import get_config

def main():
    parser = argparse.ArgumentParser(description="Analizza prestazioni e fatturato")
    parser.add_argument("--path", type=str, help="Percorso base dei DBF (override opzionale)")
    parser.add_argument("--limit", type=int, help="Numero massimo di record da analizzare")
    args = parser.parse_args()

    config = get_config()
    mode = config.get_mode()
    base_path = args.path or config.get('DEV_DB_BASE_PATH' if mode == 'dev' else 'PROD_DB_BASE_PATH')

    logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
    logging.info(f"Esecuzione in modalità {mode.upper()} con base_path={base_path}")

    # Estrazione dati tabella 'onorario'
    data = extract_data("onorario", base_path=base_path, limit=args.limit)
    if not data:
        logging.error("Nessun dato trovato nella tabella 'onorario'.")
        return

    # Analisi
    analyzer = PerformanceAnalyzer(data)
    kpi = analyzer.kpi_summary()

    # Export automatico in JSON
    output_file = "performance_report.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(kpi, f, indent=2, ensure_ascii=False)

    logging.info(f"Analisi completata. File generato: {output_file}")

if __name__ == "__main__":
    main()
