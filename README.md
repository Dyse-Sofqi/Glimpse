> **English** — Scroll down for the English README.

## Glimpse

[![Release](https://img.shields.io/github/v/release/Dyse-Sofqi/Glimpse?style=flat-square&label=Release)](https://github.com/Dyse-Sofqi/Glimpse/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Dyse-Sofqi/Glimpse/total?style=flat-square&label=Downloads)](https://github.com/Dyse-Sofqi/Glimpse/releases)
[![Stars](https://img.shields.io/github/stars/Dyse-Sofqi/Glimpse?style=flat-square&label=Stars)](https://github.com/Dyse-Sofqi/Glimpse)
[![License](https://img.shields.io/github/license/Dyse-Sofqi/Glimpse?style=flat-square&label=License)](LICENSE)

> **关键词**：动态高亮、正则查询、捕获组、自定义 CSS、高亮索引、提词器、光标联动、滚动同步、缩略图

根据选中内容或搜索关键词动态高亮文本的 Obsidian 插件，主要功能：

- **选择高亮**：选中文本后即时高亮全文所有匹配，附滚动条标记与缩略图
- **持久高亮**：按正则/关键词查询持久标记，支持捕获组、父行、开始/结束 widget、自定义 CSS 与标签组管理
- **高亮索引**：自动检索 `==高亮==` 文本，按文档标题层级组织为侧边栏索引
- **提词器（桌面端）**：歌词式浮动提词窗口，跟随文档/光标实时显示，支持多实例

目前仅支持源码模式（Source）和实时预览模式（Live Preview）。阅读模式（Reading）和旧版编辑器暂不支持。

### 选择高亮

有选中内容时，高亮选中文本的所有出现位置：
- 大小写不敏感匹配
- 当前选中文本默认标记为 `.cm-selection`
- 文档中其他位置匹配的字符串标记为 `.cm-matched-string`
- 所有匹配项附带 `data-contents` 属性存储当前选中字符串值
- **滚动条标记 / 缩略图**：选中时滚动条显示匹配位置标记；可选在编辑器右侧显示缩略图（类似 VS Code minimap，可拖动滚动）
- **检索上限**：设置中可调「选择检索的字符串上限」（2-60，默认 30），超过该长度的选中文本不再进行全文匹配，避免超长选择拖慢编辑

### 持久高亮

定义搜索查询并关联 CSS 类名和颜色来创建持久高亮。匹配的字符串会自动标记对应 CSS 类并应用所选背景色。每条样式与颜色缓存于索引，标记可随时开关控制匹配表现。

支持正则表达式查询（需开启对应选项），正则模式下可使用**命名捕获组**（如 `(?<groupName>…)`）或**无名捕获组**（如 `(…)`）精确高亮子匹配内容。

#### 标记类型

每条样式可组合启用多种标记方式：

- **匹配**：高亮完整匹配文本（默认开启）
- **父行**：为匹配所在整行添加 CSS 类，支持针对整行而非单词设置样式
- **开始 / 结束**：在匹配起止位置插入零宽度 widget 元素，配合 CSS 可实现前缀/后缀图标
- **捕获组**：正则模式下，高亮捕获组匹配的子内容而非完整表达式。子内容使用自定义样式颜色。支持命名组 `(?<name>…)` 和无名组 `(…)`，勾选「捕获组」时自动跳过整段匹配

#### 自定义 CSS

每条样式可编写独立 CSS 规则，自动注入页面 `<style>` 元素。
编辑器内通过 CodeMirror 实例高亮渲染，支持深色/浅色主题适配。CSS 变更随保存即时生效。

#### 标签组

样式支持分组管理：新建、重命名、删除分组，拖拽样式至标签页即可归类，分组标签可拖动调整顺序（默认分组固定首位不可拖动）。「全部启用/禁止」工具栏按钮统一控制当前分组匹配开关状态。

#### 导入导出

支持一键导入（从剪贴板 JSON 或文件）、一键导出（批量导出所有样式含分组信息）、单条样式导出。导入/导出弹窗使用样式化纯文本框：按钮置于文本框上方（导出到文件 / 导出到粘贴板、从文件导入 / 从下面粘贴板导入），文本框高度随内容自适应，界面风格统一。兼容旧格式数据（无分组 → 归入"默认"）。

##### Pandoc 导出中的自定义样式高亮（`:::`）
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

### 高亮索引

自动检索当前文档中 `==...==` 包裹的 Obsidian 标准高亮文本，以标题层级组织在侧边栏展示。

- **标题分组**：按文档标题结构组织高亮项，无标题的高亮项归入文档名分组展示
- **层级图标**：h1-h6 标题前显示对应 lucide heading 图标，颜色跟随 `--h1-color` ~ `--h6-color` CSS 变量
- **祖先标题栏**：共享祖先标题以独立行展示于首个索引项前，与正常标题使用相同图标和配色
- **毛玻璃卡片**：高亮文本以圆角毛玻璃卡片展示，支持悬浮增强毛玻璃特效
- **光标联动**：编辑器光标落入高亮语句所在行时，对应卡片自动选中并滚动至屏幕中央
- **键盘导航**：聚焦索引标签页时 ↑/↓ 切换上/下一项高亮卡片（从已选中卡片起算），并同步编辑器光标与提词器
- **右键复制**：右键卡片复制文本内容并弹出提示
- **锚定文档回退**：当前页面检索不到高亮时，自动从提词器锚定（绑定）的文档中检索展示；锚定文档未打开为视图时读盘检索
- **自动刷新**：首次打开文档即检索，切换文档时自动刷新索引（补监听 `file-open`，覆盖新建 / 资源管理器点击当前标签页等不触发叶子变更的打开方式）；新焦点文档无高亮时保留上次检索结果
- **命令面板**：注册「打开高亮索引」命令，可从命令面板呼出
- **设置开关**：「启动时默认打开高亮索引」（默认关闭），开启后插件启动时自动启用索引标签页

### 提词器（桌面端）

桌面歌词式浮动提词窗口，跟随文档内容实时显示，适合提词、朗读、讲解场景。仅桌面端可用。

- **三种内容模式**：
  - **行提取**：默认静态显示（打开/切换文档时提取一次），点击工具栏「跟踪光标」开启光标跟随——光标移动自动提取所在行（轮询检测，绑定/活动文档均可）；滚轮/按钮可手动切换上一行、下一行
  - **高亮提取**：按顺序显示 `==...==` 高亮匹配，适合按稿朗读
  - **选中提取**：选中文本时临时覆盖显示选中内容，取消选中自动恢复
- **高亮索引联动**：点击高亮索引卡片自动绑定该文档并切换到高亮提取模式；双击提词器文本区同步选中索引中对应卡片；开启滚动同步后，上一项/下一项切换同样联动选中对应卡片
- **滚动同步**：工具栏「穿透锁定」右侧按钮（lucide `link`）开启后，上一项/下一项切换同步触发——逐行模式光标跳转对应上一/下一行，高亮模式选中索引中对应上一/下一项卡片；穿透锁定时随非交互按钮一并隐藏
- **文档绑定**：将窗口固定到某个文档，不再跟随活动文档；已锁定后再次点击绑定按钮直接解除锁定，不会转向锁定当前活动文档
- **穿透锁定**：窗口整体穿透鼠标（仅保留交互按钮），不遮挡编辑；背景全透明统一由「隐藏背景」按钮控制，穿透锁定本身不再改动背景；锁定状态下按钮栏同样仅在鼠标悬停时显示，移出窗口自动隐藏，「跟踪光标」「滚动同步」按钮随其他非交互按钮一并隐藏
- **隐藏背景**：激活后窗口背景全透明（悬停/拖拽也不显示），未激活时背景色常显且透明度引用设置界面所设的背景透明度
- **宽度自适应**：按内容最宽行自动适配宽度（切换上一项/下一项不增宽），宽度钳制视口上限，长文本换行不溢出；右缘可拖拽调整并自动锁定，宽度锁定后仍可直接拖拽，新宽度继承为锁定宽度
- **拖拽吸附**：贴近视口边缘或中心线时自动吸附，附辅助线提示
- **字体大小**：32/40/50/64/80px 五档循环
- **字体 / 字重 / 颜色**：设置中可调正文字体（本机字体选择模态窗，`queryLocalFonts()` 枚举、兜底候选表测宽；多选 + 拖拽调优先级，首个可用字体优先生效、缺失自动顺延；支持搜索、预览与自定义字体输入）、字重（跟随主题 / 300–700）与文字颜色（色板，点击即应用；「清除」恢复跟随主题），均带「重置为初始值」按钮
- **工具栏**：模式切换为文本按钮（显示「逐行提取」/「高亮提取」）；跟踪光标（`text-cursor`，光标跟随开关）、上一项/下一项（`arrow-big-left`/`arrow-big-right`）、宽度锁定（`move-horizontal`）、穿透锁定（`lock`/`unlock`）、隐藏背景（`eye-off`）、字体档位图标（`heading-1`~`heading-5`）均为语义化 lucide 图标；按钮提示默认在上方弹出、上方无空间时自动翻转到底部；穿透锁定时仅保留上一项/下一项、穿透锁定、关闭等交互按钮；设置按钮直达提词器设置页
- **透明度**：设置中可调字体透明度（默认 80%）与背景透明度（默认 90%），两项均带「重置为初始值」按钮（lucide `rotate-ccw`）；背景色与边框常显，透明度实时生效
- **主题适配**：切换浅色/深色主题时窗口背景色即时更新，无需重启
- **渲染样式**：内容复用主题与自定义 CSS（标题、代码块、内联格式等），仅字体大小由提词器控制；单行渲染前自动去掉行首缩进，嵌套列表等缩进行按无缩进列表/文本展示，不被误判为代码块
- **垂直居中**：文本显示域内内容垂直居中，短内容不再顶置；内容超过最大高度时回退常规滚动，顶部不截断
- **状态栏入口**：右下角状态栏「打开提词器」按钮（lucide-presentation）一键打开/聚焦，可在设置中关闭
- **双击定位 + 选中**：双击文本显示域，编辑器光标跳到捕获文本所在行并选中对应文本（高亮模式选中匹配文本段、行模式选中整行、选中提取保留现有选择），聚焦并将选中范围滚动至视口中央
- **右键复制**：右键单击文本显示域，复制捕获文本的渲染后纯文本（无 Markdown 语法），成功弹出「已复制」通知
- **状态持久化**：关闭后重新打开即恢复上次窗口的位置、尺寸、模式、绑定、跟踪光标等状态；已关闭窗口的状态跨重启保留，Obsidian 重启后重开仍可恢复，已关闭的窗口不会在重启后自动弹出
- **空行回退**：当前行为空时显示上一项内容（半透明占位）
- **命令**：「打开提词器」「关闭所有提词器」，支持多实例

### 设置

设置界面按功能分为四个页签：

- **选择高亮**：高亮选中文本出现位置开关；高亮延迟（毫秒，需 ≥200）；缩略图开关；选择检索的字符串上限滑杆（2-60，默认 30，带「恢复默认」按钮）
- **持久高亮**：自定义样式的创建、编辑、删除，标签组管理与一键导入导出
- **高亮索引**：「启动时默认打开高亮索引」开关，开启后插件启动时自动启用索引标签页
- **提词器**：字体（本机字体选择）、字重、字体颜色、字体透明度（默认 80%）、背景透明度（默认 90%），均带「重置为初始值」按钮；选中提取模式与状态栏按钮开关

### 限制

- 阅读（Reading）模式暂不支持动态高亮

### 赞助

如果 Glimpse 对你有帮助，欢迎赞助支持～

[PayPal](https://paypal.me/Sofqi)

### 致谢

感谢 @chrisgrieser（aka @pseudometa）提供的插件创意和反馈。
感谢 @chetachiezikeuzor 的插件设置界面代码，灵感来自 https://github.com/chetachiezikeuzor/highlightr-Plugin/

---

## English README

> **Keywords**: dynamic highlighting, regex queries, capture groups, custom CSS, highlight index, teleprompter, cursor-linked selection, scroll sync, minimap

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

Define search queries with associated CSS class names and colors to create persistent highlights. Matched strings are automatically tagged with the corresponding CSS class and background color. Each highlighter's style and color is cached in the index; match toggles can be switched on/off at any time to control how matches appear.

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

- **Heading grouping**: Highlights organized by the document's heading structure; highlights without a preceding heading grouped under the document-name group
- **Level icons**: h1-h6 headings display a corresponding lucide heading icon, colored by `--h1-color` through `--h6-color` CSS variables
- **Ancestor breadcrumbs**: Shared ancestor headings rendered as standalone rows before the first entry in each subtree, using the same icon and color styling as direct headings
- **Frosted glass cards**: Highlights displayed as rounded frosted glass cards with a hover-enhanced frosted effect
- **Cursor-linked selection**: when the editor cursor lands on a line containing a highlight, the matching card is selected and scrolled to the center of the panel
- **Keyboard navigation**: with the index tab focused, ↑/↓ steps to the previous/next card (counting from the currently selected one), also syncing the editor cursor and the teleprompter
- **Right-click to copy**: right-clicking a card copies its text and shows a Notice toast
- **Anchored-document fallback**: when the current page has no highlights, the index scans the document bound to the teleprompter instead; documents not open in a view are read from disk
- **Auto-refresh**: Scans a document on first open and re-scans on document switch (a `file-open` listener covers opens that don't change the active leaf, e.g. new notes or explorer clicks on the current tab); keeps previous results when the new active document has no highlights
- **Command palette**: Registers "打开高亮索引" command to summon the index view
- **Settings toggle**: "Startup auto-open highlight index" (off by default) — enables the index tab on plugin load

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
- **Highlight index**: "Startup auto-open highlight index" toggle — enables the index tab on plugin load
- **Teleprompter**: font (local-font picker), font weight, font color, font opacity (default 80%) and background opacity (default 90%), each with a "Reset to initial value" button; selection-extract mode and status-bar button toggles

### Limitations

- Reading mode does not support dynamic selection highlighting

### Sponsorship

If Glimpse helps you, consider supporting the author:

[PayPal](https://paypal.me/Sofqi)

### Acknowledgments

Thanks to @chrisgrieser (aka @pseudometa) for the plugin concept and feedback.
Thanks to @chetachiezikeuzor for the settings UI code, inspired by https://github.com/chetachiezikeuzor/highlightr-Plugin/
