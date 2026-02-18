"""
Centralized path resolution for Server V2.

Goal: make deploys reliable by keeping OAuth tokens and sync state in a single,
configurable persistent directory (mounted volume / stable path).
"""

from __future__ import annotations

import os
from pathlib import Path


SERVER_V2_DIR = Path(__file__).resolve().parent.parent  # .../server_v2

# Directory that MUST be persisted in production (e.g. a mounted volume).
DATA_DIR = Path(os.getenv("STUDIODIMAAI_DATA_DIR", str(SERVER_V2_DIR / "instance"))).resolve()

# Google OAuth files
GOOGLE_CREDENTIALS_PATH = Path(
    os.getenv("GOOGLE_CREDENTIALS_PATH", str(DATA_DIR / "credentials.json"))
).resolve()
GOOGLE_TOKEN_PATH = Path(os.getenv("GOOGLE_TOKEN_PATH", str(DATA_DIR / "token.json"))).resolve()

# OAuth temporary state (web flow)
GOOGLE_OAUTH_STATE_PATH = Path(
    os.getenv("GOOGLE_OAUTH_STATE_PATH", str(DATA_DIR / "oauth_state.json"))
).resolve()

# Calendar sync state (legacy / diagnostics)
CALENDAR_SYNC_STATE_PATH = Path(
    os.getenv("CALENDAR_SYNC_STATE_PATH", str(DATA_DIR / "sync_state.json"))
).resolve()

# Local SQLite db (if used)
STUDIO_DIMA_DB_PATH = Path(os.getenv("STUDIO_DIMA_DB_PATH", str(DATA_DIR / "studio_dima.db"))).resolve()


def ensure_data_dir() -> None:
    """Ensure data directory exists before reading/writing."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

