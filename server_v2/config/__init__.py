"""Configuration module for StudioDimaAI Server V2."""

from core.config import Config
from .flask_config import FlaskConfig, get_config

__all__ = ['Config', 'FlaskConfig', 'get_config']