# app/config/logging.py
import logging

logger = logging.getLogger("studio_dima")
logger.setLevel(logging.DEBUG)  # Puoi cambiare in INFO in produzione

handler = logging.StreamHandler()
formatter = logging.Formatter("[%(asctime)s] %(levelname)s - %(message)s")
handler.setFormatter(formatter)

if not logger.hasHandlers():
    logger.addHandler(handler)

