/**
 * Windows 本地语音（SAPI5）提供方 —— 零安装兜底。
 *
 * 为什么需要：GPT-SoVITS 与 Qwen3-TTS 都要用户自部署模型（几 GB 显存 + 数十分钟准备），
 * 只想「点开就有人念」的用户两样都没有。Windows 自带 SAPI5 语音（中文系统上是
 * 「Microsoft Huihui Desktop」），不需要下载任何东西，所以作为兜底提供方。
 *
 * 实现路径：PowerShell 调 `System.Speech.Synthesis.SpeechSynthesizer` 合成到 wav，
 * 再把字节交给既有的段队列（`<audio>` + Blob）。**不直接用浏览器 speechSynthesis**：
 * 那条路只能直接出声，拿不到字节，既进不了现有的段队列（预取 / 暂停续播 / 段内进度 /
 * 标点细分高亮全靠 TtsAudio 字节），也无法与音乐模块共用播放控制。
 *
 * 契约与实测（命令与耗时均在本机实测）：
 * - 枚举语音：`GetInstalledVoices()` → 名称 / 语言 / 性别 / 是否启用
 * - 合成：`SetOutputToWaveFile` + `Speak`；输出固定 22.05kHz 单声道 16bit PCM wav
 *   （`<audio>` 直接可播，魔数校验走共享的 sniffAudioFormat）
 * - 每段起一次 PowerShell：实测 155 字 0.46 秒（含进程启动），27 字 0.42 秒
 *   —— 固定开销约 0.4 秒，与 GPT-SoVITS 的 1.0 秒固定开销同量级，所以首段渐进同样适用
 * - SAPI 的 `Rate` 是 −10…10 的档位（不是倍率）：实测 rate 6 ≈ 2.0x、3 ≈ 1.5x、
 *   −6 ≈ 0.5x，即 rate ≈ (speed − 1) × 6（见 windowsTtsRate）
 *
 * 取消：与两个服务型引擎不同，这里**真的是可中止的** —— 子进程句柄在手，
 * cancel() 直接 TerminateProcess（两个 HTTP 引擎只能靠代际计数丢弃结果）。
 */
import type { ChildProcess } from "child_process";
import { isWindows, loadNodeModule } from "../node-bridge";
import { sniffAudioFormat } from "./http-utils";
// 复用启动器的输出解码（UTF-8 失败回退 GBK）：脚本自身设了 UTF8 输出，
// 但脚本还没跑起来时的宿主错误（执行策略、解析失败）仍是控制台代码页（简体中文是 GBK）
import { decodeConsoleChunk } from "./service-launcher";
import {
  ServiceHealthInfo,
  TtsAudio,
  TtsCanceledError,
  TtsEngine,
  TtsProbeResult,
} from "./types";

export interface WindowsTtsOptions {
  /** SAPI 语音名；空串 = 用系统默认语音（不调用 SelectVoice） */
  voiceName: string;
  /** 语速倍率（0.5–2.0），换算成 SAPI Rate */
  speedFactor: number;
  /** 音量 0–100 */
  volume: number;
  /** 单次合成超时（毫秒） */
  timeoutMs: number;
  /** PowerShell 可执行文件路径覆盖；空串 = 自动探测 */
  shellPath: string;
}

export interface WindowsTtsVoice {
  name: string;
  culture: string;
  gender: string;
  enabled: boolean;
}

export interface WindowsVoiceReport {
  ok: boolean;
  message: string;
  voices: WindowsTtsVoice[];
  /** 系统的默认语音名（`SpeechSynthesizer.Voice`） */
  defaultVoice: string;
}

/** SAPI Rate 的取值边界 */
export const WINDOWS_TTS_RATE_LIMIT = 10;

/**
 * 倍速 → SAPI Rate。
 * 实测（本机 Huihui Desktop，22.05kHz）：Rate 6 ≈ 2.0x、3 ≈ 1.5x、−6 ≈ 0.5x，
 * 线性关系即 rate ≈ (speed − 1) × 6；越界由 SAPI 夹在 −10…10，这里先夹好便于展示。
 */
export function windowsTtsRate(speedFactor: number): number {
  const rate = Math.round((speedFactor - 1) * 6);
  return Math.max(-WINDOWS_TTS_RATE_LIMIT, Math.min(WINDOWS_TTS_RATE_LIMIT, rate));
}

/** 临时脚本文件名（放在系统临时目录的 glimpse-windows-tts/ 下） */
const SCRIPT_NAME = "reader-windows-tts.ps1";
const WORK_DIR_NAME = "glimpse-windows-tts";

/**
 * 合成 / 枚举脚本。
 *
 * 必须写成**带 BOM 的 UTF-8**：Windows PowerShell 5.1 读 .ps1 时按控制台代码页
 * （简体中文是 GBK）解码，没有 BOM 时下面那些中文错误文案会变乱码。
 *
 * 错误一律以 `GLIMPSE_TTS_ERROR:` 前缀写到 stderr，便于调用方与时序噪声区分。
 */
export const WINDOWS_TTS_SCRIPT = `param(
  [string]$TextFile = "",
  [string]$OutFile = "",
  [int]$Rate = 0,
  [int]$Volume = 100,
  [string]$Voice = "",
  [switch]$ListVoices
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  Add-Type -AssemblyName System.Speech
} catch {
  [Console]::Error.WriteLine("GLIMPSE_TTS_ERROR: 无法加载 System.Speech（该 PowerShell 不带此程序集）。" + $_.Exception.Message)
  exit 3
}
try {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    if ($ListVoices) {
      $items = @()
      foreach ($installed in $synth.GetInstalledVoices()) {
        $info = $installed.VoiceInfo
        $items += [pscustomobject]@{
          name    = [string]$info.Name
          culture = [string]$info.Culture.Name
          gender  = [string]$info.Gender
          enabled = [bool]$installed.Enabled
        }
      }
      # -InputObject 保住数组形状：管道会把单元素数组拆成裸对象
      [Console]::Out.Write((ConvertTo-Json -InputObject ([pscustomobject]@{
        default = [string]$synth.Voice.Name
        voices  = @($items)
      }) -Compress -Depth 4))
      exit 0
    }
    if (-not $TextFile -or -not $OutFile) {
      [Console]::Error.WriteLine("GLIMPSE_TTS_ERROR: 缺少 -TextFile / -OutFile 参数。")
      exit 4
    }
    $content = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
    if ($Voice.Trim().Length -gt 0) { $synth.SelectVoice($Voice.Trim()) }
    $synth.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
    $synth.Volume = [Math]::Max(0, [Math]::Min(100, $Volume))
    $synth.SetOutputToWaveFile($OutFile)
    $synth.Speak($content)
  } finally {
    $synth.Dispose()
  }
} catch {
  [Console]::Error.WriteLine("GLIMPSE_TTS_ERROR: " + $_.Exception.Message)
  exit 2
}
exit 0
`;

/** 交给 PowerShell 的公共参数（-File 后跟脚本路径） */
const SCRIPT_BASE_ARGS = [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
];

interface NodeProcessModule {
  spawn: (
    command: string,
    args: string[],
    options: Record<string, unknown>
  ) => ChildProcess;
}

interface NodeFsModule {
  writeFileSync: (path: string, data: string, encoding: string) => void;
  readFileSync: (path: string) => Uint8Array;
  existsSync: (path: string) => boolean;
  unlinkSync: (path: string) => void;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
}

interface NodeOsModule {
  tmpdir: () => string;
}

interface NodePathModule {
  join: (...parts: string[]) => string;
}

interface ProcessOutcome {
  code: number;
  stdout: string;
  stderr: string;
  /** spawn 自身失败（ENOENT 等，不会触发 exit） */
  spawnError: string | null;
  timedOut: boolean;
}

/** 子进程输出最多留这么多字节，避免异常进程刷爆内存 */
const MAX_CAPTURE_BYTES = 64 * 1024;
const LOG_TAIL_LIMIT = 200;

function toText(chunks: Uint8Array[]): string {
  if (chunks.length === 0) return "";
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return decodeConsoleChunk(merged);
}

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 把 Node Buffer 拷贝成独立 ArrayBuffer（Buffer 可能来自共享内存池） */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

/** 解析语音枚举的 JSON；容错对象/数组两种形状与单元素被拆包的情况 */
function parseVoiceReport(raw: string): { defaultVoice: string; voices: WindowsTtsVoice[] } {
  const text = raw.trim();
  const start = text.search(/[[{]/);
  if (start < 0) {
    throw new Error(`语音列表不是 JSON：${text.slice(0, 200) || "（无输出）"}`);
  }
  const parsed = JSON.parse(text.slice(start)) as unknown;
  const record = Array.isArray(parsed) ? null : (parsed as Record<string, unknown>);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(record?.voices)
      ? (record?.voices as unknown[])
      : record && typeof record.name === "string"
        ? [record]
        : [];

  const voices: WindowsTtsVoice[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.name !== "string" || !entry.name.trim()) continue;
    voices.push({
      name: entry.name,
      culture: typeof entry.culture === "string" ? entry.culture : "",
      gender: typeof entry.gender === "string" ? entry.gender : "",
      enabled: entry.enabled !== false,
    });
  }
  const defaultVoice =
    record && typeof record.default === "string" ? record.default : "";
  return { defaultVoice, voices };
}

export class WindowsSapiTtsEngine implements TtsEngine {
  readonly id = "windows-tts";
  readonly label = "Windows 本地语音（系统内置 SAPI）";

  private options: WindowsTtsOptions;
  /** 代际计数：cancel() 递增，用于丢弃过期结果 */
  private generation = 0;
  /** 已确认可用的 PowerShell（探测成功后才缓存） */
  private shell: string | null = null;
  /** 在途的探测（合并并发调用，见 resolveShell） */
  private shellProbe: Promise<
    { ok: true; shell: string } | { ok: false; message: string }
  > | null = null;
  private voices: WindowsTtsVoice[] = [];
  private defaultVoice = "";
  private workDir: string | null = null;
  private scriptPath: string | null = null;
  /** 在跑的子进程：cancel() 直接终止它们 */
  private readonly children = new Set<ChildProcess>();
  private logLines: string[] = [];
  private health: ServiceHealthInfo = { state: "unknown" };
  private sequence = 0;

  constructor(options: WindowsTtsOptions) {
    this.options = options;
  }

  updateOptions(options: WindowsTtsOptions): void {
    // 换了 shell 或语音才需要重新探测，其余参数合成时现取
    if (options.shellPath !== this.options.shellPath) this.shell = null;
    this.options = options;
  }

  // ── 环境准备 ──────────────────────────────────────────────

  private shellCandidates(): string[] {
    const configured = this.options.shellPath.trim();
    const defaults = ["powershell.exe", "pwsh.exe", "pwsh"];
    if (!configured) return defaults;
    return [configured, ...defaults.filter(name => name !== configured)];
  }

  private ensureWorkDir(fs: NodeFsModule, path: NodePathModule): string {
    if (this.workDir) return this.workDir;
    const os = loadNodeModule<NodeOsModule>("os");
    const base = os?.tmpdir?.() ?? ".";
    const dir = path.join(base, WORK_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    this.workDir = dir;
    return dir;
  }

  /** 把合成脚本落到临时目录（只写一次；带 BOM，见 WINDOWS_TTS_SCRIPT 注释） */
  private ensureScript(fs: NodeFsModule, path: NodePathModule): string {
    if (this.scriptPath) return this.scriptPath;
    const dir = this.ensureWorkDir(fs, path);
    const script = path.join(dir, SCRIPT_NAME);
    fs.writeFileSync(script, `\uFEFF${WINDOWS_TTS_SCRIPT}`, "utf8");
    this.scriptPath = script;
    return script;
  }

  private requireNode(): { fs: NodeFsModule; path: NodePathModule } | null {
    const fs = loadNodeModule<NodeFsModule>("fs");
    const path = loadNodeModule<NodePathModule>("path");
    if (!fs || !path) return null;
    return { fs, path };
  }

  // ── 进程执行 ──────────────────────────────────────────────

  /**
   * 终止子进程。
   *
   * 只用 `child.kill()`：Windows 上它落到 `TerminateProcess`，只要句柄还在就一定能杀掉，
   * 返回 false 只说明进程已经退出。**不要**再按 PID 兜一次 —— 那时进程已死，
   * PID 有被系统复用的理论风险，杀错进程的代价远大于「多一次保险」的收益。
   */
  private killChild(child: ChildProcess): void {
    try {
      child.kill();
    } catch {
      /* 已经退出 */
    }
  }

  /**
   * 跑一次脚本并收集输出。
   * 超时与 cancel() 都通过终止子进程结束（超时另外记 timedOut，便于给出准确文案）。
   */
  private runScript(shell: string, args: string[]): Promise<ProcessOutcome> {
    const processModule = loadNodeModule<NodeProcessModule>("child_process");
    if (!processModule?.spawn) {
      return Promise.resolve({
        code: -1,
        stdout: "",
        stderr: "",
        spawnError: '当前环境无法启动子进程（require("child_process") 不可用）',
        timedOut: false,
      });
    }

    return new Promise<ProcessOutcome>(resolve => {
      let child: ChildProcess;
      try {
        child = processModule.spawn(shell, args, {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        resolve({
          code: -1,
          stdout: "",
          stderr: "",
          spawnError: detailOf(error),
          timedOut: false,
        });
        return;
      }

      this.children.add(child);
      const stdoutChunks: Uint8Array[] = [];
      const stderrChunks: Uint8Array[] = [];
      let captured = 0;
      let settled = false;
      let timedOut = false;
      let timer: number | undefined;

      const collect = (target: Uint8Array[], data: Uint8Array) => {
        if (captured >= MAX_CAPTURE_BYTES) return;
        captured += data.length;
        target.push(data);
      };

      const finish = (code: number, spawnError: string | null = null) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) window.clearTimeout(timer);
        this.children.delete(child);
        const stdout = toText(stdoutChunks);
        const stderr = toText(stderrChunks);
        // 只留 stderr：stdout 是语音列表 JSON，塞进日志尾部只会把真正的报错挤掉
        for (const line of stderr.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) this.pushLine(trimmed);
        }
        resolve({ code, stdout, stderr, spawnError, timedOut });
      };

      const timeoutMs = Math.max(1000, this.options.timeoutMs);
      timer = window.setTimeout(() => {
        timedOut = true;
        this.killChild(child);
      }, timeoutMs);

      child.stdout?.on("data", (data: Uint8Array) => collect(stdoutChunks, data));
      child.stderr?.on("data", (data: Uint8Array) => collect(stderrChunks, data));
      child.on("error", (error: Error) => finish(-1, error.message));
      child.on("close", (code: number | null) => finish(code ?? -1));
    });
  }

  // ── 语音列表 ──────────────────────────────────────────────

  private async probeShell(shell: string): Promise<WindowsVoiceReport> {
    const node = this.requireNode();
    if (!node) {
      return {
        ok: false,
        message: "当前环境没有文件系统能力（仅 Obsidian 桌面端可用）",
        voices: [],
        defaultVoice: "",
      };
    }
    let script: string;
    try {
      script = this.ensureScript(node.fs, node.path);
    } catch (error) {
      return {
        ok: false,
        message: `写入临时脚本失败：${detailOf(error)}`,
        voices: [],
        defaultVoice: "",
      };
    }

    const outcome = await this.runScript(shell, [...SCRIPT_BASE_ARGS, script, "-ListVoices"]);
    if (outcome.spawnError) {
      return {
        ok: false,
        message: `启动失败：${outcome.spawnError}`,
        voices: [],
        defaultVoice: "",
      };
    }
    if (outcome.timedOut) {
      return { ok: false, message: "枚举系统语音超时", voices: [], defaultVoice: "" };
    }
    const stderr = outcome.stderr.replace(/GLIMPSE_TTS_ERROR:\s*/g, "").trim();
    if (outcome.code !== 0 || !outcome.stdout.trim()) {
      return {
        ok: false,
        message: stderr || `退出码 ${outcome.code}，且没有输出语音列表`,
        voices: [],
        defaultVoice: "",
      };
    }
    try {
      const report = parseVoiceReport(outcome.stdout);
      if (report.voices.length === 0) {
        return {
          ok: false,
          message: "枚举成功，但系统里没有已安装的语音（可在「设置 → 时间和语言 → 语音」添加）",
          voices: [],
          defaultVoice: "",
        };
      }
      return {
        ok: true,
        message: `共 ${report.voices.length} 个系统语音`,
        voices: report.voices,
        defaultVoice: report.defaultVoice,
      };
    } catch (error) {
      return {
        ok: false,
        message: `解析语音列表失败：${detailOf(error)}`,
        voices: [],
        defaultVoice: "",
      };
    }
  }

  /**
   * 解析出可用的 PowerShell（带缓存）。逐个候选试跑枚举脚本 ——
   * Windows PowerShell 5.1 自带 System.Speech，PowerShell 7 默认不带，
   * 所以「命令存在」不等于「能合成」，必须真跑一次才算数。
   */
  async resolveShell(
    force = false
  ): Promise<{ ok: true; shell: string } | { ok: false; message: string }> {
    if (!isWindows()) {
      return {
        ok: false,
        message: "Windows 本地语音只在 Windows 上可用（当前系统不是 Windows）",
      };
    }
    if (!force && this.shell) return { ok: true, shell: this.shell };
    // 设置页渲染与朗读前自检可能同时触发探测 —— 合并成一次（每次要起一个进程）
    if (!force && this.shellProbe) return this.shellProbe;

    const probe = this.probeShells();
    if (!force) this.shellProbe = probe;
    try {
      return await probe;
    } finally {
      if (this.shellProbe === probe) this.shellProbe = null;
    }
  }

  private async probeShells(): Promise<
    { ok: true; shell: string } | { ok: false; message: string }
  > {
    const failures: string[] = [];
    for (const shell of this.shellCandidates()) {
      const report = await this.probeShell(shell);
      if (report.ok) {
        this.shell = shell;
        this.voices = report.voices;
        this.defaultVoice = report.defaultVoice;
        return { ok: true, shell };
      }
      failures.push(`${shell} —— ${report.message}`);
    }
    return {
      ok: false,
      message:
        "找不到可用的 PowerShell。Windows 本地语音需要 Windows PowerShell 5.1" +
        "（C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe，自带 System.Speech）" +
        `或装好 System.Speech 的 PowerShell 7：\n${failures.join("\n")}`,
    };
  }

  /** 列出系统语音（首次会真的起一次 PowerShell，约 0.4 秒） */
  async listVoices(force = false): Promise<WindowsVoiceReport> {
    const resolved = await this.resolveShell(force);
    if (!resolved.ok) {
      return { ok: false, message: resolved.message, voices: [], defaultVoice: "" };
    }
    return {
      ok: true,
      message: `共 ${this.voices.length} 个系统语音（${resolved.shell}）`,
      voices: this.voices,
      defaultVoice: this.defaultVoice,
    };
  }

  /** 已解析出的 PowerShell 路径（未探测时为 null） */
  getResolvedShell(): string | null {
    return this.shell;
  }

  getVoices(): WindowsTtsVoice[] {
    return this.voices;
  }

  /** 当前实际会用的语音名（未配置时就是系统默认） */
  effectiveVoiceName(): string {
    const wanted = this.options.voiceName.trim();
    if (wanted) return wanted;
    return this.defaultVoice || this.voices.find(v => v.enabled)?.name || "";
  }

  // ── TtsEngine 契约 ────────────────────────────────────────

  async probe(): Promise<TtsProbeResult> {
    const resolved = await this.resolveShell();
    if (!resolved.ok) return { ok: false, message: resolved.message };

    const wanted = this.options.voiceName.trim();
    if (wanted) {
      const hit = this.voices.find(
        voice => voice.name.toLowerCase() === wanted.toLowerCase()
      );
      if (!hit) {
        return {
          ok: false,
          message:
            `已配置的语音「${wanted}」不在系统语音列表里。\n` +
            `可用：${this.voices.map(voice => voice.name).join("、")}\n` +
            "请在「设置 → 朗读 → 声音（Windows 本地语音）」点「刷新语音列表」后重选，" +
            "或把语音清空改用系统默认语音。",
        };
      }
      if (!hit.enabled) {
        return {
          ok: false,
          message: `已配置的语音「${wanted}」在系统里处于禁用状态，请换一个语音（或到系统语音设置里启用它）。`,
        };
      }
    }

    const effective = this.effectiveVoiceName() || "（未知）";
    return {
      ok: true,
      message:
        `系统语音可用：${this.voices.length} 个；当前使用「${effective}」` +
        `${wanted ? "" : "（系统默认）"}；${resolved.shell}`,
    };
  }

  async synthesize(text: string): Promise<TtsAudio> {
    const generation = this.generation;
    const content = text.trim();
    if (!content) throw new Error("没有可合成的文本");
    if (!isWindows()) {
      throw new Error("Windows 本地语音只在 Windows 上可用（当前系统不是 Windows）");
    }

    const node = this.requireNode();
    if (!node) {
      throw new Error("当前环境没有文件系统能力，Windows 本地语音不可用（仅桌面端）");
    }
    const { fs, path } = node;

    const resolved = await this.resolveShell();
    if (!resolved.ok) throw new Error(resolved.message);

    const script = this.ensureScript(fs, path);
    const dir = this.ensureWorkDir(fs, path);
    const stamp = `${Date.now().toString(36)}-${(this.sequence = (this.sequence + 1) % 1_000_000).toString(36)}`;
    const textPath = path.join(dir, `text-${stamp}.txt`);
    const wavPath = path.join(dir, `out-${stamp}.wav`);

    const voiceName = this.options.voiceName.trim();
    const args = [
      ...SCRIPT_BASE_ARGS,
      script,
      "-TextFile",
      textPath,
      "-OutFile",
      wavPath,
      "-Rate",
      String(windowsTtsRate(this.options.speedFactor)),
      "-Volume",
      String(Math.max(0, Math.min(100, Math.round(this.options.volume)))),
    ];
    if (voiceName) args.push("-Voice", voiceName);

    try {
      fs.writeFileSync(textPath, content, "utf8");
      const outcome = await this.runScript(resolved.shell, args);
      if (generation !== this.generation) throw new TtsCanceledError();

      if (outcome.spawnError) {
        // PowerShell 路径或临时脚本失效 —— 清空缓存，下次重新探测/重写
        if (/ENOENT|not found|找不到/i.test(outcome.spawnError)) {
          this.shell = null;
          this.scriptPath = null;
        }
        throw new Error(`启动 PowerShell 失败：${outcome.spawnError}`);
      }
      if (outcome.timedOut) {
        throw new Error(
          `语音合成超时（${Math.round(Math.max(1000, this.options.timeoutMs) / 1000)} 秒）：` +
            "系统语音正常情况下每段不到 1 秒，超时通常意味着 PowerShell 被安全软件拦截。"
        );
      }
      if (outcome.code !== 0) throw new Error(this.describeFailure(outcome, voiceName));
      if (!fs.existsSync(wavPath)) throw new Error("合成进程已退出，但没有生成音频文件");
      const bytes = toArrayBuffer(fs.readFileSync(wavPath));
      if (bytes.byteLength === 0) throw new Error("合成结果是空文件");
      const format = sniffAudioFormat(bytes);
      if (format !== "wav") {
        throw new Error(
          `音频格式不符：期望 wav，实际 ${format ?? "无法识别"}（${bytes.byteLength} 字节）`
        );
      }
      return { bytes, mimeType: "audio/wav" };
    } finally {
      for (const file of [textPath, wavPath]) {
        try {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch {
          /* 清理失败无所谓：本来就在系统临时目录里 */
        }
      }
    }
  }

  private describeFailure(outcome: ProcessOutcome, voiceName: string): string {
    const raw = `${outcome.stderr}\n${outcome.stdout}`.trim();
    const detail =
      raw.replace(/GLIMPSE_TTS_ERROR:\s*/g, "").trim() || "（进程没有输出错误信息）";
    const hint = /SelectVoice|No matching voice|没有匹配的语音/i.test(detail)
      ? `\n配置的语音「${voiceName || "（空）"}」可能已被卸载或禁用，请刷新语音列表后重选。`
      : /System\.Speech/i.test(detail)
        ? "\n该 PowerShell 缺少 System.Speech 程序集：请改用 Windows PowerShell 5.1" +
          "（C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe）。"
        : "";
    return `合成失败（退出码 ${outcome.code}）：${detail}${hint}`;
  }

  /** 立即打断：终止在跑的子进程，并让迟到结果作废 */
  cancel(): void {
    this.generation += 1;
    for (const child of [...this.children]) this.killChild(child);
    this.children.clear();
  }

  dispose(): void {
    this.cancel();
  }

  // ── 状态（与两个启动器的语义对齐，供设置页与诊断复用） ──

  getHealth(): ServiceHealthInfo {
    return this.health;
  }

  markHealthy(): void {
    this.health = { state: "ok", checkedAt: Date.now() };
  }

  markUnhealthy(reason: string): void {
    this.health = { state: "broken", reason, checkedAt: Date.now() };
  }

  resetHealth(): void {
    this.health = { state: "unknown" };
  }

  /** 最近几次子进程的输出（合成失败时给用户看真正的报错） */
  getLogTail(lineCount = 12): string[] {
    return this.logLines.slice(-lineCount);
  }

  private pushLine(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > LOG_TAIL_LIMIT) {
      this.logLines.splice(0, this.logLines.length - LOG_TAIL_LIMIT);
    }
  }
}
