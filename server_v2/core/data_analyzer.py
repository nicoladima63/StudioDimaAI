"""
Modulo: data_analyzer
Fornisce metodi comuni di analisi per tutti i dataset.
"""

from collections import Counter
from statistics import mean
from datetime import datetime

class DataAnalyzer:
    def __init__(self, records: list[dict]):
        if not records:
            raise ValueError("Dataset vuoto")
        self.records = records
        self.fields = list(records[0].keys())

    def count(self) -> int:
        return len(self.records)

    def field_names(self) -> list[str]:
        return self.fields

    def null_ratio(self, field: str) -> float:
        total = len(self.records)
        missing = sum(1 for r in self.records if not r.get(field))
        return round(missing / total, 3)

    def unique_values(self, field: str) -> list:
        return sorted(set(r[field] for r in self.records if r.get(field)))

    def most_common(self, field: str, top: int = 10):
        values = [r[field] for r in self.records if r.get(field)]
        return Counter(values).most_common(top)

    def numeric_summary(self, field: str):
        vals = [float(r[field]) for r in self.records if self._is_number(r.get(field))]
        if not vals:
            return {}
        return {
            "min": min(vals),
            "max": max(vals),
            "avg": round(mean(vals), 2),
            "count": len(vals)
        }

    def date_range(self, field: str, fmt: str = "%d/%m/%Y"):
        dates = [
            datetime.strptime(r[field], fmt)
            for r in self.records
            if self._is_date(r.get(field), fmt)
        ]
        if not dates:
            return {}
        return {"min": min(dates).strftime(fmt), "max": max(dates).strftime(fmt)}

    def group_count(self, field: str) -> dict:
        counts = Counter(r[field] for r in self.records if r.get(field))
        return dict(counts)

    @staticmethod
    def _is_number(v):
        try:
            float(v)
            return True
        except:
            return False

    @staticmethod
    def _is_date(v, fmt):
        try:
            datetime.strptime(v, fmt)
            return True
        except:
            return False
