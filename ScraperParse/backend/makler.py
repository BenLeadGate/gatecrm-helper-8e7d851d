"""
Makler-Verwaltung
Verwaltet Makler mit ihren zugehörigen Links
"""
import json
import os
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class MaklerManager:
    def __init__(self, makler_file="makler.json"):
        self.makler_file = makler_file
        self.makler: Dict[str, Dict] = self.load_makler()
    
    def load_makler(self) -> Dict[str, Dict]:
        """Lädt die Makler-Daten aus einer JSON-Datei"""
        if os.path.exists(self.makler_file):
            try:
                with open(self.makler_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('makler', {})
            except Exception as e:
                logger.error(f"Fehler beim Laden der Makler: {e}")
                return {}
        return {}
    
    def save_makler(self):
        """Speichert die Makler-Daten in eine JSON-Datei"""
        try:
            with open(self.makler_file, 'w', encoding='utf-8') as f:
                json.dump({'makler': self.makler}, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Makler: {e}")
    
    def add_makler(self, name: str) -> bool:
        """
        Fügt einen neuen Makler hinzu
        
        Args:
            name: Name des Maklers
        
        Returns:
            True wenn erfolgreich, False wenn Makler bereits existiert
        """
        if name in self.makler:
            return False
        
        self.makler[name] = {
            'name': name,
            'links': [],
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        self.save_makler()
        logger.info(f"Makler '{name}' hinzugefügt")
        return True
    
    def delete_makler(self, name: str) -> bool:
        """
        Löscht einen Makler
        
        Args:
            name: Name des Maklers
        
        Returns:
            True wenn erfolgreich, False wenn Makler nicht existiert
        """
        if name not in self.makler:
            return False
        
        del self.makler[name]
        self.save_makler()
        logger.info(f"Makler '{name}' gelöscht")
        return True
    
    def add_link_to_makler(self, name: str, link: str) -> bool:
        """
        Fügt einen Link zu einem Makler hinzu
        
        Args:
            name: Name des Maklers
            link: URL des Links
        
        Returns:
            True wenn erfolgreich, False wenn Makler nicht existiert
        """
        if name not in self.makler:
            return False
        
        if link not in self.makler[name]['links']:
            self.makler[name]['links'].append(link)
            self.makler[name]['updated_at'] = datetime.now().isoformat()
            self.save_makler()
            logger.info(f"Link zu Makler '{name}' hinzugefügt")
        
        return True
    
    def remove_link_from_makler(self, name: str, link: str) -> bool:
        """
        Entfernt einen Link von einem Makler
        
        Args:
            name: Name des Maklers
            link: URL des Links
        
        Returns:
            True wenn erfolgreich, False wenn Makler oder Link nicht existiert
        """
        if name not in self.makler:
            return False
        
        if link in self.makler[name]['links']:
            self.makler[name]['links'].remove(link)
            self.makler[name]['updated_at'] = datetime.now().isoformat()
            self.save_makler()
            logger.info(f"Link von Makler '{name}' entfernt")
        
        return True
    
    def get_makler(self, name: Optional[str] = None) -> Dict:
        """
        Gibt Makler-Daten zurück
        
        Args:
            name: Optional - Name des Maklers. Wenn None, werden alle Makler zurückgegeben
        
        Returns:
            Dict mit Makler-Daten
        """
        if name:
            return self.makler.get(name)
        return self.makler
    
    def get_all_makler_names(self) -> List[str]:
        """Gibt alle Makler-Namen zurück"""
        return list(self.makler.keys())
    
    def get_links_for_makler(self, name: str) -> List[str]:
        """
        Gibt alle Links für einen Makler zurück
        
        Args:
            name: Name des Maklers
        
        Returns:
            Liste von URLs
        """
        if name not in self.makler:
            return []
        return self.makler[name].get('links', [])
    
    def get_all_links_for_maklers(self, makler_names: List[str]) -> List[str]:
        """
        Gibt alle Links für mehrere Makler zurück
        
        Args:
            makler_names: Liste von Makler-Namen
        
        Returns:
            Liste von URLs (kann Duplikate enthalten)
        """
        all_links = []
        for name in makler_names:
            links = self.get_links_for_makler(name)
            all_links.extend(links)
        return all_links


