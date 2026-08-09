# Changelog

#### 1.0.3 (2026-08-09)

- **Fixed the highlight index not refreshing when a new document is opened** (two-stage root cause): ① re-rendering only listened to `active-leaf-change`, which does not fire when a document opens in the already-active leaf (new note / explorer click on the current tab) — added a `file-open` listener; ② `collectFromView` only read the CM editor `state.doc`, which was not yet loaded when `file-open` fired, so the first scan reported 0 matches — fall back to `vault.cachedRead` when the CM content is empty. The index now scans on first open, no need to switch away and back
- **Renamed the highlight index setting and defaulted it to off**: "Auto-open highlight index" → "Startup auto-open highlight index", default changed to off (existing `data.json` values are preserved)
- **Merged the bilingual README**: the English version is now integrated at the end of `README.md` (with a bilingual banner at the top pointing to it), and the standalone `README.en.md` was removed; the English content was re-synced against the Chinese master (dropped English-only examples, aligned drifted wording, synced the setting rename)

#### 1.0.2 (2026-08-09)

- **Passed the Obsidian plugin review (round 2)**: `obsidianmd/no-static-styles-assignment` re-flagged 8 two-argument `style.setProperty` calls (minimap / export / pickr-drag / persistent-ui / teleprompter) — all converted to `setCssProps` (the API the review allows); added `dom-augment.d.ts` to declare the method missing from the 0.14.8 types. Verified rule boundaries: custom properties (`--xxx`) and three-argument `setProperty` with `important` are allowed

#### 1.0.1 (2026-08-09)

- **Fixed broken sponsor image**: the sponsor image link in README / manifest pointed at `github.com/{repo}/zanshang.jpg`, which returns a 404 text payload and breaks as an `<img>` — switched to a `raw.githubusercontent.com` direct link
- **README highlight strip**: added a feature keyword queue at the top of the docs (dynamic highlighting, regex queries, capture groups, custom CSS, highlight index, teleprompter, cursor-linked selection, scroll sync, minimap), mirrored in both languages
- **Passed the Obsidian plugin review**:
  - Static style assignments `.style.X = "literal"` converted to `style.setProperty` / `hide()`/`show()` (`obsidianmd/no-static-styles-assignment`)
  - Removed `detachLeavesOfType` from `onunload` — detaching leaves on unload resets them to their default location even when the user moved them
  - Dynamic user custom CSS injection switched from a `<style>` element to `CSSStyleSheet` + `document.adoptedStyleSheets` (the review forbids creating style elements; functionality unchanged, supported on all Chromium)

#### 0.9.10 (2026-08-09)

- **Highlight index tab layout rework**: removed the "高亮索引" / "追根溯源" buttons and their button bar; the highlight text index now lives directly in the highlight index tab
- **New cursor-linked selection**: when the editor cursor lands on a line containing a highlight, the matching index card is selected and scrolled to the center of the panel (cursor line polled every 150 ms)
- **New anchored-document fallback**: when the current page has no highlights, the index automatically scans the document bound to the teleprompter instead; documents not open in a view are read from disk
- **New keyboard navigation**: with the highlight index tab focused, ↑/↓ steps to the previous/next highlight card (counting from the currently selected card, clamped at the ends) without scrolling the panel; also syncs the editor cursor and the teleprompter
- **New scroll-sync button**: a "滚动同步" button (lucide `link`) right of the click-through lock; when active, prev/next switching also syncs — line-extract mode moves the editor cursor to the previous/next line, highlight-extract mode selects the previous/next index card; hidden with the other non-interactive buttons while locked
- **Teleprompter double-click links the index card**: double-clicking the teleprompter text area in highlight-extract mode also selects and centers the matching index card (the index switches to that document if it is rendering another source)
- **Fixed plugin-load crash that killed all arrow keys**: `teleprompterManager` was initialized after the index view's `onOpen` layout-ready callback, so `anchoredDocPath` read `undefined` and threw — the index view was left broken and every keyboard navigation stopped working; the manager is now initialized before view registration, with a defensive null check
- **Fixed empty teleprompter after restart in highlight mode**: restoring a highlight-mode window now proactively loads the matches and positions the current item, and scrolling (prev/next) rescans on demand — clicking an index card is no longer the only way to refresh
- **Fixed card selection vanishing right after a click**: the leaf-change re-render decision now compares the rendered document path (`renderedPath`) instead of view identity, so re-renders are skipped when the content source is unchanged (including focus returning to the same editor or to the index tab itself), preserving the selection
- **Fixed scroll-sync selection being cancelled by the cursor poll**: the cursor-link poll tracks cursor movement with a dedicated `lastPollCursorLine`, so a stationary cursor no longer overrides keyboard/scroll-sync selections
- **Copy moved to right-click**: removed the copy button from index cards; right-clicking a card copies the text (sharing the `copyText` implementation with the teleprompter's right-click copy)
- **Removed hover keyboard navigation**: teleprompter hover ↑/↓ conflicted with native editor navigation (a capture-phase hijack whose guard could fail globally); removed — wheel and toolbar buttons cover prev/next

#### 0.9.9 (2026-08-08)

- **Fixed teleprompter showing the first item after the highlight index refreshes**: `ensureMatches` cached matches by document path, so after the index re-scanned a changed document the click still hit the stale cache, the text lookup failed, and it fell back to item 0. Card clicks now force a fresh scan (cache cleared), and a `modify` listener on the matched source invalidates the cache — editing the bound document rescans and refreshes the current match immediately (skipping re-render when the text is unchanged, to avoid flicker on every keystroke).
- **Fixed double-click jump & select failing after scrolling**: the selection created by a double-click jump was flagged as "selection extract" by the line-mode poll, and that flag went stale after scrolling to the next item — the next double-click hit the early-return branch and only focused instead of jumping. Manual navigation (prev/next) now clears the flag, so double-click jumps to and selects the currently shown item again.

#### 0.9.8 (2026-08-07)

- **New teleprompter body-font setting**: a "Font" row in the teleprompter settings opens a font-picker modal — it enumerates local fonts via `queryLocalFonts()`, falling back to canvas width-measurement over a bundled candidate list. You can select multiple fonts and reorder them by priority (drag & drop); the first font present on this machine wins and missing fonts fall through to the next (CSS `font-family` fallback semantics). Search, per-font self-preview, and a "custom font" text input are included; leaving it empty follows the theme default.
- **New font-weight setting**: a dropdown (follow theme / 300–700) applied live; since weight changes glyph width, the window width refits automatically on change.
- **New font-color setting**: a color palette (Pickr) applied live on change, with opacity excluded (handled separately by "font opacity"); "Clear" restores the theme default; the picker pops up to the left of the swatch; added a "Reset to initial value" button.
- **Fixed color-picker drag**: Obsidian intercepts document-level `mousemove`, and pickr drives its drag entirely through it — so the palette/hue handle could only be clicked, never dragged. The pickers now listen to pointer events and drive pickr's internal drag logic directly, bypassing the interception (fixed in both the teleprompter and persistent-highlight pickers).
- **Double-click now jumps and selects**: double-clicking the teleprompter text area still moves the cursor to the captured line and now also selects the text — the matching segment in highlight-extract mode, the whole line in line mode, and the existing editor selection (which is exactly what's shown) is preserved in selection-extract mode. The selection scrolls to the center of the viewport.
- **Fixed width-measurement distortion with custom fonts**: the auto-fit probe now carries the actual computed font family, so width auto-fit no longer measures against the theme default font and stays correct under a custom font.
- **Theme font-override resistance**: font, weight, and color are applied as inline `!important`, beating high-specificity `.markdown-preview-view` container font rules from themes such as Blue Topaz.

#### 0.9.7 (2026-08-07)

- **Fixed close→reopen state lost across restart**: when a closed teleprompter window was reopened (state restored from the stash), the persist ran before the window was added to the window list, writing an empty window list to disk — so after an Obsidian restart the restored window was gone and reopening gave a default window. The persist now runs after the window is registered, so restored state is properly saved and still restores after restart.

#### 0.9.6 (2026-08-07)

- **Track-cursor button hidden when click-through locked**: the toolbar's "Track Cursor" button is no longer an interactive button under click-through lock and is hidden along with the rest
- **Toolbar shows on hover while locked**: fixed the toolbar staying visible after the mouse left the window while locked — it now fades out on mouse-leave, just like when unlocked
- **State restored after close & reopen**: closing a teleprompter window and reopening it restores its position, size, mode, bound document, track-cursor toggle, and more
- **Closed-window state survives restart**: closed windows' states are persisted to data.json, so reopening after an Obsidian restart still restores them; closed windows never auto-reopen after restart
- **Vertically centered text**: content is now vertically centered within the display area; falls back to normal scrolling (top never clipped) when content exceeds the max height
- **New "Max selection length" setting**: the selection-highlight tab gains a slider (2-60, default 30) capping how long a selection can be for full-document matching — selections longer than the cap are skipped to avoid slowdowns from huge selections; a "Restore default" button (lucide `rotate-ccw`) sits next to the slider

#### 0.9.5 (2026-08-06)

- **New "Track Cursor" toggle**: a new "跟踪光标" button (lucide `text-cursor`) in the toolbar makes cursor-following an independent, toggleable feature (off by default). When enabled, moving the cursor auto-extracts the line under it (line-extract mode only); when disabled, line mode stays static and manual prev/next browsing is never disturbed.
- **Double-click to jump to the line**: double-clicking the teleprompter text area moves the editor cursor to the captured text's line, focuses the editor, and scrolls the line to the center of the viewport; in highlight-extract mode it jumps to the current match's line.
- **Right-click to copy plain text**: right-clicking the text area copies the rendered plain text of the captured content (no Markdown syntax) and shows a "已复制" notice on success.
- **Text area minimum height**: the content area now has a 45px min-height so the panel never collapses when content is short.
- **Fixed width-measurement distortion**: the auto-fit probe now carries the actual current font size explicitly, so the `.glimpse-tp-content` rule's fixed 50px can no longer override it and measurements follow the real font slot.
- **Fixed cumulative rightward drift from width auto-fit**: when two lines' widths differ by an odd number of pixels the refit offset is ±0.5px, and `Math.round` always rounds .5 up, making the two directions asymmetric — successive renders drifted the window right until it hit the right edge and snapped back. Switching to `Math.trunc` (toward zero) keeps the offset symmetric and bounded.

#### 0.9.4 (2026-08-02)

- **Import / export / custom-CSS editors switched to styled plain textareas**: the CodeMirror editors had cursor, input, and theme-compatibility issues in multi-plugin environments. They are now plain textareas (monospace, no-wrap `pre`, bordered, resizable); the box height auto-fits its content (with a min/max clamp, scrolling when longer) to sidestep those environment problems.
- **One-click export UI**: buttons moved above the box (Export to file / Export to clipboard); the JSON box auto-fits its height.
- **One-click import UI reworked**: "Import from file" is now a button, the paste box auto-fits, buttons sit above the box, and the whole dialog shares one style set with the export dialog; dropped the `modal-style-settings` class so the Style Settings plugin's fixed 70vh no longer inflates the modal.
- **Teleprompter theme switch adapts instantly**: the window background now updates immediately when toggling light/dark themes (a MutationObserver watches the body theme class, with a `css-change` event as fallback).
- **Group tab drag-reorder**: persistent-highlight groups can be dragged to reorder; the default group stays first and cannot be dragged.
- **Delete-group button tooltip**: added a "Delete group" tooltip to the delete button.

#### 0.9.3 (2026-08-01)

- **Resize works while width is locked**: the right-edge handle stays usable after width lock; the dragged width is adopted as the new locked value — no need to unlock first.
- **New default opacities + reset buttons**: font opacity defaults to 80% (was 25%) and background opacity to 90% (was 50%); each setting now has a "Reset to initial value" button (lucide `rotate-ccw`) that restores the default and applies live to all windows.
- **Leading-whitespace normalization**: leading tabs/spaces are stripped before a single line is rendered, so indented lines (e.g. nested list items) are no longer treated by Markdown as indented code blocks (`pre/code`) and render as unindented list/text.
- **Width measurement now uses the real render context**: the auto-fit probe wraps content children in `markdown-rendered` / `markdown-preview-view` classes so pseudo-element widths (list markers, etc.) are measured correctly — fixes the last character wrapping on list items.

#### 0.9.2 (2026-08-01)

- **New "Hide Background" button**: placed after the width-lock button. When active, the teleprompter background becomes fully transparent (including hover/drag states); when inactive, the background color and opacity follow the background-opacity setting as before.
- **Background always visible**: the background color and border are now always shown (opacity from settings) instead of only on hover; hover/drag only adds a shadow.
- **Click-through lock no longer forces transparency**: the lock now only passes pointer events through; full background transparency is handled solely by the "Hide Background" button.
- **Toolbar layout improvements**: the click-through lock button moved before the font-size button; the toolbar background now fits the button area and centers instead of stretching across the window.
- **Trimmed toolbar when locked**: only interactive buttons (prev/next, click-through lock, close) remain — the document-bind and mode-switch buttons are hidden.
- **Panel visuals moved**: border/radius/background/shadow/transition moved from the window root onto an outer content container, separating the panel from the toolbar.
- **Custom button tooltips**: replaced Obsidian's native tooltip; defaults to popping above the button and flips below only when there is no room above. Tooltip text simplified (parenthetical notes removed).
- **Document binding refined**: after binding a document, switching to another document and clicking the bind button now always unbinds instead of binding the new document.
- **Fixed dragging the teleprompter moving the cursor in the document behind**: the content element carries the `markdown-preview-view` class, which Obsidian's reading-view CSS sets to `user-select: text`, so the browser's native text selection during a window drag leaked into the editor behind. The drag now calls `preventDefault` to stop native selection and the content is explicitly set to `user-select: none`.

#### 0.9.1 (2026-08-01)

- **Fixed line-extract mode not following the cursor**: `cursor-move` events (workspace-level and editor-level) proved unreliable in some environments; replaced with **poll-based following** — every 150ms the followed document's (bound > active) editor cursor is read, and the line is re-extracted whenever the line number or selection changes. When the cursor line is unchanged, manual prev/next browsing is never overridden.
- **Followed-editor caching**: the followed editor is resolved and cached on document/leaf switch or binding change; polling reads the cached reference instead of iterating leaves every tick. Auto-reconnects if the editor is destroyed (leaf re-creation).
- **Removed redundant event chain**: deleted the manager-level `cursor-move` forwarding and the `editor.on('cursor-move')` listener — a single polling path, no duplicate renders.
- **Mode toggle button now shows text**: displays the current mode 「逐行提取」/「高亮提取」, click to switch, active state highlighted.
- **Semantic toolbar icons**: prev/next now use `arrow-big-left` / `arrow-big-right`; click-through lock uses `lock`/`unlock` (same pattern as the width lock), width lock icon changed to `move-horizontal`; the font-size button icon tracks the size slot via `heading-1` ~ `heading-5`.
- **Settings button goes straight to the teleprompter settings page**: opens the settings modal, navigates to the Glimpse plugin tab, and preselects the 提词器 section.

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
