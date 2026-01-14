# Design-Mapping: Alte zu Neue Komponenten

## HTML-Struktur
- `.container` → Entfernt (body nutzt jetzt direkt Container)
- `header` → `.Toolbar`
- `main` → `.Container` mit padding
- `.search-section` → `.Section` mit `.Card`
- `.stats-section` → `.Section` mit `.Card`
- `.export-section` → `.Section` mit `.Card`
- `.links-section` → `.Section` mit `.Card`

## Komponenten-Mapping

### Buttons
- `.btn.btn-primary` → `.Button.Button-primary`
- `.btn.btn-secondary` → `.Button.Button-secondary`
- `.btn.btn-tertiary` → `.Button.Button-tertiary` (neu)
- `.btn-danger` → `.Button.Button-danger` (wenn nötig)

### Forms
- `textarea`, `input` → `.Form-input`
- `label` → `.Form-label`
- `.filter-input` → `.Form-input` mit inline width
- `.Form-group` → Container für Label + Input

### Cards/Sections
- `.search-section`, `.stats-section`, etc. → `.Section` mit `.Card`
- `.Card-group` → Für gruppierte Inhalte innerhalb Cards
- `.Card-group-title` → Für Section-Titel in Cards

### Stats
- `.stats` → `.Stats` (Grid-Layout)
- `.stat-item` → `.Stat`
- `.stat-label` → `.Stat-label`
- `.stat-value` → `.Stat-value`

### Links/List
- `.links-container` → `.List`
- `.link-item` → `.Row`
- Empty state → `.EmptyState` mit Icon, Title, Text

### Status Messages
- `.status.success` → Inline styles mit `var(--success)`
- `.status.error` → Inline styles mit `var(--danger)`
- `.status.info` → Inline styles mit `var(--text)`

### Export Section
- `.export-options` → Flex-Container mit gap
- `.export-filter` → `.Card-group`
- `.filter-inputs` → Flex-Container mit align-items

## CSS-Dateien
- `styles.css` → Ersetzt durch:
  - `styles/tokens.css` (Design-Tokens)
  - `styles/base.css` (Typography, Body, Focus, etc.)
  - `styles/components.css` (Alle Komponenten)

## Wichtige Änderungen
1. **Keine Borders**: Stattdessen Spacing und surface-2 für Trennung
2. **Transparenz/Blur**: Toolbar nutzt backdrop-filter
3. **Tinted States**: Hover/Selected nutzen color-mix mit niedriger Opacity
4. **Pill Buttons**: Alle Buttons haben border-radius: var(--r-pill)
5. **System Fonts**: Nutzt SF Pro Display/Text Stack
6. **Dark Mode**: Automatisch via prefers-color-scheme
7. **Spacing**: Nur 8/12/16/24/32px Schritte
8. **No Hard Shadows**: Nur bei Modals/Popovers


