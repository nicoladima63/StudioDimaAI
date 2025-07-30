"""
WSGI entry point per produzione
"""
import os
import sys

# Aggiungi il path del server al PYTHONPATH
server_dir = os.path.dirname(os.path.abspath(__file__))
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

# Ora importa con path relativo
from app.run import create_app

app = create_app()

if __name__ == "__main__":
    app.run()