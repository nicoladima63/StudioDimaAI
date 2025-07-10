import os

def require_env(var_name: str) -> str:
    value = os.getenv(var_name)
    if not value:
        raise EnvironmentError(f"[CONFIG] Variabile '{var_name}' non trovata nel file .env")
    return value 