#!/usr/bin/env python3
"""
Check unregistered API routes in StudioDimaAI Server V2.

Scansiona tutti i moduli api/v2_*.py, rileva le route definite
e le confronta con quelle effettivamente registrate nei blueprint.
Stampa solo le route presenti nel modulo ma NON registrate.
"""

import os
import sys
import importlib
import inspect
import logging
from flask import Flask

# --- Aggiunge la root del progetto al PYTHONPATH ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Importa la creazione dell'app
from app_v2 import create_app_v2

API_FOLDER = os.path.join(PROJECT_ROOT, "server_v2")
API_PACKAGE = "server_v2"

def discover_blueprints():
    """Importa tutti i moduli api/v2_*.py per raccogliere i blueprint."""
    blueprints = []
    for fname in os.listdir(API_FOLDER):
        if fname.startswith("v2_") and fname.endswith(".py"):
            module_name = fname[:-3]  # rimuove .py
            full_module_name = f"{API_PACKAGE}.{module_name}"
            try:
                module = importlib.import_module(full_module_name)
                for obj_name, obj in inspect.getmembers(module):
                    # rileva blueprint
                    if hasattr(obj, "name") and hasattr(obj, "url_prefix"):
                        blueprints.append(obj)
            except Exception as e:
                print(f"X Errore importando {full_module_name}: {e}")
    return blueprints

def get_registered_routes(app: Flask):
    """Raccoglie tutte le route effettivamente registrate nell'app."""
    return set(rule.rule for rule in app.url_map.iter_rules())

def get_declared_routes(blueprints):
    """Raccoglie tutte le route dichiarate nei blueprint."""
    declared = set()
    for bp in blueprints:
        for rule in bp.url_map.iter_rules():
            declared.add(rule.rule)
    return declared
def main():
    print("⚡ Scanning for unregistered routes...")

    # Disabilita tutti i log temporaneamente
    logging.disable(logging.CRITICAL)

    # Crea l'app senza avviare il server
    app = create_app_v2()

    # Recupera blueprint importati
    blueprints = discover_blueprints()

    # Route registrate
    registered = get_registered_routes(app)

    # Route dichiarate nei blueprint
    declared = get_declared_routes(blueprints)

    # Riabilita logging (opzionale, se vuoi ripristinarlo dopo)
    logging.disable(logging.NOTSET)

    # Confronto
    unregistered = declared - registered
    if unregistered:
        print("\n❗ Route dichiarate ma NON registrate:")
        for route in sorted(unregistered):
            print(f" - {route}")
    else:
        print("\n✅ Tutte le route dichiarate sono correttamente registrate!")


if __name__ == "__main__":
    main()
