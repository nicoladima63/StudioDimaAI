import requests
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

GOOGLE_PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GOOGLE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def get_local_competitors(
    query: str,
    api_key: str,
    max_results: int = 5
) -> List[Dict[str, Any]]:
    """
    Return real local competitors (with websites) from Google Maps.
    """

    # --- STEP 1: search places ---
    params = {
        "query": query,
        "key": api_key,
    }

    try:
        resp = requests.get(GOOGLE_PLACES_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"Places search failed: {e}")
        return []

    results = []

    for place in data.get("results", [])[:max_results]:

        place_id = place.get("place_id")
        if not place_id:
            continue

        # --- STEP 2: get details (website) ---
        details_params = {
            "place_id": place_id,
            "fields": "name,website,rating,formatted_address",
            "key": api_key,
        }

        try:
            d_resp = requests.get(GOOGLE_DETAILS_URL, params=details_params, timeout=10)
            d_resp.raise_for_status()
            details = d_resp.json().get("result", {})
        except Exception as e:
            logger.error(f"Details failed for {place_id}: {e}")
            continue

        website = details.get("website")
        if not website:
            continue  # skip chi non ha sito

        results.append({
            "name": details.get("name"),
            "website": website,
            "rating": details.get("rating"),
            "address": details.get("formatted_address"),
        })

    return results