# 朗读功能交接文档

> 面向「新开对话继续开发」的场景。本文是**自包含**的：读完它 + `docs/` 下三篇分析文档，
> 就不需要回溯之前的对话。
>
> 最后更新：2026-09-29 晚。当时状态：**P1 全部完成并可用（能出声），P2 逐词高亮未开始。**
> 本次新增：callout 支持（坑 12）、服务端 GBK 崩溃修复（坑 13，`-X utf8`）、
> 播放条布局修复（见 §2 播放条说明）。
> **2026-09-29 晚追加：TTS 提供方架构** —— 新增 Qwen3-TTS（VoiceDesign）提供方与
> 「TTS 引擎」切换（`RoutingTtsEngine` 常驻路由 + 双启动器双归属记录），
> 设计与协议见 **`qwen3-tts-integration.md`**；`readerEngine` 字段类型已从
> `GptSoVitsEngine` 改为 `RoutingTtsEngine`（GPT-SoVITS 专有能力走 `readerGptEngine`）。
> 切换引擎时自动停止上一套引擎**由插件启动的**服务（外部服务不动，只提示）；
> 路径字段带「浏览…」；Qwen 有「一键准备环境」（含 CUDA torch 检测与自愈，见该文档 §7）。
> **另**：段内按标点细分高亮已上线（`clause-highlight.ts`，显示层，实际分段不变，
> 「高亮按标点细分」开关默认开）—— P2 逐词高亮的分句级中间形态；
> 「从光标读」会在光标处截断首段（`trimSegmentAtCursor`），不再整段照读。
> **首字延迟优化（同日）**：① 预热自检请求已移除（结果被丢弃、纯浪费 ~1.5s），
> 推理验证由第一段真实合成承担，失败自动重启并从失败段重试一次
> （`autoRestartAndRetry`，每次朗读一次，会话序号防竞态）；
> ② 首段上限默认 25 → **15 字**（旧值自动迁移），并加「首段渐进」
> （`buildLimitPlan`：L_{k+1} ≤ (0.216/speed·L_k − 1.0)/0.12，无空档爬坡，仅 GPT-SoVITS）。
> 首字延迟约从 5.8s → **3.1s**（服务已运行、speed 1.0）。
>
> **流式首响（实验性，2026-09-30）**：GPT-SoVITS `streaming_mode` 做成实验开关。
> 探针实测（`.workbuddy-ai/probe-streaming.py`，9881 独立实例，60 字 ogg）：
> 首字节 **5.62s（模式 0）→ 0.69s（模式 2）→ 0.58s（模式 3）**，
> GET 路径模式 3 首字节 0.43s；代价：总合成时长 +12%(2) / +41%(3)、体积 +63%(3)。
> 两条硬约束决定了实现形态：**api_v2 无任何 CORS 头** + **requestUrl 不能流式读取**
> ⇒ 唯一可行的增量消费路径是「媒体元素直连 GET URL」（`createUrlAudioPlayback`）。
> 实现要点：流式段**不预取**（避免白跑整段合成与并发流互相拖慢）、
> 失败回退到 requestUrl 合成（媒体元素只会报通用错误，回退才能拿到服务端 JSON 里的真实原因）、
> 输出固定 ogg（分片需要可渐进解码的容器）、进度/高亮在拿不到总时长时按字数估算兜底。
> 设置项：gpt-sovits 服务组「流式首响（实验）」，默认关闭。
> 注意模式 1 在 API 模式会被服务端退化成非流式（源码注释：那是旧版语义）。
> **段间停顿已消除**：段末提前 2s（`streamLeadMs`）预开下一段的流 ——
> 依据是 RTF<1 时当前段的流早已传完、段中后期 GPU 空闲，提前请求不抢资源；
> **分段预设（同日）**：「首段渐进」开关改为预设下拉 —— `READER_SEGMENT_PRESETS`：
> 「低首字延迟」= 首段 15 字 + 爬坡（首字 ~3.1s、段间无空档）；
> 「简单分段」= 首段 25 字 + 不爬坡（优化二之前的形态）。切换预设即同时套用首段上限，
> 滑块保留为微调入口；首段上限识别为预设归属的字段是 `rampUp`。
> **播放条「缩进去」（同日修复，两次定位）**：现象是首次朗读出声的瞬间播放条被顶出视野。
先怀疑通知浮层（已顺带改成：服务准备/自动重启的进度显示在播放条自身，
`restartReaderService(silent)` 静默不弹 Notice），但那不是根因 ——
读 Obsidian 真实样式（`obsidian.asar` → app.css）确认 `.view-header` 是正常文档流元素、
不是悬浮层。真正的机制：**CM 的 `EditorView.scrollIntoView(pos, {y:"center"})` 在自身滚动
不到时，会连带滚动裁剪祖先**；播放条是 `.view-content` 的第一个子元素，容器一滚就被顶出视野。
**最终修法（从根上）**：不再用 `EditorView.scrollIntoView` —— 改用 `scrollPosToCenter()` 只设置 `cm-scroller` 的 scrollTop（居中并自行钳制），祖先容器完全不会被碰 ✓。
曾试过 `position: sticky` 兜底，却因 sticky 钉住时吃掉 `margin-top`、复位后又恢复，造成「段间更替时间隙忽有忽无」的抖动，已回退为 `position: relative`；`pinBar()`（复位 `.view-content.scrollTop`）作为兜底保留。
> **另修一个回归**：`prime()` 曾用「streamSource 函数是否存在」当流式标志，
> 而控制器始终传入该闭包（关闭流式时返回 null）→ 非流式路径预取被整体关掉，
> 段间停顿变成一整个合成耗时。已改为按**返回值**逐段判断（`isStreamed()`），并有回归用例。
> 媒体元素给不出总时长（chunked）时用字数估算（`estimateDuration`）判断时机；
> 预开的流在 advance 时直接取用，stop 时销毁未消费的预开流（有验证用例）。
>
> **播放条被遮盖的根因（同日修复）**：`.glimpse-reader-bar-message` 只有省略号、
> 没有 `min-width: 0` —— 中文无空格，其 min-content 宽度等于整串文字，
> 消息一长就把整行撑得比容器宽，右侧停止按钮被 view-content 的 overflow:hidden 裁掉
> （所以是「有时」）。已补 `min-width: 0` / `box-sizing`，并把 z-index 抬到 2
> 以压住悬浮显示时的 view-header。
>
> **朗读观感三项调整（2026-09-30）**：
> ① **去掉朗读行的整行灰底**（`.glimpse-reader-line` 不再给底色）—— 整行灰底与
> 段内高亮叠在一起、又盖住段间空隙，观感很吵；行装饰保留为可自定义挂点。
> ② **块尾标点不纳入高亮**：`ClauseSpan.textContentTo` 给出「不含尾标点的内容边界」，
> 子区间路径用它换算原文区间；整段路径（单句段、不细分）走 `segmentContentRawRange`，
> 数出段尾有几个**保留字符**是标点再回退（含连续标点 `？？`）。
> **坑**：`segment.text` 是过滤后坐标、`rawFrom`/`rawTo` 是原文坐标，段内夹被过滤字符时
> 两者差值对不上（`被 \`码\` 隔开的末尾。` 原文长 12、过滤后 8），按原文长度回退会多退几个字。
> 已知限制：段尾标点**本身被过滤掉**的写法（如 `？？**`）受映射能力限制，最多差末尾一格。
> ③ **朗读时把光标移到「正在读的那一行」的行首**（`highlight.moveCursorToLineStart`）：
> 锚的是**行首**而不是块首 —— 一段常跨多行（段落内软换行、`\n\n` 断点后的续行），
> 而 Obsidian 的「块」是整段非空文本；锚行首后，同一行内既有块更替（细分高亮推进）
> 又有段更替时，光标**每行最多只动一次**，且总落在行首。走 CM6
> `dispatch({selection})` 而不是 `editor.setCursor(line, ch)`（分段器给的是整篇偏移，
> 过 line/ch 得自己数行）；`scrollIntoView: false`，滚动仍由 `scrollPosToCenter` 独占
> （避免 CM 连带滚动裁剪祖先的老问题）。于是状态栏读数与提词器「跟踪光标」都会随朗读走。
> **锚点必须是 `to - 1` 而不是 `from`**（同日修，用户报告「该行以逗号结尾时，换行后的
> 第一段高亮时光标没更新到块首」）：子区间**可以整个跨行** —— 弱边界在累积够字数时
> 切在换行前的逗号之后，于是出现 `"主唱的\n状态更是越来越好"` 这样一个子区间。用 `from`
> 定位会把光标留在**上一行**（那正是用户看到的现象），改用 `to - 1`（正读到的那一格）
> 才落在该行行首。判据在 `.workbuddy-ai/verify-highlight.ts` §G。
> ④ **修掉跨行高亮显示错位**（同日，用户报告「只有读到每行最后一块才正常高亮」）：
> `Decoration.mark` 是**行内**装饰，一条跨行 mark 会渲染成一个横跨换行的 span
> （实测旧实现产出 `L1:"第一行内容。\n第二行内容。\n第三行内容。"` 这样一条包含 `\n` 的 mark），
> 于是同一行里只有最后一块看起来是亮的。修法：`buildDecorations` 逐行生成 mark
> （`markFrom = max(from, line.from)`、`markTo = min(to, line.to)`），空行不产 mark。
> 回归判据固化在 `.workbuddy-ai/verify-highlight.ts`（用真实 CM6 检查
> 「无 mark 跨行」「每行一条」「空行无 mark」以及光标每行只动一次）。
>
> ⑤ **「高亮完全失效」的真实根因（同日，用户报告）**：`clauseRawSpans` 换算出
> **`from > to` 的倒挂区间**，`buildDecorations` 拿到 `to <= from` 直接 `return Decoration.none`
> —— 一整段完全不亮，且**不报任何错**（所以控制台干净）。
> 触发条件很常见：**列表项 / 引用行的原文区间被 Markdown 记号撑开**，段内又有被过滤字符
> （wiki 链接、emoji 等）时，`first + span.textContentTo` 会越过段的过滤后长度，
> 而 `rawToFiltered` 是 **ceil 语义**，一越界就滑到段外，算出 `to` 小于 `from`。
> 实测：`- 列表项二，带 [[双链目标|显示别名]] 和 [[裸双链]]` → `{from:158,to:95}`；
> 引用段 → `{from:240,to:131}`；末段 3 个子区间全部倒挂。
> **修法**：新增 `segmentFilteredBounds()` 作为唯一锚点，所有子区间下标先
> `clampToSegment()` 夹回 `[start, end]` 再换算，`to` 再 `Math.max(from, …)` 兜底。
> 修后同一篇笔记 19 帧全部有高亮（`verify-reader.ts` 的
> 「回归：每个子区间的原文区间都非倒挂、且不越出段界」全段扫描守着这条）。
>
> ⑥ **纯标点段导致合成 400（同日，用户报告 `第 387 段合成失败 … 请输入有效文本`）★★**
> **症状**：个别段合成失败，服务端日志里 `实际输入的目标文本:` 后面只有一个 `…`。
> **根因**：省略号独占一行时（`第一句。\n\n…\n\n第二句。`），`consumeEnd` 已把「。」吞给上一段，
> 于是过滤后只剩 `…` 的这一行被当成**独立可朗读段**送进 TTS；GPT-SoVITS 对纯标点文本
> 直接回 `400 tts failed —— 请输入有效文本`。同类写法还有：列表里的 `- …`、整篇只有标点。
> **修法（`segmenter.ts`）**：段尾的标点串与收尾引号一律**剥掉**
> （`DROPPABLE_TAIL`，含弱边界标点；不含破折号，免得把 `——` 剥成孤零零一个），
> 剥完若整段不含字母/数字/emoji（`isSpeakable`，纯标点段）就**整段不发**；
> `trimSegmentAtCursor`（从光标读）走同一套剥法，光标之后只剩标点时返回 null。
> **连带影响**：段文本现在天然不带尾标点，于是「分段覆盖全部非空白文本」这条不变式
> 要改成「**按序消费过滤后文本，未被消费的残留只有标点/空白**」——
> `verify-reader.ts` 与 callout 段落两处都已按新口径重写，
> 并新增「任何输入都不会产出纯标点段」（6 个真实写法全扫）与「段尾不再残留句末标点串」两条回归。
>
> ⑦ **光标跟随做成设置项 + 提词器「朗读提取」模式（2026-09-30）**：
> - 新增设置 `reader.cursorFollow`（朗读页「自动滚动到当前段」**之后**，默认**关**）：
>   关掉时朗读完全不碰编辑器光标。默认关的理由：朗读会持续接管光标，
>   编辑、取词、提词器「跟踪光标」行提取都会被打断。
>   实现：`applyReaderHighlight(view, range, scroll, followCursor)` 第四参控制；
>   控制器 `applyRange()` 统一从设置读这两项下发（`autoScroll` / `cursorFollow`）。
> - 提词器新增**第四种模式「朗读提取」**：展示朗读当前正在读的块，随播放自动推进。
>   数据源是 `ReaderController.getCurrentText()`（**新增**）——从编辑器实时文档按
>   当前高亮区间切片，所以提词器展示的与实际朗读的永远一致，且 Markdown 记号能被渲染；
>   细分开启时是当前子区间，否则整段；未在朗读显示「未在朗读」占位。
>   订阅走 `readerController.subscribe()`（播放推进/换段/停止都推送，模式内按文本去重），
>   窗口卸载时退订。上一项/下一项在朗读模式是 no-op（内容由音频时钟驱动，没有 seek 能力），
>   双击跳转沿用编辑器当前光标行。
>   **去重键不能用空串**（同日修，用户报告「未朗读时默认文本排版有问题」）：
>   初值就是空串，导致「窗口一打开就是朗读模式且尚未朗读」时占位被去重掉、
>   内容元素留空（或残留别的模式的内容）。改用 `idle` 表示未在朗读，
>   并清掉 `lastText` 防止旧块以占位透明度继续留着；切模式时清键强制重渲染。
>   另加 CSS `.is-placeholder p { white-space: nowrap; word-break: keep-all }`：
>   占位文案只有 4–6 字，窗口偏窄时会被 `word-break: break-word` 拆成「一字一行」的竖排，
>   看起来像排版坏了 —— 现在保证单行居中。

---

## 0. 一句话现状

朗读功能已经**能用**：能按句合成、顺序播放、编辑器跟随高亮滚动。
用户本机的 GPT-SoVITS（声音克隆）已接通，实测用其配置合成返回 200 / 20,466 字节。

**下一步是 P2：逐词高亮。** 设计已定（见 §5），且关键前置条件已实测确认。

---

## 1. 快速上手

### 项目位置与构建

```
工程目录（就是 git 仓库根）：F:\_Workspace\Plugin-Test\.obsidian\plugins\Glimpse
构建：npm run build      # = tsc --noEmit && node esbuild.config.mjs production
      npm run dev        # 同上，不压缩
```

`main.js` 构建即产物（部署目录就是工程目录，Obsidian 直接加载）。**Glimpse 目录带 `.git`，
所以 Hot Reload 会认它**（Hot Reload 的判定是 `vault.exists(dir + "/.git") || vault.exists(dir + "/.hotreload")`）。

### 用户的本机服务

```
安装根目录：F:\_Frame\GPT-SoVITS-v2pro-20250604\GPT-SoVITS-v2pro-20250604
            ⚠️ 发行包解压成「同名双层目录」，用户设置里填的是外层，靠自动定位兜住
内嵌解释器：<根>\runtime\python.exe   （Python 3.9.13）
启动脚本：  <根>\api_v2.py             （HTTP API，非网页版 webui.py）
监听：      http://127.0.0.1:9880
```

**不要用 9880 做测试** —— 那是用户正在用的服务。验证脚本一律用 **9881+**。

### 验证工具链（重点，能省大量时间）

本机 `esbuild` 是 **0.13.12**，不支持 `--alias`（0.17+ 才有）。要在 Node 里测依赖
`obsidian` 模块的代码，用 `.workbuddy-ai/build-verify.mjs`（走 esbuild **插件 API** 的
`onResolve` 把 `obsidian` 指到 `.workbuddy-ai/obsidian-stub.ts`）：

```bash
cd F:/_Workspace/Plugin-Test/.obsidian/plugins/Glimpse
node .workbuddy-ai/build-verify.mjs .workbuddy-ai/verify-xxx.ts
node "$(node -e 'console.log(require("os").tmpdir())')/verify-out.cjs"
```

纯函数（不 import obsidian）可直接用 CLI：

```bash
./node_modules/.bin/esbuild .workbuddy-ai/verify-reader.ts --bundle --platform=node \
  --format=cjs --target=node18 --outfile=/tmp/v1.cjs && node /tmp/v1.cjs
```

**两个必须知道的约束**：
- 涉及 `GptSoVitsEngine` 的脚本要先桩 `window`：
  `(globalThis as any).window = { setTimeout, clearTimeout }`（引擎超时用了 `window.setTimeout`）
- **CJS 输出不支持顶层 await**，脚本要包进 `async function main()`

### 现有验证脚本（`.workbuddy-ai/`）

| 脚本 | 覆盖 |
| --- | --- |
| `verify-reader.ts` | 过滤管线 + 分段器 + 细分高亮（映射不变式、边界情况、callout、光标截断、块尾标点两条路径、爬坡表、预设） |
| `verify-segmenter.ts` | **分段器的「可发声性」**：任何输入都不产出纯标点段、段尾不残留标点串、「从光标读」截断同理（线上事故回归） |
| `verify-highlight.ts` | **朗读高亮装饰器（真实 CM6）**：跨行区间必须按行切成 mark、空行不产 mark；光标落在行首且每行只动一次 |
| `verify-playback.ts` | 段队列（30 项：预取/顺序/取消/失败/暂停/autoplay 拦截） |
| `verify-service-ownership.ts` | 归属持久化与「插件重载后认领」 |
| `verify-pipe-fix.ts` | **Errno 22 根因复现 + 文件重定向修复验证** |
| `verify-reload-survival.ts` | 重载后服务存活 + 日志可读（18 项） |
| `verify-health.ts` | 健康度跟踪与重置 |
| `verify-launcher-path.ts` | 安装根目录校验 + 双层目录定位 + spawn 失败快速中止 |
| `verify-voice-pairing.ts` | 权重扫描配对 + 真实加载合成 |
| `verify-qwen-engine.ts` | Qwen3-TTS 引擎协议（Node 桩服务，14 项） |
| `verify-qwen-launcher.ts` | Qwen 启动器真实 spawn（脚本写入/失败根因/关停，14 项） |
| `verify-qwen-setup.ts` | 一键环境准备（py -0p 解析/Python 挑选/模型目录扫描，7 项） |
| `verify-native-dialog.ts` | 原生对话框路径解析 + 按基名配对 |
| `verify-ref-path-forms.ts` | `ref_audio_path` 四种写法实测 |
| `verify-e2e.ts` | 分段健全性 + 真实合成 + RTF |
| `experiment-*.ts` | 两个被证伪的假设（ogg 污染、跑若干次退化） |
| `diagnose-tts.ts` | 起自建服务并打印 traceback |

---

## 2. 已实现

### 分层

```
┌─ 文档层 ────────────────────────────────────────────────┐
│ text-pipeline  偏移保持过滤 → { text, map, forcedBreaks } │
│ segmenter      强/弱/硬上限三级分段 + 映射回原文区间        │
└─────────────────────────────────────────────────────────┘
┌─ 合成层 ────────────────────────────────────────────────┐
│ tts/gpt-sovits  probe / synthesize / setWeights / cancel │
│ tts/service-launcher  起停、归属、日志、健康度             │
└─────────────────────────────────────────────────────────┘
┌─ 调度层 ────────────────────────────────────────────────┐
│ playback  SegmentQueue：预取窗口 + 顺序播放 + 代际取消      │
└─────────────────────────────────────────────────────────┘
┌─ 同步层 ────────────────────────────────────────────────┐
│ highlight  CM6 段级装饰器（行 + 区间）+ scrollIntoView     │
└─────────────────────────────────────────────────────────┘
```

### 文件清单（`src/reader/`，约 3,900 行）

| 文件 | 职责 |
| --- | --- |
| `settings-types.ts` | 设置类型与默认值（默认值均有实测依据） |
| `text-pipeline.ts` | 偏移保持过滤 + `PositionMap` + 空白折叠 + 结构断点 |
| `segmenter.ts` | 分段 + 映射回原文 |
| `playback.ts` | `SegmentQueue` + `AudioPlaybackFactory`（可注入假播放器） |
| `highlight.ts` | CM6 `StateField` + `setReaderHighlight` effect |
| `controller.ts` | 编排：配置自检 → 服务自检 → 分段 → 队列 → 高亮 |
| `player-bar.ts` | 注入 `view.contentEl` 顶部的播放条 |
| `diagnostics.ts` | 环境诊断（6 项） |
| `node-bridge.ts` | `require` 解析、`isWindows`、`isProcessAlive`/`killProcess` |
| `native-file-dialog.ts` | 原生文件对话框（三级降级） |
| `reference-audio-modal.ts` | 参考音频选择 + 导入到插件目录 |
| `voice-picker-modal.ts` | 音色按配对选择 |
| `tts/types.ts` | `TtsEngine` 契约 + 服务状态/健康度类型（两个启动器共用） |
| `tts/gpt-sovits.ts` | GPT-SoVITS 实现 |
| `tts/qwen3-tts.ts` | Qwen3-TTS（VoiceDesign）实现 |
| `tts/router.ts` | `RoutingTtsEngine` 常驻门面：按 provider 路由，切换引擎不改队列持有的引用 |
| `tts/qwen-launcher.ts` | Qwen 推理服务生命周期 + 归属 + `/health` 就绪轮询 |
| `tts/qwen-server-script.ts` | `reader-qwen-server.py` 的脚本内容（启动器写入插件目录） |
| `tts/http-utils.ts` | 引擎共享：魔数嗅探、JSON 错误体提取 |
| `tts/service-launcher.ts` | 服务生命周期 + 归属 + 日志 + 健康度 |
| `tts/service-record.ts` | 归属落盘（按提供方各存一份） |
| `tts/audio-scanner.ts` | 扫描候选音频 |
| `tts/weight-scanner.ts` | 扫描权重并按音色配对 |

### 命令（10 条，`id` 前缀 `reader-`）

| 命令名 | id |
| --- | --- |
| 朗读：从头读 / 从光标读 / 读选区 | `reader-read-from-top` / `-cursor` / `-selection` |
| 朗读：播放/暂停 / 停止 | `reader-toggle-play` / `reader-stop` |
| 朗读：启动本地服务 / 停止 / 强制停止（按端口）/ 重启 | `reader-start-service` / `-stop-service` / `-force-stop-service` / `-restart-service` |
| 朗读：环境诊断 / 查看服务日志 / 应用设置的音色 | `reader-diagnostics` / `-service-log` / `-apply-voice` |
| 朗读：预览分段（不发声） | `reader-preview-segments` |

### 设置页

「朗读」标签页，分组：服务 / 声音 / 朗读 / 分段 / 内容过滤（20 个过滤开关）。
服务状态行显示：`进程状态 · 推理健康度 · 当前音色`，带颜色点（绿=正常/橙=启动中/红=推理失败/灰=停止）。

---

## 3. 已实测验证的关键结论

**这些数字直接决定了参数取值，不要凭感觉改。**

### 性能（GPT-SoVITS，RTX 3060，v2ProPlus）

| 字数 | 合成耗时 | 音频时长 | RTF |
| --- | --- | --- | --- |
| 2 | 1.50s | 1.54s | **0.97** |
| 7 | 1.88s | 3.54s | 0.53 |
| 39 | 4.42s | 8.42s | 0.52 |
| 72 | 9.39s | 17.66s | 0.53 |

- `合成耗时 ≈ 1.0s（固定） + 0.12s × 字数`；字数 ≥7 后 **RTF ≈ 0.52**（合成比播放快一倍）
- **极短句不划算**（2 字 RTF 0.97）→ 印证「弱边界 ≥36 字」阈值选得准
- **首句延迟是唯一体感瓶颈** → 首段单独设 25 字上限

### 语速上限 2.0x

`speed_factor` 缩短音频但**不缩短合成耗时**，RTF 线性恶化：
0.8→0.43、1.0→0.48、1.25→0.58、1.5→0.77、**2.0→0.97**。超过 2.0 必然卡顿。

### 格式

| media_type | 状态 | 39 字体积 |
| --- | --- | --- |
| `ogg` | ✅ | **64,505 B** |
| `wav` | ✅ | 538,924 B |
| `aac` | ✅ | 146,934 B |
| `raw` | ✅ | 裸 PCM |
| `mp3` | ❌ **400** | 服务端不支持 |

→ 用 `ogg`（体积 1/8.4，无延迟代价）。

### `ref_audio_path` 四种写法都被接受（实测）

绝对路径（安装根内/外）、相对安装根目录、相对路径用正斜杠 —— **全部 200**。
→ 不需要在安装目录下新建文件夹。真正要避开的只有 `TEMP/gradio/`（Gradio 临时目录会被清理）。

### 权重必须配对，但**错配不会报错**

故意错配（A 的 GPT + B 的 SoVITS）→ `/set_*_weights` 返回成功、**合成也返回 200 + 音频**。
只是音色是错的。这种静默错误比直接失败更难发现 → 所以做成了「按音色成对选」。

### 端点（实测）

| 端点 | 结果 |
| --- | --- |
| `POST /tts` | ✅ |
| `GET /set_gpt_weights?weights_path=` | ✅ 200 `{"message":"success"}` |
| `GET /set_sovits_weights?weights_path=` | ✅ |
| `GET /set_refer_audio` | ✅ 存在但**不影响后续请求**（`ref_audio_path` 必须每请求携带） |
| `GET /control?command=restart\|exit` | ✅ |

### 环境能力（Obsidian 内实测）

| 项 | 结论 |
| --- | --- |
| 插件内 `require("child_process")` + spawn | ✅ 可用 |
| `requestUrl` 连 `127.0.0.1` | ✅ 绕过 CORS；**但 `RequestUrlResponsePromise` 没有 `abort()`** |
| `decodeAudioData` | ✅ 0.1 秒静音解出 0.100 秒 @ 48kHz |
| `speechSynthesis` 的 `boundary` | ✅ **触发且是词级**：`sentence@0+0, word@0+2, word@2+3` |
| `getVoices()` | ⚠️ 首次常返回 0（Chromium 异步填充），speak 后再查才有值 |
| 原生文件对话框 | ✅ 走 `electron.remote.dialog.showOpenDialogSync` |
| Obsidian 的 Electron 版本 | **43.3.0 / Chrome 150**（从 exe 二进制读到） |

---

## 4. 踩过的坑（必须知道，否则会重踩）

### 坑 1：服务 stdout 用管道 → 插件重载后服务必坏 ★★★

**症状**：服务跑一阵子后所有合成都报
`tts failed —— [Errno 22] Invalid argument`；换任何参考音频/文本/格式都一样；
但换一个不存在的参考音频会返回**正常的校验错误**（说明服务没死）。

**根因**：`spawn` 时用 `stdio: ["ignore","pipe","pipe"]`，管道读端由插件实例持有。
插件一重载（热重载/重启 Obsidian），旧实例被回收 → 读端关闭 →
服务下次写 stdout（tqdm 进度条、print）抛 `OSError: [Errno 22] Invalid argument`
（Windows 上写已关闭管道的典型表现）→ 之后推理全失败。

**修法**：`stdio: ["ignore", logFd, logFd]`，输出重定向到
`<configDir>/plugins/<id>/reader-service.log`；父进程 spawn 后立刻 `closeSync(fd)`。

**别回退这个改动。** 验证脚本 `verify-pipe-fix.ts` 能确定性复现（主动 destroy 父侧流）。

> 注：`Errno` 不是拼写错误 —— 那是 Python `OSError` 的标准格式（`[Errno N] 描述`），
> 源自 POSIX `errno.h`。`errno 22` = `EINVAL` = "Invalid argument"。
> 服务端代码 `api_v2.py:444` 把 `str(e)` 塞进 `Exception` 字段。

### 坑 2：`requestUrl` 没有 `abort()`

已核对上游最新官方 `obsidian.d.ts`：`RequestUrlResponsePromise` 只加了
`arrayBuffer/json/text`，**没有 abort**。取消只能用「代际计数 + 丢弃结果」。
→ 保持段短（≤150 字）可把浪费控制在 ~19s 以内。

### 坑 3：本机 `obsidian` 类型包是 0.14.8（很旧）

运行时远比它新。已因此踩过：`Platform.isWin` 不存在（用自写的 `isWindows()` 代替）。
**用新 API 前先核对上游 d.ts**（`/tmp/obsidian-latest.d.ts` 是之前下载的副本）。

### 坑 4：Python 子进程的 stdio 编码（**已改为 UTF-8**）

原状：Windows 中文环境下服务 stdout 是 GBK，按 UTF-8 解会把中文路径变成乱码
（`MyGO_千早爱音_v2pp.ckpt` → `MyGO_ǧ�簮��`）。

**2026-09-29 起 spawn 参数加了 `-X utf8`（见坑 13），服务输出已经是 UTF-8。**
`decodeConsoleChunk()` 仍是「先用**严格 UTF-8**（`fatal:true`）试，抛错再按 GBK 解」，
所以两种编码都能吃，不需要改。**并且必须按字节累积、只在完整 `\n` 处切行再解码** ——
否则被 chunk 边界劈开的多字节字符会误判。

### 坑 5：发行包是「同名双层目录」

`F:\_Frame\GPT-SoVITS-v2pro-20250604\GPT-SoVITS-v2pro-20250604\` —— 用户很容易只填到外层。
`resolveInstallRoot()` 会自动往下探一层；**诊断与启动必须共用同一套判定**
（曾因诊断直接用原始 installRoot 而误报「找不到 python.exe」）。

### 坑 6：`spawn` 的 `error` 事件 ≠ `exit` 事件

ENOENT 走 **`error` 事件，不触发 `exit`**。就绪轮询若只监听 `exit`，会白等满 120 秒超时。
必须单独记录 `spawnError` 并在轮询里优先判断。spawn 也可能**同步抛错**（如 EFTYPE），
所以 `try/catch` 与 `error` 监听两条路都要有。

### 坑 7：报错信息别丢字段

服务返回 `{"message":"tts failed","Exception":"[Errno 22] ..."}`，
只取 `message` 会丢掉真正原因。`extractJsonError()` 现在会把 `Exception` 一并拼上。
**这条如果早就有，第一轮排查就能直接看到根因。**

### 坑 8：诊断「端口可达」≠「服务可用」

坏状态下端口照样返回 400。所以诊断加了「语音合成自检」——真的合成一小段。
同理，服务状态行把**进程状态**与**推理健康度**分开显示。

### 坑 9：验证脚本别用 9880

那是用户正在用的服务。撞端口会让 `ensureRunning` 走「复用外部服务」分支，
测试看着全挂但其实是环境冲突（曾误判为代码 bug）。**用 9881+。**

### 坑 10：`probe()` 的健康探测技巧

不要假设有 health 端点：**发一个故意不合法的请求，拿到任何 HTTP 状态码就说明服务活着**
（连不上才是没起来）。实现是 `POST /tts` 空体 → 期望 400。

### 坑 11：测试用假引擎/假播放器

`SegmentQueue` 的音频播放抽成了 `AudioPlaybackFactory`，所以能在 Node 里注入假播放器
完整验证预取/顺序/取消/失败/暂停。**新写涉及播放的逻辑请保持这个可注入设计。**

### 坑 12：引用块里的行级规则会整行失配 ★★

**症状**：callout（`> [!note] 标题`）被念成「`[!note]` 标题」；callout 里的代码块、
表格、列表记号**全都没被过滤**。

**根因**：`markFencedCode` / `markTables` / `markHeadingMarks` / `markListMarks` 都直接拿
**原始行文本**做行首判定，而引用块里的结构全部带 `> ` 前缀（`> ```js`、`> | a | b |`、
`> - 项`）→ 正则 `^\s{0,3}…` / `^#…` / `^(\s*)(?:[-+*]…)` 一律失配。

**修法**：抽出 `quotePrefixLength(text)`，所有行级规则（含 `collectStructuralBreaks`
与 `markLineFilters` 的前缀判定）先剥掉 blockquote 前缀再判定，drop 时把偏移加回去。

**顺带的一个隐蔽坑**：残留的 `[!note]` 不只是被念出来 —— 里面的 `!` 会被分段器当成
句末感叹号（`STRONG_END = /[。！？!?]/`），于是 `[!note] 标题` 被切成 `[!` + `note] 标题`
两段碎段。**修 `[!type]` 剔除时这条会一起消失，但别只盯着「被念出来」这一个症状。**

**取舍**：`[!xxx]` 出现在引用块**非首行**时也会被剔除（Obsidian 那时不渲染成 callout）。
这种写法在正文里几乎不会是「想朗读的文字」，所以选了更安全的一侧；要读字面量可以转义。

### 坑 13：服务端 `print()` 遇 GBK 编不出的字符 → 整个请求 400 ★★★

**症状**：某些笔记的某些段合成失败，报
`服务返回错误：tts failed —— 'gbk' codec can't encode character '\ua7a8' in position 40: illegal multibyte sequence`。
换个笔记就正常，看起来像「随机坏」。

**根因**：服务内部有多处 `print(目标文本)`（`GPT_SoVITS/TTS_infer_pack/TextPreprocessor.py:83`
与 `:113`、`inference_webui.py:841` 等）。spawn 用的是 `python -I`，
而**中文 Windows 上被重定向到文件的 stdout 默认是 GBK** ——
文本里只要出现 GBK 编不出的字符（实测 `U+A7A8`），`print` 就抛 `UnicodeEncodeError`，
冒泡到 `api_v2.py:444` 被包成 `{"message":"tts failed","Exception":…}`。

**修法**：spawn 参数加 `-X utf8`（UTF-8 模式 → stdio 与 `open()` 默认都变 UTF-8）。

> **为什么不能用 `PYTHONIOENCODING`**：`-I` 是隔离模式，隐含 `-E`，会**忽略全部 `PYTHON*`
> 环境变量**。命令行 `-X` 不受影响。已实测两种组合：
> `-I` → `sys.stdout.encoding == 'gbk'`（打印该字符抛错）；`-I -X utf8` → `'utf-8'`（正常）。

**怎么定位这类问题**（不用猜）：服务日志里出错的请求会**断在打印语句那一行**。
实测日志结尾是 `实际输入的目标文本:` 后面直接空掉，紧跟 `POST /tts 400` —— 一看就知道是
打印文本本身炸了。复现脚本 `.workbuddy-ai/repro-gbk.cjs`（对运行中的服务发一次带该字符的请求）。

**验证方式**：`.workbuddy-ai/verify-utf8-e2e.cjs` —— 用新参数在 **9881** 起独立实例，
发含 `U+A7A8` 的请求。修复前 400，修复后 **200 / 33,174 字节**；同实例的正常中文请求 200 / 43,261 字节。

### 坑 14：参考音频过短 → AR 对齐滑移吞掉内容；150 字触发提前 EOS ★★

**症状**：个别音色朗读时内容缺失（用户报告「只读后半段」）。

**实测**（2026-09-29，`.workbuddy-ai/bench-voices.py`，9881 独立实例，7 套音色 × 25/50/100/150 字，
完整度 = 音频时长 / (0.216s × 字数)）：

| 因素 | 数据 |
| --- | --- |
| **短参考（1.5s「撮れてないよな」）+ 八幡海鈴** | 25 字完整度仅 **28%**（音频 1.5s ≈ 只说了 7 个字），50 字 52% |
| **同一权重换 8s 长参考（prompt 严格匹配）** | 25/50/100 字稳定在 **83–84%** —— 对齐滑移消失 |
| **所有音色 × 150 字** | 全部骤降到 45–72%（100 字时 74–104%）；日志 `T2S Decoding EOS [132 -> 486]` 显示 150 字只生成 ~354 token 就提前 EOS（上限 1500 没碰到）——**cut0 长文本的尾部直接丢失** |

**根因两条**：
1. **参考音频过短**（1.5s，官方建议 3–10s）：AR 模型对齐滑移，以为目标文本开头已经说过 → 从中间开读；
   权重间敏感度差异大（高松灯短参考 80% 正常，八幡海鈴 28% 崩坏）→「个别模型」的来源。
2. **长文本提前 EOS**：v2ProPlus 在 cut0 下超过 ~100 字就会提前结束生成，与音色无关。

**修法（三条，2026-09-29 追加第三条后验证）**：
1. 换 3–10 秒、与参考文本**逐字一致**的参考音频（reader-voice 里现成的两条长日文音频都行）；
2. 单段上限从 150 降到 ≤100；
3. **参考文本留空**（无文本提示模式）——实测短参考下八幡海鈴完整度 28% → **111%**、
   高松灯 96–107%，全部完整。机制印证：吞内容来自「文本与音频不匹配的对齐滑移」，
   不给文本就没有错配源。api_v2 无 `ref_free` 参数（那是 webui 的），核心支持在
   `TTS.py:1113`（`no_prompt_text`，仅 SoVITS V3 禁用）；api_v2 对 `prompt_lang` 仍必填。
   插件已放开客户端校验（原来 validateConfig 会拦空参考文本），引擎对空 prompt_lang 兜底到朗读语种。

---

## 5. 下一步：P2 逐词高亮

### 已定的设计（**不依赖任何 provider 时间戳**）

这是整个方案的关键取舍：Note Reader 之所以脆弱，是因为它把逐词高亮建立在
「provider 必须提供时间戳」上（`boundary` 事件在 Windows 不可靠 / Edge 的 `WordBoundary`
是私有接口）。我们反过来：

1. **段级同步是精确的** —— 段是我们自己切的，什么时候开始播完全知道
2. **段时长是精确的** —— `AudioContext.decodeAudioData(bytes)` → `AudioBuffer.duration`
   （已实测可用：0.1 秒静音解出 0.100 秒 @ 48kHz）
3. **段内按权重摊分** —— 复用 `src/music/lrc.ts` 的 `WORD_SPLIT_REGEX`
   （CJK 单字拆、拉丁整词）拆词，按权重摊分 `[0, duration)`：

   | 词类型 | 权重 |
   | --- | --- |
   | CJK 单字 | 1.0 |
   | 拉丁词 | `max(1, ceil(len / 3))`（近似音节数） |
   | 数字串 | 按位数计 |
   | 标点 | 0.5（并作为停顿） |

4. **误差不累积** —— 每段起点都被音频时钟重新锚定，误差只可能出现在**单段内部**
   （通常几十字）。Note Reader 是全文档一条时间轴，误差会一路累积。
5. **渐进增强** —— `boundary` 事件实测可用且是词级（`word@0+2`），
   可作为**校正**叠加在估算之上；但**不能成为依赖**。

### 建议的实现落点

- 新增 `src/reader/word-timing.ts`：`buildWordTimings(segmentText, rawFrom, map, durationSeconds) → WordTiming[]`
  （纯函数，可用 `verify-reader.ts` 那套方式验证）
- `playback.ts`：`AudioPlayback` 增加 `onTimeUpdate` 已有；把 `currentTime/duration`
  与词时间轴对齐，算出当前词下标，回调出去
- `highlight.ts`：段级装饰器基础上叠加 `Decoration.mark` 标当前词
  （现有 `readerHighlightField` 已经是 `StateField`，扩展它即可）
- 设置页加「逐词高亮」开关与主题（配色放 `styles.css` 的 `/* #region reader */` 段，
  用户可用 CSS 片段覆盖）

### 需要注意

- `speed_factor` 会改变音频时长 → **必须读实际解码时长**，不能按字数估算
  （已实测：0.8x→10.46s，1.5x→5.72s，2.0x→4.38s，同一段文本）
- `decodeAudioData` 对 ogg 的兼容性**未单独验证**（只验证过 wav 与整体可用性）。
  若 ogg 解码有问题，退路是 `media_type: "wav"`（体积大 8 倍但解码最直接）
- 播放条现在只显示段级进度；逐词高亮后可以考虑加「当前词」的视觉强调

---

## 6. 已知限制与未验证项

| 项 | 状态 |
| --- | --- |
| **只有段级高亮，没有逐词** | 待 P2 |
| 阅读视图（Reading）不支持 | Glimpse 全项目就只支持 Source / Live Preview；Glimpse 的装饰器是 CM6 的 |
| 朗读时编辑文档 | 已修：变更链（`ChangeSet.compose`）在坐标出口换算 → 高亮/提词器不再整体偏移；**段队列仍不重排**，已在合成/播放中的段仍是编辑前的文字 |
| 没有位置持久化（续读） | 未实现 |
| 没有音频文件导出 | 未实现（在线 provider 才可行，本地 wav/ogg 可直接落盘） |
| 没有统计 | 未实现 |
| `decodeAudioData` 对 ogg 的兼容性 | 未单独验证 |
| 显存实际占用 | 只测过 RSS ≈ 1.15–2.7 GB，显存未测 |
| `streaming_mode` 1/2/3 的分片行为 | 未测（一直用 `false`） |
| 版本号 | 仍是 **1.0.10**，朗读功能**尚未发版** |
| **朗读模块代码一行都没提交** | `git status` 显示 15 项变更未提交 |

---

## 7. 用户当前配置（可直接复用）

```jsonc
// data.json → reader.tts
"baseUrl":     "http://127.0.0.1:9880",
"installRoot": "F:\\_Frame\\GPT-SoVITS-v2pro-20250604",        // 外层，靠自动定位
"gptWeights":  "...\\GPT_weights_v2ProPlus\\MyGO_千早爱音_v2pp.ckpt",
"sovitsWeights":"...\\SoVITS_weights_v2ProPlus\\MyGO_千早爱音_v2pp.pth",
"refAudioPath":"<vault>\\.obsidian\\plugins\\glimpse\\reader-voice\\あ、そうだ！…です.mp3",
"promptText":  "あ、そうだ！凛々子さん、これ見てください！お花見の時に迷子のみんなで集合写真を撮ったんです",
"promptLang":  "ja",
"textLang":    "zh",
"mediaType":   "ogg"
```

已训练音色 **7 套**（全 v2ProPlus）：MyGO 高松灯/千早爱音/椎名立希/长崎素世，
Mujica 八幡海鈴/若葉睦/豊川祥子_白。

---

## 8. 文档索引

| 文档 | 内容 |
| --- | --- |
| `docs/note-reader-analysis-and-reimplementation.md` | Note Reader 的实现分析（CC BY-ND，不能照抄）+ 复刻路线 |
| `docs/tts-provider-plan.md` | 参考 zhuomianling 的本地服务模型；provider 选型与分层方案 |
| `docs/gpt-sovits-integration.md` | GPT-SoVITS 接管可行性的完整实测记录 |
| `docs/qwen3-tts-integration.md` | Qwen3-TTS（VoiceDesign）桥接协议、引擎切换架构与验证状态 |
| `CONTEXT.md` | 项目术语表（含朗读模块词条） |
| `.workbuddy-ai/memory/2026-09-28.md` | 本次开发的详细工作日志（含所有实验与结论） |

---

## 9. 建议的下一步顺序

1. **P2 逐词高亮**（设计已定，见 §5）—— 这是用户明确想要的下一个功能
2. **朗读中编辑文档的位置处理** —— 目前是隐患
3. **位置持久化（续读）** —— 存**段索引 + 段内偏移**，不要存秒数
4. **提交与发版** —— 代码尚未提交，版本仍是 1.0.10
