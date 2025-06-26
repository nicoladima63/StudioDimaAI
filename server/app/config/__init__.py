# app/config/__init__.py

# Importa tutte le costanti principali
from .constants import *

# Se in futuro dividerai le configurazioni in moduli specifici, puoi importarli qui:
# from .google import GOOGLE
# from .twilio import TWILIO
# from .paths import PATHS_DBF, PATH_APPUNTAMENTI_DBF, PATH_ANAGRAFICA_DBF

# --- Facoltativo: centralizzazione di un dizionario unico ---
# Ad esempio per accedere a tutte le costanti configurabili come oggetti
# CONFIG = {
#     "twilio": TWILIO,
#     "google": GOOGLE,
#     "medici": MEDICI,
#     ...
# }

# Se vuoi evitare import * (più esplicito):
# __all__ = [
#     "COLONNE", "TIPI_APPUNTAMENTO", "TIPO_RICHIAMI", "COLORI_APPUNTAMENTO",
#     "GOOGLE_COLOR_MAP", "MEDICI", "TWILIO", "GOOGLE",
#     "PATH_APPUNTAMENTI_DBF", "PATH_ANAGRAFICA_DBF"
# ]
