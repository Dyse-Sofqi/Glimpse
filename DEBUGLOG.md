# 调试日志（DEBUGLOG）

关键避坑记录，供后期维护快速定位。按版本聚合。

## 未发布 (2026-09-23)

### 试听起播切歌词面板 + 自动匹配歌词（2026-10-05）

**需求：** 点「试听」播放在线歌曲时，应像播放本地歌曲一样跳到歌词页面并自动匹配歌词。

**根因：** 自动匹配的前置条件是**歌词面板可见** —— `maybeAutoSearchLyrics()` 第一行就是 `if (this.viewMode !== "lyrics" ...) return`。试听此前不切面板（`togglePreview` 里没有 `setViewMode`），所以试听歌曲永远停在「无歌词」空态，只有用户手动切到歌词面板才会触发匹配。试听歌词的落地链路本身早就有了（`applyLyricToTarget` 对 `preview:` 路径走 `applyPreviewLyrics` 内存临时挂载）。

**修复：** `togglePreview` 起播分支里补 `this.setViewMode("lyrics")`（与本地行 `void playSong(song); this.setViewMode("lyrics")` 同一写法，含队列续播的后续曲目）；另在歌词面板给一条 `renderLyricSearchStatus("正在加载试听 …")`，`stopPreview()` 里 `clearLyricCandidates()` 收起。

**避坑记录：**

1. **「切面板」就是自动匹配的开关**：这个链路的所有零件（空歌词判定、四平台搜索、`preview:` 临时挂载）都已存在，唯独缺「面板可见」这一前置条件。排查「某功能不触发」时先看它的守卫条件，而不是急着补新逻辑。
2. **切面板会遮住歌单面板里的进度条**（`renderTabProgress` 挂在歌单面板的标签栏下方）：试听拉取要几秒，切走后就没了反馈，故在歌词面板补同义状态（`renderLyricSearchStatus`，出声后由「正在自动匹配在线歌词…」自然接替；无匹配时被候选列表/空态接替）。
3. **`stopPreview()` 是试听收尾的统一出口**（失败、被接管、切歌、onClose 都走它）：新增的「正在加载试听…」状态挂在这一处清理，就不会出现「拉取失败后状态永远挂着」。它本身已承担浮层图标复位与 key 清理。
4. **harness 要手动订阅状态**：真实 `onOpen` 里才 `plugin.onLyricsStateChange(this._onStateChange)`，只构造 `MusicView`（构造器只存 plugin）不会订阅 —— 端到端测试里要显式接上，否则自动匹配这条「状态推送驱动」的链路永远不跑（本次实测先误报一条：切面板成功但 searchCalls=0）。

### 试听行封面浮层与本地行统一（2026-10-05）

**需求：** 在线歌曲试听播放中，封面浮层显示的是「停止试听」方块，与本地歌曲播放中的暂停图标不一致；用户要求统一为本地那套。

**实现：** 试听行（`renderOnlineRow` 的 `previewing` 分支、`_onStateChange` 的队列续播分支）改调 `renderCoverPlayIcon(coverPlay, playing)`；点击浮层由「停止（销毁播放器 + `stopPreview`）」改为 `toggleActivePlayer()`（暂停/续播）；新增 `syncPreviewCover(state)` 在状态推送里同步图标。`.gm-download-item-cover-play-active` 只剩「常驻显示 + 可点击」，底色回落到基础规则的压暗封面（与本地行同款），不再用 `--interactive-accent` 纯色底。

**避坑记录：**

1. **图标必须在状态推送里同步，且要按播放态翻转去重**：暂停/续播不只从浮层点击发生 —— 底栏播放键、快捷键、队列续播、别的歌曲抢播放位都会改状态。旧实现「点击时设一次方块、`stopPreview` 时复位」只在「方块=停止」这套语义下成立；换成暂停/播放后必须有状态驱动。但 `_onStateChange` 每秒推 4 次以上，`setIcon` 会重建 svg（按压瞬间重建会吞掉 click，见 musicView 顶部 setIconIfChanged 的注释），所以用 `previewPlaying` 标记只在翻转时重设。
2. **暂停试听 = 保留播放器，不是销毁**：旧「停止」走 `stopAllPlayback()`（销毁播放器 + revoke blob），续播要重新拉取；改暂停后 blob 与播放位置都留着，续播不重新下载。代价是没有显式「停止试听」入口 —— 让位（播放别的歌/切歌/队列续播）时照旧由接管守卫停止并复位浮层。
3. **拉取中（播放器尚未建立）先显播放图标**：`togglePreview` 里 `previewKey` 一旦置上，此刻状态还不是 `preview:` 路径，若直接显暂停就是在骗人；出声后由状态推送切暂停。这段时间的重复点击仍然忽略（否则试听会「永远差一次」）。
4. **浮层底色跟着本地行走，别留「强调色纯色底」**：`.gm-download-item-cover-play-active` 原先同时承担「常驻」与「强调色底 + 反白图标」；底色去掉后只留常驻与可点击，颜色/悬停色全部回落到 `.gm-download-item-cover-play` 的基础规则 —— 少一处颜色来源，就不会出现「本地是压暗封面、试听是纯色块」的不一致。
5. **Playwright 桩里的 `setIcon` 必须替换而非追加**：真实 Obsidian 的 `setIcon` 会替换元素内已有 svg，桩里若只 `appendChild`，断言图标时会读到旧的那个（本次实测先误报两条：暂停后仍读到 pause）。断言图标前先让桩与真实行为对齐。
6. **断浮层 opacity 要等过渡走完**：`.gm-download-item-cover-play` 有 `transition: opacity .15s`，类一去掉就读 `getComputedStyle().opacity` 会读到过渡中的 1（本次实测误报一条）；要么断言类名，要么 `await 250ms` 再读。

### 提词器歌词模式双击播放/暂停 + 穿透锁定正文区未穿透（2026-10-05）

**需求：** 歌词提取模式下双击提词器文本区应控制当前歌曲（原先该手势直接 `return`：歌词没有「对应的文档行」可跳）。

**实现：** `handleContentDblClick()` 按模式分派 —— 歌词模式 `music.toggleCurrentSong()`，其余模式沿用 `jumpToCapturedLine()`。切换语义与提示收在 `MusicManager.toggleCurrentSong()`：正在播放 → 暂停（`audio.pause()`）/ 已暂停 → 续播（`audio.play()`，被拒时提示）/ 无当前歌曲 → 提示「未在播放歌曲」（与占位文案一致）/ 音频没挂上 → 提示「未就绪」。

**避坑记录：**

1. **手势语义照用户认知走，别替他做安全假设**：第一版按「只播放、正在播放时不动」实现（理由：双击落在文本域上，误触停歌比没反应更糟），用户随即要求「正在播放时双击就是暂停」—— 桌面歌词的认知就是播放/暂停。**结论：先问/先按用户明确说的语义做；「更安全」的默认值不等于用户想要的默认值。**
2. **状态判断放在管理器，不放在提词器**：提词器窗口拿到的 `isPlaying` 是推送来的快照，据此判断会有竞态；暂停链路（`audio.pause()` → audio 的 pause 事件 → 播放器回调 → `emitState`）与面板按钮完全同源，`toggle()` 也走同一条。提词器只做「哪个模式的哪个手势」的分派。
3. **要提示的场景只有「手势完全没反应」**：没歌、音频没挂上、起播被拒。已在播放/暂停成功都不提示（每次双击弹通知会很吵）—— 这也是与面板按钮/命令用的 `toggleActivePlayer()`（纯切换、没歌静默）唯一的差别。
4. **`pointer-events: none` 只写在根上挡不住子元素**：1.1.2 起根窗口常驻 `none`、`.glimpse-tp-body`（正文所在）打回 `auto`（为的是失配的透明区域不挡编辑器）。但子元素显式 `auto` 会**重新参与命中**，于是「穿透锁定」只隐藏了按钮：正文区照样吃掉点击（划词/编辑被挡，双击跳转、右键复制照旧触发 —— 新增的双击播放会在锁定态误触）。修复是补 `.glimpse-teleprompter.is-locked .glimpse-tp-body { pointer-events: none }`。**结论：点击穿透是「命中测试」层面的逐元素属性，父级 none 必须对每个显式 auto 的子元素逐一收口**；排查同类问题先看子元素有没有自己的 `pointer-events`。
5. **验证用命中测试而不是「事件没触发」**：`document.elementFromPoint(正文中心)` 在锁定态应落在提词器之外（编辑器/body），解锁后落回正文；比人工手测更快，且能定位到「到底是谁接住了这一下」。
6. **`styles.css` 里的锁定态注释也要跟着改**：注释若仍写「根已恒为 none，本态仅隐藏非交互按钮」，下一个维护者会照着重犯第 4 条。

### 提词器顶栏最小宽度（2026-10-05）：1.1.2 的「工具栏不参与宽度」收窄为「只提供下限」

**现象：** 提词器窗口较窄时，悬停顶栏的 12 个控件（文档绑定、模式下拉 + 10 个图标按钮）被折成两三行，一行只剩两三个按钮。

**根因：** 1.1.2 修「背景远宽于内容」时把工具栏从宽度计算里彻底摘掉（宽度只由内容决定，顶栏窄了靠 `flex-wrap` 折行收纳），而最小宽度是固定常量 `TP_MIN_WIDTH = 240` —— 与顶栏实际单行自然宽度（本机 ≈470px，随文档名/模式文案浮动）无关。

**修复：** `minWidth() = min(max(240, 顶栏单行宽 + 4px 缓冲), 视口宽)`，由 `clampWidth()` 统一施加（宽度自适应 / 右缘拖宽 / 宽度锁定三条路径）。「工具栏不参与宽度」的 1.1.2 结论被收窄为：工具栏不**撑宽**内容宽度，但提供**下限**。

**避坑记录：**

1. **不能直接量已折行顶栏的宽度** — 顶栏 `max-width:100%`，折行后 `offsetWidth` 量到的是窗口宽（折行后的值），拿它当最小值只会把现状锁死。测量时临时 `flex-wrap:nowrap + width:max-content + max-width:none`，读 `offsetWidth`（强制同步布局）后立即 `setCssProps(…null)` 还原：同帧还原，中间态不会被绘制（与 `measureNaturalWidth` 的离屏探针同一套路，但这里必须量真实元素才能带上 `is-locked` 等状态）。
2. **顶栏组成/文案变化处都要补下限** — 绑定按钮显示活动文档名、模式文案随模式切换、穿透锁定只留交互按钮，三处都会改变顶栏单行宽度。只在 `autoFitWidth()` 里算不够：宽度锁定的窗口跳过自适应，而构造顺序是 `setWidthLocked()` → `updateBindBtn()`/`updateModeSelect()`，前者量到的顶栏还是「— + 空模式标签」（实测偏小 42px）：恢复一个窄锁定窗口会停在 430px、顶栏照样两行。故四处（`setLocked`/`updateBindBtn`/`updateModeSelect`/`setWidthLocked`）统一调 `raiseToMinWidth()`（只抬不缩）。
3. **穿透锁定要按当前可见按钮计下限** — 锁定时 `.glimpse-tp-btn` 被 `display:none`，量到的就是真实的 100px（3 个按钮），`minWidth` 取 240 常量兜底；若按解锁态统一测，锁定的「桌面歌词」式窄窗会被撑到 470px，破坏「锁定=不打扰」的意图。解除锁定时在下限变更点补回。
4. **宽度锁定仍受下限约束** — 锁定语义是「不随内容变化」，不是「可以窄到折行」；旧 data.json 存的窄锁定宽度在恢复时抬到下限（`raiseToMinWidth` 只抬不缩，不碰用户所选宽度，也不按内容重排）。
5. **下限也是视口的函数** — 视口比顶栏还窄时 `minWidth` 退到视口宽（窗口不越出屏幕），此时折行不可避免；不要为了「永不折行」把窗口撑出屏幕。
6. **验证方式** — Playwright（仓库已有依赖）+ esbuild 把真实 `src/teleprompter.ts` 与桩 `obsidian` 打成 IIFE，页面引入真实 `styles.css`，跑 22 项断言：15 项宽度/拖宽/视口、4 项歌词双击与行模式双击回归、3 项穿透锁定命中测试（顶栏行数用「可见 flex 项的 top 去重数」独立判定，不依赖被测代码的测量值）。

### 面板重新挂载用了 `getRightLeaf(true)`：右栏被多切一个分栏

**现象：** 用户报告「弹了个 notice 后，右侧边栏的音乐标签页移到下半区」。工作区快照对比：`workspaces.json` 里 2026-09-20 保存的「写作」布局中，`glimpse-music-panel` 是右栏**唯一**标签组里的第 7 个标签（叶子 id `980b6256a2548b7f`）；当前 `workspace.json` 中右栏有两个标签组，音乐面板独占 `children[1]`，叶子 id 变为 `d11aea471006ed72`（同文件里其他叶子的 id 逐一对得上）→ 该叶子是被**销毁后重建**的，不是被拖动。

**根因：** 面板丢失后 `ensureViewLoaded()` 走 `getRightLeaf(true)`。Obsidian 1.13 运行时 `getSideLeaf(sideSplit, split)`：`split === true` → 向侧栏 `insertChild(-1, new WorkspaceTabs)` 再塞一个叶子（**新建标签组**）；`split === false` → 取 `children[0]` 后 `insertChild(-1, new WorkspaceLeaf)`（**在首个标签组内新建空叶子**，不触碰已有叶子、不 `setActiveLeaf`）。所以 `true` 恰好把面板拆到了右栏下半区。

**修复：** 改用 `getRightLeaf(false)`，两个挂载入口（`activateView` / `ensureViewLoaded`）统一走 `mountMusicLeaf()`；顺带给 `activateView()` 补 `revealLeaf()`（`setViewState({active:true})` 不展开收起的侧栏）。

**避坑记录：**

1. **`getRightLeaf(split)` 的参数不是「新建标签」而是「新建标签组」** — 旧注释「`getRightLeaf(true)` 新建一个标签，避免 `setViewState` 覆盖右栏已有其他插件视图」把语义理解反了：`false` 返回的是**新建的空叶子**（不覆盖任何视图），`true` 才多切一个分栏。同族 API 佐证：`getLeaf('tab' | true)` 走 `createLeafInTabGroup()`（组内新建标签），`getLeaf('split')` 走 `splitActiveLeaf()`；`createLeafBySplit()` 在不能切分时也回退到 `createLeafInTabGroup()`。
2. **`createLeafInParent(parent, index)` 会 `setActiveLeaf(新叶子)`**（运行时实现里显式调用）→ 想「静默挂载、不抢占当前激活标签」时不要用它（除非自己把原激活叶子恢复回去，否则 `workspace.getActiveFile()` 会变 null）；`getRightLeaf(false)` 不激活叶子，符合静默语义。另外注意它内部已 `insertChild` 一个新叶子，若再自行 `createLeafInParent` 同组会多留一个空标签。
3. **本插件被懒加载接管时 hot-reload 不会重载它** — Glimpse 处于「持久化停用 + 会话内运行」态（MDRazor 懒加载接管）时，hot-reload 的 `reload()` 开头 `if (!plugins.enabledPlugins.has(plugin)) return` 会静默跳过：重建 `main.js` 不会生效（本次实测 `workspace.json` / `data.json` 的 mtime 均不变）。要加载新产物需重启 Obsidian 或先在第三方插件设置里启用该插件。

## 1.0.4 (2026-08-15)

### 新版设置项行内元素顶部对齐（.setting-item align-items: flex-start）

- **现象**：设置页「持久高亮」列表行内 `grip-vertical` 拖拽图标垂直居中失效，悬在行顶
- **根因**：Obsidian 新版设置 UI 中 `.setting-item` 基类为 `align-items: flex-start`（子元素顶部对齐）；插件行内自定义元素未做 `align-self` 补偿。颜色预览曾在 0.4.0 补过 `align-self: center`，拖拽图标漏了（其 `display:flex; align-items:center` 只居中 svg 于手柄内部，手柄本身仍顶部对齐）
- **修复**：`.highlighter-setting-icon-drag` 与 `.highlighter-details .setting-item-control` 补 `align-self: center`
- **避坑**：新版设置项自定义行内元素（图标/控件/预览）一律显式 `align-self: center`，勿依赖基类对齐；旧版（`align-items: center`）下该属性无副作用

## 1.0.1–1.0.2 审核合规 (2026-08-09)

### onunload 禁止 detachLeavesOfType
- 审核规则：卸载时分离叶子会把叶子重置回默认位置（用户挪过也复位）
- 修复：删除 `onunload` 中 `detachLeavesOfType(HIGHLIGHT_INDEX_VIEW)`；视图清理交由 Obsidian 处理

### 禁止创建/挂载 `<style>` 元素
- 审核规则：`document.createElement("style")` + `head.appendChild` 不允许；静态 CSS 用 `styles.css`
- 本插件场景是**运行时用户自定义 CSS**（query.css），无官方注入 API
- 修复：改用 `CSSStyleSheet` + `document.adoptedStyleSheets`（不创建样式元素，Chromium 全支持）；卸载时从 adoptedStyleSheets 移除
- 备选失败：`EditorView.theme`/`StyleModule` 只接受对象 spec，原始 CSS 字符串运行时逐字符遍历会坏，不可用
- 避坑：动态 CSS 合规注入用 CSSStyleSheet，勿用 style 元素；CM 主题不接受原始 CSS 文本

### no-static-styles-assignment（规则边界实测两轮）
- 禁：`.style.X = "静态字面量"`、`style.setProperty(prop, val)` 两参调用
- 放行：CSS 类、`setCssProps`/`setCssStyles`（评审明确建议）、`hide()/show()`、自定义属性（`--xxx`）、带 `important` 三参 setProperty（applySettings 的字体覆盖未被抓）
- `setCssProps` 在 obsidian 0.14.8 类型未声明 → `src/dom-augment.d.ts` 声明增强（运行时自 1.0 存在，驼峰自动转连字符，null 移除属性）
- 新增样式切换优先 `hide()/show()` / `setCssProps`

## 1.0.3 (2026-08-09)

### 首次打开新文档高亮索引不刷新（两阶段根因）

- **现象**：打开未被索引过的文档，索引面板不检索（显示 0 匹配）；切换另一文档再切回才统计正常
- **阶段一（事件缺监听）**：索引重渲染仅监听 `active-leaf-change`；新文档在**已激活叶子**内打开（新建 / 资源管理器点击当前标签页）叶子未变，不触发 `active-leaf-change`，只触发 `file-open`
- **修复一**：`onOpen` 补监听 `file-open`（视图加载后触发）；`extension !== "md"` 或 `path === renderedPath` 跳过，保留选中态
- **阶段二（内容未就绪）**：`collectFromView` 只读 CM 编辑器 `state.doc`；`file-open` 触发时 CM 内容尚未加载（doc 为空）→ 首扫误报 0 匹配，面板滞留空。切走再切回正常 = 视图已加载读到了真内容
- **修复二**：`collectFromView` 改 async，CM doc 为空时回退 `vault.cachedRead` 读盘；两处调用点加 `await`
- **避坑**：新打开文档的编辑器内容异步就绪，`file-open` 后立即读 CM state 可能为空；实时内容优先、空则读盘兜底。事件补 `file-open`（加载后）+ 内容回退读盘，两者缺一都会复现
- 诊断日志已清（console.log 全部移除）

## 0.9.10 (2026-08-09)

### 崩溃：提词器管理器未初始化即被引用（全局 ↑/↓ 失效的真凶）
- **现象**：`Uncaught TypeError: Cannot read properties of undefined (reading 'lastFocused')`，栈在 `anchoredDocPath → collectAnchoredDoc → renderIndexPanel`；索引视图 onOpen 抛错导致其后续注册（keydown/轮询/事件）全部未执行，视图损坏
- **根因**：`main.ts` onload 中 `teleprompterManager = new TeleprompterManager()` 位于 `registerView` + `autoOpenRightLeaf`（layout-ready 回调开视图）之后；layout-ready 同步触发时视图先渲染，读到未初始化字段
- **修复**：manager 初始化提前到 `registerView` 之前；`anchoredDocPath` 加 `!mgr` 空检查
- **避坑**：插件字段若被视图 onOpen/layout-ready 回调读取，初始化必须早于视图注册；跨组件引用一律空检查

### 叶子变更重渲染冲掉选中态
- **现象**：未聚焦索引页时点击卡片，选中瞬间消失
- **根因**：点击使焦点切到索引 leaf → `active-leaf-change` → 旧逻辑无条件重置 `highlightLine` + 重渲染，卡片重建无 `.active`
- **修复**：重渲染判定改为按渲染源文档路径（`renderedPath`）比较 —— 内容未变（回焦同文档编辑器、聚焦本标签页、焦点到非 markdown 叶子）跳过重渲染
- **避坑**：重渲染前判断内容源是否真变，勿用视图实例身份比较；`revealMatch` 跨文档切源后也要同步维护 `renderedPath`/`renderingAnchored`

### 光标轮询覆盖主动选中
- **现象**：滚动同步选中卡片后立即被取消（光标静止）
- **根因**：轮询用 `highlightLine` 兼任「光标移动检测」与「选中记录」；`selectCard` 写 `highlightLine` 后轮询误判光标已移动，`applyCursorHighlight` 清空全部 `.active`
- **修复**：光标移动检测拆出独立 `lastPollCursorLine`；首次轮询（未初始化）前已有主动选中（`highlightLine ≥ 0`）只记录光标不覆盖
- **避坑**：「检测状态」与「选中状态」分开存，勿共用一字段

### revealMatch 回喂提词器竞态
- **现象**（潜在，随双击联动引入）：索引 `selectCard → activateCard → handleCardClick → showMatch` 同步清空提词器 `matches`，随后 `jumpToCapturedLine` 读不到匹配文本，选中段退化为整行
- **修复**：`selectCard(index, notifyTp = false)` —— 来源即提词器（revealMatch）时跳过回喂；点击/键盘仍回喂
- **避坑**：双向联动必须防环（A 驱动 B 时 B 不得再驱动 A）；提词器 `showMatch` 清缓存是同步的，外部调用后紧接读 `matches` 必空

### 悬停键盘导航移除（设计结论）
- **经过**：悬停提词器 ↑/↓ 切换 → 编辑器原生 ↑/↓ 失效 → 加 `activeElement`/聚焦守卫仍不可靠
- **根因**：window capture 劫持全局抢键，`isHovered`/`activeElement` 判定任一失效（焦点代理、锁定态 mouseleave 不触发等）即破坏编辑
- **结论**：不做全局键盘劫持；提词器上一项/下一项走滚轮 + 工具栏按钮（零冲突）。索引页键盘导航（聚焦 gate）是安全的
- **避坑**：功能键冲突时优先放弃全局劫持方案，而非叠守卫

### 穿透锁定与 hover 状态
- **现象**：锁定后 `pointer-events:none` 使 `mouseleave` 不再触发，`isHovered` 卡死
- **结论**：随悬停键盘移除，hover 状态已删；滚动同步按钮为非交互按钮（无 `is-interactive`），锁定态随其余按钮隐藏 —— 新增按钮默认不要带 `is-interactive`，除非锁定态仍需可点

### 滚动同步光标跳转细节
- 行模式同步用 `setCursor` 但不 `focus()`，浏览不抢焦点；高亮模式同步复用 `notifyIndexCardSelect → revealMatch`
- `prevItem`/`nextItem` 为 async（滚动按需加载匹配），事件调用处用 `void`
