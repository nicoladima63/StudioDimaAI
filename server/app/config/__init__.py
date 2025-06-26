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

#Come usarlo nel progetto
#Puoi ora importare con:
#from app.config import TWILIO, PATH_ANAGRAFICA_DBF

#oppure, se vuoi accedere direttamente al modulo:
#from app.config.constants import TWILIO

#Fammi sapere se in futuro vuoi modularizzare altri aspetti come:

#env.py → gestione ambiente

#twilio.py → config e utilità legate a Twilio

#google.py → config calendario

#dbf_schema.py → colonne e path










