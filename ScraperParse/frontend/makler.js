// Makler-Verwaltung JavaScript
// API_BASE_URL wird aus window verwendet (wird in script.js gesetzt)
// KEINE lokale Deklaration, um Konflikte zu vermeiden

let maklerData = {};

// Hilfsfunktion um API_BASE_URL zu erhalten
function getAPIBaseURL() {
    return window.API_BASE_URL || 'http://localhost:9000';
}

// Lade Makler vom Backend
async function loadMakler() {
    try {
        const response = await fetch(`${getAPIBaseURL()}/makler`);
        const data = await response.json();
        maklerData = data.makler || {};
        renderMaklerList();
        updateStatusAnchors();
        renderMaklerSelection();
        // Aktualisiere auch Delete-Select und Export-Select
        if (typeof window.updateDeleteMaklerSelect === 'function') {
            window.updateDeleteMaklerSelect();
        } else if (typeof updateDeleteMaklerSelect === 'function') {
            updateDeleteMaklerSelect();
        }
        if (typeof window.updateExportMaklerSelect === 'function') {
            window.updateExportMaklerSelect();
        } else if (typeof updateExportMaklerSelect === 'function') {
            updateExportMaklerSelect();
        }
    } catch (error) {
        console.error('Fehler beim Laden der Makler:', error);
        if (typeof showStatus === 'function') {
            showStatus('Fehler beim Laden der Makler: ' + error.message, 'error');
        }
    }
}

// Rendere Makler-Liste
function renderMaklerList() {
    const container = document.getElementById('maklerList');
    if (!container) return;
    
    const maklerNames = Object.keys(maklerData);
    
    if (maklerNames.length === 0) {
        container.innerHTML = `
            <div class="EmptyState">
                <div class="EmptyState-icon">👤</div>
                <div class="EmptyState-title">Noch keine Makler angelegt</div>
                <div class="EmptyState-text">Legen Sie einen neuen Makler an, um zu beginnen.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = maklerNames.map(name => {
        const makler = maklerData[name];
        const linkCount = makler.links ? makler.links.length : 0;
        return `
            <div class="List-row" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-12); border-radius: var(--r-md); margin-bottom: var(--space-8); background: var(--surface-2);">
                <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 15px; margin-bottom: var(--space-4);">${name}</div>
                    <div style="font-size: 13px; color: var(--text-2);">${linkCount} Link${linkCount !== 1 ? 's' : ''}</div>
                </div>
                <div style="display: flex; gap: var(--space-8);">
                    <button onclick="openMaklerDetails('${name}')" class="Button Button-secondary" style="padding: 6px 12px;">Bearbeiten</button>
                    <button onclick="deleteMakler('${name}')" class="Button Button-secondary" style="padding: 6px 12px; color: var(--danger);">Löschen</button>
                </div>
            </div>
        `;
    }).join('');
}

// Rendere Makler-Auswahl für Suche
function renderMaklerSelection() {
    const container = document.getElementById('maklerSelection');
    if (!container) return;
    
    const maklerNames = Object.keys(maklerData);
    
    if (maklerNames.length === 0) {
        container.innerHTML = `
            <div class="EmptyState" style="padding: var(--space-16);">
                <div class="EmptyState-icon">📋</div>
                <div class="EmptyState-title">Keine Makler verfügbar</div>
                <div class="EmptyState-text">Legen Sie zuerst Makler an und fügen Sie Links hinzu.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = maklerNames.map(name => {
        const makler = maklerData[name];
        const linkCount = makler.links ? makler.links.length : 0;
        return `
            <label class="Chip" style="display: flex; align-items: center; gap: var(--space-8); padding: var(--space-8) var(--space-12); background: var(--surface-2); border-radius: var(--r-pill); cursor: pointer;">
                <input type="checkbox" class="makler-checkbox" value="${name}" style="margin: 0;">
                <span style="font-weight: 500;">${name}</span>
                <span style="font-size: 12px; color: var(--text-2);">(${linkCount})</span>
            </label>
        `;
    }).join('');
}

let currentEditingMakler = null;

// Füge Makler hinzu
async function addMakler(name) {
    if (!name || name.trim() === '') {
        if (typeof showStatus === 'function') {
            showStatus('Bitte geben Sie einen Makler-Namen ein.', 'error');
        }
        return false;
    }

    try {
        const response = await fetch(`${getAPIBaseURL()}/makler?name=${encodeURIComponent(name.trim())}`, {
            method: 'POST'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Fehler beim Hinzufügen des Maklers');
        }

        await loadMakler();
        if (typeof showStatus === 'function') {
            showStatus(`Makler '${name}' wurde hinzugefügt.`, 'success');
        }
        return true;
    } catch (error) {
        console.error('Fehler beim Hinzufügen des Maklers:', error);
        if (typeof showStatus === 'function') {
            showStatus('Fehler: ' + error.message, 'error');
        }
        return false;
    }
}

// Lösche Makler
async function deleteMakler(name) {
    if (!confirm(`Möchten Sie den Makler '${name}' wirklich löschen?`)) {
        return;
    }

    try {
        const response = await fetch(`${getAPIBaseURL()}/makler/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Fehler beim Löschen des Maklers');
        }

        await loadMakler();
        if (typeof showStatus === 'function') {
            showStatus(`Makler '${name}' wurde gelöscht.`, 'success');
        }
    } catch (error) {
        console.error('Fehler beim Löschen des Maklers:', error);
        if (typeof showStatus === 'function') {
            showStatus('Fehler: ' + error.message, 'error');
        }
    }
}

function openMaklerDetails(name) {
    currentEditingMakler = name;
    const makler = maklerData[name];
    
    // Erstelle Modal (einfaches Popup)
    const modal = document.createElement('div');
    modal.id = 'maklerModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-24);';
    
    modal.innerHTML = `
        <div style="background: var(--surface); border-radius: var(--r-lg); padding: var(--space-24); max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: 0 12px 32px var(--shadow);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-24);">
                <h2 class="h3" style="margin: 0;">Links für: ${name}</h2>
                <button onclick="closeMaklerDetails()" class="Button Button-tertiary" style="padding: 6px 12px;">✕</button>
            </div>
            
            <div class="Form-group">
                <label class="Form-label">Link hinzufügen (URL)</label>
                <div style="display: flex; gap: var(--space-8);">
                    <input type="text" id="newLinkInput" class="Form-input" placeholder="https://www.kleinanzeigen.de/s-..." style="flex: 1;">
                    <button onclick="addLinkToMakler('${name}')" class="Button Button-primary">Hinzufügen</button>
                </div>
            </div>
            
            <div class="Card-group" style="margin-top: var(--space-24);">
                <div class="Card-group-title">Bulk-Import</div>
                <div class="Card-group-content">
                    <div class="Form-group">
                        <label class="Form-label">Mehrere Links hinzufügen (eine URL pro Zeile)</label>
                        <textarea id="bulkLinksInput" class="Form-input Form-textarea" placeholder="https://www.kleinanzeigen.de/s-...&#10;https://www.kleinanzeigen.de/s-...&#10;https://www.kleinanzeigen.de/s-..." rows="6" style="font-family: monospace; font-size: 13px;"></textarea>
                        <div class="Form-helper">Geben Sie mehrere URLs ein, eine pro Zeile. Leere Zeilen werden ignoriert.</div>
                    </div>
                    <button onclick="addBulkLinksToMakler('${name}')" class="Button Button-primary">Alle Links hinzufügen</button>
                </div>
            </div>
            
            <div style="margin-top: var(--space-24);">
                <div class="Card-group-title">Links (${makler.links ? makler.links.length : 0})</div>
                <div id="maklerLinksList" class="List" style="margin-top: var(--space-12);">
                    ${renderMaklerLinks(name)}
                </div>
            </div>
            
            <div style="margin-top: var(--space-24); display: flex; justify-content: flex-end;">
                <button onclick="closeMaklerDetails()" class="Button Button-secondary">Schließen</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('newLinkInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addLinkToMakler(name);
        }
    });
}

function renderMaklerLinks(name) {
    const makler = maklerData[name];
    if (!makler || !makler.links || makler.links.length === 0) {
        return `
            <div class="EmptyState" style="padding: var(--space-24);">
                <div class="EmptyState-icon">🔗</div>
                <div class="EmptyState-title">Keine Links vorhanden</div>
                <div class="EmptyState-text">Fügen Sie Links hinzu, um zu beginnen.</div>
            </div>
        `;
    }
    
    return makler.links.map(link => `
        <div class="List-row" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-12); border-radius: var(--r-md); margin-bottom: var(--space-8); background: var(--surface-2);">
            <a href="${link}" target="_blank" style="flex: 1; color: var(--accent); text-decoration: none; font-size: 13px; word-break: break-all; margin-right: var(--space-12);">${link}</a>
            <button onclick="removeLinkFromMakler('${name}', '${link.replace(/'/g, "\\'")}')" class="Button Button-secondary" style="padding: 6px 12px; color: var(--danger);">Löschen</button>
        </div>
    `).join('');
}

function closeMaklerDetails() {
    const modal = document.getElementById('maklerModal');
    if (modal) {
        modal.remove();
    }
    currentEditingMakler = null;
}

// Füge Link zu Makler hinzu
async function addLinkToMakler(name) {
    const input = document.getElementById('newLinkInput');
    const link = input.value.trim();
    
    if (!link || !link.startsWith('http')) {
        if (typeof showStatus === 'function') {
            showStatus('Bitte geben Sie eine gültige URL ein (beginnt mit http:// oder https://).', 'error');
        }
        return;
    }

    try {
        const response = await fetch(`${getAPIBaseURL()}/makler/${encodeURIComponent(name)}/links`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ link: link })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Fehler beim Hinzufügen des Links');
        }

        await loadMakler();
        const maklerLinksList = document.getElementById('maklerLinksList');
        if (maklerLinksList) {
            maklerLinksList.innerHTML = renderMaklerLinks(name);
        }
        input.value = '';
        if (typeof showStatus === 'function') {
            showStatus('Link wurde hinzugefügt.', 'success');
        }
    } catch (error) {
        console.error('Fehler beim Hinzufügen des Links:', error);
        if (typeof showStatus === 'function') {
            showStatus('Fehler: ' + error.message, 'error');
        }
    }
}

// Füge mehrere Links auf einmal hinzu (Bulk-Import)
async function addBulkLinksToMakler(name) {
    const textarea = document.getElementById('bulkLinksInput');
    const linksText = textarea.value.trim();
    
    if (!linksText) {
        if (typeof showStatus === 'function') {
            showStatus('Bitte geben Sie mindestens eine URL ein.', 'error');
        }
        return;
    }
    
    // Teile in Zeilen auf und filtere leere Zeilen
    const links = linksText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
    
    if (links.length === 0) {
        if (typeof showStatus === 'function') {
            showStatus('Keine gültigen URLs gefunden. URLs müssen mit http:// oder https:// beginnen.', 'error');
        }
        return;
    }
    
    // Zeige Status
    if (typeof showStatus === 'function') {
        showStatus(`${links.length} Links werden hinzugefügt...`, 'info');
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Füge Links nacheinander hinzu (um Rate-Limiting zu vermeiden)
    for (const link of links) {
        try {
            const response = await fetch(`${getAPIBaseURL()}/makler/${encodeURIComponent(name)}/links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ link: link })
            });
            
            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error('Fehler beim Hinzufügen des Links:', link, error);
            errorCount++;
        }
    }
    
    // Lade Makler neu
    await loadMakler();
    const maklerLinksList = document.getElementById('maklerLinksList');
    if (maklerLinksList) {
        maklerLinksList.innerHTML = renderMaklerLinks(name);
    }
    
    // Leere Textarea
    textarea.value = '';
    
    // Zeige Ergebnis
    if (typeof showStatus === 'function') {
        if (errorCount === 0) {
            showStatus(`${successCount} Links erfolgreich hinzugefügt.`, 'success');
        } else {
            showStatus(`${successCount} Links hinzugefügt, ${errorCount} Fehler.`, 'error');
        }
    }
}

// Entferne Link von Makler
async function removeLinkFromMakler(name, link) {
    try {
        const response = await fetch(`${getAPIBaseURL()}/makler/${encodeURIComponent(name)}/links?link=${encodeURIComponent(link)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Fehler beim Entfernen des Links');
        }

        await loadMakler();
        const maklerLinksList = document.getElementById('maklerLinksList');
        if (maklerLinksList) {
            maklerLinksList.innerHTML = renderMaklerLinks(name);
        }
        if (typeof showStatus === 'function') {
            showStatus('Link wurde entfernt.', 'success');
        }
    } catch (error) {
        console.error('Fehler beim Entfernen des Links:', error);
        if (typeof showStatus === 'function') {
            showStatus('Fehler: ' + error.message, 'error');
        }
    }
}

// startSearchMakler wird in script.js definiert und verwendet

// Event Listeners
function initMakler() {
    const addMaklerBtn = document.getElementById('addMaklerBtn');
    const newMaklerNameInput = document.getElementById('newMaklerName');
    const searchMaklerBtn = document.getElementById('searchMaklerBtn');
    
    if (addMaklerBtn) {
        addMaklerBtn.addEventListener('click', function() {
            const name = newMaklerNameInput ? newMaklerNameInput.value.trim() : '';
            if (name) {
                addMakler(name).then(success => {
                    if (success && newMaklerNameInput) {
                        newMaklerNameInput.value = '';
                    }
                });
            }
        });
    }
    
    if (newMaklerNameInput) {
        newMaklerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const name = e.target.value.trim();
                if (name) {
                    addMakler(name).then(success => {
                        if (success) {
                            e.target.value = '';
                        }
                    });
                }
            }
        });
    }
    
    // searchMaklerBtn Event-Listener wird in script.js verwaltet
    // (wird dort gesetzt, damit die richtige startSearchMakler Funktion verwendet wird)
}

// Update Status Anchors
function updateStatusAnchors() {
    const statusMaklerCount = document.getElementById('statusMaklerCount');
    const activeMaklerCount = document.getElementById('activeMaklerCount');
    
    if (typeof maklerData !== 'undefined') {
        const maklerCount = Object.keys(maklerData).length;
        if (statusMaklerCount) statusMaklerCount.textContent = maklerCount;
        if (activeMaklerCount) activeMaklerCount.textContent = maklerCount;
    } else {
        // Lade vom Backend
        fetch(`${getAPIBaseURL()}/makler`)
            .then(response => response.json())
            .then(data => {
                const maklerCount = Object.keys(data.makler || {}).length;
                if (statusMaklerCount) statusMaklerCount.textContent = maklerCount;
                if (activeMaklerCount) activeMaklerCount.textContent = maklerCount;
            })
            .catch(error => console.error('Fehler beim Laden der Makler für Status:', error));
    }
}

// Update Makler Context Info
function updateMaklerContext() {
    const activeMaklerCount = document.getElementById('activeMaklerCount');
    const totalMaklerLinks = document.getElementById('totalMaklerLinks');
    
    if (typeof maklerData !== 'undefined') {
        const maklerNames = Object.keys(maklerData);
        const totalLinks = maklerNames.reduce((sum, name) => {
            const makler = maklerData[name];
            return sum + (makler.links ? makler.links.length : 0);
        }, 0);
        
        if (activeMaklerCount) activeMaklerCount.textContent = maklerNames.length;
        if (totalMaklerLinks) totalMaklerLinks.textContent = totalLinks;
    }
}

// Initialisiere Makler-Verwaltung beim Laden
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initMakler();
        loadMakler();
    });
} else {
    initMakler();
    loadMakler();
}