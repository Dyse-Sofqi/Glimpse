# Changelog

#### 0.9.0 (2026-07-31)

- **New Teleprompter (desktop only)**: karaoke-style floating teleprompter windows, multiple instances supported. See [docs/adr/0001-teleprompter-floating-overlay.md](docs/adr/0001-teleprompter-floating-overlay.md)
- **Three content modes**: line extract (follows cursor, shows current line), highlight extract (cycles `==...==` matches in order), selection extract (temporarily overrides with selected text, auto-restores on deselect)
- **Highlight index integration**: clicking an index card binds that document and switches to highlight-extract mode at the matching entry
- **Document binding**: pin the extraction source document instead of following the active one
- **Prev / Next**: toolbar buttons or mouse wheel (strict ±1 line, no wrap)
- **Click-through lock**: whole window becomes `pointer-events` transparent except the interactive buttons, so content never blocks the editor
- **Width auto-fit + lock**: fits content/toolbar width, drag right edge to resize, can be locked
- **Drag snapping**: snaps to viewport edges and center lines, guides shown near center
- **Font size cycling**: 32/40/50/64/80px
- **Opacity settings**: font opacity (default 25%, halved for placeholder text) and background opacity (default 50%) sliders, applied live
- **State persistence**: window position/size/lock/mode/binding restored on restart
- **Empty-content fallback**: shows previous item's text at half opacity when current line is empty
- **Commands**: "Open teleprompter" (reuses most-recently-focused instance) and "Close all teleprompters"
- **Rendering**: content rendered via MarkdownRenderer, Markdown supported
- **Status bar entry**: "Open teleprompter" button added to the bottom-right status bar (lucide-presentation), toggleable in settings (on by default); hover style matches native status bar buttons
- **Theme / custom CSS reuse**: content rendered with the `markdown-rendered` classes so theme and user CSS snippets apply (headings, code blocks, inline formatting); only font size is controlled by the teleprompter
- **Width auto-fit fix**: width now measured from the content's actual widest line (hidden nowrap probe clone); prev/next no longer grows the window each step; width clamped to the viewport so long text wraps instead of overflowing the screen
- **Drag-resize auto-lock**: dragging the right edge now locks the width automatically to prevent reflow on content change; click the lock button to unlock and restore auto-fit
- **Toolbar styling**: centered icons, background reused from the status bar, buttons use `clickable-icon` hover styling, vertically centered

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
