## Glimpse

[![Release](https://img.shields.io/github/v/release/Dyse-Sofqi/Glimpse?style=flat-square&label=Release)](https://github.com/Dyse-Sofqi/Glimpse/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Dyse-Sofqi/Glimpse/total?style=flat-square&label=Downloads)](https://github.com/Dyse-Sofqi/Glimpse/releases)
[![Stars](https://img.shields.io/github/stars/Dyse-Sofqi/Glimpse?style=flat-square&label=Stars)](https://github.com/Dyse-Sofqi/Glimpse)
[![License](https://img.shields.io/github/license/Dyse-Sofqi/Glimpse?style=flat-square&label=License)](LICENSE)

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

### Teleprompter (desktop only)

Karaoke-style floating teleprompter windows that follow document content in real time — for cue cards, reading aloud, or lectures. Desktop only.

- **Three content modes**:
  - **Line extract**: follows the editor cursor and auto-extracts the line as the cursor moves (poll-based detection, bound or active document); wheel/buttons step up/down one line manually
  - **Highlight extract**: cycles through `==...==` matches in order — great for scripted reading
  - **Selection extract**: temporarily overrides the content with selected text, auto-restores on deselect
- **Highlight index integration**: clicking an index card binds that document and switches to highlight-extract mode
- **Document binding**: pin the window to a specific document instead of following the active one; once bound, clicking the bind button again always unbinds instead of binding the currently active document
- **Click-through lock**: whole window becomes mouse-transparent (interactive buttons kept), never blocks the editor; the lock itself no longer changes the background — full background transparency is handled solely by the "Hide Background" button
- **Hide Background**: when active, the window background becomes fully transparent (including hover/drag states); when inactive, the background color stays visible with the opacity set in the settings
- **Width auto-fit**: width adapts to the content's widest line (prev/next never grows the window), clamped to the viewport so long text wraps without overflowing; the right edge is draggable and auto-locks, and stays draggable while locked — the new width inherits as the locked value
- **Drag snapping**: snaps to viewport edges and center lines with guide overlays
- **Font size**: cycles 32/40/50/64/80px
- **Toolbar**: the mode toggle is a text button showing the current mode (逐行提取 / 高亮提取); prev/next (`arrow-big-left`/`arrow-big-right`), width lock (`move-horizontal`), click-through lock (`lock`/`unlock`), hide background (`eye-off`), and font-size slot icons (`heading-1`~`heading-5`) all use semantic lucide icons; button tooltips default to popping above and flip below only when there is no room above; when locked, only interactive buttons (prev/next, lock, close) remain; the settings button jumps straight to the teleprompter settings page
- **Opacity**: font opacity (default 80%) and background opacity (default 90%) adjustable in settings, each with a "Reset to initial value" button (lucide `rotate-ccw`); the background color and border are always visible and the opacity applies live
- **Theme / custom CSS styling**: content reuses theme and user CSS snippets (headings, code blocks, inline formatting); only font size is controlled by the teleprompter. Leading tabs/spaces are stripped before rendering a single line, so indented content (e.g. nested list items) renders as unindented list/text instead of a code block
- **Status bar entry**: "Open teleprompter" button in the bottom-right status bar (lucide-presentation) for one-click open/focus, toggleable in settings
- **State persistence**: window position, size, mode, and binding restored on restart
- **Empty-line fallback**: shows previous item's text (half-opacity placeholder) when the current line is empty
- **Commands**: "打开提词器" and "关闭所有提词器", multiple instances supported

### Settings

The settings dialog is organized into four tabs:

- **Selection**: toggle highlighting all occurrences of the selected text; highlight delay in milliseconds (≥200); minimap toggle
- **Persistent**: create, edit, and delete highlighters, group management, one-click import/export
- **Highlight index**: "Auto-open highlight index" toggle — enables the index tab on plugin load
- **Teleprompter**: font opacity (default 80%) and background opacity (default 90%), each with a "Reset to initial value" button; selection-extract mode and status-bar button toggles

### Limitations

- Reading mode does not support dynamic selection highlighting

### Sponsorship

If Glimpse helps you, consider supporting the author:

![Sponsor](https://github.com/Dyse-Sofqi/Glimpse/zanshang.jpg)

### Acknowledgments

Thanks to @chrisgrieser (aka @pseudometa) for the plugin concept and feedback.
Thanks to @chetachiezikeuzor for the settings UI code, inspired by https://github.com/chetachiezikeuzor/highlightr-Plugin/
