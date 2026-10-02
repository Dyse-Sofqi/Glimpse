/**
 * 朗读模块的设置类型与默认值。
 *
 * 命名与分组刻意自成一系（不使用 Note Reader 的键名与结构）。
 * 默认值中的性能相关数字来自本机 GPT-SoVITS 实测：
 * 合成耗时 ≈ 1.0s（固定）+ 0.12s × 字数；字数 ≥7 后 RTF ≈ 0.52；
 * 语速 2.0x 时 RTF 0.97（上限）。详见 docs/gpt-sovits-integration.md
 */

/** 过滤开关：决定哪些 Markdown 结构不进朗读文本 */
export interface ReaderFilterSettings {
  /** YAML frontmatter */
  frontmatter: boolean;
  /** ``` 围栏代码块 */
  fencedCode: boolean;
  /** 行内 `code` */
  inlineCode: boolean;
  /** 表格 */
  tables: boolean;
  /** 标题记号（#），保留标题文字 */
  headingMarks: boolean;
  /** 引用记号（>），保留引用文字 */
  quoteMarks: boolean;
  /** callout 标记（[!note] 与折叠符 +/-），保留 callout 标题与正文 */
  calloutMarks: boolean;
  /** 列表记号（- / * / + / 1. 与任务框），保留列表文字 */
  listMarks: boolean;
  /** #标签 */
  tags: boolean;
  /** 链接与裸 URL */
  links: boolean;
  /** 图片嵌入 ![]() 与 ![[ ]] */
  imageEmbeds: boolean;
  /** [[双链]]，保留显示名 */
  wikiLinks: boolean;
  /** emoji */
  emoji: boolean;
  /** ==高亮== 记号，保留高亮文字 */
  highlightMarks: boolean;
  /** * 星号记号 */
  asterisks: boolean;
  /** _ 下划线记号 */
  underscores: boolean;
  /** \ 反斜杠转义，保留被转义字符 */
  backslashEscapes: boolean;
  /** 跳过含指定短语的整行 */
  phraseLineEnabled: boolean;
  phraseLine: string;
  /** 跳过以指定前缀开头的整行 */
  prefixLineEnabled: boolean;
  prefixLine: string;
}

/** 分段参数 */
export interface ReaderSegmentSettings {
  /** 单段硬上限（字）。实测 150 字约 19s 合成、30s 音频，流水线仍跟得上 */
  maxChars: number;
  /** 弱边界（、，；）生效所需的最小累积字数。实测 2 字时 RTF 0.97，切太碎不划算 */
  secondaryMinChars: number;
  /** 首段上限（字）。固定开销 1.0s 消不掉，首段短才能让播放尽快开始 */
  firstMaxChars: number;
  /**
   * 首段渐进：首段之后按「无空档」条件逐段加长（见 segmenter.buildLimitPlan），
   * 避免首段变短导致第一句读完后的静默等待。仅 GPT-SoVITS（RTF < 1）有意义。
   */
  rampUp: boolean;
}

/** GPT-SoVITS 提供方参数 */
export interface ReaderTtsSettings {
  /** 服务地址，实测默认 127.0.0.1:9880 */
  baseUrl: string;
  /** GPT-SoVITS 安装根目录（含 runtime/python.exe 与 api_v2.py）；用于自动启动服务与枚举权重 */
  installRoot: string;
  /** GPT 权重（相对 GPT-SoVITS 安装根目录） */
  gptWeights: string;
  /** SoVITS 权重（相对安装根目录） */
  sovitsWeights: string;
  /** 参考音频（绝对路径或相对安装根目录） */
  refAudioPath: string;
  /**
   * 参考音频**目录**（可留空）。
   *
   * 设好之后，「选择参考音频」弹窗优先列这个目录里的音频 —— 换音色时点一下就行，
   * 不必每次重新翻路径。留空则退回旧行为（扫描安装根目录）。纯选择辅助，不参与合成。
   */
  refAudioDir: string;
  /** 参考音频对应文本 —— 必须与参考音频内容一致，否则音色跑偏 */
  promptText: string;
  /** 参考音频语言 */
  promptLang: string;
  /** 待合成文本语言 */
  textLang: string;
  /** 输出格式。实测 mp3 不被支持；ogg 体积仅 wav 的 1/8.4 且无延迟代价 */
  mediaType: "wav" | "ogg" | "aac" | "raw";
  /** 随机种子。固定值让同一文本的产物稳定，利于缓存命中 */
  seed: number;
  /** 语速。上限 2.0，再高 RTF > 1 必然卡顿 */
  speedFactor: number;
  /** 单次合成超时（毫秒）。150 字约 19s，留足余量 */
  timeoutMs: number;
  /**
   * 流式首响（实验性，仅 GPT-SoVITS）：0 关闭；2/3 = 服务端分片流式。
   * 实测首字节 5.62s → 0.69s(2) / 0.58s(3)，代价是质量/体积与总合成时长增加；
   * 流式段不做预取，且失败时回退到常规合成（多花一次请求）。
   */
  streamingMode: 0 | 2 | 3;
}

/**
 * 朗读的 TTS 提供方。
 *
 * 取值即引擎 id：
 * - `gpt-sovits`：参考音频克隆，本机 api_v2.py（需自部署模型）
 * - `qwen3-tts`：Qwen3-TTS-12Hz-1.7B-VoiceDesign，音色用自然语言描述（需自部署模型）
 * - `windows-tts`：Windows 系统内置语音（SAPI5），零安装兜底
 */
export type ReaderTtsProvider = "gpt-sovits" | "qwen3-tts" | "windows-tts";

/**
 * Qwen3-TTS（VoiceDesign）提供方参数。
 *
 * 与 GPT-SoVITS 的关键差异：音色不来自参考音频，而是来自 `instruct` ——
 * 一段自然语言描述（如「温柔清晰的年轻女声」），随每个合成请求发送，
 * 因此没有「应用音色」这个步骤，改描述即生效。
 * `qwen-tts` 包的 generate_voice_design 没有 speed 参数，该引擎暂不支持语速调节。
 */
export interface ReaderQwenSettings {
  /** 本机推理服务地址（reader-qwen-server.py 监听） */
  baseUrl: string;
  /** 模型目录（含 config.json / model.safetensors / speech_tokenizer/） */
  modelPath: string;
  /** 已安装 qwen-tts 的 Python 解释器（如 py -3.12 对应的 python.exe） */
  pythonPath: string;
  /** 推理设备，传给 from_pretrained 的 device_map */
  device: "cuda:0" | "cuda:1" | "cpu";
  /** 朗读语种（VoiceDesign 支持的 10 种语言，首字母大写的英文名） */
  language: string;
  /** 音色描述（自然语言）；留空表示用模型默认音色 */
  instruct: string;
  /** 单次合成超时（毫秒）。首次推理含内核预热，给足余量 */
  timeoutMs: number;
}

/**
 * Windows 本地语音（SAPI5）提供方参数 —— 零安装兜底。
 *
 * 与两套自部署引擎的区别：不需要任何服务、模型或 Python，
 * 直接用 Windows 自带的 SAPI5 语音（如 zh-CN 的「Microsoft Huihui Desktop」），
 * 由 PowerShell 调 `System.Speech.Synthesis` 合成到 wav 临时文件再交给播放器。
 * 代价是每个分段要起一次 PowerShell（实测固定开销约 0.4 秒），且音色只有系统里装好的那几个。
 */
export interface ReaderWindowsTtsSettings {
  /**
   * 语音名称（SAPI voice name，如 "Microsoft Huihui Desktop"）。
   * 留空 = 不调用 SelectVoice，用系统默认语音（`SpeechSynthesizer.Voice`）。
   */
  voiceName: string;
  /**
   * 语速倍率（0.5–2.0，与 GPT-SoVITS 的滑块同义）。
   * 落到 SAPI 的 `Rate`（-10…10）按 rate ≈ (speed − 1) × 6 换算（见 windows-tts.ts）。
   */
  speedFactor: number;
  /** 音量（SAPI Volume，0–100） */
  volume: number;
  /** 单次合成超时（毫秒）。实测单段 155 字约 0.5 秒，30 秒足够宽裕 */
  timeoutMs: number;
  /**
   * PowerShell 可执行文件路径覆盖（留空自动探测）。
   * 默认优先 Windows PowerShell 5.1（一定带 System.Speech），失败再试 PowerShell 7。
   */
  shellPath: string;
}

export interface ReaderSettings {
  filters: ReaderFilterSettings;
  segment: ReaderSegmentSettings;
  tts: ReaderTtsSettings;
  /** 当前激活的 TTS 提供方 */
  provider: ReaderTtsProvider;
  /** Qwen3-TTS 提供方参数（仅 provider === "qwen3-tts" 时使用） */
  qwen: ReaderQwenSettings;
  /** Windows 本地语音提供方参数（仅 provider === "windows-tts" 时使用） */
  windows: ReaderWindowsTtsSettings;
  /** 预取深度（段）。实测 RTF ≈ 0.52，2 已足够 */
  lookahead: number;
  /** 朗读时自动滚动到当前段 */
  autoScroll: boolean;
  /**
   * 朗读时光标跟随朗读位置（移到正在读的那一行行首）。
   *
   * 默认 false：朗读会持续抢走光标，编辑/取词都会被打断，
   * 而且提词器的「跟踪光标」行提取会被朗读带着跑。需要时再开。
   */
  cursorFollow: boolean;
  /** 段内高亮按标点细分（纯显示层：播放时段内高亮按分句推进；实际分段不变） */
  highlightClauses: boolean;
  /** 朗读时锁定编辑器交互 */
  lockEditor: boolean;
  /**
   * 「生成音频文件」的保存目录（选中文本右键导出）。空 = 系统下载文件夹。
   * 目录通过设置页「浏览…」用系统资源管理器对话框指定。
   */
  generateAudioPath: string;
  /**
   * 插件卸载（含热重载）与 Obsidian 退出时是否停止本地服务。
   *
   * 默认 false（保留）：冷启动要 20–65 秒，每次重载都重启代价太大；
   * 归属信息会落盘，下次加载自动认领，仍然能正常停止。
   */
  stopServiceOnUnload: boolean;
}

export const DEFAULT_READER_FILTERS: ReaderFilterSettings = {
  frontmatter: true,
  fencedCode: true,
  inlineCode: true,
  tables: true,
  headingMarks: true,
  quoteMarks: true,
  calloutMarks: true,
  listMarks: true,
  tags: true,
  links: true,
  imageEmbeds: true,
  wikiLinks: true,
  emoji: true,
  highlightMarks: true,
  asterisks: true,
  underscores: true,
  backslashEscapes: true,
  phraseLineEnabled: false,
  phraseLine: "",
  prefixLineEnabled: false,
  prefixLine: "",
};

export const DEFAULT_READER_SEGMENT: ReaderSegmentSettings = {
  maxChars: 150,
  secondaryMinChars: 36,
  // 15 字：合成 ≈ 1.0 + 0.12×15 ≈ 2.8s，配合首段渐进（无空档）比 25 字再省 ~1.2s 首字延迟
  firstMaxChars: 15,
  rampUp: true,
};

/**
 * 分段预设：「首段上限 + 是否爬坡」是成对取舍，给用户两套配好的组合，
 * 切换预设即同时套用两者；想定制再手动拖首段上限的滑块（预设决定「靠什么保证无空档」）。
 */
export interface ReaderSegmentPreset {
  id: "low-latency" | "simple";
  label: string;
  firstMaxChars: number;
  rampUp: boolean;
}

export const READER_SEGMENT_PRESETS: ReadonlyArray<ReaderSegmentPreset> = [
  // 首段 15 字 → 首字约 3.1s；靠后续段递增加长（爬坡）保证段间无空档
  { id: "low-latency", label: "低首字延迟（推荐）", firstMaxChars: 15, rampUp: true },
  // 首段 25 字 → 首字约 4.0s；不分段爬坡，靠首段自身的音频覆盖后续合成（优化二之前的原始形态）
  { id: "simple", label: "简单分段", firstMaxChars: 25, rampUp: false },
];

/** 当前设置对应的预设 id（由是否爬坡决定；首段上限可被手动微调） */
export function segmentPresetId(segment: ReaderSegmentSettings): ReaderSegmentPreset["id"] {
  return segment.rampUp ? "low-latency" : "simple";
}

/** 套用预设：同时设定首段上限与是否爬坡 */
export function applySegmentPreset(segment: ReaderSegmentSettings, id: string): void {
  const preset = READER_SEGMENT_PRESETS.find(item => item.id === id);
  if (!preset) return;
  segment.firstMaxChars = preset.firstMaxChars;
  segment.rampUp = preset.rampUp;
}

export const DEFAULT_READER_TTS: ReaderTtsSettings = {
  baseUrl: "http://127.0.0.1:9880",
  installRoot: "",
  gptWeights: "",
  sovitsWeights: "",
  refAudioPath: "",
  refAudioDir: "",
  promptText: "",
  promptLang: "zh",
  textLang: "zh",
  mediaType: "ogg",
  seed: 42,
  speedFactor: 1,
  timeoutMs: 60_000,
  streamingMode: 0,
};

export const DEFAULT_READER_QWEN: ReaderQwenSettings = {
  // 9872 与 GPT-SoVITS 的 9880 相邻且不冲突，两套服务可以同时各占一个
  baseUrl: "http://127.0.0.1:9872",
  modelPath: "",
  pythonPath: "",
  device: "cuda:0",
  language: "Chinese",
  instruct: "",
  timeoutMs: 120_000,
};

export const DEFAULT_READER_WINDOWS: ReaderWindowsTtsSettings = {
  // 空 = 系统默认语音；中文系统上通常是 Microsoft Huihui Desktop
  voiceName: "",
  speedFactor: 1,
  volume: 100,
  timeoutMs: 30_000,
  shellPath: "",
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  filters: { ...DEFAULT_READER_FILTERS },
  segment: { ...DEFAULT_READER_SEGMENT },
  tts: { ...DEFAULT_READER_TTS },
  // 默认保持 GPT-SoVITS：已有用户的 data.json 里只有 tts 组，升级后行为不变
  provider: "gpt-sovits",
  qwen: { ...DEFAULT_READER_QWEN },
  windows: { ...DEFAULT_READER_WINDOWS },
  lookahead: 2,
  autoScroll: true,
  cursorFollow: false,
  highlightClauses: true,
  lockEditor: false,
  generateAudioPath: "",
  stopServiceOnUnload: false,
};

/** 语速安全上限 —— 超过 2.0 时合成跟不上播放（实测 RTF 0.97 @2.0x） */
export const MAX_SPEED_FACTOR = 2;
export const MIN_SPEED_FACTOR = 0.5;

/**
 * Qwen3-TTS 支持的语种（官方口径 10 种；值直接传给 generate_voice_design 的
 * language 参数，必须是首字母大写的英文名）。
 */
export const QWEN_LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "英文" },
  { value: "Japanese", label: "日文" },
  { value: "Korean", label: "韩文" },
  { value: "German", label: "德文" },
  { value: "French", label: "法文" },
  { value: "Russian", label: "俄文" },
  { value: "Portuguese", label: "葡萄牙文" },
  { value: "Spanish", label: "西班牙文" },
  { value: "Italian", label: "意大利文" },
];
