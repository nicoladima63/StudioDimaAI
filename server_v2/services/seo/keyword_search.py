"""
Keyword-based competitor discovery via DuckDuckGo HTML search.
Enhanced: better URL extraction, smarter filtering, richer output.
"""

import logging
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse, parse_qs, unquote

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SEARCH_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

SKIP_DOMAINS = {
    "duckduckgo.com", "google.com", "google.it",
    "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "linkedin.com", "wikipedia.org", "amazon.com", "amazon.it",
}

AGGREGATOR_DOMAINS = {
    "miodottore.it", "dottori.it", "doctolib.it",
    "topdoctors.it", "pazienti.it",
    "paginegialle.it", "yelp.com", "virgilio.it",
    "dentisti.it", "dentisti24.com",
    "tripadvisor.it", "trustpilot.com",
}

AGGREGATOR_PATTERNS = {
    "trova", "elenco", "directory", "lista",
    "recensioni", "review", "rating",
    "prenota", "booking", "preventiv",
    "pagine", "yellow",
}


def _is_aggregator(clean_host: str) -> bool:
    if clean_host in AGGREGATOR_DOMAINS:
        return True

    if any(pat in clean_host for pat in AGGREGATOR_PATTERNS):
        # filtro intelligente
        if clean_host.count("-") > 1 or len(clean_host.split(".")) > 3:
            return True

    return False


def _extract_real_url(href: str) -> str:
    """Extract real URL from DuckDuckGo redirect"""
    if "uddg=" in href:
        parsed = parse_qs(urlparse(href).query)
        return unquote(parsed.get("uddg", [""])[0])
    return href


def search_competitors(
    keywords: str,
    exclude_domain: Optional[str] = None,
    num_results: int = 5,
) -> List[Dict[str, Any]]:

    num_results = min(num_results, 10)

    queries = [
        keywords,
        f"{keywords} studio dentistico",
        f"{keywords} sito ufficiale",
    ]

    found_domains = set()
    results = []

    for query in queries:
        try:
            resp = requests.post(
                "https://html.duckduckgo.com/html/",
                headers={"User-Agent": SEARCH_USER_AGENT},
                data={"q": query},
                timeout=15,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Search failed: {e}")
            continue

        soup = BeautifulSoup(resp.text, "html.parser")

        for a_tag in soup.select("a.result__a"):
            href = a_tag.get("href", "")
            if not href:
                continue

            href = _extract_real_url(href)

            if not href.startswith("http"):
                continue

            parsed = urlparse(href)
            hostname = (parsed.hostname or "").lower()

            clean_host = hostname[4:] if hostname.startswith("www.") else hostname

            if clean_host in SKIP_DOMAINS:
                continue

            if _is_aggregator(clean_host):
                continue

            if clean_host in found_domains:
                continue

            found_domains.add(clean_host)

            title = a_tag.get_text(strip=True)

            snippet_tag = a_tag.find_parent("div", class_="result")
            snippet = ""
            if snippet_tag:
                s = snippet_tag.select_one(".result__snippet")
                if s:
                    snippet = s.get_text(strip=True)

            results.append({
                "url": href,
                "domain": clean_host,
                "title": title,
                "snippet": snippet,
            })

            if len(results) >= num_results:
                return results

    return results