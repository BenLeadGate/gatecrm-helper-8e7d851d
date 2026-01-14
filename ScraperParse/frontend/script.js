// API_BASE_URL global verfügbar machen
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:9000';
}

// DOM-Elemente
const statusDiv = document.getElementById('statusMessage');
const linksContainer = document.getElementById('linksContainer');
const totalLinksSpan = document.getElementById('totalLinks');
const newLinksSpan = document.getElementById('newLinks');
const linksCountSpan = document.getElementById('linksCount');
const clearLinksBtn = document.getElementById('clearLinksBtn');
const clearBlacklistBtn = document.getElementById('clearBlacklistBtn');
const deleteFilteredBtn = document.getElementById('deleteFilteredBtn');
const deleteMaklerSelect = document.getElementById('deleteMaklerSelect');
const deleteYear = document.getElementById('deleteYear');
const deleteMonth = document.getElementById('deleteMonth');
const deleteDay = document.getElementById('deleteDay');
const refreshBtn = document.getElementById('refreshBtn');
const exportLastBtn = document.getElementById('exportLastBtn');
const exportAllBtn = document.getElementById('exportAllBtn');
const exportMaklerBtn = document.getElementById('exportMaklerBtn');
const exportFilteredBtn = document.getElementById('exportFilteredBtn');
const exportFilterYear = document.getElementById('exportFilterYear');
const exportFilterMonth = document.getElementById('exportFilterMonth');
const exportFilterDay = document.getElementById('exportFilterDay');
const exportMaklerSelect = document.getElementById('exportMaklerSelect');

// URL Generator Elements
const baseURLInput = document.getElementById('baseURLInput');
const plzListInput = document.getElementById('plzListInput');
const generateURLsBtn = document.getElementById('generateURLsBtn');
const generatedURLsContainer = document.getElementById('generatedURLsContainer');
const generatedURLsOutput = document.getElementById('generatedURLsOutput');
const generatedURLsCount = document.getElementById('generatedURLsCount');
const copyURLsBtn = document.getElementById('copyURLsBtn');
const useGeneratedURLsBtn = document.getElementById('useGeneratedURLsBtn');

// Status-Nachricht anzeigen (global verfügbar machen)
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) {
        console.warn('statusMessage Element nicht gefunden');
        return;
    }
    
    // Clear previous classes
    statusDiv.className = 'StatusMessage';
    statusDiv.style.display = 'block';
    if (type === 'success') {
        statusDiv.classList.add('success');
        statusDiv.innerHTML = `<span>✓</span> ${message}`;
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    } else if (type === 'error') {
        statusDiv.classList.add('error');
        statusDiv.innerHTML = `<span>✗</span> ${message}`;
    } else {
        statusDiv.classList.add('info');
        statusDiv.textContent = message;
    }
}

// showStatus global verfügbar machen
window.showStatus = showStatus;

// Lädt alle Links vom Server (optional mit Filtern)
async function loadLinks(filters = null) {
    try {
        let url = `${window.API_BASE_URL}/links/grouped`;
        
        // Baue Query-Parameter zusammen
        if (filters) {
            const params = new URLSearchParams();
            if (filters.makler_names && filters.makler_names.length > 0) {
                params.append('makler_names', filters.makler_names.join(','));
            }
            if (filters.year) {
                params.append('year', filters.year);
            }
            if (filters.month) {
                params.append('month', filters.month);
            }
            if (filters.day) {
                params.append('day', filters.day);
            }
            if (filters.last_search_only) {
                params.append('last_search_only', 'true');
            }
            const queryString = params.toString();
            if (queryString) {
                url += '?' + queryString;
            }
        }
        
        console.log('Lade Links von URL:', url);
        console.log('Filter-Parameter:', filters);
        console.log('Vollständige URL:', url);
        const response = await fetch(url);
        console.log('Response Status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Links-Daten erhalten:', {
            grouped_keys: Object.keys(data.grouped || {}),
            total_count: data.total_count,
            filtered_count: data.filtered_count,
            grouped_data: data.grouped
        });
        
        console.log('Rufe displayLinksGrouped auf mit:', Object.keys(data.grouped || {}));
        console.log('Gefilterte Anzahl:', data.filtered_count);
        console.log('Gesamtanzahl:', data.total_count);
        displayLinksGrouped(data.grouped || {});
        if (totalLinksSpan) totalLinksSpan.textContent = data.total_count || 0;
        if (linksCountSpan) linksCountSpan.textContent = data.filtered_count || data.total_count || 0;
        
        // Update Status Anchor
        const statusLinksCount = document.getElementById('statusLinksCount');
        if (statusLinksCount) {
            statusLinksCount.textContent = data.filtered_count || data.total_count || 0;
        }
        
        // Update filtered count
        const filteredLinks = document.getElementById('filteredLinks');
        if (filteredLinks) {
            filteredLinks.textContent = data.filtered_count || data.total_count || 0;
        }
        
        // Update last action
        const lastAction = document.getElementById('lastAction');
        if (lastAction) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            lastAction.querySelector('.Panel-context-value').textContent = `Links geladen (${timeStr})`;
        }
        
        // Update Results Badge
        const resultsBadge = document.getElementById('resultsBadge');
        if (resultsBadge) {
            const count = data.filtered_count || data.total_count || 0;
            if (count > 0) {
                resultsBadge.textContent = count;
                resultsBadge.style.display = 'inline-block';
            } else {
                resultsBadge.style.display = 'none';
            }
        }
        
        return data;
    } catch (error) {
        console.error('Fehler beim Laden der Links:', error);
        showStatus('Fehler beim Laden der Links: ' + error.message, 'error');
    }
}

// loadLinks global verfügbar machen
window.loadLinks = loadLinks;

// Zeigt Links nach Maklern gruppiert an
function displayLinksGrouped(grouped) {
    console.log('displayLinksGrouped aufgerufen mit:', Object.keys(grouped || {}));
    const maklerNames = Object.keys(grouped || {});
    
    if (maklerNames.length === 0) {
        linksContainer.innerHTML = `
            <div class="EmptyState">
                <div class="EmptyState-icon">📋</div>
                <div class="EmptyState-title">Keine Links gefunden</div>
                <div class="EmptyState-text">Es wurden keine Links gefunden, die den angewendeten Filtern entsprechen.</div>
            </div>
        `;
        return;
    }
    
    linksContainer.innerHTML = maklerNames.map(maklerName => {
        const links = grouped[maklerName];
        const linkCount = links.length;
        
        return `
            <div class="Card-group" style="margin-bottom: var(--space-24);">
                <div class="Card-group-title">
                    ${maklerName}
                    <span class="secondary-text" style="font-weight: 400; margin-left: var(--space-8);">
                        (${linkCount} ${linkCount === 1 ? 'Link' : 'Links'})
                    </span>
                </div>
                <div class="Card-group-content">
                    <div class="List" style="gap: var(--space-8);">
                        ${links.map(link => {
                            const url = typeof link === 'string' ? link : link.url || link;
                            return `
                                <button class="Row" onclick="window.open('${url}', '_blank', 'noopener,noreferrer')" style="width: 100%; text-align: left;">
                                    <div class="Row-primary" style="word-break: break-all;">${url}</div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Startet die Suche nach Maklern
async function startSearchMakler() {
    const selectedMakler = Array.from(document.querySelectorAll('.makler-checkbox:checked'))
        .map(cb => cb.value);
    
    if (selectedMakler.length === 0) {
        showStatus('Bitte wählen Sie mindestens einen Makler aus.', 'error');
        return;
    }
    
    const searchBtn = document.getElementById('searchMaklerBtn');
    if (!searchBtn) return;
    
    searchBtn.disabled = true;
    searchBtn.textContent = 'Suche läuft...';
    showStatus('Suche wird durchgeführt...', 'info');
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/search/makler`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                makler_names: selectedMakler
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Fehler beim Suchen');
        }
        
        const data = await response.json();
        
        showStatus(data.message, 'success');
        if (newLinksSpan) {
            newLinksSpan.textContent = data.new_links.length;
        }
        
        // Scroll zu Results-Section
        const resultsSection = document.getElementById('ergebnisse');
        if (resultsSection) {
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
        }
        
        // Lade alle Links neu
        await loadLinks();
        
    } catch (error) {
        console.error('Fehler bei der Suche:', error);
        showStatus('Fehler bei der Suche: ' + error.message, 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Suche starten';
    }
}

// Event-Listener
const searchMaklerBtn = document.getElementById('searchMaklerBtn');
if (searchMaklerBtn) {
    searchMaklerBtn.addEventListener('click', startSearchMakler);
}

// Makler hinzufügen Event-Listener wird in makler.js verwaltet
// (Event-Listener werden dort gesetzt, nachdem DOM geladen ist)

if (clearLinksBtn) {
    clearLinksBtn.addEventListener('click', async () => {
        if (!confirm('Möchten Sie wirklich alle Links löschen?')) {
            return;
        }
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/links`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showStatus('Alle Links wurden gelöscht.', 'success');
                await loadLinks();
            } else {
                throw new Error('Fehler beim Löschen der Links');
            }
        } catch (error) {
            showStatus('Fehler beim Löschen: ' + error.message, 'error');
        }
    });
}

if (clearBlacklistBtn) {
    clearBlacklistBtn.addEventListener('click', async () => {
        if (!confirm('Möchten Sie wirklich die Blacklist leeren? Dies bedeutet, dass bereits gefundene Anzeigen wieder aufgenommen werden können.')) {
            return;
        }
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/blacklist`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showStatus('Blacklist wurde geleert.', 'success');
            } else {
                throw new Error('Fehler beim Leeren der Blacklist');
            }
        } catch (error) {
            showStatus('Fehler beim Leeren der Blacklist: ' + error.message, 'error');
        }
    });
}

// Selektives Löschen
if (deleteFilteredBtn) {
    deleteFilteredBtn.addEventListener('click', async () => {
        const maklerName = deleteMaklerSelect?.value || '';
        const year = deleteYear?.value ? parseInt(deleteYear.value) : null;
        const month = deleteMonth?.value ? parseInt(deleteMonth.value) : null;
        const day = deleteDay?.value ? parseInt(deleteDay.value) : null;
        
        // Validierung
        if (month !== null && (month < 1 || month > 12)) {
            showStatus('Monat muss zwischen 1 und 12 liegen.', 'error');
            return;
        }
        if (day !== null && (day < 1 || day > 31)) {
            showStatus('Tag muss zwischen 1 und 31 liegen.', 'error');
            return;
        }
        
        // Bestätigung
        let confirmMessage = 'Möchten Sie wirklich Links löschen?';
        const filters = [];
        if (maklerName) filters.push(`Makler: ${maklerName}`);
        if (year) filters.push(`Jahr: ${year}`);
        if (month) filters.push(`Monat: ${month}`);
        if (day) filters.push(`Tag: ${day}`);
        if (filters.length > 0) {
            confirmMessage = `Möchten Sie wirklich Links löschen?\n\nFilter: ${filters.join(', ')}`;
        } else {
            confirmMessage = 'Möchten Sie wirklich alle Links löschen?';
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        deleteFilteredBtn.disabled = true;
        deleteFilteredBtn.textContent = 'Lösche...';
        
        try {
            // Baue Query-Parameter
            const params = new URLSearchParams();
            if (maklerName) {
                params.append('makler_names', maklerName);
                console.log('Lösche für Makler:', maklerName);
            }
            if (year) params.append('year', year.toString());
            if (month) params.append('month', month.toString());
            if (day) params.append('day', day.toString());
            
            const url = `${window.API_BASE_URL}/links${params.toString() ? '?' + params.toString() : ''}`;
            console.log('DELETE URL:', url);
            
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Fehler beim Löschen');
            }
            
            const data = await response.json();
            showStatus(data.message || `${data.deleted_count} Links wurden gelöscht.`, 'success');
            
            // Felder zurücksetzen
            if (deleteMaklerSelect) deleteMaklerSelect.value = '';
            if (deleteYear) deleteYear.value = '';
            if (deleteMonth) deleteMonth.value = '';
            if (deleteDay) deleteDay.value = '';
            
            // Links neu laden
            await loadLinks();
        } catch (error) {
            showStatus('Fehler beim Löschen: ' + error.message, 'error');
        } finally {
            deleteFilteredBtn.disabled = false;
            deleteFilteredBtn.textContent = 'Löschen';
        }
    });
}

// Makler-Liste für Delete-Select füllen
function updateDeleteMaklerSelect() {
    const select = document.getElementById('deleteMaklerSelect');
    if (!select) {
        console.warn('deleteMaklerSelect Element nicht gefunden');
        return;
    }
    
    // Lade Makler-Daten
    if (typeof maklerData !== 'undefined' && maklerData && Object.keys(maklerData).length > 0) {
        const maklerNames = Object.keys(maklerData);
        select.innerHTML = '<option value="">Alle Makler</option>';
        maklerNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
        console.log(`Delete-Select aktualisiert: ${maklerNames.length} Makler`);
    } else {
        // Lade vom Backend
        const apiUrl = window.API_BASE_URL || 'http://localhost:9000';
        fetch(`${apiUrl}/makler`)
            .then(response => response.json())
            .then(data => {
                const makler = data.makler || {};
                const maklerNames = Object.keys(makler);
                select.innerHTML = '<option value="">Alle Makler</option>';
                maklerNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    select.appendChild(option);
                });
                console.log(`Delete-Select aktualisiert (vom Backend): ${maklerNames.length} Makler`);
            })
            .catch(error => {
                console.error('Fehler beim Laden der Makler für Delete-Select:', error);
            });
    }
}

// Mache Funktion global verfügbar
function updateExportMaklerSelect() {
    const exportMaklerSelect = document.getElementById('exportMaklerSelect');
    if (!exportMaklerSelect) return;
    
    // Lade Makler-Daten
    if (typeof maklerData !== 'undefined' && Object.keys(maklerData).length > 0) {
        const maklerNames = Object.keys(maklerData);
        exportMaklerSelect.innerHTML = '<option value="">Alle Makler</option>';
        maklerNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            exportMaklerSelect.appendChild(option);
        });
    } else {
        // Lade vom Backend
        fetch(`${window.API_BASE_URL}/makler`)
            .then(response => response.json())
            .then(data => {
                const makler = data.makler || {};
                const maklerNames = Object.keys(makler);
                exportMaklerSelect.innerHTML = '<option value="">Alle Makler</option>';
                maklerNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    exportMaklerSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Fehler beim Laden der Makler für Export-Select:', error);
            });
    }
}

window.updateDeleteMaklerSelect = updateDeleteMaklerSelect;
window.updateExportMaklerSelect = updateExportMaklerSelect;

if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
        await loadLinks();
        showStatus('Liste wurde aktualisiert.', 'success');
    });
}

// CSV-Export Funktionen
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

if (exportLastBtn) {
    exportLastBtn.addEventListener('click', async () => {
        try {
            const maklerName = exportMaklerSelect?.value || '';
            const year = exportFilterYear?.value ? parseInt(exportFilterYear.value) : null;
            const month = exportFilterMonth?.value ? parseInt(exportFilterMonth.value) : null;
            
            const params = new URLSearchParams();
            if (maklerName) {
                params.append('makler_names', maklerName);
                console.log('Export letzte_suche - Makler ausgewählt:', maklerName);
            }
            if (year && !isNaN(year)) {
                params.append('year', year.toString());
            }
            if (month && !isNaN(month) && month >= 1 && month <= 12) {
                params.append('month', month.toString());
            }
            
            const url = `${window.API_BASE_URL}/export/last${params.toString() ? '?' + params.toString() : ''}`;
            console.log('Export URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Fehler beim Export');
            }
            const csvContent = await response.text();
            
            // Dateiname generieren basierend auf Parametern (Fallback)
            let lastFilename = 'letzte_suche';
            if (year && month) {
                lastFilename += `_${year}_${month.toString().padStart(2, '0')}`;
                if (day !== null && !isNaN(day)) {
                    lastFilename += `_${day.toString().padStart(2, '0')}`;
                }
            }
            if (maklerName) {
                const maklerSafe = maklerName.replace(/ /g, '_').replace(/[/\\:*?"<>|]/g, '_');
                lastFilename += `_${maklerSafe}`;
            }
            lastFilename += '.csv';
            
            // Versuche Dateiname aus Header zu extrahieren
            const lastContentDisposition = response.headers.get('Content-Disposition');
            if (lastContentDisposition) {
                let filenameMatch = lastContentDisposition.match(/filename="([^"]+)"/);
                if (!filenameMatch) {
                    filenameMatch = lastContentDisposition.match(/filename=([^;]+)/);
                }
                if (filenameMatch) {
                    const extractedFilename = filenameMatch[1].trim().replace(/^["']|["']$/g, '');
                    if (extractedFilename) {
                        lastFilename = extractedFilename;
                    }
                }
            }
            
            console.log('Finaler Dateiname für Download:', lastFilename);
            downloadCSV(csvContent, lastFilename);
            const maklerText = maklerName ? ` für Makler "${maklerName}"` : '';
            const dateText = (year && month) ? ` für ${month}/${year}` : '';
            showStatus(`Letzte Suche${maklerText}${dateText} wurde als CSV exportiert.`, 'success');
        } catch (error) {
            showStatus('Fehler beim Export: ' + error.message, 'error');
        }
    });
}

if (exportAllBtn) {
    exportAllBtn.addEventListener('click', async () => {
        try {
            const maklerName = exportMaklerSelect?.value || '';
            const year = exportFilterYear?.value ? parseInt(exportFilterYear.value) : null;
            const month = exportFilterMonth?.value ? parseInt(exportFilterMonth.value) : null;
            
            const params = new URLSearchParams();
            if (maklerName) {
                params.append('makler_names', maklerName);
                console.log('Export alle_links - Makler ausgewählt:', maklerName);
            }
            if (year && !isNaN(year)) {
                params.append('year', year.toString());
            }
            if (month && !isNaN(month) && month >= 1 && month <= 12) {
                params.append('month', month.toString());
            }
            
            const url = `${window.API_BASE_URL}/export/all${params.toString() ? '?' + params.toString() : ''}`;
            console.log('Export URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Fehler beim Export');
            }
            const csvContent = await response.text();
            
            // Dateiname generieren basierend auf Parametern (Fallback)
            let allFilename = 'alle_links';
            if (year && month) {
                allFilename += `_${year}_${month.toString().padStart(2, '0')}`;
                if (day !== null && !isNaN(day)) {
                    allFilename += `_${day.toString().padStart(2, '0')}`;
                }
            }
            if (maklerName) {
                const maklerSafe = maklerName.replace(/ /g, '_').replace(/[/\\:*?"<>|]/g, '_');
                allFilename += `_${maklerSafe}`;
            }
            allFilename += '.csv';
            
            // Versuche Dateiname aus Header zu extrahieren
            const allContentDisposition = response.headers.get('Content-Disposition');
            if (allContentDisposition) {
                let filenameMatch = allContentDisposition.match(/filename="([^"]+)"/);
                if (!filenameMatch) {
                    filenameMatch = allContentDisposition.match(/filename=([^;]+)/);
                }
                if (filenameMatch) {
                    const extractedFilename = filenameMatch[1].trim().replace(/^["']|["']$/g, '');
                    if (extractedFilename) {
                        allFilename = extractedFilename;
                    }
                }
            }
            
            console.log('Finaler Dateiname für Download:', allFilename);
            downloadCSV(csvContent, allFilename);
            const maklerText = maklerName ? ` für Makler "${maklerName}"` : '';
            const dateText = (year && month) ? (day ? ` für ${day}.${month}.${year}` : ` für ${month}/${year}`) : '';
            showStatus(`Alle Links${maklerText}${dateText} wurden als CSV exportiert.`, 'success');
        } catch (error) {
            showStatus('Fehler beim Export: ' + error.message, 'error');
        }
    });
}

// Export nur nach Makler (ohne Datum)
if (exportMaklerBtn) {
    exportMaklerBtn.addEventListener('click', async () => {
        const maklerName = exportMaklerSelect?.value || '';
        
        if (!maklerName) {
            showStatus('Bitte wählen Sie einen Makler aus.', 'error');
            return;
        }
        
        try {
            console.log('Export nach Makler - Makler ausgewählt:', maklerName);
            const params = new URLSearchParams();
            params.append('makler_names', maklerName);
            
            const url = `${window.API_BASE_URL}/export/all?${params.toString()}`;
            console.log('Export URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Fehler beim Export');
            }
            const csvContent = await response.text();
            
            // Dateiname generieren basierend auf Makler
            let maklerOnlyFilename = 'alle_links';
            const maklerSafe = maklerName.replace(/ /g, '_').replace(/[/\\:*?"<>|]/g, '_');
            maklerOnlyFilename += `_${maklerSafe}`;
            maklerOnlyFilename += '.csv';
            
            // Versuche Dateiname aus Header zu extrahieren
            const maklerOnlyContentDisposition = response.headers.get('Content-Disposition');
            if (maklerOnlyContentDisposition) {
                let filenameMatch = maklerOnlyContentDisposition.match(/filename="([^"]+)"/);
                if (!filenameMatch) {
                    filenameMatch = maklerOnlyContentDisposition.match(/filename=([^;]+)/);
                }
                if (filenameMatch) {
                    const extractedFilename = filenameMatch[1].trim().replace(/^["']|["']$/g, '');
                    if (extractedFilename) {
                        maklerOnlyFilename = extractedFilename;
                    }
                }
            }
            
            console.log('Finaler Dateiname für Download:', maklerOnlyFilename);
            downloadCSV(csvContent, maklerOnlyFilename);
            showStatus(`Links für Makler "${maklerName}" wurden als CSV exportiert.`, 'success');
        } catch (error) {
            showStatus('Fehler beim Export: ' + error.message, 'error');
        }
    });
}

if (exportFilteredBtn && exportFilterYear && exportFilterMonth) {
    exportFilteredBtn.addEventListener('click', async () => {
        const year = parseInt(exportFilterYear.value);
        const month = parseInt(exportFilterMonth.value);
        const day = exportFilterDay?.value ? parseInt(exportFilterDay.value) : null;
        
        if (!year || year < 2020 || year > 2030) {
            showStatus('Bitte geben Sie ein gültiges Jahr ein (2020-2030).', 'error');
            return;
        }
        
        if (!month || month < 1 || month > 12) {
            showStatus('Bitte geben Sie einen gültigen Monat ein (1-12).', 'error');
            return;
        }
        
        if (day !== null && (day < 1 || day > 31)) {
            showStatus('Bitte geben Sie einen gültigen Tag ein (1-31).', 'error');
            return;
        }
        
        try {
            const maklerName = exportMaklerSelect?.value || '';
            console.log('Export filtered - Makler ausgewählt:', maklerName);
            const params = new URLSearchParams();
            params.append('year', year.toString());
            params.append('month', month.toString());
            if (day !== null && !isNaN(day)) {
                params.append('day', day.toString());
            }
            if (maklerName) {
                params.append('makler_names', maklerName);
            }
            
            const url = `${window.API_BASE_URL}/export/filtered?${params.toString()}`;
            console.log('Export URL:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Fehler beim Export');
            }
            const csvContent = await response.text();
            
            // Dateiname generieren basierend auf Parametern (Fallback, falls Header nicht verfügbar)
            let filteredFilename = `links_${year}_${month.toString().padStart(2, '0')}`;
            if (day !== null && !isNaN(day)) {
                filteredFilename += `_${day.toString().padStart(2, '0')}`;
            }
            if (maklerName) {
                // Ersetze Leerzeichen und Sonderzeichen im Makler-Namen
                const maklerSafe = maklerName.replace(/ /g, '_').replace(/[/\\:*?"<>|]/g, '_');
                filteredFilename += `_${maklerSafe}`;
            }
            filteredFilename += '.csv';
            
            // Versuche Dateiname aus Content-Disposition Header zu extrahieren (falls verfügbar)
            const filteredContentDisposition = response.headers.get('Content-Disposition');
            console.log('Content-Disposition Header:', filteredContentDisposition);
            if (filteredContentDisposition) {
                // Versuche verschiedene Patterns für den Dateinamen
                let filenameMatch = filteredContentDisposition.match(/filename="([^"]+)"/);
                if (!filenameMatch) {
                    filenameMatch = filteredContentDisposition.match(/filename=([^;]+)/);
                }
                if (filenameMatch) {
                    const extractedFilename = filenameMatch[1].trim().replace(/^["']|["']$/g, '');
                    if (extractedFilename) {
                        filteredFilename = extractedFilename;
                        console.log('Extrahierter Dateiname aus Header:', filteredFilename);
                    }
                }
            } else {
                console.log('Content-Disposition Header nicht verfügbar, verwende generierten Dateinamen:', filteredFilename);
            }
            
            console.log('Finaler Dateiname für Download:', filteredFilename);
            downloadCSV(csvContent, filteredFilename);
            const maklerText = maklerName ? ` für Makler "${maklerName}"` : '';
            const dateText = day ? `${day}.${month}.${year}` : `${month}/${year}`;
            showStatus(`Links für ${dateText}${maklerText} wurden als CSV exportiert.`, 'success');
        } catch (error) {
            showStatus('Fehler beim Export: ' + error.message, 'error');
        }
    });
}

// URL Generator Event-Listener
if (generateURLsBtn && plzListInput) {
    generateURLsBtn.addEventListener('click', async function() {
        const plzList = plzListInput.value.split(/[,\n;]/).map(p => p.trim()).filter(p => p && /^\d{5}$/.test(p));
        const filters = {
            kategorie: document.getElementById('filterKategorie')?.value || 'immobilien',
            anbieter: document.getElementById('filterAnbieter')?.value || 'privat',
            anzeige: document.getElementById('filterAnzeige')?.value || 'angebote',
            preis: document.getElementById('filterPreis')?.value || '150000',
            suchbegriff: document.getElementById('filterSuchbegriff')?.value || 'haus'
        };
        
        if (plzList.length === 0) {
            showStatus('Bitte geben Sie mindestens eine gültige 5-stellige PLZ ein.', 'error');
            return;
        }
        
        // Button deaktivieren während der Generierung
        generateURLsBtn.disabled = true;
        generateURLsBtn.textContent = 'Generiere...';
        showStatus(`Generiere URLs für ${plzList.length} PLZ(s)...`, 'info');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/generate-urls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plz_list: plzList,
                    filters: filters,
                    reference_url: null
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.urls) {
                if (generatedURLsOutput) {
                    generatedURLsOutput.value = data.urls.join('\n');
                }
                if (generatedURLsCount) {
                    generatedURLsCount.textContent = data.count;
                }
                if (generatedURLsContainer) {
                    generatedURLsContainer.style.display = 'block';
                    generatedURLsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                showStatus(`${data.count} URLs wurden mit IDs generiert.`, 'success');
            } else {
                throw new Error('Ungültige Antwort vom Server');
            }
        } catch (error) {
            console.error('Fehler beim Generieren der URLs:', error);
            showStatus(`Fehler beim Generieren der URLs: ${error.message}`, 'error');
        } finally {
            generateURLsBtn.disabled = false;
            generateURLsBtn.textContent = 'URLs generieren';
        }
    });
}

if (copyURLsBtn && generatedURLsOutput) {
    copyURLsBtn.addEventListener('click', function() {
        generatedURLsOutput.select();
        document.execCommand('copy');
        showStatus('URLs wurden in die Zwischenablage kopiert.', 'success');
    });
}

// Filter-Funktionen
let currentFilters = null;

// Rendere Filter-Makler-Auswahl
function renderFilterMaklerSelection() {
    const container = document.getElementById('filterMaklerSelection');
    if (!container) return;
    
    // Lade Makler-Daten (nutze maklerData aus makler.js wenn verfügbar, sonst vom Backend)
    if (typeof maklerData !== 'undefined' && Object.keys(maklerData).length > 0) {
        const maklerNames = Object.keys(maklerData);
        if (maklerNames.length === 0) {
            container.innerHTML = `
                <div class="EmptyState" style="padding: var(--space-16); width: 100%;">
                    <div class="EmptyState-icon">👤</div>
                    <div class="EmptyState-title">Keine Makler verfügbar</div>
                    <div class="EmptyState-text">Legen Sie zuerst Makler an, um nach ihnen zu filtern.</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = maklerNames.map(name => {
            const makler = maklerData[name];
            const linkCount = makler.links ? makler.links.length : 0;
            return `
                <label class="Chip" style="display: flex; align-items: center; gap: var(--space-8); padding: var(--space-8) var(--space-12); background: var(--surface-2); border-radius: var(--r-pill); cursor: pointer;">
                    <input type="checkbox" class="filter-makler-checkbox" value="${name}" style="margin: 0;">
                    <span style="font-weight: 500;">${name}</span>
                    <span style="font-size: 12px; color: var(--text-2);">(${linkCount})</span>
                </label>
            `;
        }).join('');
    } else {
        // Lade Makler vom Backend
        fetch(`${window.API_BASE_URL}/makler`)
            .then(response => response.json())
            .then(data => {
                const makler = data.makler || {};
                const maklerNames = Object.keys(makler);
                if (maklerNames.length === 0) {
                    container.innerHTML = `
                        <div class="EmptyState" style="padding: var(--space-16); width: 100%;">
                            <div class="EmptyState-icon">👤</div>
                            <div class="EmptyState-title">Keine Makler verfügbar</div>
                            <div class="EmptyState-text">Legen Sie zuerst Makler an, um nach ihnen zu filtern.</div>
                        </div>
                    `;
                    return;
                }
                container.innerHTML = maklerNames.map(name => {
                    const mak = makler[name];
                    const linkCount = mak.links ? mak.links.length : 0;
                    return `
                        <label class="Chip" style="display: flex; align-items: center; gap: var(--space-8); padding: var(--space-8) var(--space-12); background: var(--surface-2); border-radius: var(--r-pill); cursor: pointer;">
                            <input type="checkbox" class="filter-makler-checkbox" value="${name}" style="margin: 0;">
                            <span style="font-weight: 500;">${name}</span>
                            <span style="font-size: 12px; color: var(--text-2);">(${linkCount})</span>
                        </label>
                    `;
                }).join('');
            })
            .catch(error => {
                console.error('Fehler beim Laden der Makler für Filter:', error);
            });
    }
}

// Filter anwenden (global verfügbar machen)
function applyFilters() {
    console.log('=== applyFilters aufgerufen ===');
    console.log('applyFilters Funktion:', typeof applyFilters);
    console.log('window.applyFilters:', typeof window.applyFilters);
    try {
        const filters = {};
    
        // Makler-Filter
        const selectedMakler = Array.from(document.querySelectorAll('.filter-makler-checkbox:checked'))
            .map(cb => cb.value);
        console.log('Ausgewählte Makler:', selectedMakler);
        if (selectedMakler.length > 0) {
            filters.makler_names = selectedMakler;
        }
        
        // Datums-Filter
        const yearInput = document.getElementById('filterYear');
        const monthInput = document.getElementById('filterMonth');
        const dayInput = document.getElementById('filterDay');
        
        if (yearInput && yearInput.value) {
            filters.year = parseInt(yearInput.value);
        }
        if (monthInput && monthInput.value) {
            filters.month = parseInt(monthInput.value);
        }
        if (dayInput && dayInput.value) {
            filters.day = parseInt(dayInput.value);
        }
        
        // Letzte Suche Filter
        const lastSearchCheckbox = document.getElementById('filterLastSearch');
        if (lastSearchCheckbox && lastSearchCheckbox.checked) {
            filters.last_search_only = true;
        }
        
        console.log('Filter-Objekt:', filters);
        currentFilters = Object.keys(filters).length > 0 ? filters : null;
        
        // Zeige Status
        if (currentFilters) {
            showStatus('Filter werden angewendet...', 'info');
        } else {
            showStatus('Alle Filter wurden zurückgesetzt.', 'info');
        }
        
        // Lade gefilterte Links
        console.log('Rufe loadLinks auf mit currentFilters:', currentFilters);
        if (typeof loadLinks === 'function') {
            loadLinks(currentFilters).then(() => {
                console.log('loadLinks abgeschlossen');
                if (currentFilters) {
                    const filterDesc = [];
                    if (currentFilters.makler_names) {
                        filterDesc.push(`${currentFilters.makler_names.length} Makler`);
                    }
                    if (currentFilters.year || currentFilters.month || currentFilters.day) {
                        const dateParts = [];
                        if (currentFilters.day) dateParts.push(currentFilters.day);
                        if (currentFilters.month) dateParts.push(currentFilters.month);
                        if (currentFilters.year) dateParts.push(currentFilters.year);
                        filterDesc.push(dateParts.join('.'));
                    }
                    if (currentFilters.last_search_only) {
                        filterDesc.push('letzte Suche');
                    }
                    showStatus(`Filter angewendet: ${filterDesc.join(', ')}`, 'success');
                }
                
                // Zeige/Verstecke Reset-Buttons
                const clearMaklerFilterBtn = document.getElementById('clearMaklerFilterBtn');
                const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');
                
                if (clearMaklerFilterBtn) {
                    clearMaklerFilterBtn.style.display = selectedMakler.length > 0 ? 'inline-block' : 'none';
                }
                if (clearDateFilterBtn) {
                    clearDateFilterBtn.style.display = (yearInput?.value || monthInput?.value || dayInput?.value) ? 'inline-block' : 'none';
                }
            }).catch(error => {
                console.error('Fehler in loadLinks Promise:', error);
                showStatus('Fehler beim Anwenden der Filter: ' + error.message, 'error');
            });
        } else {
            console.error('loadLinks ist keine Funktion!', typeof loadLinks);
            showStatus('Fehler: loadLinks-Funktion nicht gefunden.', 'error');
        }
    } catch (error) {
        console.error('Fehler in applyFilters:', error);
        showStatus('Fehler beim Anwenden der Filter: ' + error.message, 'error');
    }
}

// Mache applyFilters SOFORT global verfügbar
window.applyFilters = applyFilters;
console.log('window.applyFilters gesetzt:', typeof window.applyFilters);
console.log('applyFilters Funktion verfügbar:', typeof applyFilters);

// Alle Filter zurücksetzen
function clearAllFilters() {
    // Makler-Checkboxes zurücksetzen
    document.querySelectorAll('.filter-makler-checkbox').forEach(cb => cb.checked = false);
    
    // Datums-Felder zurücksetzen
    const yearInput = document.getElementById('filterYear');
    const monthInput = document.getElementById('filterMonth');
    const dayInput = document.getElementById('filterDay');
    if (yearInput) yearInput.value = '';
    if (monthInput) monthInput.value = '';
    if (dayInput) dayInput.value = '';
    
    // Letzte Suche Checkbox zurücksetzen
    const lastSearchCheckbox = document.getElementById('filterLastSearch');
    if (lastSearchCheckbox) lastSearchCheckbox.checked = false;
    
    // Reset-Buttons verstecken
    const clearMaklerFilterBtn = document.getElementById('clearMaklerFilterBtn');
    const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');
    if (clearMaklerFilterBtn) clearMaklerFilterBtn.style.display = 'none';
    if (clearDateFilterBtn) clearDateFilterBtn.style.display = 'none';
    
    currentFilters = null;
    loadLinks();
}

// Makler-Filter zurücksetzen
function clearMaklerFilter() {
    document.querySelectorAll('.filter-makler-checkbox').forEach(cb => cb.checked = false);
    const clearMaklerFilterBtn = document.getElementById('clearMaklerFilterBtn');
    if (clearMaklerFilterBtn) clearMaklerFilterBtn.style.display = 'none';
    applyFilters();
}

// Datums-Filter zurücksetzen
function clearDateFilter() {
    const yearInput = document.getElementById('filterYear');
    const monthInput = document.getElementById('filterMonth');
    const dayInput = document.getElementById('filterDay');
    if (yearInput) yearInput.value = '';
    if (monthInput) monthInput.value = '';
    if (dayInput) dayInput.value = '';
    const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');
    if (clearDateFilterBtn) clearDateFilterBtn.style.display = 'none';
    applyFilters();
}

// Event-Listener für Filter registrieren
function initFilterEventListeners() {
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
    const clearMaklerFilterBtn = document.getElementById('clearMaklerFilterBtn');
    const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');
    
    console.log('Initialisiere Filter-Event-Listener:', {
        applyFilterBtn: !!applyFilterBtn,
        clearAllFiltersBtn: !!clearAllFiltersBtn,
        clearMaklerFilterBtn: !!clearMaklerFilterBtn,
        clearDateFilterBtn: !!clearDateFilterBtn,
        applyFiltersAvailable: typeof window.applyFilters === 'function'
    });
    
    // Mache applyFilters global verfügbar
    window.applyFilters = applyFilters;
    
    if (applyFilterBtn) {
        // Entferne alle bestehenden Event-Listener durch Klonen
        const newApplyBtn = applyFilterBtn.cloneNode(true);
        applyFilterBtn.parentNode.replaceChild(newApplyBtn, applyFilterBtn);
        
        // Setze onclick direkt (höchste Priorität)
        newApplyBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('=== Filter-Button geklickt (onclick) ===');
            console.log('window.applyFilters Typ:', typeof window.applyFilters);
            try {
                if (typeof window.applyFilters === 'function') {
                    console.log('Rufe window.applyFilters() auf');
                    window.applyFilters();
                } else if (typeof applyFilters === 'function') {
                    console.log('Rufe applyFilters() direkt auf');
                    applyFilters();
                } else {
                    console.error('applyFilters ist nicht verfügbar!');
                    showStatus('Fehler: Filter-Funktion nicht verfügbar', 'error');
                }
            } catch (error) {
                console.error('Fehler beim Aufruf von applyFilters:', error);
                showStatus('Fehler beim Anwenden der Filter: ' + error.message, 'error');
            }
            return false;
        };
        
        // Zusätzlicher Event-Listener als Backup (nur falls onclick nicht funktioniert)
        newApplyBtn.addEventListener('click', function(e) {
            // Verhindere doppelte Ausführung wenn onclick bereits funktioniert hat
            if (e.defaultPrevented) return;
            e.preventDefault();
            e.stopPropagation();
            console.log('Filter-Button geklickt (addEventListener Backup)');
            try {
                if (typeof window.applyFilters === 'function') {
                    window.applyFilters();
                } else if (typeof applyFilters === 'function') {
                    applyFilters();
                }
            } catch (error) {
                console.error('Fehler in addEventListener:', error);
            }
            return false;
        }, { once: false });
        
        console.log('Filter-Button Event-Listener registriert');
        console.log('Button ID:', newApplyBtn.id);
        console.log('Button vorhanden:', !!document.getElementById('applyFilterBtn'));
    } else {
        console.warn('applyFilterBtn nicht gefunden beim Initialisieren!');
    }
    
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearAllFilters();
        });
    }
    
    if (clearMaklerFilterBtn) {
        clearMaklerFilterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearMaklerFilter();
        });
    }
    
    if (clearDateFilterBtn) {
        clearDateFilterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearDateFilter();
        });
    }
}

// Event-Listener für Filter registrieren - warte bis DOM vollständig geladen ist
function initFilters() {
    console.log('initFilters aufgerufen');
    // Warte kurz, damit alle Scripts geladen sind
    setTimeout(function() {
        console.log('Initialisiere Filter nach Timeout');
        initFilterEventListeners();
        // Rendere Filter-Makler-Auswahl beim Laden
        renderFilterMaklerSelection();
    }, 100);
}

// Event-Listener für Filter beim DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilters);
} else {
    // DOM bereits geladen
    initFilters();
}

// Mache applyFilters global verfügbar (auch hier als Fallback)
if (typeof window.applyFilters === 'undefined') {
    window.applyFilters = applyFilters;
}

// Beim Laden der Seite: Links laden (ohne Filter) - nur wenn Results-View aktiv ist
document.addEventListener('DOMContentLoaded', function() {
    // Initial load nur wenn Results-View aktiv ist
    const resultsView = document.getElementById('view-results');
    if (resultsView && resultsView.classList.contains('View-active')) {
        loadLinks();
    }
    
    // Aktualisiere Delete-Makler-Select
    if (typeof window.updateDeleteMaklerSelect === 'function') {
        window.updateDeleteMaklerSelect();
    } else if (typeof updateDeleteMaklerSelect === 'function') {
        updateDeleteMaklerSelect();
    }
    
    // Auch nach kurzer Verzögerung, falls Makler noch nicht geladen sind
    setTimeout(() => {
        if (typeof window.updateDeleteMaklerSelect === 'function') {
            window.updateDeleteMaklerSelect();
        }
    }, 1000);
});

