"""
StudioDimaAI Server V2 - Refactored Infrastructure
==================================================

This package contains the refactored server infrastructure for StudioDimaAI,
focusing on performance improvements, code consolidation, and architectural
best practices.

Key improvements:
- Centralized database connection pooling
- Consolidated DBF processing utilities  
- Repository pattern with standardized CRUD operations
- Proper error handling and logging
- Thread-safe implementations

The V2 infrastructure is designed to work alongside the existing V1 server
during the migration period.
"""

__version__ = "2.0.0"
__author__ = "StudioDimaAI Development Team"