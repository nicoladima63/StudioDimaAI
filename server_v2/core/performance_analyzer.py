"""
Modulo: performance_analyzer
Analisi prestazioni e fatturato basata su tabella 'onorario'
"""

from core.data_analyzer import DataAnalyzer
from core.data_extractor import extract_data
from collections import defaultdict

class PerformanceAnalyzer(DataAnalyzer):
    def __init__(self, prestazioni: list[dict]):
        super().__init__(prestazioni)

    def kpi_summary(self):
        kpi = {}
        kpi["tot_prestazioni"] = self.count()

        costi = [float(r["costo"]) for r in self.records if self._is_number(r.get("costo"))]
        kpi["tot_incasso"] = round(sum(costi), 2)

        per_nome = defaultdict(lambda: {"count": 0, "totale": 0.0})
        for r in self.records:
            nome = r.get("nome_prestazione") or "Sconosciuta"
            if not nome.strip():
                nome = "Sconosciuta"
            valore = float(r["costo"]) if self._is_number(r.get("costo")) else 0.0
            per_nome[nome]["count"] += 1
            per_nome[nome]["totale"] += valore

        kpi["top_volume"] = sorted(per_nome.items(), key=lambda x: x[1]["count"], reverse=True)[:10]
        kpi["top_valore"] = sorted(per_nome.items(), key=lambda x: x[1]["totale"], reverse=True)[:10]

        return kpi


if __name__ == "__main__":
    records = extract_data("onorario")
    analyzer = PerformanceAnalyzer(records)
    result = analyzer.kpi_summary()
    for k, v in result.items():
        print(k, ":", v)
