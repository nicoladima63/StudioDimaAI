"""
Utility condivise per gli script studio-analytics.
Setup sys.path, JSON encoder sicuro, output helper.
"""

import sys
import os
import json
import math
import logging
from datetime import date, datetime

# Setup path per importare da server_v2
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SERVER_V2_DIR = os.path.join(PROJECT_ROOT, 'server_v2')
if SERVER_V2_DIR not in sys.path:
    sys.path.insert(0, SERVER_V2_DIR)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def _safe(val, default=0):
    """Converte NaN/Inf in un valore sicuro per JSON."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


class SafeEncoder(json.JSONEncoder):
    """JSON encoder che gestisce datetime, numpy, pandas e NaN."""

    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        try:
            import numpy as np
            if isinstance(obj, (np.integer,)):
                return int(obj)
            if isinstance(obj, (np.floating,)):
                v = float(obj)
                return None if (math.isnan(v) or math.isinf(v)) else v
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if isinstance(obj, np.bool_):
                return bool(obj)
        except ImportError:
            pass
        try:
            import pandas as pd
            if isinstance(obj, pd.Timestamp):
                return obj.isoformat()
            if isinstance(obj, pd.Timedelta):
                return obj.total_seconds()
        except ImportError:
            pass
        return super().default(obj)


def output_json(data, output_path=None):
    """Scrive JSON su file o stdout."""
    json_str = json.dumps(data, cls=SafeEncoder, indent=2, ensure_ascii=False)
    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(json_str)
        print(f"Output scritto in {output_path}")
    else:
        print(json_str)
