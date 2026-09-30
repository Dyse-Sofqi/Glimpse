# TTS 方案：参考 zhuomianling 的本地服务模型

> 承接 `note-reader-analysis-and-reimplementation.md`。上一篇确定了 Glimpse 要做「朗读 + 逐词高亮」，并指出 Note Reader 的 TTS 有两个硬伤：**在线走逆向私有接口**、**词级时间戳依赖不可靠的 provider 事件**。
>
> 本文分析 `F:\_Workspace\GitHub-Project\zhuomianling`（桌面灵）的语音实现，提炼出**能同时解决这两个硬伤**的 TTS 方案。
>
> 关键结论：它把 TTS 从「逆向别人的私有接口」换成了「**调用本机的 HTTP 服务**」，并**彻底放弃词级时间戳、只做句级同步**。这两点合起来，反而让逐词高亮变得可行且不依赖任何 provider 特性。

---

## 0. 结论摘要

1. **桌面灵是 MIT 许可的完整源码项目**（`LICENSE` 为 MIT，第三方资产另有 `NOTICE` 声明）。项目自有代码可自由借鉴、复制、改造——与 Note Reader 的 CC BY-ND 是**完全不同的约束等级**。
2. 它的 TTS 是**本地 HTTP 服务模型**：插件不实现语音合成，只向本机 GPT-SoVITS 服务发 HTTP 请求拿音频字节。**没有任何逆向接口、没有 ToS 风险、不依赖云端可用性。**
3. 它**完全没有词级时间戳**——`voiceReplyMode` 硬编码为 `"sentence"`，全库检索 `boundary` / `WordBoundary` / `charIndex` 在语音语境下零命中。文本与语音的同步是**句级**的。
4. 它最有价值的一块是 `StreamingVoiceCommitter`：一套**流式累积文本 → 完整句段**的提交器，带中英混排的边界规则（强边界标点、弱边界需 ≥36 字、硬上限 80 字）、前缀单调性校验、以及「已提交的段永不重复提交」的保证。**这套规则对中文笔记直接可用。**
5. 它的工程健壮性值得整套搬：`AbortController` + 超时 + 显式中止原因、**预热**、配置快照缓存（TTL + LRU）、有界重试、**音频魔数嗅探**（防「HTTP 200 但返回的是 JSON 错误体」）。
6. 它的预设语音缓存用**内容哈希 + 声音指纹**做键，并把「文本变了」标记为 `stale` 而非直接删除——这是「音频落盘复用」的正确姿势。
7. 它**缺**的正好是「阅读器」需要的：长文队列、位置映射、跳转/倒退/续读。这些由我们自己的方案补（上一篇的 `text-pipeline` + `PositionMapper`）。
8. **推荐方案**：句级合成 + 句级精确同步 + **句内按权重分配时间轴** → 得到词级高亮。因为每句的音频时长可以**精确测量**（`decodeAudioData`），句内误差不累积，精度远好于 Note Reader 的全文档时间轴。且**对 provider 零要求**——任何能返回音频的 TTS 都能用。

---

## Part A — 桌面灵的语音实现分析

### A1. 定位与许可

- 项目：Live2D 桌宠框架（Electron + Vite，主进程 / 渲染进程 / sidecar 三部分）。
- `LICENSE`：**MIT**。项目自有代码无使用限制。
- `NOTICE`：仅 Live2D Cubism runtime 与记忆运行时（CPython + ONNX + BGE 模型）有额外条款，**与语音实现无关**。
- 语音分两条独立链路，本文只取输出侧：
  - **输入（ASR）**：腾讯云实时语音识别（`src/main/services/speech/speechToText.ts`，812 行）—— 与 Glimpse 无关，跳过。
  - **输出（TTS）**：本机 GPT-SoVITS（`src/main/services/speech/textToSpeech.ts`）—— **本文主体**。

### A2. TTS 提供方模型：本地 HTTP 服务

核心设计：**插件不做语音合成，只做 HTTP 客户端。**

```
渲染进程 (useVoiceReplyQueue)
    │  IPC: window.desktopPet.textToSpeech.speak({petId, text, requestId, sessionId})
    ▼
主进程 (textToSpeech.ts)
    │  POST http://127.0.0.1:9880/tts   ← 本机 GPT-SoVITS 服务
    ▼
GPT-SoVITS 本地进程（独立部署，用户自己启动）
    └─ 返回音频字节 → base64 → IPC → 渲染进程播放
```

配置来源两级（`resolvePetVoiceConfig`）：
1. **per-pet 配置** `{userData}/pets/{petId}/pet.local.json` 的 `voiceModelSettings`（用户在设置页填的参考音频/参考文本）；
2. 回退到 `config/tts.local.json` 的 `provider: "gpt-sovits"` + `pets[petId]` 静态配置。

配置形状（`GptSoVitsPetConfig`）：

| 字段 | 含义 |
| --- | --- |
| `baseUrl` | 服务地址，默认 `http://127.0.0.1:9880` |
| `apiMode` | `"v2"`（新）或 `"beta"`（旧），决定 URL 与请求体字段名 |
| `refAudioPath` | **参考音频路径**（3–10 秒）—— 声音克隆的声源 |
| `promptText` / `promptLang` | 参考音频对应的文本与语言 |
| `textLang` | 待合成文本的语言 |
| `textSplitMethod` | 默认 `"cut5"`（GPT-SoVITS 的切分策略） |
| `mediaType` | `wav`（默认）/ `mp3` / `ogg` / `aac` —— **注意：本机实测 GPT-SoVITS 服务实际拒绝 `mp3`（400），可用 `wav`/`ogg`/`aac`/`raw`，推荐 `ogg`。见 `gpt-sovits-integration.md` §1.5** |

> **已补充实测**：本机 GPT-SoVITS 的接管可行性、端点、延迟与语速上限已实测，见 **`gpt-sovits-integration.md`**。结论：插件可完全脱离网页驱动推理，模型可运行时热切换，语速上限 2.0x。

两种请求体（同一份语义，字段名不同）：

```jsonc
// apiMode: "v2"  →  POST {baseUrl}/tts
{ "text", "text_lang", "ref_audio_path", "prompt_text", "prompt_lang",
  "text_split_method", "media_type", "streaming_mode": false }

// apiMode: "beta" →  POST {baseUrl}/
{ "text", "text_language", "refer_wav_path", "prompt_text", "prompt_language" }
```

注意 `streaming_mode: false`——**它没有用服务端的流式输出**，而是靠客户端「按句请求 + 预取」实现等效的流式体验（见 A5）。这是个务实的取舍：服务端流式在各版本 GPT-SoVITS 上行为不一，客户端分句更可控。

### A3. 生命周期与健壮性（可直接复用的模式）

| 机制 | 实现要点 |
| --- | --- |
| **每请求可中止** | 每个请求一个 `AbortController`；中止原因显式枚举：`"renderer"` / `"owner-destroyed"` / `"replaced"` / `"timeout"` |
| **超时** | `textToSpeechTimeoutMs = 45_000`；超时走 `abort("timeout")`，错误码 `TIMEOUT`（与用户取消 `CANCELED` 区分） |
| **同 key 替换** | 同 `(petId, requestId)` 的新请求会**先中止**旧请求（`detachTextToSpeechEntry(existing, "replaced")`） |
| **属主追踪** | `WeakMap<WebContents, OwnerState>`；监听 `render-process-gone` / `destroyed`，渲染进程消失时自动清空其所有请求（防泄漏） |
| **配置快照缓存** | 按 `(petId, sessionId)` 缓存已解析的配置 Promise；**上限 128 条 LRU** + **10 分钟 TTL**（`unref()` 定时器，不阻止进程退出） |
| **预热** | `warmUpTextToSpeech(petId)`：用一句极短文本（`"嗯。"` / `"うん。"` / `"Mm."`，按语言）先打一次请求，把模型的首次推理开销挪到用户真正播放之前 |
| **预热与正式请求互斥** | 正式合成前会 `abort` 该 pet 的预热请求（`abortWarmup`），避免抢占 GPU |
| **错误分级** | `code: "CANCELED" \| "TIMEOUT" \| "INVALID_CONFIG"`；配置类错误**只上报一次**（`voiceConfigurationErrorRequestRef`），避免刷屏 |
| **错误文本净化** | `sanitizeVoiceDiagnosticText(raw, 600)` 截断并清洗上游错误，再经 `toUserFacingGptSoVitsError` 转成用户能懂的话 |
| **错误体上限** | 只读前 `16_000` 字符（`maximumGptSoVitsErrorBodyChars`） |

### A4. 分句：`StreamingVoiceCommitter`（最值得抄的一块）

输入是**累积文本**（不是增量），输出是**新提交的完整句段数组**。

```ts
class StreamingVoiceCommitter {
  private latestText = "";
  private committedOffset = 0;
  private revisionDetected = false;

  append(cumulativeText): string[]   // 流式追加
  finalize(finalText?): string[]     // 收尾，flush 尾部
  hasRevision(): boolean
}
```

边界规则（这是精华）：

| 级别 | 规则 | 常量 |
| --- | --- | --- |
| **强边界** | `。！？!?`；英文句点（带守卫）；`……` | — |
| **弱边界** | `、，,；;` —— **但仅当已累积 ≥ 36 字** | `secondaryBoundaryMinimumCharacters = 36` |
| **硬上限** | 累积到 **80 字**必须断开 | `hardSegmentMaximumCharacters = 80` |

细节设计：
- **英文句点守卫** `isEnglishPeriodBoundary`：`. ` 两侧都是数字 → 不是边界（保护 `3.14`）；连续点 ≥3 个视为省略号处理，只认最后一个点。
- **吞掉句尾附加符** `consumeSentenceEnding`：先吞 `。！？!?.…~～`，再吞右引号/右括号 `”’」』）》】）]}` —— 保证断句不会把收尾标点甩到下一段。
- **前缀单调性校验**：新文本必须以上次文本为前缀，否则 `revisionDetected = true` 并**停止提交**（流式输出被上游改写时的安全阀）。
- **已提交不重复**：`committedOffset` 单调前进，段永不重复返回。

**这套规则对中文笔记的价值**：36/80 字阈值让中文不会被逗号切得过碎，也不会出现超长段（TTS 单次请求过长会显著变慢甚至超时）。Note Reader 用的是 `Intl.Segmenter` 纯句级切分，对「一句话 200 字的中文段落」没有保护。

### A5. 播放队列：预取与顺序保证

`src/renderer/pet-window/useVoiceReplyQueue.ts`（905 行）的核心：

| 常量 / 机制 | 值 / 说明 |
| --- | --- |
| `synthesisLookahead` | **3** —— 边播当前段，边合成后面 3 段（`primeItems` 只对队首 N 项触发合成） |
| `segmentMaxAttempts` | **3** —— 单段最多试 3 次 |
| `segmentRetryBaseMs` | **220** —— 退避 `220 * attempt` 毫秒 |
| 音频播放 | `<audio>` + `URL.createObjectURL(blob)`；`pendingUrlsRef` 追踪所有待回收 URL，停止时统一 `revokeObjectURL` |
| 自动播放被拦 | `playbackBlocked` / `isPlaybackBlocked()` 显式建模（浏览器 autoplay policy） |
| 段队列项 | `{ segment, audioPromise? }` —— **Promise 即预取句柄**，懒触发一次 |

`primeItems` 的写法很干净：`item.audioPromise ??= synthesizeSegment(...)` —— 预取是幂等的，重复调用不会重复发请求。

### A6. 文本与语音同步：句级 reveal

不是「先出文字再配音」，而是**文字按语音节奏揭示**：

- `SyncVoiceRevealState { requestId, pendingMessageId, latestContent, revealed, firstAudioSettled, watchingFirstAudio }`
- `awaitSynchronizedPlaybackStart(requestId)` / `updateSynchronizedContent(content)` / `onSynchronizedReveal(...)`
- 设置项 `syncTextWithVoice`（默认 **true**）+ 文档里的「**首句就绪后输出**」开关。
- 副标题另有 hold/release 生命周期：`holdSubtitle(requestId)` → `releaseSubtitle` → `hideAfter(1800)`。

**这是「朗读器」的正确形态**：先保证音频就绪，再让文字跟着音频走；而不是文字先刷完、语音慢慢追。

### A7. 预设语音：内容哈希 + 声音指纹的磁盘缓存

`presetVoiceFingerprint.ts` + `presetVoiceStorage.ts` + `presetVoiceTargets.ts`：

- **缓存键** `createPresetVoiceFingerprint(...)` = SHA-256 of
  `{ schemaVersion, sourceText, spokenText, language, modelVersion, gptSoVitsRootPath, sovitsModelPath, gptModelPath, inferenceDevice, halfPrecision, referenceIdentity, referenceText, requestedMoodRange, resolvedMoodRange, personaFingerprint? }`
  → **文本、语言、模型、推理设备、参考音频任一变化，缓存自动失效**。
- **状态机** `getStatus(line)`：`missing`（无音频）/ `invalid`（schema 或字段不全）/ `ready` / **`stale`**（`sourceTextHash !== hashPresetVoiceText(line.text)`，即文案改了但音频还是旧的）。
  → **不删旧音频、只标 stale**，用户改了台词不会立刻丢音频，重新生成前仍可播。
- **落盘**：`storePresetVoiceAudio` 用 `randomUUID` 命名 + **原子写入**（`writeBufferFileAtomically`）+ 路径越界校验（`assertPathContained` + `realpath` 双重检查，防符号链接逃逸）+ 单文件上限 32 MB。
- **批量生成**：`maximumTargetsPerTask = 512`，**严格串行**（`for (const target of targets)`）——因为背后是单张 GPU，并行只会互相拖慢；带 `AbortController` 与任务快照（进度上报）。

### A8. 音频载荷校验（防「假成功」）

`getVoiceAudioPayloadError(base64, mimeType)`（渲染进程）与 `hasExpectedSignature(bytes, mimeType)`（主进程）做同一件事：**嗅探魔数**。

| 格式 | 判定 |
| --- | --- |
| WAV | `RIFF` + 偏移 8 处 `WAVE` |
| MP3 | `ID3` 或 `0xFF` + `(b1 & 0xE0) === 0xE0` |
| OGG | `OggS` |
| AAC | `0xFF` + `(b1 & 0xF0) === 0xF0`，或偏移 4 处 `ftyp` |

**为什么必要**：本地 TTS 服务在配置错误时经常**返回 HTTP 200 + JSON 错误体**。不校验就会拿到一段「看起来是音频」的 base64，然后 `<audio>` 静默失败，用户只看到「没声音」。校验后能给出「音频格式无效」这种可定位的错误。

### A9. 它没有的东西（决定我们要补什么）

| 缺失 | 影响 |
| --- | --- |
| **词级时间戳** | 全库无 `boundary` / `WordBoundary` / `charIndex`（语音语境）；`voiceReplyMode` 硬编码 `"sentence"` |
| **文本位置映射** | 段只有字符串，没有「这段对应文档哪个偏移」——聊天回复不需要，**阅读器必须要** |
| **长文队列语义** | 队列生命周期 = 一条回复；没有 seek / rewind / resume / 分段重排 |
| **音频时长利用** | 播放用 `<audio>`，未解码取时长；句内时间轴无从建立 |
| **中文笔记的过滤** | 无 Markdown 过滤（frontmatter/代码块/URL…）——聊天文本不需要 |

---

## Part B — 与 Note Reader 的差距对照

| 维度 | Note Reader | 桌面灵 | 我们的方案 |
| --- | --- | --- | --- |
| **在线 TTS** | 逆向 Edge Read Aloud 私有接口（`Sec-MS-GEC` + UA 伪装） | **本机 HTTP 服务**，无逆向、无 ToS 风险 | 采用桌面灵的模型 |
| **音色** | 预设音色（Edge 神经音色 / SAPI） | **参考音频克隆**（3–10 秒样本） | 同桌面灵 |
| **provider 可换** | 否（两条链路写死） | 半可换（`apiMode` 两种形状） | **适配器 + 多内置形状**（含 OpenAI 兼容） |
| **词级时间戳** | 依赖 provider 事件（Windows 上不可靠） | 无（句级） | **句级精确同步 + 句内按权重分配** |
| **分句** | `Intl.Segmenter` 纯句级 | **强/弱/硬上限三级 + 前缀单调性** | 采用桌面灵的规则 + 补偏移 |
| **预取** | 分块 ≤4096 字符整段 | **预取 3 段**，边播边合成 | 采用桌面灵 |
| **首句延迟** | 无预热 | **warmup** + 「首句就绪后输出」 | 采用桌面灵 |
| **中止/超时** | 有（较简单） | **显式中止原因 + 属主追踪 + 快照 LRU/TTL** | 采用桌面灵 |
| **载荷校验** | 无（无 lamejs，直出分片） | **魔数嗅探** | 采用桌面灵 |
| **音频缓存** | 导出为文件（无复用） | **内容哈希 + 声音指纹 + stale** | 采用桌面灵 |
| **长文阅读** | 完整（seek/rewind/resume/jump） | **无** | 采用 Note Reader 的语义 + 桌面灵的工程 |

一句话：**Note Reader 有「阅读器语义」但没有干净的 provider；桌面灵有干净的 provider 但没有阅读器语义。方案 = 两者各取其长。**

---

## Part C — 可行方案

### C1. 分层

```
┌─ 文档层 ───────────────────────────────────────────────┐
│ text-pipeline：偏移保持过滤 → { text, mapping[] }        │  ← 上一篇已定
│ 分句：强/弱/硬上限三级规则（借鉴桌面灵）+ 记录 raw 偏移   │
│       产出 Segment[] = { text, rawFrom, rawTo }         │
└────────────────────────────────────────────────────────┘
┌─ 合成层 ───────────────────────────────────────────────┐
│ TtsEngine 适配器接口（可替换）                            │
│  ├ local-web-speech   （零依赖兜底）★已实现为 windows-tts（SAPI5 → wav 字节） │
│  ├ openai-speech      （/v1/audio/speech，生态最广）★推荐 │
│  ├ gpt-sovits-v2      （/tts，桌面灵同款）               │
│  ├ gpt-sovits-beta    （/，旧版）                        │
│  └ edge-read-aloud    （可选、显式标注非官方）            │
│ 生命周期：abort/timeout/warmup/重试/魔数校验/配置快照缓存 │
└────────────────────────────────────────────────────────┘
┌─ 调度层 ───────────────────────────────────────────────┐
│ 段队列 + 预取 3 段 + 顺序播放 + 磁盘缓存（指纹键）        │
│ 长文扩展：seek / rewind / resume / 从光标或选区起读       │
└────────────────────────────────────────────────────────┘
┌─ 同步层 ───────────────────────────────────────────────┐
│ decodeAudioData → 段精确时长                             │
│ 段内按权重分配 → WordTiming[] { rawFrom, rawTo, tStart } │
│ 音频时钟驱动 → CM6 装饰器（当前词 + 当前行）+ 自动滚动     │
└────────────────────────────────────────────────────────┘
```

### C2. 提供方契约

```ts
export interface TtsEngine {
  readonly id: string;
  /** 可选：列出音色（本地服务常无此能力，则返回空并让用户填名称） */
  listVoices?(): Promise<TtsVoice[]>;
  /** 合成一段文本；必须响应 AbortSignal */
  synthesize(req: {
    text: string;
    voice?: string;
    rate?: number;      // 0.5–2.0
    pitch?: number;
    signal: AbortSignal;
  }): Promise<{ bytes: ArrayBuffer; mimeType: string }>;
  /** 可选：预热，把首句延迟前置 */
  warmup?(voice?: string): Promise<void>;
}
```

**推荐默认 = `openai-speech`**（`POST {baseUrl}/v1/audio/speech`，请求体 `{ model, input, voice, response_format, speed }`）。理由：本地 TTS 生态已经收敛到这个形状（openedai-speech、GPT-SoVITS-OpenAI-API、Kokoro-FastAPI、CosyVoice-API、IndexTTS 等都有实现），用户换引擎不用改插件；而 `gpt-sovits-v2` 作为并列选项，覆盖原版 GPT-SoVITS 部署。

**注意实现细节**：Obsidian 渲染进程直连 `http://127.0.0.1:PORT` 会遇到 CORS。应使用 Obsidian 的 `requestUrl`（绕过 CORS）而非 `fetch`；但 `requestUrl` 的流式与中止能力需实测确认——**这一点列入验证清单**（见 C6）。

### C3. 分句与偏移（把两边的长处合起来）

桌面灵的 `findNextSegmentEnd` 只返回字符串。我们要在同一趟扫描里**同时记录原文偏移**：

```ts
interface Segment { text: string; rawFrom: number; rawTo: number; }

// 输入是过滤后文本 + mapping[]（mapping[过滤下标] = 原文下标）
// 扫描时用 mapping 把 [过滤下标区间] 翻译成 [rawFrom, rawTo]
function nextSegmentEnd(text: string, start: number, flushTail: boolean): number | undefined;
```

沿用桌面灵的常量与守卫，并做两处针对「阅读」的调整：
- **硬上限 80 字** 对朗读偏小（换气点太密，听感碎）。建议默认 **120–150 字**，可配置。
- **弱边界 36 字** 对中文偏合理，保留；但**段落换行**（`\n\n`）应作为**强边界**——笔记的段落是最自然的停顿。

### C4. 词级高亮：不依赖任何 provider 特性

这是整个方案的关键。**Note Reader 之所以脆弱，是因为它把「逐词高亮」建立在了 provider 必须提供时间戳这个假设上。** 我们反过来：

1. **段级同步是精确的** —— 段是我们自己切的，段音频什么时候开始播我们完全知道（`<audio>` 的 `play` 事件 / 段起始 `currentTime`）。
2. **段时长是精确的** —— `AudioContext.decodeAudioData(bytes)` → `AudioBuffer.duration`（毫秒级）。GPT-SoVITS 默认返回 WAV，Chromium 原生可解；MP3/OGG 亦可。
3. **段内按权重分配** —— 复用 Glimpse 已有的 `WORD_SPLIT_REGEX`（CJK 单字、拉丁整词）拆词，按权重摊分 `[0, duration)`：

   | 词类型 | 权重 |
   | --- | --- |
   | CJK 单字 | 1.0 |
   | 拉丁词 | `max(1, ceil(len / 3))`（近似音节数） |
   | 数字串 | 按位数计 |
   | 标点 | 0.5（并作为停顿） |

   归一化后得到 `WordTiming { rawFrom, rawTo, tStart, tEnd }`。

4. **误差不累积** —— 每段起点都被音频时钟重新锚定，误差只可能出现在**单段内部**（通常几十字）。而 Note Reader 是全文档一条时间轴，误差会一路累积。

5. **可选升级** —— 若某 provider 确实提供时间戳（Edge 的 `WordBoundary` 元数据、Azure 官方 SDK 的 word boundary、某些 GPT-SoVITS 分支），**用真实时间戳替换该段的估算值**。这是**渐进增强**，不是依赖。

6. **降级链**：真实时间戳 → 段内权重估算 → 整段高亮（连解码都失败时）。任何一级失效都不会导致「没有高亮」。

这个设计的好处：**任何能返回音频的 TTS 都能做逐词高亮**，包括纯本地的 GPT-SoVITS。这是 Note Reader 做不到的。

### C5. 缓存与预取

| 机制 | 做法 |
| --- | --- |
| **磁盘缓存** | 键 = `sha256(text + voiceFingerprint + rate + pitch + engineId)`；值 = 音频文件。参照桌面灵的**指纹**思路（把模型/参考音频/设备纳入指纹），但键要**加上 rate/pitch**——这两个直接改变音频。 |
| **stale 语义** | 笔记被编辑后，已缓存段若文本变了 → 标 stale，**不立即删**（阅读中途编辑不至于让后续全卡住） |
| **内存预取** | `lookahead = 3` 段；`item.audioPromise ??= synthesize(...)` 保证幂等 |
| **并发** | 对本地单 GPU 服务**串行**合成（桌面灵的做法）；预取靠「提前发起」而非「并行发起」 |
| **回收** | blob URL 统一追踪 + `revokeObjectURL`；缓存文件按 LRU 上限清理 |

### C6. 长文阅读（桌面灵没有，必须自己补）

| 需求 | 设计 |
| --- | --- |
| **从光标 / 选区起读** | 用 `PositionMapper.rawToFiltered` 反查过滤偏移，找到所在段，从该段开始合成 |
| **倒退 10 秒** | 段内：改 `audio.currentTime`；跨段：回到上一段起点（本地 TTS 无 seek 能力，只能按段跳） |
| **续读位置** | 存**段索引 + 段内偏移**，而非秒数（段可重建，秒数不行） |
| **文档编辑** | 朗读中编辑 → 用 CM6 `ChangeDesc` 映射当前段位置；映射不到则从当前段重启 |
| **超长文** | 不要一次性把全文切成段并全部预取；**滑动窗口**：只维护「当前段 + 后续 N 段」 |

### C7. 依赖与许可

| 用途 | 选型 | 许可 |
| --- | --- | --- |
| 本地 TTS 引擎 | GPT-SoVITS（用户自部署，独立进程） | 不在我们分发范围内 |
| OpenAI 兼容 TTS | 任一本地服务（openedai-speech / Kokoro / CosyVoice…） | 不在我们分发范围内 |
| 音频解码取时长 | Web Audio `decodeAudioData`（内置） | 无 |
| 分句 / 拆词 | 自研（借鉴桌面灵规则 + Glimpse `WORD_SPLIT_REGEX`） | — |
| 播放 | 复用 `src/music/audioPlayer.ts` | 本项目 |
| 可选在线 | `microsoft-cognitiveservices-speech-sdk`（自带 key） | MIT |
| 可选在线（逆向） | `msedge-tts`（锁版本） | MIT（1.1.x 曾是 GPL-3.0） |

**注意**：桌面灵是 MIT，**可以直接复制其代码并保留版权声明**。但建议仍按「借鉴设计 + 自己实现」处理 `StreamingVoiceCommitter`（其边界规则已足够简单，重写成本低于引入跨项目耦合），只在确实想省事时才直接搬代码——那时记得在文件头注明来源与 MIT 声明。

### C8. 分期

| 阶段 | 内容 | 依赖 |
| --- | --- | --- |
| **P0（探针）** | ① 本机 `speechSynthesis` 是否触发 `boundary`；② Obsidian `requestUrl` 能否连 `127.0.0.1` 且支持中止；③ `decodeAudioData` 对目标格式的兼容 | 无 |
| **P1（骨架）** | text-pipeline + 分句（含偏移）+ 段队列 + `openai-speech` 适配器 + `<audio>` 顺序播放 + 段级高亮 | 一个本地 TTS 服务 |
| **P2（逐词）** | `decodeAudioData` 取时长 + 段内权重分配 + CM6 逐词装饰器 + 自动滚动 | 无 |
| **P3（本地兜底）** | `local-web-speech` 适配器（零服务可用）+ 时间轴估算兜底 | 无 |

> **P3 已落地，改了实现路线**：提供方 id 为 `windows-tts`，但走的是 **SAPI5 → wav 字节**，
> 不是本表原先设想的 `speechSynthesis` —— 后者只能直接出声、拿不到字节，
> 进不了既有段队列（预取 / 暂停续播 / 段内进度 / 标点细分高亮全靠 `TtsAudio` 字节）。
> 见 `windows-tts-integration.md`。
| **P4（阅读器语义）** | 从光标/选区起读、倒退、续读、编辑映射、滑动窗口 | 无 |
| **P5（缓存与预取）** | 磁盘缓存（指纹键）+ stale + LRU + 预热 | 无 |
| **P6（可选）** | `gpt-sovits-v2` / `edge-read-aloud` 适配器、真实时间戳渐进增强 | — |

---

## 附录：证据索引

| 结论 | 位置 |
| --- | --- |
| MIT 许可 | `LICENSE` |
| 本地 HTTP 服务模型、两种 apiMode、超时/预热/快照 | `src/main/services/speech/textToSpeech.ts` |
| 请求/响应契约 | `src/shared/types/speech.ts` |
| 配置示例 | `config/examples/tts.example.json` |
| 分句规则（36/80、守卫、前缀单调性） | `src/renderer/pet-window/streamingVoiceCommitter.ts` |
| 预取 3 段 / 重试 / blob URL / 句级 reveal | `src/renderer/pet-window/useVoiceReplyQueue.ts`（`synthesisLookahead`、`primeItems`、`synthesizeSegment`、`SyncVoiceRevealState`） |
| `voiceReplyMode` 硬编码 `"sentence"` | `src/renderer/services/speech/speechSettings.ts` |
| 无词级时间戳 | 全库检索 `boundary`/`WordBoundary`/`charIndex` 在语音语境零命中 |
| 指纹缓存键 | `src/main/services/presetVoice/presetVoiceFingerprint.ts` |
| `missing/invalid/ready/stale` 状态机 | `src/main/services/presetVoice/presetVoiceTargets.ts` |
| 原子落盘 / 路径越界校验 / 魔数嗅探 | `src/main/services/presetVoice/presetVoiceStorage.ts` |
| 串行批量 + 512 上限 + 任务快照 | `src/main/services/presetVoice/PresetVoiceGenerationService.ts` |
| IPC 契约 | `src/preload/pet.ts`（`textToSpeech.speak` / `stop`） |
| 用户文档 | `docs/help/features/voice-model.md`、`preset-voice.md` |
