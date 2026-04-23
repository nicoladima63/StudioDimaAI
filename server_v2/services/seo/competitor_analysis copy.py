"""
Competitor SEO Analysis.

Compares a cached main audit against competitors found by keyword search.
Returns only actionable corrective items where competitors perform better.
Uses parallel execution for speed.
"""

import logging
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

from .seo_service import run_page_audit


def _clean_host(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host

logger = logging.getLogger(__name__)

MAX_COMPETITORS = 5

# Category labels for display
CATEGORY_LABELS = {
    "on_page": "On-Page SEO",
    "content": "Qualita Contenuto",
    "technical": "SEO Tecnico",
    "schema": "Schema / Dati Strutturati",
    "images": "Immagini",
    "ai_readiness": "AI Search Readiness",
    "performance": "Performance (CWV Hints)",
}


def _extract_metrics(report: Dict[str, Any]) -> Dict[str, Any]:
    """Extract comparable metrics from a full audit report."""
    categories = report.get("categories", {})
    content_data = categories.get("content", {}).get("data", {})
    on_page_data = categories.get("on_page", {}).get("data", {})
    technical_data = categories.get("technical", {}).get("data", {})
    images_data = categories.get("images", {}).get("data", {})
    schema_data = categories.get("schema", {}).get("data", {})

    return {
        "overall_score": report.get("overall_score", 0),
        "score_label": report.get("score_label", ""),
        "word_count": content_data.get("word_count", 0),
        "meta_description": on_page_data.get("meta_description", ""),
        "title": on_page_data.get("title", ""),
        "h1_count": len(on_page_data.get("h1", [])),
        "internal_links": technical_data.get("internal_links", content_data.get("internal_links", 0)),
        "external_links": technical_data.get("external_links", content_data.get("external_links", 0)),
        "images_total": images_data.get("total", 0),
        "images_without_alt": images_data.get("without_alt", 0),
        "schema_types": schema_data.get("types_found", []),
        "has_ssl": technical_data.get("ssl", False),
        "category_scores": {
            key: cat.get("score", 0)
            for key, cat in categories.items()
        },
        "issues_summary": report.get("issues_summary", {}),
    }


def competitor_analysis(
    main_report: Dict[str, Any],
    competitor_urls: List[str],
) -> Dict[str, Any]:
    """
    Compare cached main audit against competitor URLs.

    Args:
        main_report: Pre-computed audit report for the main site
        competitor_urls: List of competitor URLs to audit and compare

    Returns:
        Report focused on corrective actions where competitors are better
    """
    # Exclude main site URL from competitor list (already audited)
    main_url = main_report.get("url", "")
    main_host = urlparse(main_url).hostname or ""
    if main_host.startswith("www."):
        main_host = main_host[4:]

    competitor_urls = [
        u for u in competitor_urls
        if _clean_host(u) != main_host
    ][:MAX_COMPETITORS]

    if not competitor_urls:
        return {"success": False, "error": "Nessun competitor da analizzare"}

    main_metrics = _extract_metrics(main_report)

    # Parallel audit of competitors only
    competitor_results = []
    with ThreadPoolExecutor(max_workers=min(len(competitor_urls), 4)) as executor:
        future_to_url = {
            executor.submit(run_page_audit, url): url
            for url in competitor_urls
        }

        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                report = future.result()
                if report.get("success"):
                    metrics = _extract_metrics(report)
                    competitor_results.append({
                        "url": report.get("url", url),
                        "score": metrics["overall_score"],
                        "score_label": metrics["score_label"],
                        "metrics": metrics,
                    })
                else:
                    competitor_results.append({
                        "url": url,
                        "error": report.get("error", "Audit fallito"),
                    })
            except Exception as e:
                logger.error(f"Audit fallito per {url}: {e}")
                competitor_results.append({"url": url, "error": str(e)})

    valid_comps = [c for c in competitor_results if "error" not in c]

    if not valid_comps:
        return {
            "success": True,
            "competitors": competitor_results,
            "corrections": [],
            "warning": "Nessun competitor analizzabile per il confronto",
        }

    # Build corrections: only where competitors do better
    corrections = _build_corrections(main_metrics, valid_comps)

    # Competitor list with scores
    competitors_summary = []
    for c in competitor_results:
        if "error" in c:
            competitors_summary.append({"url": c["url"], "error": c["error"]})
        else:
            competitors_summary.append({
                "url": c["url"],
                "score": c["score"],
                "score_label": c["score_label"],
            })

    n = len(valid_comps)
    return {
        "success": True,
        "analyzed": n,
        "failed": len(competitor_urls) - n,
        "competitors": competitors_summary,
        "corrections": corrections,
    }


def _build_corrections(
    main: Dict, competitors: List[Dict]
) -> List[Dict[str, Any]]:
    """
    Generate concrete, actionable corrections.
    Each item explains WHAT to do and WHY, referencing the best competitor.
    No abstract score comparisons - only things you can act on.
    """
    corrections = []
    n = len(competitors)

    # --- Meta description ---
    if not main["meta_description"]:
        comp_with_meta = [c for c in competitors if c["metrics"].get("meta_description")]
        if comp_with_meta:
            example = comp_with_meta[0]["metrics"]["meta_description"][:80]
            corrections.append({
                "severity": "critical",
                "action": "Aggiungi una meta description di 120-160 caratteri che descriva il servizio e la zona geografica.",
                "reason": f"{len(comp_with_meta)}/{n} competitor ce l'hanno. Senza meta description Google genera un estratto casuale dalla pagina, riducendo il CTR nei risultati di ricerca.",
                "example": f"Guarda come fa {comp_with_meta[0]['url']}: \"{example}...\"",
            })

    # --- Contenuto troppo corto ---
    avg_words = sum(c["metrics"]["word_count"] for c in competitors) / n
    diff_words = int(avg_words - main["word_count"])
    if diff_words > 100:
        best_comp = max(competitors, key=lambda c: c["metrics"]["word_count"])
        corrections.append({
            "severity": "high" if diff_words > 500 else "medium",
            "action": f"Aggiungi circa {diff_words} parole di contenuto alla pagina (hai {main['word_count']}, i competitor ne hanno in media {int(avg_words)}).",
            "reason": "Google favorisce pagine con contenuti approfonditi. Aggiungi sezioni come FAQ, descrizioni dettagliate dei servizi, casi studio o testimonianze.",
            "example": f"Il competitor con piu contenuto e {best_comp['url']} ({best_comp['metrics']['word_count']} parole).",
        })

    # --- Link interni ---
    avg_links = sum(c["metrics"]["internal_links"] for c in competitors) / n
    diff_links = int(avg_links - main["internal_links"])
    if diff_links > 2:
        best_comp = max(competitors, key=lambda c: c["metrics"]["internal_links"])
        corrections.append({
            "severity": "medium",
            "action": f"Aggiungi ~{diff_links} link interni verso altre pagine del sito (ne hai {main['internal_links']}, competitor media {int(avg_links)}).",
            "reason": "I link interni aiutano Google a scoprire e indicizzare tutte le pagine. Collega verso servizi correlati, pagina contatti, blog.",
            "example": f"Guarda {best_comp['url']} che ne usa {best_comp['metrics']['internal_links']}.",
        })

    # --- Schema markup ---
    if len(main["schema_types"]) == 0:
        comp_with_schema = [c for c in competitors if len(c["metrics"]["schema_types"]) > 0]
        if comp_with_schema:
            all_schemas = set()
            for c in comp_with_schema:
                all_schemas.update(c["metrics"]["schema_types"])
            corrections.append({
                "severity": "high",
                "action": f"Aggiungi dati strutturati schema.org alla pagina. I competitor usano: {', '.join(sorted(all_schemas))}.",
                "reason": "I dati strutturati permettono a Google di mostrare rich snippet (stelle, orari, indirizzo) nei risultati. Per uno studio medico/dentistico usa LocalBusiness, MedicalOrganization o Dentist.",
                "example": f"{len(comp_with_schema)}/{n} competitor li hanno gia implementati. Guarda {comp_with_schema[0]['url']}.",
            })

    # --- Immagini senza alt ---
    if main["images_without_alt"] > 0:
        comp_avg_missing = sum(c["metrics"]["images_without_alt"] for c in competitors) / n
        if comp_avg_missing < main["images_without_alt"]:
            corrections.append({
                "severity": "medium",
                "action": f"Aggiungi l'attributo alt a {main['images_without_alt']} immagini che ne sono prive.",
                "reason": "L'alt text migliora l'accessibilita e aiuta Google Immagini a indicizzare. Descrivi cosa mostra la foto includendo parole chiave pertinenti (es. 'studio dentistico sala operatoria').",
                "example": f"I competitor hanno in media solo {int(comp_avg_missing)} immagini senza alt.",
            })

    # --- H1 mancante ---
    if main["h1_count"] == 0:
        comp_with_h1 = [c for c in competitors if c["metrics"]["h1_count"] > 0]
        if comp_with_h1:
            corrections.append({
                "severity": "high",
                "action": "Aggiungi un tag H1 alla pagina con il titolo principale del servizio.",
                "reason": "L'H1 e il segnale piu forte per dire a Google di cosa parla la pagina. Deve contenere la keyword principale (es. 'Impianti Dentali a Agliana').",
                "example": f"{len(comp_with_h1)}/{n} competitor hanno un H1.",
            })

    # --- SSL ---
    if not main["has_ssl"]:
        comp_with_ssl = [c for c in competitors if c["metrics"].get("has_ssl")]
        if comp_with_ssl:
            corrections.append({
                "severity": "critical",
                "action": "Attiva HTTPS sul sito con un certificato SSL.",
                "reason": "Google penalizza i siti senza HTTPS. I browser mostrano 'Non sicuro' ai visitatori, riducendo la fiducia.",
                "example": f"{len(comp_with_ssl)}/{n} competitor usano HTTPS.",
            })

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    corrections.sort(key=lambda x: severity_order.get(x.get("severity", "low"), 99))

    return corrections
