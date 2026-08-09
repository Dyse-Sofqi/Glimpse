## Glimpse

[![Release](https://img.shields.io/github/v/release/Dyse-Sofqi/Glimpse?style=flat-square&label=Release)](https://github.com/Dyse-Sofqi/Glimpse/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Dyse-Sofqi/Glimpse/total?style=flat-square&label=Downloads)](https://github.com/Dyse-Sofqi/Glimpse/releases)
[![Stars](https://img.shields.io/github/stars/Dyse-Sofqi/Glimpse?style=flat-square&label=Stars)](https://github.com/Dyse-Sofqi/Glimpse)
[![License](https://img.shields.io/github/license/Dyse-Sofqi/Glimpse?style=flat-square&label=License)](LICENSE)

> **Keywords**: dynamic highlighting · regex queries · capture groups · custom CSS · highlight index · teleprompter · cursor-linked selection · scroll sync · multi-instance

An Obsidian plugin that dynamically highlights text based on cursor selection or search query. Key features:

- **Selection highlighting**: instantly highlights all occurrences of the selected text, with scrollbar markers and a minimap
- **Persistent highlighting**: mark text persistently via regex/keyword queries, with capture groups, line/start/end widgets, custom CSS, and group management
- **Highlight index**: auto-scans `==highlighted==` text and organizes it into a sidebar index by heading hierarchy
- **Teleprompter (desktop only)**: karaoke-style floating teleprompter windows that follow the document/cursor in real time, with multi-instance support

Currently supports Source mode and Live Preview mode. Reading mode and the legacy editor are not supported.

### Selection Highlighting

When text is selected, highlights all occurrences of the selected text:
- Case-insensitive matching
- Current selection marked as `.cm-selection`
- Other matching strings in the document marked as `.cm-matched-string`
- All matches include `data-contents` attribute with the selected string value
- **Scrollbar markers / minimap**: match positions shown on the scrollbar when text is selected; an optional minimap on the editor's right edge (draggable to scroll)
- **Selection length cap**: a "Max selection length" slider in settings (2-60, default 30) skips full-document matching for selections longer than the cap, avoiding slowdowns from huge selections

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

Organize highlighters with groups: create, rename, delete groups; drag highlighters onto group tabs to categorize, and drag group tabs to reorder them (the default group stays first and cannot be dragged). The "Enable All / Disable All" toolbar button controls match toggles for the current group at once.

#### Import & Export

Supports one-click import (from clipboard JSON or a file), batch export of all highlighters with group metadata, and per-highlighter single export. The import/export dialogs use styled plain textareas: buttons sit above the box (Export to file / Export to clipboard; Import from file / Import from the paste box below), the box auto-fits its content height, and both dialogs share one visual style. Backward compatible with legacy data format (no groups → defaults to "默认").

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
- **Cursor-linked selection**: when the editor cursor lands on a line containing a highlight, the matching card is selected and scrolled to the center of the panel
- **Keyboard navigation**: with the index tab focused, ↑/↓ steps to the previous/next card (counting from the currently selected one), also syncing the editor cursor and the teleprompter
- **Right-click to copy**: right-clicking a card copies its text and shows a Notice toast
- **Anchored-document fallback**: when the current page has no highlights, the index scans the document bound to the teleprompter instead; documents not open in a view are read from disk
- **Auto-refresh**: Re-scans on document switch; keeps previous results when the new active document has no highlights
- **Command palette**: Registers "打开高亮索引" command to summon the index view
- **Settings toggle**: Auto-open on plugin load option available in settings

### Teleprompter (desktop only)

Karaoke-style floating teleprompter windows that follow document content in real time — for cue cards, reading aloud, or lectures. Desktop only.

- **Three content modes**:
  - **Line extract**: static by default (extracts once when opened or when switching documents); click the "Track Cursor" button in the toolbar to enable cursor-following — the line under the cursor is auto-extracted as it moves (poll-based detection, bound or active document); wheel/buttons step up/down one line manually
  - **Highlight extract**: cycles through `==...==` matches in order — great for scripted reading
  - **Selection extract**: temporarily overrides the content with selected text, auto-restores on deselect
- **Highlight index integration**: clicking an index card binds that document and switches to highlight-extract mode; double-clicking the teleprompter text area selects the matching index card, and with scroll-sync on, prev/next steps select the corresponding card too
- **Scroll sync**: the button (lucide `link`) right of the click-through lock — when active, prev/next also syncs: line-extract mode moves the editor cursor to the previous/next line, highlight-extract mode selects the previous/next index card; hidden with the other non-interactive buttons while locked
- **Document binding**: pin the window to a specific document instead of following the active one; once bound, clicking the bind button again always unbinds instead of binding the currently active document
- **Click-through lock**: whole window becomes mouse-transparent (interactive buttons kept), never blocks the editor; the lock itself no longer changes the background — full background transparency is handled solely by the "Hide Background" button; while locked the toolbar shows only on hover and fades out on mouse-leave, and the "Track Cursor" / "Scroll Sync" buttons are hidden with the other non-interactive buttons
- **Hide Background**: when active, the window background becomes fully transparent (including hover/drag states); when inactive, the background color stays visible with the opacity set in the settings
- **Width auto-fit**: width adapts to the content's widest line (prev/next never grows the window), clamped to the viewport so long text wraps without overflowing; the right edge is draggable and auto-locks, and stays draggable while locked — the new width inherits as the locked value
- **Drag snapping**: snaps to viewport edges and center lines with guide overlays
- **Font size**: cycles 32/40/50/64/80px
- **Font / weight / color**: adjustable in settings — the body font uses a local-font picker modal (`queryLocalFonts()` enumeration, falling back to canvas measurement over a candidate list; multi-select with drag-to-reorder priority — the first available font wins, missing ones fall through; search, self-preview, and custom-font input included), font weight is a dropdown (follow theme / 300–700), and text color is a palette applied live ("Clear" restores the theme default); each has a "Reset to initial value" button
- **Toolbar**: the mode toggle is a text button showing the current mode (逐行提取 / 高亮提取); track cursor (`text-cursor`, cursor-following toggle), prev/next (`arrow-big-left`/`arrow-big-right`), width lock (`move-horizontal`), click-through lock (`lock`/`unlock`), hide background (`eye-off`), and font-size slot icons (`heading-1`~`heading-5`) all use semantic lucide icons; button tooltips default to popping above and flip below only when there is no room above; when locked, only interactive buttons (prev/next, lock, close) remain; the settings button jumps straight to the teleprompter settings page
- **Opacity**: font opacity (default 80%) and background opacity (default 90%) adjustable in settings, each with a "Reset to initial value" button (lucide `rotate-ccw`); the background color and border are always visible and the opacity applies live
- **Theme adaptation**: the window background updates instantly when toggling light/dark themes — no restart needed
- **Theme / custom CSS styling**: content reuses theme and user CSS snippets (headings, code blocks, inline formatting); only font size is controlled by the teleprompter. Leading tabs/spaces are stripped before rendering a single line, so indented content (e.g. nested list items) renders as unindented list/text instead of a code block
- **Vertical centering**: content is vertically centered within the text display area — short content no longer sits at the top; when content exceeds the max height it falls back to normal scrolling (top never clipped)
- **Status bar entry**: "Open teleprompter" button in the bottom-right status bar (lucide-presentation) for one-click open/focus, toggleable in settings
- **Double-click to jump & select**: double-click the text area to move the editor cursor to the captured text's line and select the matching text (the match segment in highlight-extract mode, the whole line in line mode, the existing selection preserved in selection-extract mode), focus the editor, and scroll the selection to the center of the viewport
- **Right-click to copy**: right-click the text area to copy the rendered plain text of the captured content (no Markdown syntax); a "已复制" notice confirms success
- **State persistence**: closing a window and reopening it restores its position, size, mode, binding, track-cursor toggle, and more; closed-window states survive an Obsidian restart (reopening still restores them), and closed windows never auto-reopen on restart
- **Empty-line fallback**: shows previous item's text (half-opacity placeholder) when the current line is empty
- **Commands**: "打开提词器" and "关闭所有提词器", multiple instances supported

### Settings

The settings dialog is organized into four tabs:

- **Selection**: toggle highlighting all occurrences of the selected text; highlight delay in milliseconds (≥200); minimap toggle; a "Max selection length" slider (2-60, default 30, with a "Restore default" button)
- **Persistent**: create, edit, and delete highlighters, group management, one-click import/export
- **Highlight index**: "Auto-open highlight index" toggle — enables the index tab on plugin load
- **Teleprompter**: font (local-font picker), font weight, font color, font opacity (default 80%) and background opacity (default 90%), each with a "Reset to initial value" button; selection-extract mode and status-bar button toggles

### Limitations

- Reading mode does not support dynamic selection highlighting

### Sponsorship

If Glimpse helps you, consider supporting the author:

![Sponsor](https://raw.githubusercontent.com/Dyse-Sofqi/Glimpse/main/zanshang.jpg)

### Acknowledgments

Thanks to @chrisgrieser (aka @pseudometa) for the plugin concept and feedback.
Thanks to @chetachiezikeuzor for the settings UI code, inspired by https://github.com/chetachiezikeuzor/highlightr-Plugin/
