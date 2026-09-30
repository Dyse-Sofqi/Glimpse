# Note Reader 实现分析与复刻方案

> 目的：为 Glimpse 增加「朗读笔记 + 逐词高亮」能力。Note Reader 采用 **CC BY-ND 4.0（禁止演绎）**，不能搬运代码，因此本文档分两部分：
> **Part A** 行为级实现分析（作为复刻的规格来源），**Part B** 面向 Glimpse 的独立重写方案。
>
> 本文档是**功能规格**，不是代码来源。实现阶段应以本文档为依据，不要对着 Note Reader 的产物写代码（见 §5.2 红线清单）。

---

## 0. 结论摘要

1. **仓库里没有源码。** `F:\_Workspace\note-reader` 的 `main.js` 只有 13 KB，是个**桩**（只含 Logger + 默认设置 + 一条调试命令）；真产物在 GitHub Releases 里（`main.js` 577 KB / `styles.css` 23.7 KB）。`.gitignore` 明确写着编译产物只发 Release。
2. **产物是混淆压缩的单文件 bundle**，变量名已 mangle，无 sourcemap、无 `// src/...` 模块注释。**无法还原出可信的源码结构**，只能做行为分析。
3. 许可证 **CC BY-ND 4.0**：允许原样转载（署名），**明确禁止分享演绎作品**。把它的代码（哪怕重排/翻译）并入 Glimpse 发布 = 违规。**独立重写（行为驱动）不受此限**——著作权不保护思想、功能与算法。
4. 它的架构是**服务注册表 + EventBus + 状态机**的重型分层设计（约 24 个 service），核心算法是一套 **偏移保持的文本过滤 + `PositionMapper` 双向映射**。
5. 高亮走的是 **DOM 绝对定位覆盖层**（`coordsAtPos` 测量 + CSS 变量定位），不是编辑器装饰器。**Glimpse 不该照这条路走**——CM6 装饰器方案更简单、更稳、自动跟随主题与换行。
6. 在线 TTS 用的是**逆向的 Edge Read Aloud 私有接口**（`speech.platform.bing.com` + `Sec-MS-GEC` 令牌），不是官方 Azure SDK。技术上可用，但属未公开接口、随时可能失效。
7. 建议：**Phase 1 只做本地 `speechSynthesis`（零依赖、零许可证风险）**，在线音质作为 Phase 2 可选项，且优先「用户自带 Azure key + 官方 MIT SDK」。

---

## Part A — 实现分析

### A1. 取证材料与可信度

| 材料 | 来源 | 可信度 |
| --- | --- | --- |
| `LICENSE`（CC BY-ND 4.0） | 仓库 | 直接读取 |
| `README.md` | 仓库 | 直接读取（功能自述，需与产物交叉验证） |
| `manifest.json` v1.6.0 | 仓库 + Release | 直接读取 |
| 桩 `main.js`（13 KB） | 仓库 `4e583ff` | **未混淆**，Logger / SettingsManager / DEFAULT_SETTINGS 可读 |
| 真产物 `main.js`（577 KB） | Release `1.6.0` | 混淆，仅字符串与结构可读 |
| `styles.css`（23.7 KB） | Release `1.6.0` | **未压缩且带注释**，UI 结构还原度最高 |

分析脚本与产物落在 `F:\_Workspace\note-reader\_analysis\`（`1.6.0/` 为下载产物，`ctx.py` 为上下文提取脚本）。该目录是取证用的临时材料，可随时删除。

> 下文凡标 **[推断]** 的结论，均为从字符串/结构反推，未在运行中验证。

### A2. 交付形态

- 插件 id `note-reader`，`isDesktopOnly: true`，`minAppVersion 1.11.0`。
- Release 时间线 1.0.0（2025-11）→ 1.6.0（2026-06），共 12 个版本。
- 三个资产：`main.js` / `manifest.json` / `styles.css`。
- **没有 `ItemView` / `registerView`**：播放器不是 Obsidian 视图，而是**注入进 MarkdownView DOM 的一条横条**。

### A3. 架构总览

```
NoteReader (Plugin)
└── services{}  ← 服务注册表（构造期一次性装配）
    ├── settingsManager / logger / statisticsTracker
    ├── eventBus                ← 全模块解耦中枢
    ├── textProcessor           ← 过滤 + 分句 + 分块
    ├── ttsServiceManager ──┬── localTtsAdapter   (Web Speech API)
    │                       └── onlineTtsAdapter  (Edge Read Aloud / WSS)
    ├── mediaSourceManager      ← MediaSource + SourceBuffer 流式喂音频
    ├── audioController         ← <audio> 元素、播放/暂停/跳转
    ├── bufferManager           ← 预读缓冲 + 卡顿看门狗
    ├── highlightService ──┬── positionMapper      ← raw ↔ filtered 偏移映射
    │                      ├── highlightQueue      ← 按时间调度「该显示的词」
    │                      └── highlightAdapter    ← DOM 覆盖层定位
    ├── scrollManager / interactionController / readerUIView
    ├── readerCoordinator       ← 状态机（总指挥）
    ├── readingPositionService  ← frontmatter 位置持久化
    ├── fileChangeMonitor / mediaKeyManager / mobileHelper
    └── audioFileGenerator / audioFileGenerationCoordinator
```

- **EventBus 命名空间**（从字符串常量提取）：`AUDIO.WORD_BOUNDARY`、`AUDIO.TIME_UPDATE`、`AUDIO.REWIND`、`AUDIO.FINISHED`、`SETTINGS.CHANGED`、`UI.STOP_SELECTED`。
- **状态机**（`readerCoordinator`）：`stopped | loading | reading | paused | reloading`。
- **朗读起点** `readingOrigin`：`documentTop | cursor | selection | jump | persisted` —— 对应「从头读 / 从光标读 / 读选区 / 从某行跳读 / 恢复上次位置」。
- **命令清单**（`id` → 名称）：`read-note`「Read note from top」、`reload-active-note`、`rewind-10-seconds`、`play-pause`、`close-reader-controls`、`generate-audio-file`、`generate-audio-folder`、`log-debugging-messages`。用 `checkCallback` 做可用性门控（需有活动 md 文件 / 需正在朗读 / 需在线 provider）。

### A4. 核心机制 1：偏移保持的文本过滤 + PositionMapper

**这是整个插件最值得学的部分。** 问题定义：朗读要跳过 frontmatter、代码块、URL、Markdown 记号等；但**高亮要落回原文位置**。所以过滤不能丢偏移信息。

**做法**：过滤时逐字符记录来源。

```ts
// mapping[filteredIndex] = rawOffset（过滤后第 i 个字符来自原文的哪个下标）
class PositionMapper {
  mapping: number[] | null;
  isIdentity: boolean;       // 未过滤任何内容时为 true，双向映射退化为恒等（零成本）
  filteredToRaw(i) { return this.isIdentity ? i : this.mapping[i]; }   // O(1)
  rawToFiltered(pos) {                                                 // O(n) 线性扫描
    for (let i = 0; i < this.mapping.length; i++) if (this.mapping[i] >= pos) return i;
    return this.filteredLength;
  }
  truncateAt(filteredLen) { this.filteredLength = Math.min(filteredLen, this.filteredLength); }
  // truncateAt 用于「朗读过程中用户编辑了文档」→ 丢弃映射尾部
}
```

要点：
- `isIdentity` 短路是必要的优化——默认无过滤时不能引入任何映射开销。
- `rawToFiltered` 是线性扫描，用于**从编辑器光标位置反查朗读位置**（jump / rewind）。映射数组长度 = 过滤后字符数，长文下需注意（可改二分）。
- `truncateAt` 揭示了它的编辑策略：**编辑发生时截断映射尾部**，而不是重新映射全文。

**过滤项清单**（1.6.0 默认值，从 bundle 提取）：`frontmatter`、`codeBlocks`、`inlineCode`、`tables`、`headers`、`blockquotes`、`tags`、`urls`、`imageEmbeds`、`emojis`、`highlights`、`asterisks`、`underscores`、`backslashEscapes`，另有 `enablePhraseLineFilter` + `ignorePhraseLine`（跳过含特定短语的行）与 `enableLinePrefixFilter` + `ignoreLinePrefix`（跳过特定前缀开头的行）。

**分句与分块**：
- 分句用 `Intl.Segmenter(locale, { granularity: "sentence" })`。
- `mergeAcronymSplits`：正则 `/(?:[A-Za-z]\.){2,}\s*$/` 把被误切的缩写（`U.S.A.` 等）重新合并到下一句。
- `isLineIsolated`：标记「独占整行的句子」——用于「停止朗读短语」的匹配。
- 分块上限 **4096 字符**（`splitTextIntoChunks`），对应在线接口的单次请求上限。

### A5. 核心机制 2：TTS 双提供方

两条链路被统一成**同一个归一化事件**：

```
AUDIO.WORD_BOUNDARY → { chunkStartTime, offset, duration, text }
AUDIO.TIME_UPDATE   → { currentTime }
```

**本地 provider（Web Speech API）**
- `speechSynthesis` + `SpeechSynthesisUtterance`；`addEventListener("boundary", handler)` 取词边界（`charIndex` / `charLength`）。
- **lite 模式不注册 boundary 监听**（移动端熄屏只听音，不做高亮）。
- 无 seek 能力，所以倒退用**启发式**：从当前 `charIndex` 往前扫 120→150 个字符，命中空格或 `[.!?,;:]` 就落在该处，否则退回 150 字符处。

**在线 provider（Edge Read Aloud，非官方 Azure SDK）**
- 端点：`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`
- 音色列表：`https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=…`
- 请求头伪装 Edge：`User-Agent … Edg/143.0.3650.75`、`Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold`、`Sec-CH-UA` 等。
- 鉴权靠 `Sec-MS-GEC` + `Sec-MS-GEC-Version` 查询参数；**令牌依赖服务器时间**，所以代码里有 RFC2616 `Date` 解析 + `adjClockSkewSeconds` 时钟偏移校正。
- 返回流分两类：`audio` 分片（MP3）+ `audio.metadata`（JSON）。metadata 的 `Type` 为 `WordBoundary` / `SentenceBoundary`，字段 `Data.Offset`（100ns 单位，故有 `offsetCompensation`）/ `Data.Duration` / `Data.text.Text`。**词级时间戳由此而来**——这是在线模式能逐词高亮的原因。
- 支持 `https-proxy-agent` 走代理。
- 默认在线音色 `en-US-AvaMultilingualNeural`，默认本地音色 `Microsoft Zira - English (United States)`。

> **与 `msedge-tts` 的关系**：bundle 中这套代码的结构（`parseMetadata` 的字段路径、`proxy` 选项、`generateSecMsGec`、依赖 `ws` + `https-proxy-agent`）与 npm 包 `msedge-tts` 高度一致，**[推断]** 为直接内嵌或轻度改造。`msedge-tts@2.0.8` 的 npm 元数据为 **MIT**，故这一层本身可被我们独立合法使用。

### A6. 核心机制 3：流式播放（MSE）

- `MediaSource` + `SourceBuffer`，支持 mime：`audio/mpeg`、`audio/webm`、`audio/mp4`、`audio/ogg`。
- `appendQueue` 串行喂入分片，`previousBufferedEnd` / `totalBufferedDuration` 追踪缓冲；`SUPPORTED_MIME_TYPES` 决定 codec 选择。
- **预读与卡顿看门狗**：设置项 `targetBufferAheadSeconds`（30–180s，默认 90）、`stallCheckIntervalMs`（2000）、`stallThresholdSeconds`（5）；有 `stallWatchdogTimeoutId` 与流恢复（`stream recovery`，失败则重新拉取编辑器内容重开）。
- 本地 provider 不需要 MSE，直接 `speechSynthesis` 发声。

### A7. 核心机制 4：逐词高亮（DOM 覆盖层）

**关键设计选择：不用编辑器装饰器，用一个绝对定位的浮层。**

```
高亮元素 = <div class="note-reader-traveling-highlight {themeId}">
  位置通过 CSS 变量注入：--highlight-left / --highlight-top / --highlight-width / --highlight-height
  transition: left .08s ease-out, width .08s ease-out   ← 换词时平滑滑动
  另有 .note-reader-line-highlight-overlay  ← 整行背景
```

- **坐标获取**：编辑器视图用 CM6 `view.coordsAtPos(from)` / `coordsAtPos(to)` 取两个点，再减去容器 `getBoundingClientRect()` 并加上 `scrollDOM.scrollLeft/scrollTop`，换算成覆盖层坐标。
- **层级**：`getZIndex()` 编辑器视图返回 `-1`，阅读视图返回 `0`（CSS 注释亦印证）。覆盖层插入 `.cm-scroller`。
- **跨行处理**：若首词与末词 `top` 相差 > 5px（常量 `Xh = 5`），判定为跨行，**只高亮末词**。
- **调度**：`highlightQueue` 记录 `recordShownWord(word, currentTime)`，在 `TIME_UPDATE` 时 `processDueHighlights()` 批量放行到期的词；倒退时 `restoreFromRewindHistory(newTime, previousTime)` / `getPositionForRewindSeconds(10)`。
- **主题系统**：一个主题 = 一组 CSS 自定义属性（`--highlight-background` / `-border` / `-box-shadow` / `-background-image` …）。内置主题 + 用户自定义主题（设置里存 `customThemes`），默认 `classy`。设置页有 4 列卡片网格的主题选择弹窗、主题预览、自定义主题编辑器。
- **窗口可见性**：`visibilitychange` 时隐藏/恢复高亮（`showLastPosition`）。

**[推断] 阅读视图**：bundle 中**没有** `markdown-preview-view` 之类选择器，也没有 `createRange` / `TreeWalker` / `getClientRects`；同时 `handleViewMode()` 会在开启「锁定滚动」时调用 `enforceSourceMode()`，把视图 `setViewState({mode:"source"})` 强制切回源码模式（并保存原模式以便恢复）。**故推测：逐词高亮的主战场是编辑器，阅读视图要么能力受限、要么靠同一条覆盖层路径勉强支持。此点未验证。**

### A8. 其他机制

| 机制 | 实现要点 |
| --- | --- |
| **交互锁定** | 编辑器加 `pointer-events: none` + `caret-color: transparent`；捕获阶段拦截 `click` / `mousedown` / `contextmenu`；隐藏滚动条 |
| **跟随滚动** | 高亮位置变化时滚动使其可见（`scrollIntoView`）；`scrollManager` 独立成服务 |
| **跳到某行朗读** | 悬停编辑器行 → 用 `posAtCoords({x,y})` 定位行 → `coordsAtPos` 算行坐标 → 在行左侧 −28px 处绝对定位一个 24×24 播放图标（`.note-reader-jump-icon`），点击从该行起读 |
| **位置持久化** | `app.fileManager.processFrontMatter` 写入/读取（设置项 `enablePositionPersistence`、`persistRewind` 回退一点给上下文、`resumeThresholdSeconds` 默认 60）；笔记被改过时弹「续读 / 从头读」弹窗 |
| **完成行为** | `enableChimeOnFinish`（`AudioContext` 合成提示音 `playNotificationChime`）、`closePlayerOnFinish`、`enableStopReading` + `stopReadingPhrase`（独占一行的短语触发停止） |
| **音频文件导出** | `vault.adapter.writeBinary` 落盘；命令 `generate-audio-file`（当前笔记）/ `generate-audio-folder`（弹文件夹选择器批量）。**依赖在线 provider**——因为 MP3 分片是服务端直出，本地不需要编码器（bundle 中无 lamejs） |
| **统计** | 12 项计数器（朗读次数、时长、各按钮点击…）；存储模式 `pluginStorage`（随库同步）或 `browserStorage`（`app.loadLocalStorage`，仅本机） |
| **UI 结构** | 播放条 `.note-reader-player`（可折叠 `collapsed` + 入场动画 `appearing`）内含进度数字、进度条（自定义 `--progress-percent` + `::before` 填充，隐藏原生 thumb）、控制区、右槽位；音色选择弹窗（搜索框 + 语言/性别筛选 + 表格 + 每行试听/配置 + `flagcdn.com` 国旗）；设置页用可折叠分组 `.note-reader-setting-group` |
| **设置树** | 9 个分组：`filters` / `liteMode` / `onboarding` / `reading` / `readingCompletionBehavior` / `showRibbonIcon` / `statisticsStorageMode` / `stats` / `storage` / `troubleshooting` / `tts` / `wordHighlighting` |

### A9. 值得借鉴 vs 应当避免

| 值得借鉴 | 应当避免 |
| --- | --- |
| 偏移保持过滤 + `PositionMapper` 双向映射（问题定义准确，算法干净） | 24 个 service + 自建 EventBus —— 对 Glimpse 是过度设计 |
| 用 `Intl.Segmenter` 分句 + 缩写合并修正 | DOM 覆盖层定位（测量、CSS 变量、z-index 负值、跨行阈值全要手写） |
| 「过滤后文本 + 原始偏移」而非「替换后字符串」的思路 | 逆向私有接口（`Sec-MS-GEC`、Edge UA 伪装）作唯一在线方案 |
| `highlightQueue` 按时间放行到期词（时间驱动而非事件驱动） | 强制切换视图模式（`setViewState`）——对用户是侵入式副作用 |
| 逐词时间戳驱动高亮（与卡拉OK同构） | 桩 `main.js` 这种「仓库发桩、产物发 Release」的交付方式 |
| 主题 = 一组 CSS 变量 | 复制其设置键名 / CSS 类名前缀 / 字符串 |

---

## Part B — 面向 Glimpse 的复刻方案

### B1. 总原则：规格驱动重写

法律上可行的路径只有一条：**以行为规格为输入，独立实现**。

- 著作权保护的是**表达**，不保护**思想、功能、算法、接口**。「文本过滤要保留原文偏移」是思想，「用一个 `mapping[]` 数组实现」是表达——前者可自由使用，后者若逐行对应就是演绎。
- 因此：**先有规格（本文档 Part A），再关掉参考物写代码**。写代码时不应打开 Note Reader 的 bundle 或 `styles.css`。
- 不需要署名（我们没有分享它的材料），但在 README 写一句「朗读功能的设计对比过 Note Reader」是诚实且无害的；**不要**写「移植自 / 基于」——那会自认演绎。
- 不构成法律意见。若要商业化发行，建议正式过一遍法务。

### B2. 红线清单（不得触碰）

| 类别 | 具体禁止 |
| --- | --- |
| 代码 | 反混淆后搬运、逐行翻译 TS、复制函数/类结构 |
| 标识符 | 沿用其内部命名（`PositionMapper`、`highlightQueue`、`audioController`…）作为我们 API 的命名体系 |
| 样式 | 复制 `.note-reader-*` 类名与 CSS 规则；Glimpse 统一用 `glimpse-` 前缀 |
| 文案 | 照抄设置项标题/描述/命令名（如 "Read note from top"、"Rewind 10 seconds"） |
| 结构 | 照抄其设置树的键名与分组形状（`tts.voiceOnline`、`wordHighlighting.highlightThemeId`…）——**我们另起一套** |
| 产物 | 把 Release 的 `main.js` / `styles.css` 放进 Glimpse |

### B3. 建议架构（映射到 Glimpse 既有资产）

新增 `src/reader/`，与既有 `highlighters/`、`music/`、`settings/` 平级：

```
src/reader/
├── settings-types.ts    ReaderSettings（我们自己的键名与分组）
├── text-pipeline.ts     纯函数：buildReadableText(raw, filters) → { text, mapping[] }
│                        + splitIntoSentences(text, locale)
├── word-timing.ts       时间轴引擎：句子/词 → { rawFrom, rawTo, tStart } 队列
├── tts/
│   ├── types.ts         TtsProvider 接口 + 归一化 WordTiming 事件
│   ├── local.ts         Web Speech API（含 boundary 缺失时的估算兜底）
│   └── edge.ts          （Phase 2，可选）在线音质
├── controller.ts        状态机 + 命令实现
├── player-bar.ts        播放条 UI（注入 MarkdownView 顶部）
└── highlight.ts         CM6 装饰器扩展（逐词 + 整行）
```

**复用 Glimpse 现有资产**：

| Glimpse 已有 | 复用方式 |
| --- | --- |
| `src/music/lrc.ts` 的 `WORD_SPLIT_REGEX` | **直接复用**做 CJK 感知拆词（中日韩单字拆、拉丁整词）——比 Note Reader 的 provider 边界更适合中文笔记。建议提到 `src/shared/` 或从 lrc.ts 导出 |
| `src/music/musicView.ts` 的卡拉OK逐字高亮（`updateKaraokeWords` + `timeupdate`） | 同构模式：`时间 → 当前词索引 → 更新 span`。逐词高亮可直接照此形状写 |
| `src/music/audioPlayer.ts` | 在线 provider 的音频播放（play/pause/seek/rate/volume/destroy）现成 |
| `src/highlighters/static.ts` 的 `ViewPlugin` + `Decoration.set` 模式 | 逐词高亮的实现范式（含 `EditorView.theme()` 上色） |
| `src/settings/tabs/*-ui.ts` + `settings/ui.ts` | 设置页新增 `reader-ui.ts` 标签页 |
| `src/main.ts` 的 `registerEditorExtension` / `iterateCM6` | 注册扩展与向已打开编辑器派发 reconfigure |
| `src/teleprompter.ts` | 可选：把当前朗读句镜像到提词器浮窗 |

### B4. 关键设计差异（我们比它更好的地方）

1. **用 CM6 装饰器替代 DOM 覆盖层。**
   - `Decoration.mark({class:"glimpse-reader-word"})` + `Decoration.line({class:"glimpse-reader-line"})`，通过 `StateEffect` 更新当前词位置。
   - 换来：自动跟随换行/缩放/主题/字体、无需 `coordsAtPos` 测量、无需 CSS 变量定位、无 z-index 负值、无跨行 5px 阈值这类补丁。
   - 自动滚动直接 `EditorView.scrollIntoView(pos, {y:"center"})`。
   - 代价：装饰只在视口内渲染——但我们本来就要滚到当前词，无影响。
2. **词边界事件的兜底估算。** 实测与资料均表明：Chromium/Electron 在 Windows 上对本地 SAPI 音色的 `boundary` 事件**不可靠**（远程音色更是基本不触发）。Note Reader 只依赖该事件，本地模式下逐词高亮很可能退化。我们的做法：**以「字数 ÷ 估算语速」的时间轴为主时钟，`boundary` 事件到达时做校正**——两者都不可用时至少还能整句高亮。
3. **编辑器优先，不强制切视图模式。** Glimpse README 已声明「仅支持 Source / Live Preview」，因此无需像它那样 `setViewState` 强制切源码模式——Live Preview 原生可用。是否锁编辑改为**可选**（CM6 位置可随 `ChangeDesc` 映射，未必要锁）。
4. **CJK 友好。** 拆词走 `WORD_SPLIT_REGEX`，中文按字、英文按词，天然适配中文笔记；而不是等 provider 吐 `WordBoundary`（对中文的分词质量不可控）。
5. **零重依赖起步。** Phase 1 不引入任何 npm 依赖。

### B5. 依赖与许可证选型

> **已更新**：TTS 提供方选型见 `tts-provider-plan.md`（参考 zhuomianling 的本地 HTTP 服务模型）。结论是**改用本机 HTTP TTS 服务作主 provider**，`Web Speech API` 降为离线兜底；词级高亮不再依赖 provider 时间戳。下表保留为初版记录。

| 用途 | 选型 | 许可证 | 备注 |
| --- | --- | --- | --- |
| 本地 TTS | **Web Speech API**（内置） | 无（浏览器 API） | 零依赖、离线、零风险；**现降级为兜底方案** |
| 分句 | `Intl.Segmenter`（内置） | 无 | Chromium ≥ 87 可用 |
| 在线 TTS（可选 A） | `msedge-tts` | **MIT** | 非官方接口；依赖 `ws`/`buffer`/`stream-browserify`，会显著增大 bundle |
| 在线 TTS（可选 B，推荐） | `microsoft-cognitiveservices-speech-sdk` | **MIT** | 官方 SDK，用户自带 Azure key，合规且稳定 |
| 音频播放 | 复用 `music/audioPlayer.ts` | 本项目 | — |
| 拆词 | 复用 `music/lrc.ts` 的 `WORD_SPLIT_REGEX` | 本项目 | — |

> 注意：`msedge-tts` 的早期版本（1.0.x）是 MIT，1.1.0 起曾标为 GPL-3.0，**2.0.8 的 npm 元数据又回到 MIT**。若采用，请锁定版本并在 `package.json` 里固定，避免上游再次变更许可。这也再次说明：**逆向接口的依赖链本身就不稳**。

### B6. 分期路线

**Phase 1 — 本地朗读 + 逐词高亮（核心，零依赖）**
1. `text-pipeline.ts`：偏移保持过滤（输出 `mapping[]`）+ `Intl.Segmenter` 分句 + 缩写合并修正。
2. `word-timing.ts`：句子/词 → 时间轴；估算语速兜底。
3. `tts/local.ts`：`speechSynthesis` 逐句朗读，`boundary` 校正。
4. `highlight.ts`：CM6 装饰器（当前词 + 当前行）+ `scrollIntoView`。
5. `controller.ts` + 命令：从头读 / 从光标读 / 读选区 / 播放暂停 / 后退 10 秒 / 停止。
6. `player-bar.ts`：播放条（进度、播放/暂停、后退、关闭、设置入口）。
7. 设置页 `reader-ui.ts`：provider（本地）、音色、语速、音高、过滤开关、高亮开关/主题、行为选项。
8. 主题：2–3 个内置逐词高亮主题（CSS 变量驱动，配色用 Obsidian 主题变量）。

**Phase 2 — 在线音质（可选，需显式开启）**
- 二选一：`msedge-tts`（体验接近，但接口非官方 + 体积 + 许可需锁版本）；或官方 SDK + 用户 Azure key（推荐）。
- 界面必须明示：数据会发送到第三方、接口稳定性不受保证。

**Phase 3 — 增强**
- 音频文件导出（`vault.adapter.writeBinary`；仅在线模式可行，本地无 MP3 直出）。
- 位置持久化（**用 Glimpse 自己的 frontmatter 键**，如 `glimpse-reader-pos`）。
- 统计计数、跳到某行朗读（悬停播放图标）、完成提示音。
- 阅读视图（Reading）支持——需**另写**一条 `registerMarkdownPostProcessor` 路径，不能复用 CM6 装饰器；建议先不做。

### B7. 风险与未验证项

| 项 | 状态 | 建议动作 |
| --- | --- | --- |
| 本机 Electron 是否触发 `boundary` 事件 | **未验证** | 写 20 行探针（`speechSynthesis` + 监听 boundary，在 Obsidian 控制台跑）先确认；这直接决定 Phase 1 的时间轴策略权重 |
| 本机可用语音列表与语言覆盖 | 未验证 | 同上探针一并打印 `getVoices()` |
| Note Reader 阅读视图的真实能力 | **[推断]** | 仅影响我们对它的评价，不影响复刻方案 |
| `Intl.Segmenter` 中文分句质量 | 未验证 | 用一段中英混排笔记试 |
| 长文 `rawToFiltered` 线性扫描性能 | 已知风险 | 我们自己实现时直接上二分 |
| 在线接口随时失效 | 已知风险 | Phase 2 明确标注 + 提供本地降级 |

---

## 附录：证据索引

| 结论 | 证据位置 |
| --- | --- |
| 仓库无源码 | `F:\_Workspace\note-reader\.gitignore`（`main.js` 被忽略 + 注释） |
| 桩 `main.js` 内容 | `F:\_Workspace\note-reader\main.js`（92 行可读） |
| 许可证 | `F:\_Workspace\note-reader\LICENSE` 第 87 行 §2(a)(1)(b)、第 187 行 |
| 真产物 | Release `1.6.0` 资产，已下载至 `_analysis\1.6.0\` |
| `PositionMapper` | `_analysis\1.6.0\main.js` 偏移 301886 起（`ot=class`） |
| `Intl.Segmenter` 分句 | 偏移 459964 起（`splitIntoSentences`） |
| Edge Read Aloud 端点 | 偏移 401259 起（`speech.platform.bing.com`、`TrustedClientToken`） |
| `WordBoundary` 解析 | 偏移 403639 / 414619 |
| 覆盖层与 `coordsAtPos` | 偏移 310790 / 313436 |
| MSE 流式播放 | 偏移 286054 起（`MediaSource`、`SourceBuffer`） |
| 默认设置全量 | 偏移 282073 起（`backslashEscapes` 所在的默认设置对象） |
| 强制源码模式 | 偏移 323638 / 509245（`enforceSourceMode`） |
| UI 结构 | `_analysis\1.6.0\styles.css`（未压缩带注释） |

复现方式：`python _analysis\ctx.py "<正则>" <前文> <后文> <条数>`
