"""
Utility modules for StudioDimaAI Server V2.

This module contains consolidated utility functions:
- DBF processing utilities for data conversion and cleaning
- Common data transformation functions
- Helper utilities for consistent operations
"""

from .dbf_utils import (
    clean_dbf_value,
    convert_bytes_to_string,
    safe_get_dbf_field,
    validate_dbf_record,
    normalize_dbf_data,
    get_fornitori_mapping,
    DbfProcessor
)

__all__ = [
    'clean_dbf_value',
    'convert_bytes_to_string', 
    'safe_get_dbf_field',
    'validate_dbf_record',
    'normalize_dbf_data',
    'get_fornitori_mapping',
    'DbfProcessor'
]