/**
 * Kleinanzeigen URL Generator
 * Generiert URLs für verschiedene PLZs mit konfigurierbaren Filtern
 */

/**
 * Generiert eine Basis-URL ohne die ID am Ende
 * Die ID am Ende (z.B. k0c195l1857) ist ortsspezifisch, aber die URLs funktionieren auch ohne sie
 * @param {string} plz - Die PLZ (5-stellig)
 * @param {object} filters - Filter-Objekte (anbieter, anzeige, preis, kategorie, suchbegriff)
 * @returns {string} - Die generierte URL ohne ID
 */
function generateKleinanzeigenURL(plz, filters = {}) {
    const baseURL = 'https://www.kleinanzeigen.de';
    
    // Kategorie (Standard: immobilien)
    const kategorie = filters.kategorie || 'immobilien';
    
    // Baue URL-Pfad zusammen
    let urlPath = `/s-${kategorie}/${plz}`;
    
    // Filter hinzufügen
    const filterParts = [];
    
    if (filters.anbieter) {
        filterParts.push(`anbieter:${filters.anbieter}`);
    }
    
    if (filters.anzeige) {
        filterParts.push(`anzeige:${filters.anzeige}`);
    }
    
    if (filters.preis) {
        filterParts.push(`preis:${filters.preis}:`);
    }
    
    if (filters.suchbegriff) {
        filterParts.push(filters.suchbegriff);
    }
    
    if (filterParts.length > 0) {
        urlPath += '/' + filterParts.join('/');
    }
    
    return baseURL + urlPath;
}

/**
 * Extrahiert Filter aus einer vorhandenen URL
 * @param {string} url - Die Basis-URL
 * @returns {object} - Objekt mit PLZ und Filtern
 */
function parseURLFilters(url) {
    const filters = {
        plz: null,
        kategorie: 'immobilien',
        anbieter: null,
        anzeige: null,
        preis: null,
        suchbegriff: null
    };
    
    // Extrahiere PLZ
    const plzMatch = url.match(/kleinanzeigen\.de\/s-[^/]+\/(\d{5})/);
    if (plzMatch) {
        filters.plz = plzMatch[1];
    }
    
    // Extrahiere Kategorie
    const kategorieMatch = url.match(/s-([^/]+)/);
    if (kategorieMatch) {
        filters.kategorie = kategorieMatch[1];
    }
    
    // Entferne die ID am Ende für besseres Parsing
    const urlWithoutID = url.replace(/\/k\d+c\d+l\d+$/, '');
    
    // Extrahiere Filter
    if (urlWithoutID.includes('anbieter:')) {
        const anbieterMatch = urlWithoutID.match(/anbieter:([^/]+)/);
        if (anbieterMatch) {
            filters.anbieter = anbieterMatch[1];
        }
    }
    
    if (urlWithoutID.includes('anzeige:')) {
        const anzeigeMatch = urlWithoutID.match(/anzeige:([^/]+)/);
        if (anzeigeMatch) {
            filters.anzeige = anzeigeMatch[1];
        }
    }
    
    if (urlWithoutID.includes('preis:')) {
        const preisMatch = urlWithoutID.match(/preis:([^/]+):/);
        if (preisMatch) {
            filters.preis = preisMatch[1];
        }
    }
    
    // Suchbegriff (alles nach preis oder anderen Filtern, aber vor /k0)
    const suchbegriffMatch = urlWithoutID.match(/\/([^/]+)(?:\/k\d+c\d+l\d+|$)/);
    if (suchbegriffMatch && !suchbegriffMatch[1].includes(':')) {
        filters.suchbegriff = suchbegriffMatch[1];
    }
    
    return filters;
}

/**
 * Generiert URLs für eine Liste von PLZs
 * @param {object} filterTemplate - Filter-Vorlage (aus Basis-URL oder manuell)
 * @param {string[]} plzList - Array von PLZs
 * @returns {string[]} - Array von generierten URLs
 */
function generateURLsForPLZs(filterTemplate, plzList) {
    const urls = [];
    const seenPLZs = new Set();
    
    for (const plz of plzList) {
        const cleanPLZ = plz.trim();
        
        // Nur 5-stellige PLZs akzeptieren
        if (!/^\d{5}$/.test(cleanPLZ)) {
            console.warn(`Überspringe ungültige PLZ: ${cleanPLZ}`);
            continue;
        }
        
        // Vermeide Duplikate
        if (seenPLZs.has(cleanPLZ)) {
            continue;
        }
        seenPLZs.add(cleanPLZ);
        
        try {
            const newURL = generateKleinanzeigenURL(cleanPLZ, filterTemplate);
            urls.push(newURL);
        } catch (error) {
            console.warn(`Fehler beim Generieren der URL für PLZ ${cleanPLZ}:`, error.message);
        }
    }
    
    return urls;
}

/**
 * Parse PLZ-Liste aus Text (eine pro Zeile, Komma-getrennt, etc.)
 * @param {string} plzText - Text mit PLZs
 * @returns {string[]} - Array von PLZs
 */
function parsePLZList(plzText) {
    if (!plzText.trim()) {
        return [];
    }
    
    // Unterstützt: Zeilenumbruch, Komma, Semikolon
    const plzs = plzText
        .split(/[\n,;]+/)
        .map(p => p.trim())
        .filter(p => p.length > 0 && /^\d{5}$/.test(p));
    
    return plzs;
}

/**
 * Export für Verwendung in anderen Modulen
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateKleinanzeigenURL,
        parseURLFilters,
        generateURLsForPLZs,
        parsePLZList
    };
}
