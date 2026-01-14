"""
Kleinanzeigen URL Finder
Findet die korrekte URL mit ID für eine PLZ durch Anfrage an Kleinanzeigen JSON-API
"""
import urllib.request
import json
from urllib.parse import quote
import re
import logging
import time

logger = logging.getLogger(__name__)


def get_location_id(plz_or_ort):
    """
    Ruft die Location-ID für eine PLZ oder einen Ort von Kleinanzeigen ab
    
    Args:
        plz_or_ort: PLZ (5-stellig) oder Ortsname
    
    Returns:
        Location-ID als String oder None
    """
    url = f"https://www.kleinanzeigen.de/s-ort-empfehlungen.json?query={plz_or_ort}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            # Nimm die erste nicht-0 ID (oder passe Logik an, wenn multiple)
            for key in data:
                if key != "_0":
                    location_id = key[1:]  # Entferne "_" und nimm ID
                    logger.info(f"Location-ID für {plz_or_ort}: {location_id}")
                    return location_id
            return None  # Wenn keine gefunden
    except Exception as e:
        logger.error(f"Fehler bei {plz_or_ort}: {e}")
        return None


def extract_id_from_url(url):
    """Extrahiert die ID (k0c195lXXXX) aus einer URL"""
    match = re.search(r'/(k\d+c\d+l\d+)', url)
    return match.group(1) if match else None


def find_kleinanzeigen_url_with_id(plz, filters, reference_url_with_id=None):
    """
    Findet die korrekte Kleinanzeigen URL mit ID für eine PLZ
    
    Args:
        plz: 5-stellige PLZ oder Ortsname
        filters: Dict mit Filter-Parametern (kategorie, anbieter, anzeige, preis, suchbegriff)
        reference_url_with_id: Wird ignoriert, da wir die ID direkt holen
    
    Returns:
        URL mit korrekter ID oder None bei Fehler
    """
    try:
        # Hole Location-ID über die JSON-API
        location_id = get_location_id(plz)
        if not location_id:
            logger.warning(f"Konnte Location-ID für {plz} nicht abrufen")
            return None
        
        # Baue URL
        base_url = 'https://www.kleinanzeigen.de'
        kategorie = filters.get('kategorie', 'immobilien')
        url_path = f'/s-{kategorie}/{plz}'
        
        filter_parts = []
        if filters.get('anbieter'):
            filter_parts.append(f"anbieter:{filters['anbieter']}")
        if filters.get('anzeige'):
            filter_parts.append(f"anzeige:{filters['anzeige']}")
        if filters.get('preis'):
            filter_parts.append(f"preis:{filters['preis']}:")
        if filters.get('suchbegriff'):
            filter_parts.append(filters['suchbegriff'])
        
        if filter_parts:
            url_path += '/' + '/'.join(filter_parts)
        
        # Kategorie-Code (195 für Immobilien)
        category_code = '195'  # Standard für Immobilien
        
        # Füge ID hinzu
        url_path += f'/k0c{category_code}l{location_id}'
        final_url = base_url + url_path
        logger.info(f"URL mit ID für {plz} generiert: {final_url}")
        return final_url
        
    except Exception as e:
        logger.error(f"Fehler beim Generieren der URL für {plz}: {e}")
        return None


def find_urls_for_plzs(plz_list, filters, reference_url=None):
    """
    Findet URLs mit IDs für eine Liste von PLZs
    
    Args:
        plz_list: Liste von PLZs (Strings)
        filters: Dict mit Filter-Parametern
        reference_url: Wird ignoriert, da wir die ID direkt holen
    
    Returns:
        Dict mit PLZ als Key und URL als Value
    """
    results = {}
    
    for plz in plz_list:
        clean_plz = plz.strip()
        # Akzeptiere sowohl PLZs (5-stellig) als auch Ortsnamen
        if (len(clean_plz) == 5 and clean_plz.isdigit()) or clean_plz:
            url = find_kleinanzeigen_url_with_id(clean_plz, filters, reference_url)
            if url:
                results[clean_plz] = url
            # Kurze Pause zwischen Anfragen (optimiert für Performance)
            time.sleep(0.2)
        else:
            logger.warning(f"Ungültige PLZ/Ortsname übersprungen: {clean_plz}")
    
    return results
