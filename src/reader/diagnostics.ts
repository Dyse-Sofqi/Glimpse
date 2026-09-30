/**
 * 朗读模块的环境诊断。
 *
 * 这里把 P0 阶段的三个未验证假设落成了插件里**长期可用**的诊断命令：
 * 1. 插件内能否 require("child_process") 并 spawn 子进程
 * 2. requestUrl 能否连 127.0.0.1（绕过 CORS）—— 注意它没有 abort()
 * 3. AudioContext.decodeAudioData 能否解出时长（逐词高亮的时间轴依赖它）
 * 另外顺带探测 speechSynthesis 的 boundary 事件是否触发（会出声，属预期）。
 */
import { isWindows, resolveRequire } from "./node-bridge";
import { detectNativeDialogMethod } from "./native-file-dialog";
import { resolvePythonExecutable } from "./tts/service-launcher";
import type { ReaderTtsProvider } from "./settings-types";
import type { TtsEngine } from "./tts/types";

export interface DiagnosticItem {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DiagnosticReport {
  items: DiagnosticItem[];
  allOk: boolean;
}

type NodeRequire = (id: string) => unknown;

function probeChildProcess(installRoot: string): DiagnosticItem {
  const name = "子进程能力（child_process）";
  const req = resolveRequire();
  if (!req) {
    return {
      name,
      ok: false,
      detail: "取不到 require，无法启动外部进程（服务需手动启动）",
    };
  }

  let cp: typeof import("child_process");
  try {
    cp = req("child_process") as typeof import("child_process");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail: `require("child_process") 失败：${detail}` };
  }

  const windows = isWindows();
  try {
    const echo = cp.spawnSync(
      windows ? "cmd.exe" : "/bin/sh",
      windows ? ["/c", "echo", "ok"] : ["-c", "echo ok"],
      { encoding: "utf8", timeout: 5000, windowsHide: true }
    );
    if (echo.status !== 0 || !String(echo.stdout ?? "").includes("ok")) {
      return { name, ok: false, detail: `基础 spawn 测试未通过（status=${echo.status}）` };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail: `spawn 抛错：${detail}` };
  }

  if (!installRoot.trim()) {
    return {
      name,
      ok: true,
      detail: "可用（基础 spawn 通过）。填入安装根目录后可进一步验证内嵌 Python",
    };
  }

  // 必须走与启动器同一套路径解析（含双层目录自动定位），
  // 否则用户只填到外层时会误报「找不到 python.exe」
  const resolved = resolvePythonExecutable(installRoot);
  if (!resolved.ok) {
    return { name, ok: false, detail: resolved.message };
  }

  try {
    const result = cp.spawnSync(resolved.python, ["--version"], {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    if (result.status === 0 && /Python/i.test(output)) {
      const note = resolved.note ? `${resolved.note}；` : "";
      return { name, ok: true, detail: `可用；${note}内嵌解释器 ${output}` };
    }
    return {
      name,
      ok: false,
      detail:
        `能 spawn，但 ${resolved.python} 未返回 Python 版本` +
        `（status=${result.status}，输出=${output.slice(0, 200) || "（空）"}）`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail: `启动内嵌 Python 失败：${detail}` };
  }
}

/**
 * 原生文件对话框可用性。
 *
 * 首选 `electron.remote.dialog.showOpenDialogSync`（Obsidian 自己就用这个），
 * 备选 `<input type="file">` + `webUtils.getPathForFile`
 * （Electron 32 起已移除 `File.path`，本机是 43.3.0）。
 * 两条都不通时，路径选择会退回「扫描列表 + 手动填写」。
 */
function probeNativeFileDialog(): DiagnosticItem {
  const name = "原生文件对话框";
  const versions = (
    window as unknown as { process?: { versions?: Record<string, string> } }
  ).process?.versions;
  const electronVersion = versions?.electron ?? "未知";
  const chromeVersion = versions?.chrome ?? "未知";

  const method = detectNativeDialogMethod();
  const methodLabel: Record<typeof method, string> = {
    "electron-remote": "electron.remote.dialog.showOpenDialogSync（首选）",
    "input-file": "input[type=file] + webUtils.getPathForFile（备选）",
    none: "两条路径都不可用 —— 会退回「扫描列表 + 手动填写」",
  };

  return {
    name,
    ok: method !== "none",
    detail: `${methodLabel[method]}；Electron ${electronVersion} / Chrome ${chromeVersion}`,
  };
}

async function probeTtsService(engine: TtsEngine): Promise<DiagnosticItem> {
  const name = "语音服务可达性（当前引擎）";
  try {
    const result = await engine.probe();
    return { name, ok: result.ok, detail: result.message };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail };
  }
}

/** 造一段极短的静音 WAV，用来验证 decodeAudioData 能取出精确时长 */
function buildSilentWav(sampleRate = 8000, sampleCount = 800): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  return buffer;
}

async function probeAudioDecoding(): Promise<DiagnosticItem> {
  const name = "音频解码（decodeAudioData）";
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return { name, ok: false, detail: "当前环境没有 AudioContext" };
  }

  let context: AudioContext | null = null;
  try {
    context = new Ctor();
    const wav = buildSilentWav();
    const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      context!.decodeAudioData(wav.slice(0), resolve, reject);
    });
    const duration = decoded.duration;
    const sampleRate = decoded.sampleRate;
    if (!Number.isFinite(duration) || duration <= 0) {
      return { name, ok: false, detail: `解出的时长异常：${duration}` };
    }
    return {
      name,
      ok: true,
      detail: `可用；0.1 秒静音解出 ${duration.toFixed(3)} 秒 @ ${sampleRate}Hz`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail: `解码失败：${detail}` };
  } finally {
    if (context) await context.close().catch(() => undefined);
  }
}

async function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return existing;
  return new Promise(resolve => {
    const finish = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    window.setTimeout(finish, timeoutMs);
  });
}

interface BoundarySample {
  name: string;
  charIndex: number;
  charLength: number;
  elapsedMs: number;
}

/**
 * 探测 boundary 事件是否触发、粒度如何 —— 决定本地兜底方案能否做逐词高亮。
 *
 * 注意：Chromium 的语音列表是**异步填充**的，实测首次 getVoices() 会返回空数组，
 * 但 speak() 仍能出声并触发 boundary。所以必须在 speak 之后再查一次列表，
 * 否则会得出「0 个语音」这种误导性结论。
 */
async function probeSpeechBoundary(): Promise<DiagnosticItem> {
  const name = "浏览器语音（speechSynthesis）";
  if (typeof window.speechSynthesis === "undefined") {
    return { name, ok: false, detail: "当前环境没有 speechSynthesis" };
  }

  const voicesBefore = await waitForVoices();
  const utterance = new SpeechSynthesisUtterance("测试一二三。");
  utterance.lang = voicesBefore[0]?.lang ?? "zh-CN";

  const samples: BoundarySample[] = [];
  const startedAt = Date.now();
  utterance.addEventListener("boundary", event => {
    const boundary = event as SpeechSynthesisEvent;
    samples.push({
      name: boundary.name || "word",
      charIndex: boundary.charIndex ?? -1,
      charLength: boundary.charLength ?? -1,
      elapsedMs: Date.now() - startedAt,
    });
  });

  await new Promise<void>(resolve => {
    const done = () => resolve();
    utterance.addEventListener("end", done, { once: true });
    utterance.addEventListener("error", done, { once: true });
    window.setTimeout(done, 8000);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      done();
    }
  });

  const voicesAfter = window.speechSynthesis.getVoices();
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }

  const voiceCount = Math.max(voicesBefore.length, voicesAfter.length);
  const sampleText = samples
    .slice(0, 5)
    .map(s => `${s.name}@${s.charIndex}+${s.charLength}`)
    .join(", ");
  const detail =
    `语音列表 ${voicesBefore.length} → ${voicesAfter.length} 个（Chromium 异步填充，首查常为空）；` +
    `boundary ${samples.length} 次` +
    (samples.length > 0 ? `（${sampleText}）→ 可做逐词高亮` : " → 逐词高亮需退回按权重估算");

  // 语音列表为空不算致命：speak 仍可用，只是设置页无法列出音色
  return { name, ok: samples.length > 0 || voiceCount > 0, detail };
}

/**
 * 真实合成自检。
 *
 * 只探「端口可达」远远不够：实测存在**服务活着但推理全失败**的坏状态
 * （写日志报 `Errno 22 Invalid argument`），此时端口探测照样返回 400，
 * 用户会以为一切正常。所以这里真的合成一小段，才算验证了服务可用。
 */
async function probeTtsSynthesis(
  engine: TtsEngine,
  provider: ReaderTtsProvider,
  refAudioPath: string,
  promptText: string
): Promise<DiagnosticItem> {
  const name = "语音合成自检";
  // 只有 GPT-SoVITS 需要参考音频；Qwen3-TTS 的音色描述可空，
  // Windows 本地语音用的是系统装好的语音
  if (provider === "gpt-sovits" && !refAudioPath.trim()) {
    return {
      name,
      ok: false,
      detail: "未配置参考音频，无法自检。请在「设置 → 朗读 → 声音」点「选择参考音频」",
    };
  }
  // 参考文本可空：无文本提示模式实测可用（坑 14），不再作为自检前置

  try {
    const audio = await engine.synthesize("测试。");
    return {
      name,
      ok: true,
      detail: `可用；合成了 ${audio.bytes.byteLength} 字节（${audio.mimeType}）`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const hint = /Errno 22|Invalid argument/i.test(detail)
      ? "\n这是「服务进程处于坏状态」的典型表现，执行「朗读：重启本地服务」即可恢复。"
      : "";
    return { name, ok: false, detail: `${detail}${hint}` };
  }
}

export interface DiagnosticsOptions {
  engine: TtsEngine;
  /** 当前激活的提供方：决定合成自检要不要参考音频，以及子进程检查用哪套路径 */
  provider: ReaderTtsProvider;
  /** GPT-SoVITS 安装根目录（仅 gpt-sovits 提供方使用；其余提供方传空即可） */
  installRoot: string;
  /** 参考音频路径，用于真实合成自检 */
  refAudioPath: string;
  /** 参考文本，用于真实合成自检 */
  promptText: string;
  /** 是否包含会出声的语音探测 */
  includeSpeech: boolean;
}

export async function runDiagnostics(
  options: DiagnosticsOptions
): Promise<DiagnosticReport> {
  const items: DiagnosticItem[] = [];
  // 子进程能力两项引擎都需要；但「内嵌 Python」验证只对 GPT-SoVITS 有意义，
  // 其余提供方传空 installRoot 让它退回基础 spawn 检查
  items.push(probeChildProcess(options.provider === "gpt-sovits" ? options.installRoot : ""));
  items.push(probeNativeFileDialog());

  const service = await probeTtsService(options.engine);
  items.push(service);
  // 服务不可达时不必再试合成（那条已经红了）
  if (service.ok) {
    items.push(
      await probeTtsSynthesis(
        options.engine,
        options.provider,
        options.refAudioPath,
        options.promptText
      )
    );
  }

  items.push(await probeAudioDecoding());
  if (options.includeSpeech) {
    items.push(await probeSpeechBoundary());
  }
  return { items, allOk: items.every(item => item.ok) };
}

export function formatReport(report: DiagnosticReport): string {
  return report.items
    .map(item => `${item.ok ? "✅" : "❌"} ${item.name}\n    ${item.detail}`)
    .join("\n");
}
