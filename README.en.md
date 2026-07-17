## Gazer

An Obsidian plugin that dynamically highlights text based on cursor selection or search query.

Currently only supports Source mode and Live Preview mode. Reading mode and legacy editor are not supported.

### Selection Highlighting

When text is selected, highlights all occurrences of the selected text:
- Case-insensitive matching
- Current selection marked as `.cm-selection`
- Other matching strings in the document marked as `.cm-matched-string`
- All matches include `data-contents` attribute with the selected string value

### Persistent Highlighting

Define search queries with associated CSS class names and colors to create persistent highlights. Matched strings are automatically tagged with the corresponding CSS class and background color.

Supports regex queries (enable the toggle for regex mode).

You can define any number of independent highlighters; class names must be unique. Be mindful of performance with many complex regex queries.

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
