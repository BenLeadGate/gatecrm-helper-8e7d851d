from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional, Dict
import uvicorn
import logging
from scraper import KleinanzeigenScraper
from url_finder import find_urls_for_plzs
from makler import MaklerManager

# Konfiguriere Logging mit Datei-Output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend_export.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kleinanzeigen Scraper")

# CORS für Frontend-Zugriff
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Wichtig: Erlaube Frontend, Content-Disposition Header zu lesen
)

scraper = KleinanzeigenScraper()
makler_manager = MaklerManager()

class SearchRequest(BaseModel):
    search_strings: List[str]

class MaklerSearchRequest(BaseModel):
    makler_names: List[str]

class SearchResponse(BaseModel):
    success: bool
    new_links: List[str]
    total_links: int
    message: str

@app.get("/")
def read_root():
    return {"message": "Kleinanzeigen Scraper API"}

@app.post("/search", response_model=SearchResponse)
async def start_search(request: SearchRequest):
    """Legacy-Endpoint: Sucht direkt nach Links (für Kompatibilität)"""
    try:
        new_links = scraper.search_and_collect_links(request.search_strings)
        total_links = scraper.get_total_links_count()
        return SearchResponse(
            success=True,
            new_links=new_links,
            total_links=total_links,
            message=f"{len(new_links)} neue Anzeigen gefunden"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search/makler", response_model=SearchResponse)
async def start_search_makler(request: MaklerSearchRequest):
    """Sucht nach Links der angegebenen Makler"""
    try:
        # Erstelle Mapping: search_url -> makler_name
        # Jede Such-URL wird ihrem Makler zugeordnet
        url_to_makler = {}
        for makler_name in request.makler_names:
            links = makler_manager.get_links_for_makler(makler_name)
            for link in links:
                url_to_makler[link] = makler_name
        
        all_links = list(url_to_makler.keys())
        
        if not all_links:
            return SearchResponse(
                success=False,
                new_links=[],
                total_links=scraper.get_total_links_count(),
                message=f"Keine Links für die angegebenen Makler gefunden"
            )
        
        # Führe Scraping durch mit URL-zu-Makler-Mapping
        new_links = scraper.search_and_collect_links(all_links, url_to_makler_mapping=url_to_makler)
        total_links = scraper.get_total_links_count()
        
        return SearchResponse(
            success=True,
            new_links=new_links,
            total_links=total_links,
            message=f"{len(new_links)} neue Anzeigen gefunden für {len(request.makler_names)} Makler"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/links")
def get_all_links():
    return {
        "links": scraper.get_all_links(),
        "count": scraper.get_total_links_count()
    }

@app.get("/links/grouped")
def get_links_grouped_by_makler(
    makler_names: Optional[str] = Query(None, description="Komma-getrennte Liste von Makler-Namen"),
    year: Optional[int] = Query(None, description="Jahr zum Filtern"),
    month: Optional[int] = Query(None, description="Monat zum Filtern (1-12)"),
    day: Optional[int] = Query(None, description="Tag zum Filtern (1-31)"),
    last_search_only: Optional[bool] = Query(False, description="Nur Links der letzten Suche")
):
    """Gibt Links nach Maklern gruppiert zurück, optional gefiltert"""
    # Parse Makler-Namen
    makler_list = None
    if makler_names:
        makler_list = [name.strip() for name in makler_names.split(',') if name.strip()]
    
    # Validierung
    if month is not None and (month < 1 or month > 12):
        raise HTTPException(status_code=400, detail="Monat muss zwischen 1 und 12 sein")
    if day is not None and (day < 1 or day > 31):
        raise HTTPException(status_code=400, detail="Tag muss zwischen 1 und 31 sein")
    
    # Filtere Links
    grouped = scraper.get_filtered_links_grouped(
        makler_names=makler_list,
        year=year,
        month=month,
        day=day,
        last_search_only=last_search_only
    )
    
    # Konvertiere für Frontend: Dict mit Makler-Namen als Keys
    return {
        "grouped": grouped,
        "makler_names": list(grouped.keys()),
        "total_count": scraper.get_total_links_count(),
        "filtered_count": sum(len(links) for links in grouped.values())
    }

@app.delete("/links")
def clear_links(
    makler_names: Optional[str] = Query(None, description="Komma-getrennte Liste von Makler-Namen"),
    year: Optional[int] = Query(None, description="Jahr zum Filtern"),
    month: Optional[int] = Query(None, description="Monat zum Filtern (1-12)"),
    day: Optional[int] = Query(None, description="Tag zum Filtern (1-31)")
):
    """Löscht Links, optional gefiltert nach Makler und/oder Datum"""
    # Wenn keine Filter angegeben, lösche alle
    if not makler_names and year is None and month is None and day is None:
        scraper.clear_links()
        return {"message": "Alle Links wurden gelöscht", "deleted_count": scraper.get_total_links_count()}
    
    # Parse Makler-Namen
    makler_list = None
    if makler_names:
        # URL-Decodierung für Leerzeichen (z.B. "Sara+Rosillo" -> "Sara Rosillo")
        from urllib.parse import unquote
        decoded_names = unquote(makler_names)
        makler_list = [name.strip() for name in decoded_names.split(',') if name.strip()]
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Lösche Links für Makler: {makler_list}")
    
    # Validierung
    if month is not None and (month < 1 or month > 12):
        raise HTTPException(status_code=400, detail="Monat muss zwischen 1 und 12 liegen")
    if day is not None and (day < 1 or day > 31):
        raise HTTPException(status_code=400, detail="Tag muss zwischen 1 und 31 liegen")
    
    # Selektives Löschen
    deleted_count = scraper.delete_links_filtered(
        makler_names=makler_list,
        year=year,
        month=month,
        day=day
    )
    
    return {
        "message": f"{deleted_count} Links wurden gelöscht",
        "deleted_count": deleted_count
    }

@app.delete("/blacklist")
def clear_blacklist():
    scraper.clear_blacklist()
    return {"message": "Blacklist wurde geleert"}

# Makler-Endpoints
@app.get("/makler")
def get_all_makler():
    """Gibt alle Makler zurück"""
    return {"makler": makler_manager.get_makler()}

@app.post("/makler")
def add_makler(name: str = Query(..., description="Name des Maklers")):
    """Fügt einen neuen Makler hinzu"""
    success = makler_manager.add_makler(name)
    if not success:
        raise HTTPException(status_code=400, detail=f"Makler '{name}' existiert bereits")
    return {"message": f"Makler '{name}' wurde hinzugefügt", "makler": makler_manager.get_makler(name)}

@app.delete("/makler/{name}")
def delete_makler(name: str):
    """Löscht einen Makler"""
    success = makler_manager.delete_makler(name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Makler '{name}' nicht gefunden")
    return {"message": f"Makler '{name}' wurde gelöscht"}

class AddLinkRequest(BaseModel):
    link: str

@app.post("/makler/{name}/links")
def add_link_to_makler(name: str, request: AddLinkRequest):
    """Fügt einen Link zu einem Makler hinzu"""
    success = makler_manager.add_link_to_makler(name, request.link)
    if not success:
        raise HTTPException(status_code=404, detail=f"Makler '{name}' nicht gefunden")
    return {"message": f"Link zu Makler '{name}' hinzugefügt", "makler": makler_manager.get_makler(name)}

@app.delete("/makler/{name}/links")
def remove_link_from_makler(name: str, link: str = Query(..., description="URL des Links")):
    """Entfernt einen Link von einem Makler"""
    success = makler_manager.remove_link_from_makler(name, link)
    if not success:
        raise HTTPException(status_code=404, detail=f"Makler '{name}' nicht gefunden oder Link nicht vorhanden")
    return {"message": f"Link von Makler '{name}' entfernt", "makler": makler_manager.get_makler(name)}

class URLGeneratorRequest(BaseModel):
    plz_list: List[str]
    filters: Dict[str, Optional[str]]
    reference_url: Optional[str] = None

@app.post("/generate-urls")
def generate_urls_with_ids(request: URLGeneratorRequest):
    """Generiert URLs mit IDs für eine Liste von PLZs"""
    try:
        results = find_urls_for_plzs(request.plz_list, request.filters, request.reference_url)
        urls = list(results.values())
        return {
            "success": True,
            "urls": urls,
            "count": len(urls),
            "results": results  # PLZ -> URL Mapping
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Generieren der URLs: {str(e)}")

@app.get("/export/last")
def export_last_scraping(
    makler_names: Optional[str] = Query(None, description="Komma-getrennte Liste von Makler-Namen"),
    year: Optional[int] = Query(None, description="Jahr (z.B. 2026)"),
    month: Optional[int] = Query(None, description="Monat (1-12)"),
    day: Optional[int] = Query(None, description="Tag (1-31)")
):
    """Exportiert die Links der letzten Suche als CSV, optional gefiltert nach Makler und/oder Datum"""
    makler_list = None
    if makler_names:
        from urllib.parse import unquote
        decoded_names = unquote(makler_names)
        makler_list = [name.strip() for name in decoded_names.split(',') if name.strip()]
        logger.info(f"Export letzte_suche - Makler-Namen erhalten: {makler_names} -> {makler_list}")
    
    # Validierung
    if month is not None and (month < 1 or month > 12):
        raise HTTPException(status_code=400, detail="Monat muss zwischen 1 und 12 sein")
    if day is not None and (day < 1 or day > 31):
        raise HTTPException(status_code=400, detail="Tag muss zwischen 1 und 31 sein")
    
    links_with_metadata = scraper.get_filtered_links_with_metadata(
        makler_names=makler_list,
        year=year,
        month=month,
        day=day,
        last_search_only=True
    )
    csv_content = scraper.export_to_csv_with_metadata(links_with_metadata)
    
    # Dateiname mit allen Filterkriterien: Datum + Makler
    filename = "letzte_suche"
    if year and month:
        filename += f"_{year}_{month:02d}"
        if day:
            filename += f"_{day:02d}"
    if makler_list and len(makler_list) > 0:
        if len(makler_list) == 1:
            # Einzelner Makler: Name im Dateinamen
            makler_safe = makler_list[0].replace(' ', '_').replace('/', '_').replace('\\', '_').replace(':', '_').replace('*', '_').replace('?', '_').replace('"', '_').replace('<', '_').replace('>', '_').replace('|', '_')
            filename += f"_{makler_safe}"
        else:
            # Mehrere Makler: "mehrere" als Platzhalter
            filename += "_mehrere_makler"
    filename += ".csv"
    
    logger.info(f"Export letzte_suche - Dateiname: {filename}, Makler: {makler_list}")
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/export/all")
def export_all_links(
    makler_names: Optional[str] = Query(None, description="Komma-getrennte Liste von Makler-Namen"),
    year: Optional[int] = Query(None, description="Jahr (z.B. 2026)"),
    month: Optional[int] = Query(None, description="Monat (1-12)"),
    day: Optional[int] = Query(None, description="Tag (1-31)")
):
    """Exportiert alle Links als CSV, optional gefiltert nach Makler und/oder Datum"""
    makler_list = None
    if makler_names:
        from urllib.parse import unquote
        decoded_names = unquote(makler_names)
        makler_list = [name.strip() for name in decoded_names.split(',') if name.strip()]
        logger.info(f"Export alle_links - Makler-Namen erhalten: {makler_names} -> {makler_list}")
    
    # Validierung
    if month is not None and (month < 1 or month > 12):
        raise HTTPException(status_code=400, detail="Monat muss zwischen 1 und 12 sein")
    if day is not None and (day < 1 or day > 31):
        raise HTTPException(status_code=400, detail="Tag muss zwischen 1 und 31 sein")
    
    # Wenn Filter gesetzt sind, verwende get_filtered_links_with_metadata
    if makler_list or year or month or day:
        links_with_metadata = scraper.get_filtered_links_with_metadata(
            makler_names=makler_list,
            year=year,
            month=month,
            day=day
        )
    else:
        # Für "alle Links" ohne Filter: hole alle Links mit Metadaten
        all_links_data = scraper.get_all_links_with_dates()
        links_with_metadata = []
        for link_entry in all_links_data:
            if isinstance(link_entry, dict):
                makler_names_list = link_entry.get('makler_names', [])
                if not isinstance(makler_names_list, list):
                    makler_names_list = [makler_names_list] if makler_names_list else []
                makler_str = ', '.join(makler_names_list) if makler_names_list else ''
                links_with_metadata.append({
                    'url': link_entry.get('url', ''),
                    'makler': makler_str,
                    'scraped_at': link_entry.get('scraped_at', '')
                })
    
    csv_content = scraper.export_to_csv_with_metadata(links_with_metadata)
    
    # Dateiname mit allen Filterkriterien: Datum + Makler
    filename = "alle_links"
    if year and month:
        filename += f"_{year}_{month:02d}"
        if day:
            filename += f"_{day:02d}"
    if makler_list and len(makler_list) > 0:
        if len(makler_list) == 1:
            # Einzelner Makler: Name im Dateinamen
            makler_safe = makler_list[0].replace(' ', '_').replace('/', '_').replace('\\', '_').replace(':', '_').replace('*', '_').replace('?', '_').replace('"', '_').replace('<', '_').replace('>', '_').replace('|', '_')
            filename += f"_{makler_safe}"
        else:
            # Mehrere Makler: "mehrere" als Platzhalter
            filename += "_mehrere_makler"
    filename += ".csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/export/filtered")
def export_filtered_links(
    year: int = Query(..., description="Jahr (z.B. 2026)"),
    month: int = Query(..., description="Monat (1-12)"),
    day: Optional[int] = Query(None, description="Tag (1-31)"),
    makler_names: Optional[str] = Query(None, description="Komma-getrennte Liste von Makler-Namen")
):
    """Exportiert Links gefiltert nach Jahr, Monat, optional Tag und optional Makler als CSV"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Monat muss zwischen 1 und 12 sein")
    if day is not None and (day < 1 or day > 31):
        raise HTTPException(status_code=400, detail="Tag muss zwischen 1 und 31 sein")
    
    makler_list = None
    if makler_names:
        from urllib.parse import unquote
        logger.info(f"Export filtered - RAW makler_names Parameter: {makler_names}, type: {type(makler_names)}")
        decoded_names = unquote(makler_names)
        logger.info(f"Export filtered - Decoded: {decoded_names}")
        makler_list = [name.strip() for name in decoded_names.split(',') if name.strip()]
        logger.info(f"Export filtered - Makler-Liste nach Split: {makler_list}, len: {len(makler_list) if makler_list else 0}")
    
    links_with_metadata = scraper.get_filtered_links_with_metadata(
        makler_names=makler_list,
        year=year,
        month=month,
        day=day
    )
    csv_content = scraper.export_to_csv_with_metadata(links_with_metadata)
    
    # Dateiname mit allen Filterkriterien: Datum + Makler
    filename = f"links_{year}_{month:02d}"
    if day:
        filename += f"_{day:02d}"
    
    logger.info(f"Export filtered - Vor Makler-Prüfung: makler_list={makler_list}, type={type(makler_list)}, len={len(makler_list) if makler_list else 0}")
    print(f"DEBUG: makler_list = {makler_list}, bool(makler_list) = {bool(makler_list)}, len = {len(makler_list) if makler_list else 'None'}")
    
    if makler_list is not None and len(makler_list) > 0:
        logger.info(f"Export filtered - Makler-Liste gefüllt: {makler_list}")
        if len(makler_list) == 1:
            # Einzelner Makler: Name im Dateinamen
            makler_safe = makler_list[0].replace(' ', '_').replace('/', '_').replace('\\', '_').replace(':', '_').replace('*', '_').replace('?', '_').replace('"', '_').replace('<', '_').replace('>', '_').replace('|', '_')
            filename += f"_{makler_safe}"
            logger.info(f"Export filtered - Makler-Name zum Dateinamen hinzugefügt: {makler_safe}")
        else:
            # Mehrere Makler: "mehrere" als Platzhalter
            filename += "_mehrere_makler"
            logger.info(f"Export filtered - Mehrere Makler erkannt")
    else:
        logger.warning(f"Export filtered - KEIN Makler im Dateinamen! makler_list={makler_list}")
    
    filename += ".csv"
    
    logger.info(f"Export filtered - Finaler Dateiname: {filename}, Makler: {makler_list}")
    
    # Content-Disposition Header mit korrektem Dateinamen
    content_disposition = f'attachment; filename="{filename}"'
    logger.info(f"Export filtered - Content-Disposition Header: {content_disposition}")
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": content_disposition}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)

