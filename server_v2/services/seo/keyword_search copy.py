"""
Keyword-based competitor discovery via DuckDuckGo HTML search.

Searches for given keywords and returns top organic URLs,
filtering out directories/aggregators to find real competitor sites.
"""

import logging
from typing import List, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SEARCH_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Domains to always skip (social, big platforms)
SKIP_DOMAINS = {
    "duckduckgo.com", "google.com", "google.it",
    "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "linkedin.com", "wikipedia.org", "amazon.com", "amazon.it",
}

# Directories and aggregators - not real SEO competitors
AGGREGATOR_DOMAINS = {
    # Directories mediche/dentistiche
    "miodottore.it", "dottori.it", "doctolib.it", "doctolib.fr",
    "topdoctors.it", "pazienti.it", "medicitalia.it",
    # Directory generiche
    "paginegialle.it", "paginebianche.it", "yelp.com", "yelp.it",
    "tuttocitta.it", "virgilio.it", "cylex.it", "hotfrog.it",
    "europages.it", "infobel.com", "misterimprese.it",
    # Aggregatori settoriali
    "dentisti.it", "dentisti24.com", "dentisti-italia.it",
    "studi-dentistici.it", "trovadentista.it",
    "cupsolidale.it", "ssn.it",
    # Review / listing
    "tripadvisor.it", "tripadvisor.com",
    "trustpilot.com", "trustpilot.it",
    "google.com", "maps.google.com",
    # Altre directory
    "firmania.it", "cylex-italia.it", "cylex.it",
    "italia-info.com", "comuni-italiani.it",
    "guidamonaci.it", "kompass.com",
    "informazione-aziende.it", "italiaonline.it",
    "oneflare.com.au", "starofservice.it",
    "preventivi.it", "prontopro.it",
    "trova-aperto.it", "italiarecensioni.com",
    "docplanner.com", "jameda.it",
}

# Keywords in domain name that indicate a directory/aggregator
AGGREGATOR_PATTERNS = {
    "dentist", "doctor", "medic", "trova", "cerco",
    "elenco", "directory", "lista", "annunci",
    "recensioni", "review", "rating",
    "prenota", "booking", "preventiv",
    "pagine", "yellow", "info-",
}


def search_competitors(
    keywords: str,
    exclude_domain: Optional[str] = None,
    num_results: int = 5,
) -> List[str]:
    """
    Search DuckDuckGo for keywords and return real competitor URLs.

    Filters out aggregators and directories to find actual competitor sites.

    Args:
        keywords: Search query string
        exclude_domain: Domain to exclude from results (the main site)
        num_results: How many competitor URLs to return (max 10)

    Returns:
        List of unique competitor homepage URLs
    """
    num_results = min(num_results, 10)

    # Normalize exclude domain
    exclude_host = None
    if exclude_domain:
        exclude_domain = exclude_domain.strip().lower()
        if exclude_domain.startswith(("http://", "https://")):
            exclude_host = urlparse(exclude_domain).hostname
        else:
            exclude_host = exclude_domain
        if exclude_host and exclude_host.startswith("www."):
            exclude_host = exclude_host[4:]

    all_skip = SKIP_DOMAINS | AGGREGATOR_DOMAINS

    # DuckDuckGo HTML search (POST, no JS needed)
    # Request more results to compensate for filtering
    try:
        resp = requests.post(
            "https://html.duckduckgo.com/html/",
            headers={"User-Agent": SEARCH_USER_AGENT},
            data={"q": keywords},
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"DuckDuckGo search failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    found_domains = set()
    results = []

    for a_tag in soup.select("a.result__a"):
        href = a_tag.get("href", "")
        if not href.startswith(("http://", "https://")):
            continue

        parsed = urlparse(href)
        hostname = (parsed.hostname or "").lower()

        # Normalize
        clean_host = hostname
        if clean_host.startswith("www."):
            clean_host = clean_host[4:]

        # Skip unwanted domains and aggregators
        if any(clean_host.endswith(d) or clean_host == d for d in all_skip):
            continue

        # Skip domains that look like aggregators by name pattern
        if any(pat in clean_host for pat in AGGREGATOR_PATTERNS):
            continue

        # NOTE: non escludiamo piu il sito principale dai risultati
        # cosi l'utente vede se compare nella ricerca

        # Deduplicate
        if clean_host in found_domains:
            continue

        found_domains.add(clean_host)
        results.append(f"https://{hostname}")

        if len(results) >= num_results:
            break

    logger.info(
        f"Keyword search '{keywords}': found {len(results)} competitors "
        f"(filtered from {len(soup.select('a.result__a'))} raw results)"
    )
    return results
