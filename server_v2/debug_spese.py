
import sys
import os

# Add server_v2 to path
sys.path.append(os.getcwd())

from flask import Flask
from services.spese_fornitori_service import spese_fornitori_service
from core.database_manager import initialize_database_manager
from core.config import Config

# Setup minimal app context
app = Flask(__name__)
# Initialize config (assuming development)
config = Config(db_path="instance/studio_dima.db")
initialize_database_manager(config)

print("Testing get_riepilogo_spese(2026)...")
try:
    result = spese_fornitori_service.get_riepilogo_spese(2026)
    print("Result:", result)
except Exception as e:
    print("CRASHED:")
    print(e)
    import traceback
    traceback.print_exc()
