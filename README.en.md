## Glimpse

An Obsidian plugin that dynamically highlights text based on cursor selection or search query.

Currently only supports Source mode and Live Preview mode. Reading mode and legacy editor are not supported.

### Selection Highlighting

When text is selected, highlights all occurrences of the selected text:
- Case-insensitive matching
- Current selection marked as `.cm-selection`
- Other matching strings in the document marked as `.cm-matched-string`
- All matches include `data-contents` attribute with the selected string value

### Persistent Highlighting

Define search queries with associated CSS class names and colors to create persistent highlights. Matched strings are automatically tagged with the corresponding CSS class and background color. Each highlighter's style and color is cached in the index; match toggles can be enabled/disabled at any time without re-creating the highlighter.

Supports regex queries (enable the toggle for regex mode). In regex mode, **named capture groups** (e.g., `(?<groupName>…)`) or **unnamed capture groups** (e.g., `(…)`) can be used to highlight sub-matches with precision.

#### Mark Types

Each highlighter can combine multiple mark modes:

- **Match**: Highlight the full matched text (enabled by default)
- **Line**: Apply the CSS class to the entire line containing the match, enabling whole-line styling instead of word-level
- **Start / End**: Insert zero-width widget elements at match boundaries — use with CSS for prefix/suffix icons
- **Group**: In regex mode, highlight capture group sub-matches instead of the full match. Sub-matches use the highlighter's own color. Supports both named `(?<name>…)` and unnamed `(…)` capture groups. When "Group" is toggled on, full-match decoration is automatically skipped.

#### Custom CSS

Each highlighter can include its own CSS rules, automatically injected into the page via a `<style>` element. Renders through the editor's CodeMirror instance, supporting dark/light theme adaptation. CSS changes take effect immediately on save.

#### Group Management

Organize highlighters with groups: create, rename, delete groups; drag highlighters onto group tabs to categorize. The "Enable All / Disable All" toolbar button controls match toggles for the current group at once.

#### Import & Export

Supports one-click import from clipboard (JSON), batch export of all highlighters with group metadata, and per-highlighter single export. Backward compatible with legacy data format (no groups → defaults to "默认").

#### Examples

Click the `Import` button at the top right of the plugin settings to import the following examples.

##### Visual Linting
Highlights double spaces, empty list markers, duplicate list markers, leading whitespace, and trailing whitespace.

```json
{
  "Mini-Linting": {
    "class": "Mini-Linting",
    "color": "#A70F0F38",
    "regex": true,
    "query": " {2,}(?!\\|| |$)|- - |^\\s*- \\n|^ +(?![0-9-`])",
    "mark": ["match"],
    "css": ".cm-line .Mini-Linting {\n  background: none;\n}\n\n.cm-line:not(.cm-active) .Mini-Linting {\n  outline: 1px solid var(--text-error);\n}"
  }
}
```

##### Filler Words in Writing
```json
{
  "Filler-Words": {
    "class": "Filler-Words",
    "color": "#2D801838",
    "regex": true,
    "query": "\\b([Aa] bit|[Aa]bsolutely|[Aa]ctually|[Aa]nd all that|[Aa]nd so forth|[Aa]nyway|[Bb]asically|[Cc]ertainly|[Cc]learly|[Cc]ompletely|[Dd]efinitely|[Ee]ffectively|[Ee]ntirely|[Ee]ssentially|[Ee]vidently|[Ee]xtremely|[Ff]airly|[Ff]rankly|[Ff]requently|[Gg]enerally|[Hh]opefully|[Kk]ind of|[Ll]argely|[Ll]iterally|[Mm]ore or less|[Mm]ostly|[Oo]ccasionally|[Oo]ften|[Oo]verall|[Pp]articularly|[Pp]erhaps|[Pp]ossibly|[Pp]ractically|[Pp]recisely|[Pp]resumably|[Pp]retty|[Pp]rimarily|[Pp]robably|[Pp]urely|[Qq]uite|[Rr]arely|[Rr]ather|[Rr]eally|[Rr]elatively|[Ss]eriously|[Ss]ignificantly|[Ss]imply|[Ss]lightly|[Ss]omehow|[Ss]ort of|[Ss]pecifically|[Ss]trongly|[Ss]upposedly|[Ss]urely|[Tt]he fact that|[Tt]otally|[Tt]ruly|[Tt]ypically|[Uu]ltimately|[Uu]sually|[Vv]ery|[Vv]irtually|[Ww]idely)\\b",
    "mark": ["match"],
    "css": ".cm-line .Filler-Words{\n\ttext-decoration: line-through;\n\tbackground: none;\n\tcolor: var(--text-muted);\n}\n\n/* where to disable */\n.HyperMD-quote.cm-line .Filler-Words,\n.pdf-annotations .cm-line .Filler-Words {\n\ttext-decoration: none;\n\tcolor: unset;\n}"
  }
}
```

##### Pandoc Fenced Divs Highlighting (`:::`)
```json
{
  "Pandoc-Syntax": {
    "class": "Pandoc-Syntax",
    "color": "#77787C4A",
    "regex": true,
    "query": "::: \\{.*?\\}[\\s\\S]*?:::",
    "mark": ["match", "group"],
    "css": ""
  }
}
```

### Highlight Index

Automatically scans the active document for `==...==` wrapped Obsidian standard highlights and organizes them in a sidebar view grouped by heading hierarchy.

- **Heading grouping**: Highlights grouped under their nearest preceding heading; orphans (before any heading) shown first under the document title
- **Level icons & colors**: h1-h6 headings display matching lucide heading icons via `setIcon`, colored by `--h1-color` through `--h6-color` CSS variables
- **Ancestor breadcrumbs**: Shared ancestor headings rendered as standalone rows before the first entry in each subtree, using the same icon and color styling as direct headings
- **Frosted glass cards**: Highlights displayed as rounded frosted glass cards with hover-enhanced blur effect (0.08s fast transition)
- **One-click copy**: Copy button (lucide clipboard-paste) on each card, copies text and shows a Notice toast
- **Auto-refresh**: Re-scans on document switch; keeps previous results when the new active document has no highlights
- **Command palette**: Registers "打开高亮索引" command to summon the index view
- **Settings toggle**: Auto-open on plugin load option available in settings

### Settings

#### Delay

Delay in milliseconds before selection highlighting kicks in after cursor movement.

#### Ignored Words

Comma-separated list of words to exclude from highlighting.

Default word list: https://gist.github.com/sebleier/554280

### Limitations

- Reading/Live Preview mode does not support dynamic selection highlighting

### Acknowledgments

Thanks to @chrisgrieser (aka @pseudometa) for the plugin concept and feedback.
Thanks to @chetachiezikeuzor for the settings UI code, inspired by https://github.com/chetachiezikeuzor/highlightr-Plugin/

---

### Changelog

#### 0.8.3 (2026-07-24)

- **Fixed capture groups not applying for multiline regexes**: `cursor instanceof RegExpCursor` guard in `getDeco()` fails when `RegExpCursor` constructor returns a `MultilineRegExpCursor` (for patterns containing `\s`/`\n` etc.), which is a standalone class that does not extend `RegExpCursor`. Removed type guard; now uses `match?.indices?.groups` duck-type check.
- **Added unnamed capture group support**: Group decorations now use the highlighter's own `query.class` instead of the group name. Unnamed groups `(…)` are supported via `match.indices[1..N]` — no need to write `(?<name>…)`.
- **Fixed group/line/start/end decorations bypassing the on/off toggle**: These four mark types each independently checked `mark.includes("x")`, but the toggle only adds/removes `"match"`. Introduced an `enabled` flag that controls all decorations uniformly.
- **Fixed match + group coexistence**: When "Group" is toggled on, full-match decoration is automatically skipped — the two modes are now mutually exclusive.

#### 0.8.2 (2026-07-24)

- **Fixed custom styles not applying after save**: `updateStaticHighlighter` refactor removed `Compartment` + `iterateCM6` dispatch, causing Facet values to go stale in already-open editors — ViewPlugin never re-decorated. Restored full compartment architecture + dispatch loop.
- **Fixed toggle not taking effect until restart**: `reconfigureStaticHighlighter` only passed Facet config into `compartment.reconfigure()`, dropping the `staticHighlighter` ViewPlugin. After toggle ON, facet updates but ViewPlugin is missing → no decorations. Now reconfigure includes both ViewPlugin and Facet.
- **Improved custom styles documentation**: Added detailed sections on mark types, custom CSS injection, group management, import/export, and examples.

#### 0.8.1 (2026-07-24)

- **Fixed capture groups not working**: `regexp-cursor.ts` regex flags missing `d` flag. Switched from `regexp-match-indices` polyfill to native `this.re.exec()`
- **Fixed group offset crash**: `linePos + groupFrom` → `(from - match.index) + groupFrom`. Works for both single-line and multiline cursors.
- **Fixed build hanging**: removed `watch` option from esbuild `build()`, upgraded esbuild to `0.25.12`

#### 0.8.0 (2026-07-23)

- **Highlight index code extraction**: `HighlightIndexView` moved from monolithic `main.ts` into standalone `src/highlight-index-view.ts`, reducing main file bloat
- **Heading hierarchy grouping**: Highlights grouped under their nearest preceding heading in document order
- **Ancestor breadcrumb trail**: Each heading's parent chain displayed; shared common ancestors rendered as standalone rows before the first entry in each subtree
- **Heading level icons & colors**: h1-h6 rendering uses `setIcon(heading-1~6)` with lucide icons, colored via `--h1-color` through `--h6-color` CSS variables; ancestor headings reuse identical styling
- **Document title**: Current document name displayed centered at the top of the index
- **Orphan match placement**: Highlights before any heading shown first under the document name as group header
- **Tab switch fix**: Clicking an index entry no longer reverts to the previous document's index due to focus race condition
- **README update**: Added "Highlight Index" feature documentation

#### 0.7.2 (2026-07-19)

- **Highlight Index**: New sidebar view that scans `==...==` wrapped Obsidian standard highlights in the active document
- **Frosted glass cards**: Highlights displayed as rounded frosted glass cards with hover-enhanced blur effect (0.08s fast transition)
- **One-click copy**: Copy button (lucide clipboard-paste) on each card's top-right corner, copies text and shows a Notice toast
- **Auto-refresh**: Re-scans on document switch; keeps previous results when the new active document has no highlights
- **Blur-focus preservation**: Continues showing the last document's highlights when focus leaves the Markdown editor
- **Command palette**: Registers "打开高亮索引" command to summon the index view
- **Selectable text**: Card text uses body font at 0.8× body size, user-selectable
- **Settings toggle**: "默认打开高亮索引" setting — auto-opens the highlight index on plugin load
- **Single instance**: Guarantees only one highlight index leaf exists; properly cleans up on reload via `onunload()`
- **Settings UI refactor**: Three-tab layout (persistent / selection / highlight index), code split into standalone modules

#### 0.7.1 (2026-07-19)

- **Minimap rewrite**: Fixed 120px width, font size & line-wrapping adapt to editor's chars-per-line, per-character pixel-width wrapping with CJK/Latin mixed text support
- **HiDPI support**: `ctx.scale(dpr, dpr)` normalizes coordinate system to CSS pixels — font size, wrapping, and line height unaffected by device pixel ratio
- **Scroll offset rendering**: Minimap content follows editor scroll position, last document line visible when scrolled to bottom; drag indicator also mapped by visual content height
- **Instant re-render**: Scroll events trigger full repaint with offset, eliminating scroll lag
- **Performance**: Per-character `measureText` replaced with width lookup table (half/full-width measured once, integer accumulation) — drastically reduces lag on large documents
- **Default off**: Minimap now defaults to `false` in settings, must be manually enabled
- **Line height fix**: Text rows `fontSize × 1.3`, blank rows `fontSize × 0.65`, preventing overlap
- Translation: all comments in `src/highlighters/minimap.ts` changed to Chinese

#### 0.7.0 (2026-07-18)

- **Scrollbar markers**: Rectangular match position indicators on scrollbar when text is selected, using theme accent color `--interactive-accent`, canvas-based rendering
- **Minimap**: Document minimap on the right side of the editor (similar to VS Code minimap), supports drag-to-scroll, click-to-jump, wheel sync, independently toggleable
- **Full-document search**: Selection matching no longer limited to visible viewport, uses `SearchCursor` to scan entire document
- **Match line collection decoupled from decoration limit**: All match line numbers collected before decoration cap, scrollbar markers cover entire document regardless of `maxMatches`
- **Reverse selection fix**: Normalize `from`/`to` boundaries for leftward drags (anchor > head), preventing `sliceDoc` from returning empty
- **Debounce fix**: Fixed delay stuck at 0ms — `highlightDelay` Facet combine strategy changed from `Math.min` to `Math.max`
- **Stale setTimeout guard**: `clearVersion` counter prevents old `setTimeout` callbacks from wiping fresh decorations
- **Settings persistence**: `minSelectionLength` and `maxMatches` forcibly aligned with `DEFAULT_SETTINGS`, stale data.json values auto-written back on load
- **Chinese + English comments**: Added comprehensive comments in `selection.ts` and `scrollbar-markers.ts`

- **Plugin rename**: Consolidated `GazerPlugin` → `GlimpsePlugin` across all files, CSS classes (`modal-gazer` → `modal-glimpse`), and export filenames (`gazer.json` → `glimpse.json`)
- **Fixed new highlighters not activating after save**: `static.ts` used non-standard `Array.prototype.contains()` (returned `undefined`) causing saved highlighters with explicit `mark: ["match"]` to silently fail — replaced all 7 occurrences with `.includes()`
- **Settings UI inline style → CSS refactoring**: Removed all `setAttribute("style")` calls per Obsidian plugin review guidelines; using CSS custom properties (`--picker-bg`) and classes (`.glimpse-modal-input`, `.highlighter-name`); added corresponding rules in `styles.css`
- **Import from clipboard**: New button before Save (clipboard-copy icon) — pastes JSON from clipboard and populates the entire form (name, color, query, regex, mark toggles, custom CSS editor with automatic dark/light theme)
- **Per-highlighter export**: New button between Edit and Delete (clipboard-paste icon) — exports a single highlighter as JSON via ExportModal
- **New "match" toggle in creation form**: Defaults to ON, giving clear visual feedback that the highlighter will be active after saving; line/start/end/group toggles remain OFF by default
- **Toolbar button rename**: "导入" → "一键导入" (One-click Import), "导出" → "一键导出" (One-click Export)
- **Code cleanup**: `regexp-cursor.ts` whitespace and formatting normalization

#### 0.5.0 (2026-07-18)

- TypeScript: added definite assignment assertions to all class props, removed unused `customCSS` prop/interface
- Fixed type mismatch in `updateConfig` with `reconfigureSelectionHighlighter` signature
- tsconfig: removed deprecated `baseUrl`, enabled `strict`, switched `moduleResolution` to `bundler`
- Added `.clickable-icon:hover` anti-theme-bleed styles using `--icon-color-hover` and `--background-modifier-hover`
- Line/start/end toggles default to OFF when creating new highlighters

#### 0.4.0 (2026-07-17)

- Group tabs: create, rename, delete groups to organize highlighters
- Drag highlighters onto group tabs with hover animation
- Add group button opens naming modal by default
- Import backward compatibility: old format without groups → all go to "默认"
- All group action buttons use Obsidian's native `.clickable-icon` styling
- Group tab UI redesign: zero-gap layout, accent-colored active tab, rounded top/square bottom, full-width separator line
- TypeScript strict mode error fixes

#### 0.3.2 (2026-07-17)
- Drag handle icon changed to Obsidian's native Lucide `grip-vertical`
- Drag handle and color preview integrated into `highlighter-details` layout
- Removed redundant `highlighter-item-draggable` container
- Setting item description now shows only the search expression/term
- Unlocked Chinese selection highlighting: `minSelectionLength` default 3→1
- Fixed toggle button overlapping save button caused by `.query-wrapper input` width `15ch`
- TypeScript strict mode cleanup, fixed all type errors and module import issues
