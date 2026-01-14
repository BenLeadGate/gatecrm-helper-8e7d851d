import requests
from bs4 import BeautifulSoup
import json
import os
import re
import time
from datetime import datetime
from urllib.parse import urljoin, urlparse, parse_qs
from typing import List, Set, Dict
import logging
import csv
from io import StringIO
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KleinanzeigenScraper:
    def __init__(self, blacklist_file="blacklist.json", links_file="links.json"):
        self.blacklist_file = blacklist_file
        self.links_file = links_file
        self.base_url = "https://www.kleinanzeigen.de"
        self.blacklist: Set[str] = self.load_blacklist()
        self.links: List[Dict[str, str]] = self.load_links()  # Liste von Dicts mit 'url' und 'scraped_at'
        self.last_scraping_links: List[str] = []  # Links der letzten Suche
        # Session wird pro Thread erstellt (thread-safe)
        self._default_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def _create_session(self):
        """Erstellt eine neue Session für Thread-sichere Verwendung"""
        session = requests.Session()
        session.headers.update(self._default_headers)
        return session
    
    def load_blacklist(self) -> Set[str]:
        """Lädt die Blacklist aus einer JSON-Datei"""
        if os.path.exists(self.blacklist_file):
            try:
                with open(self.blacklist_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return set(data.get('blacklist', []))
            except Exception as e:
                logger.error(f"Fehler beim Laden der Blacklist: {e}")
                return set()
        return set()
    
    def save_blacklist(self):
        """Speichert die Blacklist in eine JSON-Datei"""
        try:
            with open(self.blacklist_file, 'w', encoding='utf-8') as f:
                json.dump({'blacklist': list(self.blacklist)}, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Blacklist: {e}")
    
    def load_links(self) -> List[Dict[str, str]]:
        """Lädt die gesammelten Links aus einer JSON-Datei (mit Timestamps)"""
        if os.path.exists(self.links_file):
            try:
                with open(self.links_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    links = data.get('links', [])
                    # Migration: Wenn Links noch Strings sind, konvertiere sie
                    if links and isinstance(links[0], str):
                        # Alte Struktur: Liste von Strings
                        timestamp = datetime.now().isoformat()
                        return [{'url': link, 'scraped_at': timestamp} for link in links]
                    # Neue Struktur: Liste von Dicts
                    return links
            except Exception as e:
                logger.error(f"Fehler beim Laden der Links: {e}")
                return []
        return []
    
    def save_links(self):
        """Speichert die gesammelten Links in eine JSON-Datei"""
        try:
            with open(self.links_file, 'w', encoding='utf-8') as f:
                json.dump({'links': self.links}, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Links: {e}")
    
    def normalize_url(self, url: str) -> str:
        """Normalisiert eine URL, um Duplikate zu vermeiden"""
        # Entferne Query-Parameter, die für die Eindeutigkeit nicht relevant sind
        parsed = urlparse(url)
        # Behalte nur den Pfad und wichtige Parameter
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        return normalized
    
    def is_valid_listing_url(self, url: str) -> bool:
        """Prüft, ob es sich um eine gültige Anzeigen-URL handelt (keine Werbung)"""
        url_lower = url.lower()
        
        # Ausschlusskriterien für Werbung/irrelevante Links
        excluded_patterns = [
            'anzeige-aufgeben',
            'abo',
            'premium',
            'werbung',
            'advertisement',
            'impressum',
            'datenschutz',
            'agb',
            'hilfe',
            'kontakt',
            'login',
            'registrieren',
            '/anbieter/',
            '/benutzer/',
            '/meine-anzeigen',
            '/s-werbung',
            'javascript:',
            'mailto:',
            'tel:',
            '#',
            '?',
            '/s-ort/',
            '/s-kategorie/'
        ]
        
        # Muss ein Anzeigen-Link sein (enthält typischerweise /s-anzeige/ oder ähnliches)
        valid_patterns = [
            '/s-anzeige/',
            '/s-anzeigen/',
            '/anzeige/'
        ]
        
        # Prüfe auf ausgeschlossene Patterns
        for pattern in excluded_patterns:
            if pattern in url_lower:
                return False
        
        # Prüfe auf gültige Patterns
        for pattern in valid_patterns:
            if pattern in url_lower:
                return True
        
        return False
    
    def extract_listing_links_from_page(self, html_content: str, base_url: str) -> Set[str]:
        """Extrahiert alle Anzeigen-Links von einer Seite - nur aus dem Haupt-Suchergebnis-Bereich"""
        soup = BeautifulSoup(html_content, 'html.parser')
        links = set()
        
        # Prüfe, ob die Seite "keine Ergebnisse" anzeigt
        empty_result_selectors = [
            '#saved-search-empty-result',
            '.j-zsrp-error-message',
            '.outcomemessage-warning'
        ]
        
        has_no_results = False
        for selector in empty_result_selectors:
            empty_element = soup.select_one(selector)
            if empty_element:
                # Prüfe, ob der Text "keine Ergebnisse" oder "nicht gefunden" enthält
                text = empty_element.get_text().lower()
                if any(keyword in text for keyword in ['keine ergebnisse', 'nicht gefunden', 'wurden keine']):
                    has_no_results = True
                    logger.info("Seite zeigt 'keine Ergebnisse' an - ignoriere alternative Anzeigen")
                    break
        
        # Versuche zuerst, den Haupt-Suchergebnis-Bereich zu finden
        # Kleinanzeigen verwendet verschiedene Container für Suchergebnisse
        main_result_containers = [
            '#srchrslt-content',
            '.srchrslt-content',
            '#srchrslt-list',
            '.srchrslt-list',
            'div[id*="srchrslt"]'
        ]
        
        main_container = None
        for selector in main_result_containers:
            container = soup.select_one(selector)
            if container:
                main_container = container
                logger.debug(f"Haupt-Container gefunden mit Selektor: {selector}")
                break
        
        # Wenn kein spezifischer Container gefunden wurde, verwende den body
        if main_container is None:
            main_container = soup.find('body')
            if main_container is None:
                main_container = soup
        
        # Finde die Überschrift "Alternative Anzeigen in der Umgebung"
        alternative_h2 = None
        for h2 in soup.find_all('h2'):
            h2_text = h2.get_text().strip().lower()
            if 'alternative anzeigen' in h2_text or ('anzeigen' in h2_text and 'umgebung' in h2_text):
                alternative_h2 = h2
                break
        
        # Entferne explizit den Bereich mit alternativen Anzeigen
        # Kleinanzeigen verwendet #srchrslt-adtable-altads für alternative Anzeigen
        alt_ads_container = soup.select_one('#srchrslt-adtable-altads')
        if alt_ads_container:
            alt_ads_container.decompose()
            logger.info("Bereich '#srchrslt-adtable-altads' (Alternative Anzeigen) wurde entfernt")
        
        # Entferne auch alles nach der Überschrift "Alternative Anzeigen"
        if alternative_h2:
            # Finde alle nachfolgenden Geschwister-Elemente und entferne sie
            current = alternative_h2.find_next_sibling()
            while current:
                next_sibling = current.find_next_sibling()
                current.decompose()
                current = next_sibling
            # Entferne auch die Überschrift selbst
            alternative_h2.decompose()
            logger.info("Bereich nach 'Alternative Anzeigen in der Umgebung' wurde entfernt")
        
        # Ausschluss-Bereiche: Diese Bereiche enthalten "Ähnliche Anzeigen", "In der Nähe" oder "Alternative Anzeigen"
        excluded_selectors = [
            '[class*="similar"]',
            '[class*="recommended"]',
            '[class*="empfohlen"]',
            '[class*="nahe"]',
            '[id*="similar"]',
            '[id*="recommended"]',
            '[id*="empfohlen"]',
            '[id*="altads"]',  # Alternative Anzeigen Container
            '.adbox-similar',
            '.similar-ads',
            '.recommendations',
            '.empfehlungen'
        ]
        
        # Entferne ausgeschlossene Bereiche aus dem Container
        for excluded_selector in excluded_selectors:
            for excluded_element in main_container.select(excluded_selector):
                excluded_element.decompose()  # Entferne den Bereich komplett
        
        # Wenn keine Ergebnisse gefunden wurden, gebe keine Links zurück
        if has_no_results:
            logger.info("Keine echten Suchergebnisse gefunden - keine Links zurückgegeben")
            return links
        
        # WICHTIG: Suche NUR Links aus dem ERSTEN #srchrslt-adtable (echte Ergebnisse)
        # NICHT aus #srchrslt-adtable-altads (alternative Anzeigen)
        primary_results_list = soup.select_one('#srchrslt-adtable')
        
        if primary_results_list:
            # Suche nur innerhalb der primären Ergebnisse-Liste
            logger.info("Gefunden: Primäre Ergebnisse-Liste #srchrslt-adtable")
            selectors = [
                '#srchrslt-adtable article.ad-listitem a[href*="/s-anzeige/"]',
                '#srchrslt-adtable .ad-listitem a[href*="/s-anzeige/"]',
                '#srchrslt-adtable article a[href*="/s-anzeige/"]',
                '#srchrslt-adtable h2 a[href*="/s-anzeige/"]',
                '#srchrslt-adtable .ellipsis a[href*="/s-anzeige/"]'
            ]
        else:
            # Fallback: Suche im Haupt-Container, aber mit zusätzlicher Validierung
            logger.warning("#srchrslt-adtable nicht gefunden, verwende Fallback")
            selectors = [
                'article.ad-listitem a[href*="/s-anzeige/"]',
                '.ad-listitem a[href*="/s-anzeige/"]',
                'article a[href*="/s-anzeige/"]',
                'h2 a[href*="/s-anzeige/"]',
                '.ellipsis a[href*="/s-anzeige/"]'
            ]
        
        found_selectors = set()
        search_container = primary_results_list if primary_results_list else main_container
        
        for selector in selectors:
            elements = search_container.select(selector) if search_container else []
            if elements:
                found_selectors.add(selector)
                for element in elements:
                    href = element.get('href', '')
                    if href:
                        # Konvertiere relative URLs zu absoluten URLs
                        full_url = urljoin(base_url, href)
                        normalized = self.normalize_url(full_url)
                        
                        if self.is_valid_listing_url(normalized):
                            # Prüfe, ob der Link nicht in einem ausgeschlossenen Bereich liegt
                            parent = element.find_parent()
                            is_excluded = False
                            while parent:
                                parent_id = parent.get('id', '')
                                parent_class = parent.get('class', [])
                                parent_str = ' '.join(parent_class).lower() + ' ' + parent_id.lower()
                                
                                # Ausschluss-Kriterien
                                exclude_keywords = ['similar', 'recommended', 'empfohlen', 'nahe', 'empfehlung', 'alternative']
                                if any(excluded in parent_str for excluded in exclude_keywords):
                                    is_excluded = True
                                    break
                                # Prüfe explizit auf altads-Container
                                if parent_id == 'srchrslt-adtable-altads':
                                    is_excluded = True
                                    break
                                parent = parent.find_parent()
                            
                            if not is_excluded:
                                links.add(normalized)
        
        if found_selectors:
            logger.debug(f"Links gefunden mit Selektoren: {found_selectors}")
        else:
            logger.warning("Keine Links mit spezifischen Selektoren gefunden. Versuche Fallback-Methode.")
            # Fallback: Suche alle Anzeigen-Links, aber nur direkt im Haupt-Container
            fallback_links = main_container.select('a[href*="/s-anzeige/"]')
            for element in fallback_links:
                href = element.get('href', '')
                if href:
                    full_url = urljoin(base_url, href)
                    normalized = self.normalize_url(full_url)
                    if self.is_valid_listing_url(normalized):
                        links.add(normalized)
        
        return links
    
    def get_next_page_url(self, current_url: str, page_number: int) -> str:
        """Erstellt die URL für die nächste Seite"""
        parsed = urlparse(current_url)
        
        # Kleinanzeigen verwendet verschiedene Pagination-Formate
        # Format 1: ?seite:2 oder seite:2 im Pfad
        # Format 2: ?seite=2
        
        # Prüfe, ob bereits ein seite-Parameter existiert
        query_params = parse_qs(parsed.query)
        
        # Entferne alte seite/seite: Parameter
        params_to_remove = ['seite', 'seite:']
        for key in list(query_params.keys()):
            if key in params_to_remove or key.startswith('seite'):
                del query_params[key]
        
        # Füge neuen seite-Parameter hinzu
        query_params['seite'] = [str(page_number)]
        
        # Baue die Query-String neu auf
        query_parts = []
        for k, v in query_params.items():
            if v:
                query_parts.append(f"{k}={v[0]}")
        
        query_string = '&'.join(query_parts)
        
        if query_string:
            next_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{query_string}"
        else:
            next_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?seite={page_number}"
        
        return next_url
    
    def scrape_search_string(self, search_string: str, max_pages: int = 10, session=None) -> Set[str]:
        """
        Scraped eine Suche von Kleinanzeigen
        
        Args:
            search_string: Die Such-URL
            max_pages: Maximale Anzahl Seiten
            session: Optional Session-Objekt (für Thread-sichere Verwendung)
        """
        all_links = set()
        # Verwende übergebene Session oder erstelle neue
        session = session if session else self._create_session()
        
        try:
            # Parse die Such-URL
            if not search_string.startswith('http'):
                logger.warning(f"'{search_string}' ist keine vollständige URL. Bitte vollständige Kleinanzeigen-URL verwenden.")
                return all_links
            
            logger.info(f"Starte Scraping für: {search_string}")
            
            for page in range(1, max_pages + 1):
                try:
                    if page == 1:
                        url = search_string
                    else:
                        url = self.get_next_page_url(search_string, page)
                    
                    logger.info(f"Lade Seite {page}: {url}")
                    response = session.get(url, timeout=10)
                    response.raise_for_status()
                    
                    # Extrahiere Links von dieser Seite
                    page_links = self.extract_listing_links_from_page(response.text, self.base_url)
                    
                    if not page_links:
                        logger.info(f"Keine Links mehr auf Seite {page}. Beende Scraping.")
                        break
                    
                    all_links.update(page_links)
                    logger.info(f"Gefunden: {len(page_links)} Links auf Seite {page}")
                    
                    # Kleine Pause zwischen Requests (optimiert für Performance)
                    time.sleep(0.2)
                    
                except requests.exceptions.RequestException as e:
                    logger.error(f"Fehler beim Laden von Seite {page}: {e}")
                    break
                except Exception as e:
                    logger.error(f"Unerwarteter Fehler auf Seite {page}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Fehler beim Scraping von '{search_string}': {e}")
        
        return all_links
    
    def search_and_collect_links(self, search_strings: List[str], max_pages: int = 10, max_workers: int = 4, makler_names: List[str] = None, url_to_makler_mapping: Dict[str, str] = None) -> List[str]:
        """
        Sucht nach Links für mehrere Suchstrings und fügt nur neue Links hinzu
        
        Args:
            search_strings: Liste von Such-URLs
            max_pages: Maximale Seiten pro Suchstring
            max_workers: Anzahl paralleler Threads (3-5 empfohlen für Sicherheit)
            makler_names: Optionale Liste von Makler-Namen (für Gruppierung, deprecated - verwende url_to_makler_mapping)
            url_to_makler_mapping: Mapping von Such-URL zu Makler-Name (für korrekte Zuordnung)
        """
        new_links = []
        # Mapping: gefundener Link -> Makler-Name (basierend auf Such-URL)
        link_to_makler = {}
        current_timestamp = datetime.now().isoformat()
        
        # Hole bestehende URLs für Vergleich
        existing_urls = {link['url'] if isinstance(link, dict) else link for link in self.links}
        
        # Parallelisierung: 4 Worker (konservativ für Sicherheit)
        def scrape_with_session(search_string):
            """Hilfsfunktion für Threading mit eigener Session"""
            session = self._create_session()
            try:
                return self.scrape_search_string(search_string, max_pages, session=session)
            finally:
                session.close()
        
        # Paralleles Scraping
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Starte alle Scraping-Tasks
            future_to_string = {
                executor.submit(scrape_with_session, search_string): search_string 
                for search_string in search_strings
            }
            
            # Sammle Ergebnisse mit Zuordnung zur Such-URL
            for future in as_completed(future_to_string):
                search_string = future_to_string[future]
                try:
                    found_links = future.result()
                    # Bestimme Makler-Name für diese Such-URL
                    makler_name = None
                    if url_to_makler_mapping and search_string in url_to_makler_mapping:
                        makler_name = url_to_makler_mapping[search_string]
                    elif makler_names and len(makler_names) == 1:
                        # Fallback: Wenn nur ein Makler, verwende diesen
                        makler_name = makler_names[0]
                    
                    # Ordne alle gefundenen Links diesem Makler zu
                    for link_url in found_links:
                        if makler_name:
                            # Wenn Link bereits einem Makler zugeordnet ist, behalte beide
                            if link_url in link_to_makler:
                                existing_makler = link_to_makler[link_url]
                                if isinstance(existing_makler, list):
                                    if makler_name not in existing_makler:
                                        existing_makler.append(makler_name)
                                else:
                                    if existing_makler != makler_name:
                                        link_to_makler[link_url] = [existing_makler, makler_name]
                            else:
                                link_to_makler[link_url] = makler_name
                    
                    logger.info(f"Abgeschlossen: {search_string} - {len(found_links)} Links gefunden (Makler: {makler_name})")
                except Exception as e:
                    logger.error(f"Fehler beim Scraping von '{search_string}': {e}")
        
        # Filtere Links, die bereits in der Blacklist sind
        for link_url, assigned_makler in link_to_makler.items():
            if link_url not in self.blacklist:
                if link_url not in existing_urls:
                    new_links.append(link_url)
                    # Füge Link mit Timestamp und Makler-Name hinzu
                    link_data = {'url': link_url, 'scraped_at': current_timestamp}
                    # Konvertiere zu Liste falls nötig
                    if isinstance(assigned_makler, list):
                        link_data['makler_names'] = assigned_makler
                    else:
                        link_data['makler_names'] = [assigned_makler] if assigned_makler else []
                    self.links.append(link_data)
                    existing_urls.add(link_url)
                else:
                    # Link existiert bereits - aktualisiere Makler-Namen
                    for link in self.links:
                        if isinstance(link, dict) and link.get('url') == link_url:
                            existing_makler = link.get('makler_names', [])
                            if not isinstance(existing_makler, list):
                                existing_makler = [existing_makler] if existing_makler else []
                            
                            # Füge neuen Makler hinzu, ohne Duplikate
                            if isinstance(assigned_makler, list):
                                for makler in assigned_makler:
                                    if makler not in existing_makler:
                                        existing_makler.append(makler)
                            else:
                                if assigned_makler and assigned_makler not in existing_makler:
                                    existing_makler.append(assigned_makler)
                            
                            link['makler_names'] = existing_makler
                            break
                # Füge zur Blacklist hinzu (auch wenn bereits in links)
                self.blacklist.add(link_url)
        
        # Speichere die aktualisierten Daten
        if new_links:
            self.save_links()
        self.save_blacklist()
        
        # Speichere Links der letzten Suche
        self.last_scraping_links = new_links
        
        logger.info(f"Insgesamt {len(new_links)} neue Links gefunden und hinzugefügt")
        return new_links
    
    def get_all_links(self) -> List[str]:
        """Gibt alle gesammelten Links als Liste von URLs zurück (für Kompatibilität)"""
        return [link['url'] if isinstance(link, dict) else link for link in self.links]
    
    def get_all_links_with_dates(self) -> List[Dict[str, str]]:
        """Gibt alle Links mit Timestamps zurück"""
        return self.links
    
    def get_links_grouped_by_makler(self) -> Dict[str, List[Dict[str, str]]]:
        """
        Gibt Links nach Maklern gruppiert zurück
        
        Returns:
            Dict mit Makler-Name als Key und Liste von Links als Value
        """
        grouped = {}
        for link in self.links:
            if isinstance(link, dict):
                url = link.get('url', '')
                makler_names = link.get('makler_names', [])
                if makler_names:
                    for makler_name in makler_names:
                        if makler_name not in grouped:
                            grouped[makler_name] = []
                        grouped[makler_name].append(link)
                else:
                    # Links ohne Makler-Zuordnung in "Sonstige" Gruppe
                    if 'Sonstige' not in grouped:
                        grouped['Sonstige'] = []
                    grouped['Sonstige'].append(link)
        return grouped
    
    def get_last_scraping_links(self) -> List[str]:
        """Gibt die Links der letzten Suche zurück"""
        return self.last_scraping_links
    
    def get_links_by_date(self, year: int, month: int, day: int = None) -> List[str]:
        """Gibt Links zurück, die im angegebenen Jahr, Monat und optional Tag gescraped wurden"""
        filtered_links = []
        for link_entry in self.links:
            if isinstance(link_entry, dict):
                scraped_at = link_entry.get('scraped_at', '')
                try:
                    dt = datetime.fromisoformat(scraped_at)
                    if dt.year == year and dt.month == month:
                        if day is None or dt.day == day:
                            filtered_links.append(link_entry['url'])
                except (ValueError, TypeError):
                    continue
        return filtered_links
    
    def get_filtered_links_flat(
        self,
        makler_names: List[str] = None,
        year: int = None,
        month: int = None,
        day: int = None,
        last_search_only: bool = False
    ) -> List[str]:
        """
        Gibt gefilterte Links als flache Liste von URLs zurück (für CSV-Export)
        
        Args:
            makler_names: Liste von Makler-Namen zum Filtern (optional)
            year: Jahr zum Filtern (optional)
            month: Monat zum Filtern (optional)
            day: Tag zum Filtern (optional)
            last_search_only: Nur Links der letzten Suche zurückgeben (optional)
        
        Returns:
            Liste von URLs
        """
        self.links = self.load_links()
        
        # Wenn letzte Suche, filtere nach last_scraping_links
        last_scraping_urls = set(self.last_scraping_links) if last_search_only else None
        
        filtered_links = []
        for link in self.links:
            if isinstance(link, dict):
                url = link.get('url', '')
                
                # Filter: Letzte Suche
                if last_search_only and url not in last_scraping_urls:
                    continue
                
                # Filter: Datum
                if year is not None or month is not None or day is not None:
                    scraped_at = link.get('scraped_at', '')
                    try:
                        dt = datetime.fromisoformat(scraped_at)
                        if year is not None and dt.year != year:
                            continue
                        if month is not None and dt.month != month:
                            continue
                        if day is not None and dt.day != day:
                            continue
                    except (ValueError, TypeError):
                        continue
                
                # Filter: Makler
                if makler_names:
                    link_makler_names = link.get('makler_names', [])
                    if not isinstance(link_makler_names, list):
                        link_makler_names = [link_makler_names] if link_makler_names else []
                    # Normalisiere Namen (trim whitespace)
                    link_makler_normalized = [str(m).strip() for m in link_makler_names]
                    makler_names_normalized = [str(m).strip() for m in makler_names]
                    # Link muss mindestens einem der angegebenen Makler gehören
                    if not any(makler in link_makler_normalized for makler in makler_names_normalized):
                        continue
                
                filtered_links.append(url)
        
        return filtered_links
    
    def get_filtered_links_with_metadata(
        self,
        makler_names: List[str] = None,
        year: int = None,
        month: int = None,
        day: int = None,
        last_search_only: bool = False
    ) -> List[Dict[str, str]]:
        """
        Gibt gefilterte Links mit Metadaten zurück (für erweiterten CSV-Export)
        
        Args:
            makler_names: Liste von Makler-Namen zum Filtern (optional)
            year: Jahr zum Filtern (optional)
            month: Monat zum Filtern (optional)
            day: Tag zum Filtern (optional)
            last_search_only: Nur Links der letzten Suche zurückgeben (optional)
        
        Returns:
            Liste von Dicts mit 'url', 'makler', 'scraped_at'
        """
        self.links = self.load_links()
        
        # Wenn letzte Suche, filtere nach last_scraping_links
        last_scraping_urls = set(self.last_scraping_links) if last_search_only else None
        
        filtered_links = []
        for link in self.links:
            if isinstance(link, dict):
                url = link.get('url', '')
                
                # Filter: Letzte Suche
                if last_search_only and url not in last_scraping_urls:
                    continue
                
                # Filter: Datum
                if year is not None or month is not None or day is not None:
                    scraped_at = link.get('scraped_at', '')
                    try:
                        dt = datetime.fromisoformat(scraped_at)
                        if year is not None and dt.year != year:
                            continue
                        if month is not None and dt.month != month:
                            continue
                        if day is not None and dt.day != day:
                            continue
                    except (ValueError, TypeError):
                        continue
                
                # Filter: Makler
                link_makler_names = link.get('makler_names', [])
                if not isinstance(link_makler_names, list):
                    link_makler_names = [link_makler_names] if link_makler_names else []
                
                if makler_names:
                    # Normalisiere Namen (trim whitespace)
                    link_makler_normalized = [str(m).strip() for m in link_makler_names]
                    makler_names_normalized = [str(m).strip() for m in makler_names]
                    # Link muss mindestens einem der angegebenen Makler gehören
                    if not any(makler in link_makler_normalized for makler in makler_names_normalized):
                        continue
                
                # Erstelle Eintrag mit Metadaten
                makler_str = ', '.join(link_makler_names) if link_makler_names else ''
                scraped_at_str = link.get('scraped_at', '')
                
                filtered_links.append({
                    'url': url,
                    'makler': makler_str,
                    'scraped_at': scraped_at_str
                })
        
        return filtered_links
    
    def get_filtered_links_grouped(
        self, 
        makler_names: List[str] = None, 
        year: int = None, 
        month: int = None, 
        day: int = None,
        last_search_only: bool = False
    ) -> Dict[str, List[Dict[str, str]]]:
        """
        Gibt Links nach Maklern gruppiert zurück, gefiltert nach verschiedenen Kriterien
        
        Args:
            makler_names: Liste von Makler-Namen zum Filtern (optional)
            year: Jahr zum Filtern (optional)
            month: Monat zum Filtern (optional)
            day: Tag zum Filtern (optional)
            last_search_only: Nur Links der letzten Suche zurückgeben (optional)
        
        Returns:
            Dict mit Makler-Name als Key und Liste von Links als Value
        """
        # Lade Links neu, um sicherzustellen, dass wir die neuesten Daten haben
        self.links = self.load_links()
        
        # Wenn letzte Suche, filtere nach last_scraping_links
        last_scraping_urls = set(self.last_scraping_links) if last_search_only else None
        
        grouped = {}
        for link in self.links:
            if isinstance(link, dict):
                url = link.get('url', '')
                
                # Filter: Letzte Suche
                if last_search_only and url not in last_scraping_urls:
                    continue
                
                # Filter: Datum
                if year is not None or month is not None or day is not None:
                    scraped_at = link.get('scraped_at', '')
                    try:
                        dt = datetime.fromisoformat(scraped_at)
                        if year is not None and dt.year != year:
                            continue
                        if month is not None and dt.month != month:
                            continue
                        if day is not None and dt.day != day:
                            continue
                    except (ValueError, TypeError):
                        continue
                
                # Filter: Makler
                link_makler_names = link.get('makler_names', [])
                if makler_names:
                    # Nur Links, die zu mindestens einem der angegebenen Makler gehören
                    if not any(makler in link_makler_names for makler in makler_names):
                        continue
                
                # Gruppiere nach Makler
                if link_makler_names:
                    for makler_name in link_makler_names:
                        # Wenn makler_names Filter gesetzt ist, nur diese Makler anzeigen
                        if makler_names and makler_name not in makler_names:
                            continue
                        if makler_name not in grouped:
                            grouped[makler_name] = []
                        grouped[makler_name].append(link)
                else:
                    # Links ohne Makler-Zuordnung in "Sonstige" Gruppe
                    # Nur anzeigen, wenn kein Makler-Filter gesetzt ist
                    if not makler_names:
                        if 'Sonstige' not in grouped:
                            grouped['Sonstige'] = []
                        grouped['Sonstige'].append(link)
        
        return grouped
    
    def export_to_csv(self, links: List[str]) -> str:
        """Exportiert Links in CSV-Format (ein Link pro Zeile)"""
        output = StringIO()
        writer = csv.writer(output, lineterminator='\n')
        writer.writerow(['URL'])  # Header
        for link in links:
            writer.writerow([link])
        return output.getvalue()
    
    def export_to_csv_with_metadata(self, links_with_metadata: List[Dict[str, str]]) -> str:
        """Exportiert Links mit Metadaten in CSV-Format"""
        output = StringIO()
        writer = csv.writer(output, lineterminator='\n')
        writer.writerow(['URL', 'Makler', 'Gefunden am'])  # Header
        for link_data in links_with_metadata:
            url = link_data.get('url', '')
            makler = link_data.get('makler', '')
            scraped_at = link_data.get('scraped_at', '')
            # Formatiere Datum lesbar
            if scraped_at:
                try:
                    dt = datetime.fromisoformat(scraped_at)
                    scraped_at_formatted = dt.strftime('%d.%m.%Y %H:%M:%S')
                except (ValueError, TypeError):
                    scraped_at_formatted = scraped_at
            else:
                scraped_at_formatted = ''
            writer.writerow([url, makler, scraped_at_formatted])
        return output.getvalue()
    
    def get_total_links_count(self) -> int:
        """Gibt die Gesamtanzahl der gesammelten Links zurück"""
        return len(self.links)
    
    def delete_links_filtered(self, makler_names: List[str] = None, year: int = None, month: int = None, day: int = None) -> int:
        """
        Löscht Links basierend auf Filtern
        
        Args:
            makler_names: Liste von Makler-Namen (optional)
            year: Jahr (optional)
            month: Monat 1-12 (optional)
            day: Tag 1-31 (optional)
        
        Returns:
            Anzahl gelöschter Links
        """
        from datetime import datetime
        
        deleted_count = 0
        links_to_keep = []
        
        for link in self.links:
            should_delete = True
            
            # Prüfe Makler-Filter
            if makler_names:
                link_makler = link.get('makler_names', [])
                if not isinstance(link_makler, list):
                    link_makler = [link_makler] if link_makler else []
                # Link muss mindestens einen der angegebenen Makler haben
                # Normalisiere Namen (trim whitespace, case-insensitive Vergleich)
                link_makler_normalized = [str(m).strip() for m in link_makler]
                makler_names_normalized = [str(m).strip() for m in makler_names]
                if not any(makler in link_makler_normalized for makler in makler_names_normalized):
                    should_delete = False
                else:
                    logger.debug(f"Link wird gelöscht: {link.get('url')[:50]}... (Makler: {link_makler_normalized}, Filter: {makler_names_normalized})")
            
            # Prüfe Datums-Filter
            if should_delete and (year is not None or month is not None or day is not None):
                scraped_at = link.get('scraped_at')
                if scraped_at:
                    try:
                        if isinstance(scraped_at, str):
                            dt = datetime.fromisoformat(scraped_at.replace('Z', '+00:00'))
                        else:
                            dt = scraped_at
                        
                        if year is not None and dt.year != year:
                            should_delete = False
                        if should_delete and month is not None and dt.month != month:
                            should_delete = False
                        if should_delete and day is not None and dt.day != day:
                            should_delete = False
                    except Exception as e:
                        logger.warning(f"Fehler beim Parsen von scraped_at '{scraped_at}': {e}")
                        # Bei Fehler: Link behalten
                        should_delete = False
                else:
                    # Kein Datum vorhanden: Link behalten
                    should_delete = False
            
            if should_delete:
                deleted_count += 1
                # Entferne auch aus Blacklist
                link_url = link.get('url') if isinstance(link, dict) else link
                if link_url in self.blacklist:
                    self.blacklist.remove(link_url)
            else:
                links_to_keep.append(link)
        
        self.links = links_to_keep
        if deleted_count > 0:
            self.save_links()
            self.save_blacklist()
            logger.info(f"{deleted_count} Links wurden gelöscht (Filter: Makler={makler_names}, Jahr={year}, Monat={month}, Tag={day})")
        
        return deleted_count
    
    def clear_links(self):
        """Löscht alle gesammelten Links"""
        self.links = []
        self.last_scraping_links = []
        self.save_links()
    
    def clear_blacklist(self):
        """Löscht die Blacklist"""
        self.blacklist = set()
        self.save_blacklist()

