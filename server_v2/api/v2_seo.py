"""
SEO Analysis API Blueprint.

Provides endpoints for SEO page audits, quick checks, and reports.
"""

import json
import logging
import os
from urllib.parse import urlparse
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app_v2 import format_response
from services.seo.seo_service import run_page_audit, quick_check
from services.seo.competitor_analysis import competitor_analysis
from services.seo.google_maps_competitors import get_local_competitors

# Google Places API key
GOOGLE_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY', '')

# Directory where audit JSONs are saved
SEO_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'services', 'seo', 'data')
os.makedirs(SEO_DATA_DIR, exist_ok=True)


def _clean_host(url: str) -> str:
    """Extract clean hostname without www."""
    hostname = (urlparse(url).hostname or '').lower()
    return hostname[4:] if hostname.startswith('www.') else hostname


def _domain_from_url(url: str) -> str:
    """Extract clean domain for filename: https://www.foo.com/bar -> foo.com"""
    from urllib.parse import urlparse
    hostname = urlparse(url).hostname or 'unknown'
    if hostname.startswith('www.'):
        hostname = hostname[4:]
    # Sanitize for filename
    return hostname.replace('/', '_').replace('\\', '_')


def _save_audit(report: dict):
    """Save audit report to JSON file named by domain."""
    domain = _domain_from_url(report.get('url', ''))
    filepath = os.path.join(SEO_DATA_DIR, f'audit_{domain}.json')
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


def _load_audit(domain: str) -> dict | None:
    """Load audit report for a specific domain."""
    filepath = os.path.join(SEO_DATA_DIR, f'audit_{domain}.json')
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def _list_audits() -> list:
    """List all saved audits with domain and timestamp."""
    audits = []
    for f in os.listdir(SEO_DATA_DIR):
        if f.startswith('audit_') and f.endswith('.json'):
            domain = f[6:-5]  # strip 'audit_' and '.json'
            filepath = os.path.join(SEO_DATA_DIR, f)
            try:
                with open(filepath, 'r', encoding='utf-8') as fh:
                    data = json.load(fh)
                audits.append({
                    'domain': domain,
                    'url': data.get('url', ''),
                    'score': data.get('overall_score', 0),
                    'score_label': data.get('score_label', ''),
                    'timestamp': data.get('timestamp', ''),
                })
            except (json.JSONDecodeError, IOError):
                pass
    return audits

logger = logging.getLogger(__name__)

seo_v2_bp = Blueprint('seo_v2', __name__)


# =============================================================================
# Full Page Audit
# =============================================================================


@seo_v2_bp.route('/seo/audit', methods=['POST'])
@jwt_required()
def seo_audit():
    """
    Run a full SEO audit on a URL.

    Request body:
        { "url": "https://example.com" }

    Returns comprehensive audit report with scores and issues.
    """
    try:
        data = request.get_json()
        if not data or not data.get('url'):
            return format_response(
                success=False,
                error='MISSING_URL',
                message='URL obbligatorio per l\'audit SEO',
                state='error'
            ), 400

        url = data['url'].strip()

        # Basic URL validation
        if not url.startswith(('http://', 'https://')):
            url = f'https://{url}'

        result = run_page_audit(url)

        if not result.get('success'):
            return format_response(
                success=False,
                error='AUDIT_FAILED',
                message=result.get('error', 'Errore durante l\'audit SEO'),
                data=result,
                state='error'
            ), 200

        # Save to JSON for competitor analysis
        _save_audit(result)

        return format_response(
            success=True,
            data=result,
            message=f"Audit SEO completato: {result.get('overall_score', 0)}/100 ({result.get('score_label', '')})",
            state='success'
        ), 200

    except Exception as e:
        logger.error(f"Error running SEO audit: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore durante l\'audit SEO',
            state='error'
        ), 500


# =============================================================================
# Quick Check
# =============================================================================


@seo_v2_bp.route('/seo/quick-check', methods=['POST'])
@jwt_required()
def seo_quick_check():
    """
    Run a quick SEO check on a URL (lighter, faster).

    Request body:
        { "url": "https://example.com" }

    Returns basic SEO data without full scoring.
    """
    try:
        data = request.get_json()
        if not data or not data.get('url'):
            return format_response(
                success=False,
                error='MISSING_URL',
                message='URL obbligatorio',
                state='error'
            ), 400

        url = data['url'].strip()
        if not url.startswith(('http://', 'https://')):
            url = f'https://{url}'

        result = quick_check(url)

        if not result.get('success'):
            return format_response(
                success=False,
                error='CHECK_FAILED',
                message=result.get('error', 'Errore durante il controllo SEO'),
                state='error'
            ), 200

        return format_response(
            success=True,
            data=result,
            message='Controllo SEO rapido completato',
            state='success'
        ), 200

    except Exception as e:
        logger.error(f"Error running quick SEO check: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore durante il controllo SEO rapido',
            state='error'
        ), 500


# =============================================================================
# Saved Audits
# =============================================================================


@seo_v2_bp.route('/seo/audits', methods=['GET'])
@jwt_required()
def seo_saved_audits():
    """List all saved audit reports."""
    try:
        audits = _list_audits()
        return format_response(
            success=True,
            data=audits,
            message=f'{len(audits)} audit salvati',
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"Error listing audits: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore nel recupero audit salvati',
            state='error'
        ), 500


@seo_v2_bp.route('/seo/audits/<domain>', methods=['GET'])
@jwt_required()
def seo_load_audit(domain):
    """Load a saved audit report by domain."""
    try:
        report = _load_audit(domain)
        if not report:
            return format_response(
                success=False,
                error='NOT_FOUND',
                message=f'Nessun audit salvato per {domain}',
                state='error'
            ), 404

        return format_response(
            success=True,
            data=report,
            message=f'Audit caricato per {domain}',
            state='success'
        ), 200
    except Exception as e:
        logger.error(f"Error loading audit for {domain}: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore nel caricamento audit',
            state='error'
        ), 500


# =============================================================================
# Competitor Analysis
# =============================================================================


@seo_v2_bp.route('/seo/competitors', methods=['POST'])
@jwt_required()
def seo_competitor_analysis():
    """
    Search competitors by keywords and compare against saved audit.

    Request body:
        { "keywords": "dentista roma", "domain": "studiodimartino.eu" }

    Returns corrective actions where competitors outperform.
    """
    try:
        data = request.get_json()

        domain = (data.get('domain') or '').strip()
        if not domain:
            return format_response(
                success=False,
                error='MISSING_DOMAIN',
                message='Dominio obbligatorio per il confronto',
                state='error'
            ), 400

        # Load audit for domain from JSON file
        main_report = _load_audit(_domain_from_url(f'https://{domain}'))
        if not main_report:
            return format_response(
                success=False,
                error='MISSING_REPORT',
                message=f'Nessun audit salvato per {domain}. Esegui prima l\'audit.',
                state='error'
            ), 400

        keywords = (data.get('keywords') or '').strip()
        if not keywords:
            return format_response(
                success=False,
                error='MISSING_KEYWORDS',
                message='Inserisci parole chiave per cercare i competitor',
                state='error'
            ), 400

        # Exclude main site domain from search results
        main_url = main_report.get('url', '')

        # Step 1: Search competitors via Google Maps
        try:
            places = get_local_competitors(
                query=keywords,
                api_key=GOOGLE_API_KEY,
                max_results=5
            )

            all_urls = [p.get("website") for p in places if p.get("website")]

            # deduplica
            all_urls = list(dict.fromkeys(all_urls))

            # Trova la posizione del sito principale nei risultati
            my_position = None
            for i, u in enumerate(all_urls):
                if _clean_host(u) == _clean_host(main_url):
                    my_position = i + 1
                    break

            # escludi sito principale per il confronto
            competitor_urls = [
                u for u in all_urls
                if _clean_host(u) != _clean_host(main_url)
            ]

        except Exception as e:
            logger.error(f"Errore Google Maps competitors: {e}")
            competitor_urls = []


        if not competitor_urls:
            return format_response(
                success=False,
                error='NO_RESULTS',
                message='Nessun competitor trovato su Google Maps per queste parole chiave',
                state='warning'
            ), 200

        # Step 2: Run competitor analysis against cached main report
        result = competitor_analysis(main_report, competitor_urls)

        if not result.get('success'):
            return format_response(
                success=False,
                error='COMPETITOR_ANALYSIS_FAILED',
                message=result.get('error', 'Errore durante l\'analisi competitor'),
                data=result,
                state='error'
            ), 200

        # Aggiungi posizione del sito nei risultati Google Maps
        result['my_position'] = my_position

        state = 'success'
        if result.get('warning'):
            state = 'warning'

        msg = f"Analisi competitor completata: {result.get('analyzed', 0)} competitor analizzati"
        if my_position:
            msg += f". Il tuo sito e' in posizione {my_position} su Google Maps"

        return format_response(
            success=True,
            data=result,
            message=msg,
            state=state
        ), 200

    except Exception as e:
        logger.error(f"Error running competitor analysis: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            message='Errore durante l\'analisi competitor',
            state='error'
        ), 500
