/**
 * Qwen3-TTS 本机推理服务（reader-qwen-server.py）的启动/停止。
 *
 * 生命周期模式与 GptSoVitsServiceLauncher 一致（检测优先、只杀自己启动的进程、
 * 归属落盘 + 重载认领、输出重定向到日志文件），差异点：
 * - 有真 /health 端点：就绪轮询直接等 ready=true，还能拿到「加载失败」的
 *   准确原因（如未安装 qwen-tts），不用靠日志猜测
 * - 启动要素是「Python 解释器 + 模型目录」而不是安装根目录；解释器须已
 *   pip install qwen-tts，模型目录须含 config.json / model.safetensors / speech_tokenizer/
 * - 服务脚本由插件生成（QWEN_SERVER_SCRIPT），启动前内容有变就覆盖
 */
import type { ChildProcess } from "child_process";
import { isProcessAlive, killProcess, loadNodeModule } from "../node-bridge";
import { Qwen3TtsEngine } from "./qwen3-tts";
import type { ServiceRecordStore } from "./service-record";
import type { ServiceHealthInfo, ServiceState } from "./types";
import { QWEN_SERVER_SCRIPT } from "./qwen-server-script";

export interface QwenLaunchOptions {
  /** 模型目录（含 config.json / model.safetensors / speech_tokenizer/） */
  modelPath: string;
  /** 已安装 qwen-tts 的 Python 解释器 */
  pythonPath: string;
  /** 服务地址，用于解析 host 与 port */
  baseUrl: string;
  /** 传给服务的推理设备（device_map） */
  device: string;
  /** 就绪等待上限（毫秒） */
  readyTimeoutMs?: number;
  /** 启动进度回调，用于 Notice 或状态栏 */
  onProgress?: (message: string) => void;
}

export interface QwenLaunchResult {
  ok: boolean;
  message: string;
  /** 是否由本次调用新启动（false 表示复用了已有服务） */
  started: boolean;
  logTail?: string[];
}

const LOG_TAIL_LIMIT = 200;
const POLL_INTERVAL_MS = 1000;
/** 首次加载含磁盘读盘 + 内核预热；1.7B 在本机 SSD 上通常几十秒内 */
const DEFAULT_READY_TIMEOUT_MS = 240_000;

interface NodeProcessModule {
  spawn: (
    command: string,
    args: string[],
    options: Record<string, unknown>
  ) => ChildProcess;
  execFile: (
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: (error: Error | null, stdout: string, stderr: string) => void
  ) => unknown;
}

interface NodeFsModule {
  existsSync: (path: string) => boolean;
  statSync: (path: string) => { isDirectory: () => boolean };
  readFileSync: (path: string, encoding: string) => string;
  writeFileSync: (path: string, data: string) => void;
  mkdirSync: (path: string, options?: Record<string, unknown>) => void;
  openSync: (path: string, flags: string) => number;
  closeSync: (fd: number) => void;
}

function parseEndpoint(baseUrl: string): { host: string; port: string } {
  try {
    const url = new URL(baseUrl);
    return {
      host: url.hostname || "127.0.0.1",
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return { host: "127.0.0.1", port: "9872" };
  }
}

function joinPath(root: string, ...parts: string[]): string {
  const separator = (window as unknown as { process?: { platform?: string } })
    .process?.platform === "win32"
    ? "\\"
    : "/";
  const trimmed = root.replace(/[\\/]+$/, "");
  return [trimmed, ...parts].join(separator);
}

function dirNameOf(path: string): string {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index > 0 ? path.slice(0, index) : path;
}

/** 校验模型目录：config.json / model.safetensors / speech_tokenizer/ 三者齐全 */
export function validateQwenModelPath(modelPath: string): { ok: boolean; message: string } {
  const root = modelPath.trim();
  if (!root) {
    return { ok: false, message: "未配置模型目录。" };
  }
  const fs = loadNodeModule<NodeFsModule>("fs");
  if (!fs) {
    return { ok: false, message: "当前环境无法访问文件系统，无法校验模型目录。" };
  }
  const missing: string[] = [];
  for (const entry of ["config.json", "model.safetensors", "speech_tokenizer"]) {
    try {
      if (!fs.existsSync(joinPath(root, entry))) missing.push(entry);
    } catch {
      missing.push(entry);
    }
  }
  if (missing.length === 0) {
    return { ok: true, message: `模型目录有效：${root}` };
  }
  return {
    ok: false,
    message:
      `在 ${root} 找不到：${missing.join("、")}。\n` +
      "请把「模型目录」填成直接包含 config.json / model.safetensors / speech_tokenizer 的那一层" +
      "（HuggingFace 下载的模型快照目录）。",
  };
}

/**
 * 检查 Python 解释器环境：解释器存在、且已安装 qwen-tts。
 * import torch 较慢，给 120 秒上限；结果直接写进 /health 的 error 同源提示。
 */
export function checkQwenPython(pythonPath: string): Promise<{ ok: boolean; message: string }> {
  const target = pythonPath.trim();
  if (!target) {
    return Promise.resolve({
      ok: false,
      message: "未配置 Python 解释器。需一个已安装 qwen-tts 的 Python 3.10+ 环境（推荐 3.12）。",
    });
  }
  const cp = loadNodeModule<NodeProcessModule>("child_process");
  if (!cp?.execFile) {
    return Promise.resolve({ ok: false, message: "当前环境无法启动子进程，无法检查。" });
  }
  return new Promise(resolve => {
    try {
      cp.execFile(
        target,
        ["-c", "import torch, qwen_tts; print('ok', torch.__version__)"],
        { timeout: 120_000, windowsHide: true, encoding: "utf8" } as never,
        (error, stdout) => {
          if (!error) {
            resolve({ ok: true, message: `qwen-tts 可用（torch ${String(stdout).trim()}）` });
            return;
          }
          const output = `${error.message ?? ""}`.trim();
          if (/ModuleNotFoundError.*qwen_tts/i.test(output) || /No module named ['"]?qwen_tts/i.test(output)) {
            resolve({
              ok: false,
              message:
                `解释器存在，但未安装 qwen-tts。\n` +
                `请在该解释器下执行：pip install -U qwen-tts`,
            });
            return;
          }
          resolve({
            ok: false,
            message: `检查失败：${output.slice(0, 400) || "解释器无法启动"}`,
          });
        }
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      resolve({ ok: false, message: `无法启动解释器：${detail}` });
    }
  });
}

export class QwenTtsServiceLauncher {
  private child: ChildProcess | null = null;
  private logLines: string[] = [];
  /** 尚未凑成完整行的字节（管道回退模式下避免把多字节字符劈开误判） */
  private pendingBytes = new Uint8Array(0);
  private state: ServiceState = "stopped";
  private spawnError: string | null = null;
  /** 我们负责的进程 PID（插件重载后经落盘记录认领回来） */
  private ownedPid: number | null = null;
  private health: ServiceHealthInfo = { state: "unknown" };

  constructor(
    private readonly engine: Qwen3TtsEngine,
    private readonly records?: ServiceRecordStore,
    /** 子进程 stdout/stderr 重定向的日志文件（理由同 GPT-SoVITS：管道会随插件重载失效） */
    private readonly logFilePath?: string | null,
    /** 服务脚本写入位置（插件目录内） */
    private readonly serverScriptPath?: string | null
  ) {}

  getState(): ServiceState {
    return this.state;
  }

  getOwnedPid(): number | null {
    return this.ownedPid;
  }

  getHealth(): ServiceHealthInfo {
    return this.health;
  }

  markHealthy(): void {
    this.health = { state: "ok", checkedAt: Date.now() };
  }

  markUnhealthy(reason: string): void {
    this.health = { state: "broken", reason, checkedAt: Date.now() };
  }

  private resetHealth(): void {
    this.health = { state: "unknown" };
  }

  /** 最近一次 CUDA 降级提示（服务日志里有明确一行） */
  hasCudaDowngrade(): boolean {
    return /已降级到 CPU/i.test(this.getLogTail(200).join("\n"));
  }

  getLogTail(lineCount = 12): string[] {
    const fromFile = this.logFilePath ? readFileTail(this.logFilePath) : [];
    const source = fromFile.length > 0 ? fromFile : this.logLines;
    return source.slice(-lineCount);
  }

  private pushLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.logLines.push(trimmed);
    if (this.logLines.length > LOG_TAIL_LIMIT) {
      this.logLines.splice(0, this.logLines.length - LOG_TAIL_LIMIT);
    }
  }

  private appendBytes(chunk: Uint8Array): void {
    // 与 GPT-SoVITS 启动器同一套按行切分：按字节累积、只在完整 \n 处切行，
    // 避免被 chunk 边界劈开的多字节字符解码失败。我们 spawn 带 -X utf8，按 UTF-8 解
    const merged = new Uint8Array(this.pendingBytes.length + chunk.length);
    merged.set(this.pendingBytes);
    merged.set(chunk, this.pendingBytes.length);

    let start = 0;
    for (let i = 0; i < merged.length; i++) {
      if (merged[i] !== 0x0a) continue;
      this.pushLine(new TextDecoder("utf-8").decode(merged.subarray(start, i)));
      start = i + 1;
    }
    this.pendingBytes = merged.slice(start);
    if (this.pendingBytes.length > 8192) this.pendingBytes = new Uint8Array(0);
  }

  /** 把服务脚本写到插件目录；内容没变就不动（避免无谓的写盘） */
  private ensureServerScript(): { ok: true; path: string } | { ok: false; message: string } {
    const path = this.serverScriptPath;
    if (!path) {
      return { ok: false, message: "无法确定服务脚本写入位置（非桌面环境？）" };
    }
    const fs = loadNodeModule<NodeFsModule>("fs");
    if (!fs) {
      return { ok: false, message: "当前环境无法访问文件系统，无法生成服务脚本。" };
    }
    try {
      let current: string | null = null;
      try {
        current = fs.readFileSync(path, "utf8");
      } catch {
        current = null;
      }
      if (current !== QWEN_SERVER_SCRIPT) {
        try {
          fs.mkdirSync(dirNameOf(path), { recursive: true });
        } catch {
          /* 目录可能已存在 */
        }
        fs.writeFileSync(path, QWEN_SERVER_SCRIPT);
      }
      return { ok: true, path };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `写入服务脚本失败：${detail}` };
    }
  }

  /**
   * 确保服务可用：已有则复用，没有则校验环境并启动。
   * 就绪判定：/health 返回 ready=true；error 字段非空则立刻失败并给出原因。
   */
  async ensureRunning(options: QwenLaunchOptions): Promise<QwenLaunchResult> {
    const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    const endpoint = parseEndpoint(options.baseUrl);

    const existing = await this.engine.health();
    if (existing.reachable) {
      this.state = this.child || this.ownedPid ? "owned" : "external";
      if (existing.error) {
        return {
          ok: false,
          started: false,
          message: `端口 ${endpoint.port} 上有服务，但模型加载失败：${existing.error}`,
        };
      }
      if (!existing.ready) {
        return {
          ok: false,
          started: false,
          message: `端口 ${endpoint.port} 上的服务正在加载模型，请稍候再试`,
        };
      }
      return {
        ok: true,
        started: false,
        message: `复用已在运行的服务（${options.baseUrl}）`,
      };
    }

    const modelCheck = validateQwenModelPath(options.modelPath);
    if (!modelCheck.ok) {
      return { ok: false, started: false, message: modelCheck.message };
    }
    const python = options.pythonPath.trim();
    if (!python) {
      return {
        ok: false,
        started: false,
        message:
          "未配置 Python 解释器。需要一个已安装 qwen-tts 的 Python 3.10+ 环境" +
          "（推荐 3.12：pip install -U qwen-tts），填入「Python 解释器」后可自动启动。",
      };
    }
    const fs = loadNodeModule<NodeFsModule>("fs");
    if (fs && python.includes("\\") && !fs.existsSync(python)) {
      return {
        ok: false,
        started: false,
        message: `找不到 Python 解释器：${python}\n请检查「Python 解释器」路径。`,
      };
    }

    const script = this.ensureServerScript();
    if (!script.ok) return { ok: false, started: false, message: script.message };

    const spawned = this.spawn(python, script.path, options.modelPath, endpoint, options.device);
    if (!spawned.ok) return spawned;

    options.onProgress?.("正在启动 Qwen3-TTS 服务并加载模型…");

    const deadline = Date.now() + readyTimeoutMs;
    let exited = false;
    this.child?.once("exit", () => {
      exited = true;
    });

    const failure = (reason: string): QwenLaunchResult => ({
      ok: false,
      started: true,
      message: reason,
      logTail: this.getLogTail(),
    });

    while (Date.now() < deadline) {
      if (this.spawnError) {
        this.state = "stopped";
        this.child = null;
        return failure(`启动进程失败：${this.spawnError}`);
      }
      if (exited) {
        this.state = "stopped";
        return failure("服务启动后立即退出，详见服务日志。");
      }
      const health = await this.engine.health();
      if (health.reachable && health.error) {
        this.state = "owned";
        return failure(`模型加载失败：${health.error}`);
      }
      if (health.reachable && health.ready) {
        this.state = "owned";
        const downgrade = this.hasCudaDowngrade()
          ? "（检测到 CUDA 不可用，已降级到 CPU —— 合成会非常慢）"
          : "";
        return { ok: true, started: true, message: `服务已启动${downgrade}` };
      }
      await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS));
    }

    await this.stop();
    return failure(`等待模型加载超时（${Math.round(readyTimeoutMs / 1000)} 秒）。`);
  }

  private spawn(
    python: string,
    script: string,
    modelPath: string,
    endpoint: { host: string; port: string },
    device: string
  ): QwenLaunchResult {
    const processModule = loadNodeModule<NodeProcessModule>("child_process");
    if (!processModule?.spawn) {
      return {
        ok: false,
        started: false,
        message:
          '当前环境无法启动子进程（require("child_process") 不可用），请手动启动服务。',
      };
    }

    // 与 GPT-SoVITS 相同：输出重定向到文件而不是管道（插件重载会弄坏管道）
    let logFd: number | null = null;
    const fs = loadNodeModule<NodeFsModule>("fs");
    if (this.logFilePath && fs) {
      try {
        logFd = fs.openSync(this.logFilePath, "w");
      } catch {
        logFd = null;
      }
    }

    try {
      this.logLines = [];
      this.pendingBytes = new Uint8Array(0);
      this.spawnError = null;
      this.state = "starting";
      this.resetHealth();
      const child = processModule.spawn(
        python,
        [
          "-X",
          "utf8",
          script,
          "--model",
          modelPath,
          "--host",
          endpoint.host,
          "--port",
          endpoint.port,
          "--device",
          device.trim() || "cuda:0",
        ],
        {
          cwd: dirNameOf(script),
          windowsHide: true,
          stdio: logFd !== null ? ["ignore", logFd, logFd] : ["ignore", "pipe", "pipe"],
        }
      );
      if (logFd !== null) {
        fs?.closeSync(logFd);
        logFd = null;
      }
      this.child = child;
      this.ownedPid = child.pid ?? null;
      if (this.ownedPid) {
        void this.records?.save({
          pid: this.ownedPid,
          port: endpoint.port,
          startedAt: Date.now(),
        });
      }
      child.stdout?.on("data", (data: Uint8Array) => this.appendBytes(data));
      child.stderr?.on("data", (data: Uint8Array) => this.appendBytes(data));
      child.on("error", (error: Error) => {
        this.spawnError = error.message;
        this.pushLine(`spawn 错误：${error.message}`);
      });
      return { ok: true, started: true, message: "已发起启动" };
    } catch (error) {
      if (logFd) {
        try {
          fs?.closeSync(logFd);
        } catch {
          /* 已经关了 */
        }
      }
      this.state = "stopped";
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, started: false, message: `启动失败：${detail}` };
    }
  }

  /** 从落盘记录认领上次启动的进程（双重确认：PID 存活 且 端口在服务） */
  async adoptFromRecord(baseUrl: string): Promise<boolean> {
    if (this.state === "owned") return true;
    const record = await this.records?.load();
    if (!record) return false;
    if (record.port !== parseEndpoint(baseUrl).port) {
      await this.records?.save(null);
      return false;
    }
    if (!isProcessAlive(record.pid)) {
      await this.records?.save(null);
      return false;
    }
    const health = await this.engine.health();
    if (!health.reachable) return false;

    this.ownedPid = record.pid;
    this.state = "owned";
    this.resetHealth();
    return true;
  }

  /** 轮询直到服务不可达（说明端口释放了） */
  private async waitForPortFree(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const health = await this.engine.health();
      if (!health.reachable) return true;
      if (Date.now() >= deadline) return false;
      await new Promise(resolve => window.setTimeout(resolve, 300));
    }
  }

  /** 停止服务。只杀我们自己启动（或认领）的进程 */
  async stop(): Promise<{ ok: boolean; message: string }> {
    const owned = this.state === "owned" || this.state === "starting";
    if (!owned) {
      return {
        ok: true,
        message: "没有由本插件启动的 Qwen3-TTS 服务需要停止（可用「强制停止」按端口关闭）",
      };
    }

    if (this.spawnError) {
      this.child = null;
      this.ownedPid = null;
      this.spawnError = null;
      this.state = "stopped";
      await this.records?.save(null);
      return { ok: true, message: "启动未成功，已清理状态" };
    }

    const pid = this.ownedPid ?? this.child?.pid ?? null;
    await this.engine.requestShutdown();
    let freed = await this.waitForPortFree(3000);
    if (!freed && pid) {
      killProcess(pid);
      freed = await this.waitForPortFree(2500);
    }

    this.child = null;
    this.ownedPid = null;
    this.state = "stopped";
    this.resetHealth();
    await this.records?.save(null);
    return {
      ok: true,
      message: freed ? "Qwen3-TTS 服务已退出" : "已发送停止信号，但端口仍被占用（可稍后重试）",
    };
  }

  /** 强制停止：不做归属判断，直接让配置端口上的服务退出 */
  async forceStop(): Promise<{ ok: boolean; message: string }> {
    const health = await this.engine.health();
    if (!health.reachable) {
      this.state = "stopped";
      this.ownedPid = null;
      this.child = null;
      this.resetHealth();
      await this.records?.save(null);
      return { ok: true, message: "服务本来就没有在运行" };
    }

    await this.engine.requestShutdown();
    let freed = await this.waitForPortFree(4000);
    if (!freed && this.ownedPid) {
      killProcess(this.ownedPid);
      freed = await this.waitForPortFree(2500);
    }

    this.child = null;
    this.ownedPid = null;
    this.state = "stopped";
    this.resetHealth();
    await this.records?.save(null);
    return {
      ok: true,
      message: freed
        ? "Qwen3-TTS 服务已退出"
        : "已发送退出请求，但端口仍被占用。可能是别的程序占着该端口，请检查。",
    };
  }

  /** 插件卸载时的清理；stopService 为 false 时保留进程与归属记录 */
  dispose(stopService: boolean): void {
    if (!stopService) return;
    if (this.state === "owned" || this.state === "starting") {
      void this.stop();
    }
  }
}

const LOG_READ_LIMIT_BYTES = 256 * 1024;

interface NodeFileReadModule {
  existsSync: (path: string) => boolean;
  openSync: (path: string, flags: string) => number;
  closeSync: (fd: number) => void;
  fstatSync: (fd: number) => { size: number };
  readSync: (
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number
  ) => number;
}

/** 读日志尾部并按行解码。日志最多读 256KB，避免同步读卡住界面 */
function readFileTail(path: string): string[] {
  const fs = loadNodeModule<NodeFileReadModule>("fs");
  if (!fs) return [];
  try {
    if (!fs.existsSync(path)) return [];
    const fd = fs.openSync(path, "r");
    try {
      const size = fs.fstatSync(fd).size;
      if (size <= 0) return [];
      const start = Math.max(0, size - LOG_READ_LIMIT_BYTES);
      const length = size - start;
      const buffer = new Uint8Array(length);
      const read = fs.readSync(fd, buffer, 0, length, start);
      const lines = new TextDecoder("utf-8")
        .decode(buffer.subarray(0, read))
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      // 从文件中间开始读时首行可能是半截，丢掉
      return start > 0 ? lines.slice(1) : lines;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
}
