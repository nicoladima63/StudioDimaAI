"""
Competitor SEO Analysis - improved benchmarking logic
"""

import logging
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

from .seo_service import run_page_audit

logger = logging.getLogger(__name__)

MAX_COMPETITORS = 5


def _clean_host(url) -> str:
    if isinstance(url, dict):
        url = url.get("url", "")

    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _extract_metrics(report: Dict[str, Any]) -> Dict[str, Any]:
    categories = report.get("categories", {})
    content = categories.get("content", {}).get("data", {})
    on_page = categories.get("on_page", {}).get("data", {})
    technical = categories.get("technical", {}).get("data", {})
    images = categories.get("images", {}).get("data", {})
    schema = categories.get("schema", {}).get("data", {})

    return {
        "overall_score": report.get("overall_score", 0),
        "word_count": content.get("word_count", 0),
        "meta_description": on_page.get("meta_description", ""),
        "h1_count": len(on_page.get("h1", [])),
        "internal_links": technical.get("internal_links", 0),
        "images_without_alt": images.get("without_alt", 0),
        "schema_types": schema.get("types_found", []),
        "has_ssl": technical.get("ssl", False),
    }


def competitor_analysis(main_report, competitor_urls):

    main_host = _clean_host(main_report.get("url", ""))

    def _extract_url(u):
        if isinstance(u, dict):
            return u.get("url", "")
        return u

    competitor_urls = [
        _extract_url(u) for u in competitor_urls
        if _clean_host(_extract_url(u)) != main_host
    ][:MAX_COMPETITORS]

    if not competitor_urls:
        return {"success": False, "error": "Nessun competitor"}

    main_metrics = _extract_metrics(main_report)

    competitor_results = []

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(run_page_audit, url): url
            for url in competitor_urls
        }

        for future in as_completed(futures):
            url = futures[future]
            try:
                report = future.result()
                if report.get("success"):
                    metrics = _extract_metrics(report)
                    competitor_results.append({
                        "url": report.get("url", url),
                        "score": metrics["overall_score"],
                        "metrics": metrics,
                    })
            except Exception as e:
                logger.error(e)

    if not competitor_results:
        return {"success": False, "error": "Audit competitor falliti"}

    corrections = _build_corrections(main_metrics, competitor_results)

    return {
        "success": True,
        "corrections": corrections,
        "competitors": competitor_results
    }


def _top_benchmark(values: List[int]) -> int:
    """Top 30% benchmark"""
    values = sorted(values, reverse=True)
    index = max(0, int(len(values) * 0.3) - 1)
    return values[index]


def _build_corrections(main, competitors):

    corrections = []

    # --- CONTENUTO ---
    comp_words = [c["metrics"]["word_count"] for c in competitors]
    benchmark = _top_benchmark(comp_words)

    if benchmark - main["word_count"] > 100:
        corrections.append({
            "severity": "high",
            "action": f"Aggiungi contenuto fino a ~{benchmark} parole",
            "reason": "I competitor migliori hanno più contenuto"
        })

    # --- META ---
    if not main["meta_description"]:
        corrections.append({
            "severity": "critical",
            "action": "Aggiungi meta description",
            "reason": "Assente mentre i competitor la usano"
        })

    # --- H1 ---
    if main["h1_count"] == 0:
        corrections.append({
            "severity": "high",
            "action": "Aggiungi H1",
            "reason": "Segnale SEO principale mancante"
        })

    # --- LINK INTERNI ---
    comp_links = [c["metrics"]["internal_links"] for c in competitors]
    benchmark_links = _top_benchmark(comp_links)

    if benchmark_links - main["internal_links"] > 2:
        corrections.append({
            "severity": "medium",
            "action": f"Aumenta link interni (~{benchmark_links})",
            "reason": "I competitor ne usano di più"
        })

    # --- SCHEMA ---
    if not main["schema_types"]:
        corrections.append({
            "severity": "high",
            "action": "Aggiungi schema.org",
            "reason": "I competitor lo usano"
        })

    # --- IMMAGINI ---
    if main["images_without_alt"] > 0:
        corrections.append({
            "severity": "medium",
            "action": "Aggiungi alt alle immagini",
            "reason": "Migliora SEO immagini"
        })

    # --- SSL ---
    if not main["has_ssl"]:
        corrections.append({
            "severity": "critical",
            "action": "Attiva HTTPS",
            "reason": "Fattore ranking e trust"
        })

    return sorted(corrections, key=lambda x: ["critical", "high", "medium"].index(x["severity"]))