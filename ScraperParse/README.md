# Kleinanzeigen Scraper

Ein Scraper/Parser für Kleinanzeigen.de, der gezielt Anzeigen sucht und die Links sammelt. Die Anwendung verfügt über ein Frontend und Backend mit Blacklist-Funktionalität.

## Features

- ✅ **Manuelle Suche**: Starten Sie die Suche manuell mit einem oder mehreren Suchstrings (URLs)
- ✅ **Blacklist-System**: Bereits gefundene Anzeigen werden gespeichert und nicht erneut hinzugefügt
- ✅ **Seiten-Pagination**: Automatisches Durchsuchen mehrerer Seiten
- ✅ **Werbungsfilter**: Filtert Werbung und irrelevante Anzeigen automatisch heraus
- ✅ **Moderne UI**: Benutzerfreundliches Frontend zur Verwaltung der Suchen

## Installation

### Voraussetzungen

- Python 3.8 oder höher
- pip (Python Package Manager)

### Backend einrichten

1. Navigieren Sie zum Backend-Verzeichnis:
```bash
cd backend
```

2. Installieren Sie die Abhängigkeiten:
```bash
pip install -r requirements.txt
```

3. Starten Sie den Server:
```bash
python main.py
```

Der Server läuft nun auf `http://localhost:8000`

### Frontend verwenden

1. Öffnen Sie die Datei `frontend/index.html` in einem modernen Webbrowser
2. Oder starten Sie einen lokalen Webserver (z.B. mit Python):
```bash
cd frontend
python -m http.server 8080
```
Dann öffnen Sie `http://localhost:8080` im Browser

## Verwendung

1. **Suchstrings eingeben**: 
   - Kopieren Sie die URL einer Kleinanzeigen-Suche (z.B. `https://www.kleinanzeigen.de/s-...`)
   - Fügen Sie eine URL pro Zeile in das Textfeld ein
   - Sie können mehrere URLs gleichzeitig eingeben

2. **Suche starten**:
   - Klicken Sie auf "Suche starten"
   - Die Anwendung durchsucht alle Seiten der Suche
   - Neue Anzeigen werden automatisch zur Liste hinzugefügt

3. **Ergebnisse ansehen**:
   - Alle gefundenen Links werden in der Liste angezeigt
   - Klicken Sie auf einen Link, um die Anzeige zu öffnen
   - Die Statistiken zeigen die Gesamtzahl und neue Links

4. **Verwaltung**:
   - **Links löschen**: Entfernt alle gesammelten Links
   - **Blacklist leeren**: Entfernt die Blacklist (bereits gefundene Anzeigen können wieder hinzugefügt werden)
   - **Liste aktualisieren**: Lädt die Liste neu vom Server

## Datenstruktur

- `blacklist.json`: Speichert alle bereits gefundenen Anzeigen-URLs
- `links.json`: Speichert alle gesammelten Anzeigen-Links

## API-Endpunkte

- `GET /`: API-Informationen
- `POST /search`: Startet eine Suche mit gegebenen Suchstrings
- `GET /links`: Gibt alle gesammelten Links zurück
- `DELETE /links`: Löscht alle Links
- `DELETE /blacklist`: Leert die Blacklist

## Hinweise

- Die Anwendung verwendet einen User-Agent, um wie ein normaler Browser zu erscheinen
- Zwischen den Requests wird eine Pause von 1 Sekunde eingelegt, um den Server nicht zu überlasten
- Werbung und irrelevante Anzeigen werden automatisch herausgefiltert
- Die Blacklist verhindert, dass bereits gefundene Anzeigen erneut hinzugefügt werden

## Fehlerbehebung

- **CORS-Fehler**: Stellen Sie sicher, dass der Backend-Server läuft
- **Keine Links gefunden**: Überprüfen Sie, ob die URL korrekt ist und ob die Seite erreichbar ist
- **Timeout-Fehler**: Die Suche kann bei langsamen Verbindungen länger dauern


