"""
SEO Analysis Service for StudioDimaAI.

Provides comprehensive SEO analysis capabilities including:
- Full page audit (on-page, content quality, technical, schema, images)
- E-E-A-T framework evaluation
- Core Web Vitals hints
- Schema.org markup detection and validation
- AI Search Optimization (GEO) readiness

Inspired by claude-seo (https://github.com/AgriciDaniel/claude-seo)
but fully integrated as a native Python service.
"""

import logging
import re
import json
import ipaddress
import socket
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, urljoin
from datetime import datetime

import urllib3
import requests
from bs4 import BeautifulSoup

# Suppress SSL warnings for environments with certificate issues
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 StudioDimaAI-SEO/1.0"
)

DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

# Scoring weights (from claude-seo methodology)
SCORING_WEIGHTS = {
    "technical": 0.22,
    "content": 0.23,
    "on_page": 0.20,
    "schema": 0.10,
    "performance": 0.10,
    "ai_readiness": 0.10,
    "images": 0.05,
}

# Quality gates
MIN_WORD_COUNTS = {
    "homepage": 500,
    "service": 800,
    "blog": 1500,
    "product": 300,
    "location": 500,
    "about": 400,
    "landing": 600,
    "faq": 800,
    "default": 300,
}

TITLE_MIN_LENGTH = 30
TITLE_MAX_LENGTH = 60
META_DESC_MIN_LENGTH = 120
META_DESC_MAX_LENGTH = 160

# Deprecated schema types - never recommend these
DEPRECATED_SCHEMAS = {"HowTo", "SpecialAnnouncement", "CourseInfo",
                      "EstimatedSalary", "LearningVideo", "ClaimReview",
                      "VehicleListing", "PracticeProblem", "Dataset"}

RESTRICTED_SCHEMAS = {"FAQPage"}  # Only gov/health sites

# Known AI crawlers for robots.txt analysis
AI_CRAWLERS = {
    "GPTBot": {"company": "OpenAI", "purpose": "Model training"},
    "ChatGPT-User": {"company": "OpenAI", "purpose": "Real-time browsing"},
    "ClaudeBot": {"company": "Anthropic", "purpose": "Model training"},
    "PerplexityBot": {"company": "Perplexity", "purpose": "Search + training"},
    "Bytespider": {"company": "ByteDance", "purpose": "Model training"},
    "Google-Extended": {"company": "Google", "purpose": "Gemini training (NOT search)"},
    "CCBot": {"company": "Common Crawl", "purpose": "Open dataset"},
}


# ---------------------------------------------------------------------------
# Fetch utilities
# ---------------------------------------------------------------------------

def fetch_page(url: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Fetch a web page and return response details.

    Returns dict with: url, status_code, content, headers, redirect_chain, error
    """
    result = {
        "url": url,
        "status_code": None,
        "content": None,
        "headers": {},
        "redirect_chain": [],
        "error": None,
    }

    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"
        parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        result["error"] = f"Schema URL non valido: {parsed.scheme}"
        return result

    # SSRF prevention
    try:
        resolved_ip = socket.gethostbyname(parsed.hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            result["error"] = f"Bloccato: URL risolve a IP privato/interno ({resolved_ip})"
            return result
    except (socket.gaierror, ValueError):
        pass

    try:
        session = requests.Session()
        session.max_redirects = 5

        # Try with SSL verification first, fallback to verify=False
        try:
            response = session.get(url, headers=DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
        except requests.exceptions.SSLError:
            logger.warning(f"SSL verification failed for {url}, retrying without verification")
            response = session.get(url, headers=DEFAULT_HEADERS, timeout=timeout, allow_redirects=True, verify=False)

        result["url"] = response.url
        result["status_code"] = response.status_code
        result["content"] = response.text
        result["headers"] = dict(response.headers)

        if response.history:
            result["redirect_chain"] = [
                {"url": r.url, "status_code": r.status_code}
                for r in response.history
            ]

    except requests.exceptions.Timeout:
        result["error"] = f"Timeout dopo {timeout} secondi"
    except requests.exceptions.SSLError as e:
        result["error"] = f"Errore SSL: {e}"
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Errore di connessione: {e}"
    except requests.exceptions.RequestException as e:
        result["error"] = f"Richiesta fallita: {e}"

    return result


# ---------------------------------------------------------------------------
# HTML Parsing
# ---------------------------------------------------------------------------

def parse_html(html: str, base_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Parse HTML and extract SEO-relevant elements.
    """
    try:
        import lxml  # noqa: F401
        parser = "lxml"
    except ImportError:
        parser = "html.parser"

    soup = BeautifulSoup(html, parser)

    result = {
        "title": None,
        "meta_description": None,
        "meta_robots": None,
        "canonical": None,
        "h1": [],
        "h2": [],
        "h3": [],
        "images": [],
        "links": {"internal": [], "external": []},
        "schema": [],
        "open_graph": {},
        "twitter_card": {},
        "word_count": 0,
        "hreflang": [],
        "lang": None,
        "viewport": None,
        "charset": None,
    }

    # HTML lang attribute
    html_tag = soup.find("html")
    if html_tag:
        result["lang"] = html_tag.get("lang")

    # Title
    title_tag = soup.find("title")
    if title_tag:
        result["title"] = title_tag.get_text(strip=True)

    # Meta tags
    for meta in soup.find_all("meta"):
        name = meta.get("name", "").lower()
        property_attr = meta.get("property", "").lower()
        content = meta.get("content", "")
        charset = meta.get("charset")

        if charset:
            result["charset"] = charset

        if name == "description":
            result["meta_description"] = content
        elif name == "robots":
            result["meta_robots"] = content
        elif name == "viewport":
            result["viewport"] = content

        # Open Graph
        if property_attr.startswith("og:"):
            result["open_graph"][property_attr] = content

        # Twitter Card
        if name.startswith("twitter:"):
            result["twitter_card"][name] = content

    # Canonical
    canonical = soup.find("link", rel="canonical")
    if canonical:
        result["canonical"] = canonical.get("href")

    # Hreflang
    for link in soup.find_all("link", rel="alternate"):
        hreflang = link.get("hreflang")
        if hreflang:
            result["hreflang"].append({
                "lang": hreflang,
                "href": link.get("href"),
            })

    # Headings
    for tag in ["h1", "h2", "h3"]:
        for heading in soup.find_all(tag):
            text = heading.get_text(strip=True)
            if text:
                result[tag].append(text)

    # Images
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if base_url and src:
            src = urljoin(base_url, src)

        result["images"].append({
            "src": src,
            "alt": img.get("alt"),
            "width": img.get("width"),
            "height": img.get("height"),
            "loading": img.get("loading"),
        })

    # Links
    if base_url:
        base_domain = urlparse(base_url).netloc
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if not href or href.startswith("#") or href.startswith("javascript:"):
                continue

            full_url = urljoin(base_url, href)
            link_parsed = urlparse(full_url)

            link_data = {
                "href": full_url,
                "text": a.get_text(strip=True)[:100],
                "rel": a.get("rel", []),
                "nofollow": "nofollow" in (a.get("rel") or []),
            }

            if link_parsed.netloc == base_domain:
                result["links"]["internal"].append(link_data)
            else:
                result["links"]["external"].append(link_data)

    # Schema (JSON-LD)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            schema_data = json.loads(script.string)
            result["schema"].append(schema_data)
        except (json.JSONDecodeError, TypeError):
            pass

    # Word count (visible text only)
    text_soup = BeautifulSoup(html, parser)
    for element in text_soup(["script", "style", "nav", "footer", "header"]):
        element.decompose()
    text = text_soup.get_text(separator=" ", strip=True)
    words = re.findall(r"\b\w+\b", text)
    result["word_count"] = len(words)

    return result


# ---------------------------------------------------------------------------
# Analyzers
# ---------------------------------------------------------------------------

def _analyze_on_page(parsed: Dict, url: str) -> Dict[str, Any]:
    """Analyze on-page SEO elements."""
    issues = []
    score = 100

    # Title analysis
    title = parsed.get("title")
    if not title:
        issues.append({"severity": "critical", "message": "Tag <title> mancante"})
        score -= 25
    else:
        title_len = len(title)
        if title_len < TITLE_MIN_LENGTH:
            issues.append({
                "severity": "high",
                "message": f"Title troppo corto ({title_len} car.). Min consigliati: {TITLE_MIN_LENGTH}"
            })
            score -= 10
        elif title_len > TITLE_MAX_LENGTH:
            issues.append({
                "severity": "medium",
                "message": f"Title troppo lungo ({title_len} car.). Max consigliati: {TITLE_MAX_LENGTH}. Google potrebbe troncarlo."
            })
            score -= 5

    # Meta description
    meta_desc = parsed.get("meta_description")
    if not meta_desc:
        issues.append({"severity": "high", "message": "Meta description mancante"})
        score -= 15
    else:
        desc_len = len(meta_desc)
        if desc_len < META_DESC_MIN_LENGTH:
            issues.append({
                "severity": "medium",
                "message": f"Meta description troppo corta ({desc_len} car.). Min: {META_DESC_MIN_LENGTH}"
            })
            score -= 5
        elif desc_len > META_DESC_MAX_LENGTH:
            issues.append({
                "severity": "low",
                "message": f"Meta description troppo lunga ({desc_len} car.). Max: {META_DESC_MAX_LENGTH}"
            })
            score -= 3

    # H1
    h1_list = parsed.get("h1", [])
    if len(h1_list) == 0:
        issues.append({"severity": "critical", "message": "Nessun tag H1 trovato"})
        score -= 20
    elif len(h1_list) > 1:
        issues.append({
            "severity": "medium",
            "message": f"Troppi tag H1: {len(h1_list)}. Ideale: esattamente 1 per pagina."
        })
        score -= 5

    # Heading hierarchy
    h2_list = parsed.get("h2", [])
    h3_list = parsed.get("h3", [])
    if h1_list and not h2_list and h3_list:
        issues.append({
            "severity": "medium",
            "message": "Struttura heading incompleta: H3 presenti senza H2 (livelli saltati)"
        })
        score -= 5

    # Canonical
    canonical = parsed.get("canonical")
    if not canonical:
        issues.append({"severity": "medium", "message": "Tag canonical mancante"})
        score -= 5

    # Meta robots
    meta_robots = parsed.get("meta_robots", "")
    if meta_robots and "noindex" in meta_robots.lower():
        issues.append({
            "severity": "critical",
            "message": "Pagina impostata come noindex! Non verrà indicizzata da Google."
        })
        score -= 30

    # Open Graph
    og = parsed.get("open_graph", {})
    og_required = ["og:title", "og:description", "og:image", "og:url"]
    og_missing = [k for k in og_required if k not in og]
    if og_missing:
        issues.append({
            "severity": "medium",
            "message": f"Tag Open Graph mancanti: {', '.join(og_missing)}. Condivisioni social degradate."
        })
        score -= 3

    # Twitter Card
    tc = parsed.get("twitter_card", {})
    if not tc:
        issues.append({
            "severity": "low",
            "message": "Tag Twitter Card mancanti"
        })
        score -= 2

    # Viewport
    if not parsed.get("viewport"):
        issues.append({
            "severity": "critical",
            "message": "Meta viewport mancante. Sito non ottimizzato per mobile."
        })
        score -= 15

    # Lang attribute
    if not parsed.get("lang"):
        issues.append({
            "severity": "medium",
            "message": "Attributo lang mancante nel tag <html>"
        })
        score -= 3

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "title": title,
            "title_length": len(title) if title else 0,
            "meta_description": meta_desc,
            "meta_description_length": len(meta_desc) if meta_desc else 0,
            "h1_count": len(h1_list),
            "h1_values": h1_list,
            "h2_count": len(h2_list),
            "h3_count": len(h3_list),
            "canonical": canonical,
            "has_viewport": bool(parsed.get("viewport")),
            "has_lang": bool(parsed.get("lang")),
            "og_tags": len(og),
            "twitter_tags": len(tc),
        }
    }


def _analyze_content(parsed: Dict) -> Dict[str, Any]:
    """Analyze content quality and E-E-A-T signals."""
    issues = []
    score = 100
    word_count = parsed.get("word_count", 0)

    # Word count
    min_words = MIN_WORD_COUNTS["default"]
    if word_count < min_words:
        issues.append({
            "severity": "high",
            "message": f"Contenuto molto scarso: {word_count} parole. Minimo consigliato: {min_words}"
        })
        score -= 25
    elif word_count < 500:
        issues.append({
            "severity": "medium",
            "message": f"Contenuto leggero: {word_count} parole. Per un buon posizionamento servono almeno 500."
        })
        score -= 10

    # Readability estimate (sentence and paragraph length)
    # Basic Flesch-like heuristic based on word count and heading density
    h2_count = len(parsed.get("h2", []))
    h3_count = len(parsed.get("h3", []))
    heading_count = len(parsed.get("h1", [])) + h2_count + h3_count

    if word_count > 800 and heading_count < 3:
        issues.append({
            "severity": "medium",
            "message": f"Contenuto lungo ({word_count} parole) con pochi heading ({heading_count}). "
                       "Migliora la scansionabilità con più H2/H3."
        })
        score -= 8

    # Internal links
    internal_links = len(parsed.get("links", {}).get("internal", []))
    expected_links = max(3, word_count // 300)
    if internal_links < 2:
        issues.append({
            "severity": "high",
            "message": f"Solo {internal_links} link interni. Consigliati almeno {expected_links} per il linking interno."
        })
        score -= 10
    elif internal_links < expected_links:
        issues.append({
            "severity": "low",
            "message": f"{internal_links} link interni trovati. Potresti aggiungerne altri ({expected_links} consigliati)."
        })
        score -= 3

    # External links to authoritative sources
    external_links = len(parsed.get("links", {}).get("external", []))
    if external_links == 0 and word_count > 500:
        issues.append({
            "severity": "low",
            "message": "Nessun link esterno. Citare fonti autorevoli migliora la credibilità (E-E-A-T)."
        })
        score -= 5

    # E-E-A-T basic signals (what we can detect from HTML)
    eeat_signals = {
        "experience": 0,
        "expertise": 0,
        "authoritativeness": 0,
        "trustworthiness": 0,
    }

    # Check for author information (expertise/experience signal)
    # We look for common patterns in the parsed data
    schema_data = parsed.get("schema", [])
    has_author = False
    for schema in schema_data:
        if isinstance(schema, dict):
            if schema.get("author") or schema.get("@type") == "Person":
                has_author = True
                eeat_signals["expertise"] += 25
                break

    if not has_author:
        issues.append({
            "severity": "medium",
            "message": "Nessuna informazione autore rilevata. Aggiungi author bio per migliorare l'E-E-A-T."
        })
        score -= 5

    # Trustworthiness: HTTPS, contact info hints
    # (HTTPS checked in technical section)

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "word_count": word_count,
            "heading_count": heading_count,
            "internal_links": internal_links,
            "external_links": external_links,
            "has_author": has_author,
            "eeat_signals": eeat_signals,
        }
    }


def _analyze_technical(parsed: Dict, fetch_result: Dict) -> Dict[str, Any]:
    """Analyze technical SEO aspects."""
    issues = []
    score = 100

    url = fetch_result.get("url", "")
    headers = fetch_result.get("headers", {})
    status_code = fetch_result.get("status_code")

    # HTTPS
    if url.startswith("http://"):
        issues.append({
            "severity": "critical",
            "message": "Il sito non usa HTTPS! Questo è un fattore di ranking negativo."
        })
        score -= 25

    # Status code
    if status_code and status_code != 200:
        issues.append({
            "severity": "high",
            "message": f"Status code: {status_code} (atteso: 200)"
        })
        score -= 15

    # Redirects
    redirect_chain = fetch_result.get("redirect_chain", [])
    if len(redirect_chain) > 2:
        issues.append({
            "severity": "high",
            "message": f"Catena di redirect troppo lunga: {len(redirect_chain)} hop. Max consigliato: 1."
        })
        score -= 10

    # Security headers
    security_headers = {
        "Strict-Transport-Security": "HSTS",
        "Content-Security-Policy": "CSP",
        "X-Frame-Options": "X-Frame-Options",
        "X-Content-Type-Options": "X-Content-Type-Options",
        "Referrer-Policy": "Referrer-Policy",
    }

    missing_security = []
    for header, label in security_headers.items():
        if header.lower() not in {h.lower() for h in headers.keys()}:
            missing_security.append(label)

    if missing_security:
        severity = "high" if "HSTS" in missing_security else "medium"
        issues.append({
            "severity": severity,
            "message": f"Header di sicurezza mancanti: {', '.join(missing_security)}"
        })
        score -= min(15, len(missing_security) * 3)

    # URL structure
    parsed_url = urlparse(url)
    path = parsed_url.path
    if len(url) > 100:
        issues.append({
            "severity": "low",
            "message": f"URL troppo lungo ({len(url)} car.). Mantieni sotto 100 caratteri."
        })
        score -= 3

    if "?" in path or any(c.isupper() for c in path):
        issues.append({
            "severity": "low",
            "message": "URL contiene parametri o lettere maiuscole. Usa URL puliti, lowercase e con trattini."
        })
        score -= 3

    # Charset
    if not parsed.get("charset"):
        issues.append({
            "severity": "low",
            "message": "Charset non dichiarato nel meta tag. Aggiungi <meta charset='utf-8'>"
        })
        score -= 2

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "https": url.startswith("https://"),
            "status_code": status_code,
            "redirect_count": len(redirect_chain),
            "redirect_chain": redirect_chain,
            "missing_security_headers": missing_security,
            "url_length": len(url),
        }
    }


def _analyze_schema(parsed: Dict) -> Dict[str, Any]:
    """Analyze Schema.org structured data."""
    issues = []
    score = 100
    schemas = parsed.get("schema", [])

    if not schemas:
        issues.append({
            "severity": "high",
            "message": "Nessun markup Schema.org (JSON-LD) trovato. Aggiungere dati strutturati migliora la visibilità nei risultati di ricerca."
        })
        score -= 40

        return {
            "score": max(0, score),
            "issues": issues,
            "data": {
                "schema_count": 0,
                "types_found": [],
                "deprecated_found": [],
                "validation_issues": [],
            }
        }

    types_found = []
    deprecated_found = []
    validation_issues = []

    for schema in schemas:
        if not isinstance(schema, dict):
            continue

        schema_type = schema.get("@type", "Unknown")
        if isinstance(schema_type, list):
            schema_type = schema_type[0] if schema_type else "Unknown"
        types_found.append(schema_type)

        # Check deprecated
        if schema_type in DEPRECATED_SCHEMAS:
            deprecated_found.append(schema_type)
            issues.append({
                "severity": "high",
                "message": f"Schema '{schema_type}' è deprecato. Rimuoverlo."
            })
            score -= 10

        # Check restricted
        if schema_type in RESTRICTED_SCHEMAS:
            issues.append({
                "severity": "medium",
                "message": f"Schema '{schema_type}' è limitato a siti governativi/sanitari per i rich results di Google. "
                           "Conserva per visibilità AI (ChatGPT, Perplexity)."
            })
            score -= 3

        # Basic validation
        if not schema.get("@context"):
            validation_issues.append(f"{schema_type}: manca @context")
            score -= 5
        elif "http://" in str(schema.get("@context", "")):
            validation_issues.append(f"{schema_type}: @context usa http:// invece di https://")
            score -= 3

        # Check for placeholder text
        for key, value in schema.items():
            if isinstance(value, str) and ("[" in value and "]" in value):
                validation_issues.append(f"{schema_type}.{key}: possibile testo placeholder")
                score -= 5

    if validation_issues:
        issues.append({
            "severity": "medium",
            "message": f"Problemi di validazione schema: {'; '.join(validation_issues[:5])}"
        })

    # Suggest missing common schemas
    common_missing = []
    type_set = set(types_found)
    if "Organization" not in type_set and "LocalBusiness" not in type_set:
        common_missing.append("Organization/LocalBusiness")
    if "WebSite" not in type_set:
        common_missing.append("WebSite (con SearchAction per sitelinks)")
    if "BreadcrumbList" not in type_set:
        common_missing.append("BreadcrumbList")

    if common_missing:
        issues.append({
            "severity": "low",
            "message": f"Schema consigliati mancanti: {', '.join(common_missing)}"
        })
        score -= len(common_missing) * 3

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "schema_count": len(schemas),
            "types_found": types_found,
            "deprecated_found": deprecated_found,
            "validation_issues": validation_issues,
        }
    }


def _analyze_images(parsed: Dict) -> Dict[str, Any]:
    """Analyze image optimization."""
    issues = []
    score = 100
    images = parsed.get("images", [])

    if not images:
        return {
            "score": score,
            "issues": [{"severity": "low", "message": "Nessuna immagine trovata sulla pagina."}],
            "data": {"total_images": 0, "missing_alt": 0, "missing_dimensions": 0}
        }

    missing_alt = 0
    empty_alt = 0
    missing_dimensions = 0
    missing_lazy = 0
    non_webp = 0

    for i, img in enumerate(images):
        alt = img.get("alt")
        if alt is None:
            missing_alt += 1
        elif alt == "":
            empty_alt += 1  # Could be decorative, OK

        if not img.get("width") or not img.get("height"):
            missing_dimensions += 1

        if not img.get("loading") and i > 2:  # Below fold images
            missing_lazy += 1

        src = img.get("src", "")
        ext = src.rsplit(".", 1)[-1].lower() if "." in src else ""
        if ext in ("jpg", "jpeg", "png", "bmp", "tiff"):
            non_webp += 1

    if missing_alt > 0:
        issues.append({
            "severity": "high",
            "message": f"{missing_alt} immagini senza attributo alt. Fondamentale per accessibilità e SEO."
        })
        score -= min(30, missing_alt * 5)

    if missing_dimensions > 0:
        issues.append({
            "severity": "medium",
            "message": f"{missing_dimensions} immagini senza dimensioni (width/height). Causa CLS (spostamento layout)."
        })
        score -= min(15, missing_dimensions * 3)

    if missing_lazy > 0:
        issues.append({
            "severity": "low",
            "message": f"{missing_lazy} immagini below-fold senza loading='lazy'. Rallentano il caricamento."
        })
        score -= min(10, missing_lazy * 2)

    if non_webp > 0:
        issues.append({
            "severity": "low",
            "message": f"{non_webp} immagini in formato non ottimale (JPEG/PNG). Converti in WebP/AVIF."
        })
        score -= min(10, non_webp * 2)

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "total_images": len(images),
            "missing_alt": missing_alt,
            "decorative_images": empty_alt,
            "missing_dimensions": missing_dimensions,
            "missing_lazy_loading": missing_lazy,
            "non_optimized_format": non_webp,
        }
    }


def _analyze_ai_readiness(parsed: Dict) -> Dict[str, Any]:
    """Analyze readiness for AI search engines (GEO)."""
    issues = []
    score = 100

    # Structured content (headings)
    h1_count = len(parsed.get("h1", []))
    h2_count = len(parsed.get("h2", []))
    h3_count = len(parsed.get("h3", []))
    total_headings = h1_count + h2_count + h3_count

    if total_headings < 3:
        issues.append({
            "severity": "medium",
            "message": "Struttura heading insufficiente per AI. Gli engine AI estraggono meglio da contenuti ben strutturati."
        })
        score -= 15

    # Schema markup (AI systems use it)
    schemas = parsed.get("schema", [])
    if not schemas:
        issues.append({
            "severity": "high",
            "message": "Nessun dato strutturato. I sistemi AI citano 2.5x più spesso contenuti con Schema.org."
        })
        score -= 20

    # Word count (AI prefers comprehensive content)
    word_count = parsed.get("word_count", 0)
    if word_count < 300:
        issues.append({
            "severity": "high",
            "message": "Contenuto troppo scarso per essere citato da AI. Servono almeno 300+ parole di valore."
        })
        score -= 20

    # Lists and tables (AI loves structured data)
    try:
        soup_check = BeautifulSoup(html, "html.parser")
        has_lists = len(soup_check.find_all(["ul", "ol"])) > 0
        has_tables = len(soup_check.find_all("table")) > 0
        if not has_lists and not has_tables:
            issues.append({
                "severity": "low",
                "message": "Suggerimento: usa tabelle e liste puntate per dati comparativi. Gli AI engine li preferiscono."
            })
            score -= 3
    except Exception:
        pass

    # Open Graph / metadata completeness
    og = parsed.get("open_graph", {})
    if not og.get("og:title") or not og.get("og:description"):
        issues.append({
            "severity": "medium",
            "message": "Metadati Open Graph incompleti. Utili per come i motori AI rappresentano il tuo contenuto."
        })
        score -= 8

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "heading_structure": f"H1:{h1_count} H2:{h2_count} H3:{h3_count}",
            "has_schema": len(schemas) > 0,
            "word_count": word_count,
            "has_og_metadata": bool(og),
        }
    }


# ---------------------------------------------------------------------------
# Performance hints (from HTML analysis only, no real CWV measurement)
# ---------------------------------------------------------------------------

def _analyze_performance_hints(parsed: Dict, html: str) -> Dict[str, Any]:
    """Analyze potential performance issues from HTML."""
    issues = []
    score = 100

    # Check for render-blocking potential
    try:
        soup = BeautifulSoup(html, "html.parser")

        # Count external scripts without async/defer
        blocking_scripts = 0
        total_scripts = 0
        for script in soup.find_all("script", src=True):
            total_scripts += 1
            # type="module" is deferred by HTML spec
            if script.get("type") == "module":
                continue
            if not script.get("async") and not script.get("defer"):
                blocking_scripts += 1

        if blocking_scripts > 2:
            issues.append({
                "severity": "high",
                "message": f"{blocking_scripts} script bloccanti (senza async/defer). Impattano LCP e INP."
            })
            score -= min(20, blocking_scripts * 5)
        elif blocking_scripts > 0:
            issues.append({
                "severity": "medium",
                "message": f"{blocking_scripts} script bloccanti (senza async/defer). Aggiungi async o defer."
            })
            score -= blocking_scripts * 3

        # Count external stylesheets
        stylesheets = len(soup.find_all("link", rel="stylesheet"))
        if stylesheets > 5:
            issues.append({
                "severity": "medium",
                "message": f"{stylesheets} fogli di stile esterni. Considera di combinarne alcuni per ridurre le richieste."
            })
            score -= 5

        # Check for large inline styles/scripts
        inline_scripts = soup.find_all("script", src=False)
        large_inline = sum(1 for s in inline_scripts if s.string and len(s.string) > 5000)
        if large_inline:
            issues.append({
                "severity": "medium",
                "message": f"{large_inline} script inline molto grandi. Esternalizzali per il caching."
            })
            score -= 5

        # Viewport meta (CLS prevention)
        if not parsed.get("viewport"):
            issues.append({
                "severity": "critical",
                "message": "Meta viewport mancante. Mobile-first indexing è attivo dal luglio 2024."
            })
            score -= 15

        # Image dimensions (CLS)
        images_without_dims = sum(1 for img in parsed.get("images", [])
                                  if not img.get("width") or not img.get("height"))
        if images_without_dims > 0:
            issues.append({
                "severity": "medium",
                "message": f"{images_without_dims} immagini senza dimensioni esplicite. Causa CLS (Cumulative Layout Shift)."
            })
            score -= min(10, images_without_dims * 2)

    except Exception as e:
        logger.warning(f"Performance hint analysis error: {e}")

    return {
        "score": max(0, score),
        "issues": issues,
        "data": {
            "blocking_scripts": blocking_scripts if 'blocking_scripts' in dir() else 0,
            "total_scripts": total_scripts if 'total_scripts' in dir() else 0,
            "external_stylesheets": stylesheets if 'stylesheets' in dir() else 0,
        }
    }


# ---------------------------------------------------------------------------
# Main audit function
# ---------------------------------------------------------------------------

def run_page_audit(url: str) -> Dict[str, Any]:
    """
    Run a comprehensive SEO audit on a single page.

    Args:
        url: The URL to audit

    Returns:
        Complete audit report with scores and recommendations
    """
    logger.info(f"Starting SEO audit for: {url}")
    start_time = datetime.now()

    # Step 1: Fetch page
    fetch_result = fetch_page(url)
    if fetch_result["error"]:
        return {
            "success": False,
            "url": url,
            "error": fetch_result["error"],
            "timestamp": datetime.now().isoformat(),
        }

    html = fetch_result["content"]
    final_url = fetch_result["url"]

    # Step 2: Parse HTML
    parsed = parse_html(html, base_url=final_url)

    # Step 3: Run all analyzers
    on_page = _analyze_on_page(parsed, final_url)
    content = _analyze_content(parsed)
    technical = _analyze_technical(parsed, fetch_result)
    schema = _analyze_schema(parsed)
    images = _analyze_images(parsed)
    ai_readiness = _analyze_ai_readiness(parsed)
    performance = _analyze_performance_hints(parsed, html)

    # Step 4: Calculate overall score
    overall_score = round(
        on_page["score"] * SCORING_WEIGHTS["on_page"] +
        content["score"] * SCORING_WEIGHTS["content"] +
        technical["score"] * SCORING_WEIGHTS["technical"] +
        schema["score"] * SCORING_WEIGHTS["schema"] +
        performance["score"] * SCORING_WEIGHTS["performance"] +
        ai_readiness["score"] * SCORING_WEIGHTS["ai_readiness"] +
        images["score"] * SCORING_WEIGHTS["images"]
    )

    # Step 5: Collect all issues and sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_issues = []

    for category_name, analysis in [
        ("On-Page SEO", on_page),
        ("Qualità Contenuto", content),
        ("SEO Tecnico", technical),
        ("Schema / Dati Strutturati", schema),
        ("Immagini", images),
        ("AI Search Readiness", ai_readiness),
        ("Performance", performance),
    ]:
        for issue in analysis.get("issues", []):
            all_issues.append({
                "category": category_name,
                "severity": issue["severity"],
                "message": issue["message"],
            })

    all_issues.sort(key=lambda x: severity_order.get(x["severity"], 99))

    # Step 6: Build report
    elapsed = (datetime.now() - start_time).total_seconds()

    report = {
        "success": True,
        "url": final_url,
        "timestamp": datetime.now().isoformat(),
        "elapsed_seconds": round(elapsed, 2),
        "overall_score": overall_score,
        "score_label": _score_label(overall_score),
        "categories": {
            "on_page": {
                "label": "On-Page SEO",
                "score": on_page["score"],
                "weight": f'{int(SCORING_WEIGHTS["on_page"] * 100)}%',
                "data": on_page["data"],
                "issues_count": len(on_page["issues"]),
            },
            "content": {
                "label": "Qualità Contenuto",
                "score": content["score"],
                "weight": f'{int(SCORING_WEIGHTS["content"] * 100)}%',
                "data": content["data"],
                "issues_count": len(content["issues"]),
            },
            "technical": {
                "label": "SEO Tecnico",
                "score": technical["score"],
                "weight": f'{int(SCORING_WEIGHTS["technical"] * 100)}%',
                "data": technical["data"],
                "issues_count": len(technical["issues"]),
            },
            "schema": {
                "label": "Schema / Dati Strutturati",
                "score": schema["score"],
                "weight": f'{int(SCORING_WEIGHTS["schema"] * 100)}%',
                "data": schema["data"],
                "issues_count": len(schema["issues"]),
            },
            "images": {
                "label": "Immagini",
                "score": images["score"],
                "weight": f'{int(SCORING_WEIGHTS["images"] * 100)}%',
                "data": images["data"],
                "issues_count": len(images["issues"]),
            },
            "ai_readiness": {
                "label": "AI Search Readiness",
                "score": ai_readiness["score"],
                "weight": f'{int(SCORING_WEIGHTS["ai_readiness"] * 100)}%',
                "data": ai_readiness["data"],
                "issues_count": len(ai_readiness["issues"]),
            },
            "performance": {
                "label": "Performance (CWV Hints)",
                "score": performance["score"],
                "weight": f'{int(SCORING_WEIGHTS["performance"] * 100)}%',
                "data": performance["data"],
                "issues_count": len(performance["issues"]),
            },
        },
        "issues": all_issues,
        "issues_summary": {
            "critical": len([i for i in all_issues if i["severity"] == "critical"]),
            "high": len([i for i in all_issues if i["severity"] == "high"]),
            "medium": len([i for i in all_issues if i["severity"] == "medium"]),
            "low": len([i for i in all_issues if i["severity"] == "low"]),
        },
        "quick_wins": [i for i in all_issues if i["severity"] in ("critical", "high")][:5],
    }

    logger.info(f"SEO audit complete for {url}: score={overall_score}/100 ({elapsed:.1f}s)")
    return report


def _score_label(score: int) -> str:
    """Convert numeric score to human-readable label."""
    if score >= 90:
        return "Eccellente"
    elif score >= 70:
        return "Buono"
    elif score >= 50:
        return "Sufficiente"
    elif score >= 30:
        return "Scarso"
    else:
        return "Critico"


# ---------------------------------------------------------------------------
# Convenience function for quick checks
# ---------------------------------------------------------------------------

def quick_check(url: str) -> Dict[str, Any]:
    """
    Quick SEO check - returns just the essentials.
    Lighter version of run_page_audit for fast feedback.
    """
    fetch_result = fetch_page(url, timeout=15)
    if fetch_result["error"]:
        return {"success": False, "url": url, "error": fetch_result["error"]}

    parsed = parse_html(fetch_result["content"], base_url=fetch_result["url"])

    return {
        "success": True,
        "url": fetch_result["url"],
        "title": parsed.get("title"),
        "meta_description": parsed.get("meta_description"),
        "h1": parsed.get("h1", []),
        "word_count": parsed.get("word_count", 0),
        "images_count": len(parsed.get("images", [])),
        "images_without_alt": sum(1 for img in parsed.get("images", []) if img.get("alt") is None),
        "internal_links": len(parsed.get("links", {}).get("internal", [])),
        "external_links": len(parsed.get("links", {}).get("external", [])),
        "schema_types": [
            s.get("@type", "Unknown") for s in parsed.get("schema", []) if isinstance(s, dict)
        ],
        "has_viewport": bool(parsed.get("viewport")),
        "has_canonical": bool(parsed.get("canonical")),
        "https": fetch_result["url"].startswith("https://"),
    }
