/**
 * GPT-SoVITS 本地服务的启动/停止。
 *
 * 设计原则：**检测优先，启动可选，绝不篡改用户配置**。
 * - 端口只能被一个进程占用，所以先探测：已有服务在跑就直接复用（用户可能正为别的应用开着）
 * - 只有我们 spawn 出来的进程才会被我们杀掉
 * - 不传 -c 时服务读用户自己的 GPT_SoVITS/configs/tts_infer.yaml，
 *   与他在网页里调好的状态完全一致；插件不去写那个文件
 *
 * 实测数据（见 docs/gpt-sovits-integration.md）：
 * - 冷启动 20–65 秒，所以就绪超时给到 120 秒并需要进度反馈
 * - CUDA 不可用时服务**静默降级到 CPU**（只 print 一行 warning），
 *   所以必须读日志尾部并把降级提示给用户，否则用户只会觉得「怎么这么慢」
 */
import type { ChildProcess } from "child_process";
import { isProcessAlive, isWindows, killProcess, loadNodeModule } from "../node-bridge";
import { GptSoVitsEngine } from "./gpt-sovits";
import type { ServiceRecordStore } from "./service-record";
// 状态类型已上移到 types.ts 与 Qwen 启动器共用；这里再导出保持既有引用不变
import type { ServiceHealthInfo, ServiceState } from "./types";
export type { ServiceHealthInfo, ServiceState };

export interface LaunchOptions {
  /** GPT-SoVITS 安装根目录（含 runtime/ 与 api_v2.py） */
  installRoot: string;
  /** 服务地址，用于解析 host 与 port */
  baseUrl: string;
  /** 就绪等待上限（毫秒） */
  readyTimeoutMs?: number;
  /** 启动进度回调，用于 Notice 或状态栏 */
  onProgress?: (message: string) => void;
}

export interface LaunchResult {
  ok: boolean;
  /** 面向用户的说明（不含日志，日志另放在 logTail） */
  message: string;
  /** 是否由本次调用新启动（false 表示复用了已有服务） */
  started: boolean;
  /** 失败诊断用的日志尾部 */
  logTail?: string[];
}

const LOG_TAIL_LIMIT = 200;
const POLL_INTERVAL_MS = 1000;

interface NodeProcessModule {
  spawn: (
    command: string,
    args: string[],
    options: Record<string, unknown>
  ) => ChildProcess;
}

interface NodeFsModule {
  existsSync: (path: string) => boolean;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean; size: number };
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

/** 读日志尾部时最多读这么多字节，避免日志涨到几 MB 后同步读卡住界面 */
const LOG_READ_LIMIT_BYTES = 256 * 1024;

/** 读文件尾部并按行解码（编码判定复用 decodeConsoleChunk，兼容 GBK） */
function readFileTail(path: string): string[] {
  const fs = loadNodeModule<NodeFsModule>("fs");
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
      const lines = decodeConsoleChunk(buffer.subarray(0, read))
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

function parseEndpoint(baseUrl: string): { host: string; port: string } {
  try {
    const url = new URL(baseUrl);
    return {
      host: url.hostname || "127.0.0.1",
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return { host: "127.0.0.1", port: "9880" };
  }
}

function joinPath(root: string, ...parts: string[]): string {
  const separator = isWindows() ? "\\" : "/";
  const trimmed = root.replace(/[\\/]+$/, "");
  return [trimmed, ...parts].join(separator);
}

/** 内嵌解释器的相对路径（Windows 是 runtime\python.exe，类 Unix 是 runtime/python） */
function pythonRelativePath(): string[] {
  return ["runtime", isWindows() ? "python.exe" : "python"];
}

/**
 * 解码子进程输出的一整行。
 *
 * 为什么要回退：Windows 中文环境下，Python 往管道写的是 **GBK（cp936）** 字节，
 * 直接按 UTF-8 解会把中文路径变成乱码（实测 `MyGO_千早爱音_v2pp.ckpt` → `MyGO_ǧ�簮��`）。
 * 先用严格 UTF-8 试，失败再按 GBK 解。
 */
export function decodeConsoleChunk(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("gbk").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

/** 从启动日志里解析出实际加载的权重文件 */
export function parseLoadedModel(lines: string[]): { gpt?: string; sovits?: string } {
  const result: { gpt?: string; sovits?: string } = {};
  for (const line of lines) {
    const gpt = /Loading Text2Semantic weights from (.+)$/.exec(line);
    if (gpt) result.gpt = gpt[1].trim();

    const vits = /Loading VITS weights from (.+)$/.exec(line);
    if (vits) {
      // 该行后面通常还跟着 _IncompatibleKeys(...)，在第一个 ". " 处截断
      result.sovits = vits[1].split(". ")[0].trim();
    }
  }
  return result;
}

interface ResolvedRoot {
  ok: true;
  root: string;
  /** 自动定位到子目录时给出的说明，需回显给用户 */
  note?: string;
}

type ResolveOutcome = ResolvedRoot | { ok: false; message: string };

/**
 * 校验安装根目录，并在必要时往下探一层。
 *
 * 为什么需要：GPT-SoVITS 的发行包解压出来是**同名双层目录**
 * （`GPT-SoVITS-v2pro-20250604\GPT-SoVITS-v2pro-20250604\`），
 * 用户很容易只填到外层，结果 spawn 报 ENOENT —— 这个错误对用户毫无指引。
 */
function resolveInstallRoot(input: string): ResolveOutcome {
  const root = input.trim();
  if (!root) {
    return { ok: false, message: "未配置安装根目录。" };
  }

  const fs = loadNodeModule<NodeFsModule>("fs");
  if (!fs) {
    return { ok: false, message: "当前环境无法访问文件系统，无法校验安装根目录。" };
  }

  const looksLikeInstallRoot = (dir: string): boolean => {
    try {
      return (
        fs.existsSync(joinPath(dir, "api_v2.py")) &&
        fs.existsSync(joinPath(dir, ...pythonRelativePath()))
      );
    } catch {
      return false;
    }
  };

  if (looksLikeInstallRoot(root)) return { ok: true, root };

  // 往下探一层找真正的安装根目录
  let children: string[] = [];
  try {
    children = fs.readdirSync(root);
  } catch {
    return {
      ok: false,
      message:
        `目录不存在或无法读取：${root}\n` +
        "请检查「安装根目录」是否填错。注意 GPT-SoVITS 发行包解压后常是同名双层目录，容易只填到外层。",
    };
  }

  const candidates: string[] = [];
  for (const name of children) {
    const child = joinPath(root, name);
    try {
      if (fs.statSync(child).isDirectory() && looksLikeInstallRoot(child)) {
        candidates.push(child);
      }
    } catch {
      /* 跳过不可读项 */
    }
  }

  if (candidates.length === 1) {
    return { ok: true, root: candidates[0], note: `已自动定位到子目录：${candidates[0]}` };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      message:
        `${root} 下有多个候选安装目录，请明确指定其一：\n` + candidates.join("\n"),
    };
  }

  return {
    ok: false,
    message:
      `在 ${root} 找不到 api_v2.py 与 runtime/${isWindows() ? "python.exe" : "python"}。\n` +
      "请把「安装根目录」填成**直接包含 api_v2.py 与 runtime/ 的那一层**。\n" +
      "注意 GPT-SoVITS 发行包解压后常是同名双层目录，容易只填到外层。",
  };
}

/**
 * 解析内嵌解释器的绝对路径（含双层目录自动定位）。
 *
 * 导出给诊断用 —— 诊断若直接用用户填的 installRoot，遇到「只填到外层」时会
 * 报「找不到 python.exe」，而启动器其实是能自动定位的，两边判定必须一致。
 */
export function resolvePythonExecutable(
  installRoot: string
): { ok: true; python: string; root: string; note?: string } | { ok: false; message: string } {
  const resolved = resolveInstallRoot(installRoot);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    python: joinPath(resolved.root, ...pythonRelativePath()),
    root: resolved.root,
    note: resolved.note,
  };
}

export class GptSoVitsServiceLauncher {  private child: ChildProcess | null = null;
  private logLines: string[] = [];
  /** 尚未凑成完整行的字节，见 appendBytes */
  private pendingBytes = new Uint8Array(0);
  private state: ServiceState = "stopped";
  private exitHandler: (() => void) | null = null;
  /** spawn 失败（如 ENOENT）时记录；这种情况不会触发 exit，必须单独判断 */
  private spawnError: string | null = null;
  /**
   * 我们负责的进程 PID。
   * 与 child 分开保存 —— 插件重载后 child 句柄没了，但 PID 仍能从落盘记录认领回来。
   */
  private ownedPid: number | null = null;
  /** 推理健康度；由 controller / 诊断在真实合成后上报 */
  private health: ServiceHealthInfo = { state: "unknown" };

  constructor(
    private readonly engine: GptSoVitsEngine,
    private readonly records?: ServiceRecordStore,
    /**
     * 服务日志的绝对路径。子进程的 stdout/stderr 会**重定向到这个文件**而不是管道。
     *
     * 为什么必须这样：管道读端由本实例持有，插件一重载旧实例被回收，
     * 读端就关了；服务进程下一次往 stdout 写日志（tqdm 进度条、print）会抛
     * `OSError: [Errno 22] Invalid argument`（Windows 上写已关闭管道的典型表现），
     * 之后整个推理都会失败。实测两次故障都紧跟插件重载。
     *
     * 写文件还有个额外好处：日志能跨重载保留，「查看服务日志」对认领回来的服务也有效。
     */
    private readonly logFilePath?: string | null
  ) {}

  getState(): ServiceState {
    return this.state;
  }

  /** 当前由本插件负责的进程 PID（含重载后认领回来的） */
  getOwnedPid(): number | null {
    return this.ownedPid;
  }

  // ── 推理健康度（由调用方在真实合成成功/失败后上报）────────────

  getHealth(): ServiceHealthInfo {
    return this.health;
  }

  markHealthy(): void {
    this.health = { state: "ok", checkedAt: Date.now() };
  }

  markUnhealthy(reason: string): void {
    this.health = { state: "broken", reason, checkedAt: Date.now() };
  }

  /** 服务启停后健康度未知，重置掉旧的判定 */
  private resetHealth(): void {
    this.health = { state: "unknown" };
  }

  /**
   * 日志尾部若干行。
   * 优先读日志文件 —— 这样认领回来的服务（本次会话没捕获过 stdout）也能看到日志。
   */
  getLogTail(lineCount = 12): string[] {
    const fromFile = this.logFilePath ? readFileTail(this.logFilePath) : [];
    const source = fromFile.length > 0 ? fromFile : this.logLines;
    return source.slice(-lineCount);
  }

  /** 服务是否报告了 CUDA 不可用而降级到 CPU */
  hasCudaDowngrade(): boolean {
    const joined = this.getLogTail(200).join("\n");
    return /CUDA is not available|set device to CPU/i.test(joined);
  }

  /** 从日志里解析实际加载的权重（用于设置页显示当前音色） */
  getLoadedModel(): { gpt?: string; sovits?: string } {
    return parseLoadedModel(this.getLogTail(200));
  }

  /** 校验并（必要时）自动定位安装根目录，供设置页做即时校验 */
  validateInstallRoot(installRoot: string): ResolveOutcome {
    return resolveInstallRoot(installRoot);
  }

  private pushLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.logLines.push(trimmed);
    if (this.logLines.length > LOG_TAIL_LIMIT) {
      this.logLines.splice(0, this.logLines.length - LOG_TAIL_LIMIT);
    }
  }

  /**
   * 按字节累积、只在完整的换行处切行。
   * 这样多字节字符不会被 chunk 边界劈开，编码判定才可靠
   * （直接对每个 chunk 解码，可能把被截断的 UTF-8 误判成 GBK）。
   */
  private appendBytes(chunk: Uint8Array): void {
    const merged = new Uint8Array(this.pendingBytes.length + chunk.length);
    merged.set(this.pendingBytes);
    merged.set(chunk, this.pendingBytes.length);

    let start = 0;
    for (let i = 0; i < merged.length; i++) {
      if (merged[i] !== 0x0a) continue;
      this.pushLine(decodeConsoleChunk(merged.subarray(start, i)));
      start = i + 1;
    }
    this.pendingBytes = merged.slice(start);
    // 防御：长时间没有换行（如进度条刷屏）时不要无限增长
    if (this.pendingBytes.length > 8192) this.pendingBytes = new Uint8Array(0);
  }

  /**
   * 确保服务可用：已有则复用，没有则按需启动。
   * 就绪判定用「空体 POST /tts 拿到 400」—— 连不上才是没起来。
   */
  async ensureRunning(options: LaunchOptions): Promise<LaunchResult> {
    const readyTimeoutMs = options.readyTimeoutMs ?? 120_000;
    const endpoint = parseEndpoint(options.baseUrl);

    const existing = await this.engine.probe();
    if (existing.ok) {
      // 已有服务在跑。若这个进程本来就是我们启动/认领的，必须保持 owned ——
      // 否则会失去对它的追踪，stop() 就不肯杀，留下孤儿进程。
      this.state = this.child || this.ownedPid ? "owned" : "external";
      return {
        ok: true,
        started: false,
        message: `复用已在运行的服务（${options.baseUrl}）`,
      };
    }

    if (!options.installRoot.trim()) {
      return {
        ok: false,
        started: false,
        message:
          "服务未运行，且未配置安装根目录。\n" +
          "请在「设置 → 朗读 → 服务」中填入 GPT-SoVITS 安装根目录，或手动启动 api_v2.py。",
      };
    }

    const resolved = resolveInstallRoot(options.installRoot);
    if (!resolved.ok) {
      return { ok: false, started: false, message: resolved.message };
    }

    const spawned = this.spawn(resolved.root, endpoint);
    if (!spawned.ok) return spawned;

    options.onProgress?.("正在加载声音模型（首次约需 20–65 秒）…");

    const deadline = Date.now() + readyTimeoutMs;
    let exited = false;
    const onExit = () => {
      exited = true;
    };
    this.exitHandler = onExit;
    this.child?.once("exit", onExit);

    const failure = (reason: string): LaunchResult => ({
      ok: false,
      started: true,
      message: reason,
      logTail: this.getLogTail(),
    });

    while (Date.now() < deadline) {
      // spawn 失败（ENOENT 等）不会触发 exit，必须单独判断，否则会白等满超时
      if (this.spawnError) {
        this.state = "stopped";
        this.child = null;
        return failure(`启动进程失败：${this.spawnError}`);
      }
      if (exited) {
        this.state = "stopped";
        return failure("服务启动后立即退出。");
      }
      const probe = await this.engine.probe();
      if (probe.ok) {
        this.state = "owned";
        const prefix = resolved.note ? `${resolved.note}\n` : "";
        return {
          ok: true,
          started: true,
          message: this.hasCudaDowngrade()
            ? `${prefix}服务已启动，但检测到 CUDA 不可用，已降级到 CPU —— 合成会非常慢。请检查显卡驱动或改用其他设备配置。`
            : `${prefix}服务已启动`,
        };
      }
      await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS));
    }

    await this.stop();
    return failure(`等待服务就绪超时（${Math.round(readyTimeoutMs / 1000)} 秒）。`);
  }

  private spawn(
    installRoot: string,
    endpoint: { host: string; port: string }
  ): LaunchResult {
    const processModule = loadNodeModule<NodeProcessModule>("child_process");
    if (!processModule?.spawn) {
      return {
        ok: false,
        started: false,
        message:
          '当前环境无法启动子进程（require("child_process") 不可用），请手动启动服务。',
      };
    }

    const python = joinPath(installRoot, ...pythonRelativePath());
    const script = joinPath(installRoot, "api_v2.py");

    // 优先把子进程输出重定向到文件。管道会在插件重载后失效
    // （读端被回收 → 服务写日志时抛 Errno 22 → 之后推理全失败），文件没有这个问题。
    let logFd: number | null = null;
    if (this.logFilePath) {
      const fs = loadNodeModule<NodeFsModule>("fs");
      if (fs) {
        try {
          // "w" 覆盖：每次启动服务都是一份新日志，避免无限增长
          logFd = fs.openSync(this.logFilePath, "w");
        } catch {
          logFd = null;
        }
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
        // 必须带 "-X utf8"：
        //   服务内部有多处 print(目标文本)（如 TTS_infer_pack/TextPreprocessor.py:83），
        //   而中文 Windows 上被重定向到文件的 stdout 默认是 GBK。文本里只要出现
        //   GBK 编不出的字符（实测 U+A7A8），print 就抛 UnicodeEncodeError，
        //   整个请求变成 {"message":"tts failed","Exception":"'gbk' codec can't encode…"}。
        //   注意不能用 PYTHONIOENCODING 环境变量 —— 这里的 "-I" 是隔离模式，
        //   会忽略全部 PYTHON* 环境变量；命令行 -X 不受影响（已实测两种组合）。
        ["-I", "-X", "utf8", script, "-a", endpoint.host, "-p", endpoint.port],
        {
          cwd: installRoot,
          windowsHide: true,
          stdio: logFd !== null ? ["ignore", logFd, logFd] : ["ignore", "pipe", "pipe"],
        }
      );
      // 子进程已继承自己的 fd 副本，父进程这份可以关了
      if (logFd !== null) {
        loadNodeModule<NodeFsModule>("fs")?.closeSync(logFd);
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
      // 只有退回管道模式时才需要监听（文件模式直接从文件读）
      child.stdout?.on("data", (data: Uint8Array) => this.appendBytes(data));
      child.stderr?.on("data", (data: Uint8Array) => this.appendBytes(data));
      child.on("error", (error: Error) => {
        // ENOENT 等不会触发 exit，记下来让轮询循环立刻失败
        this.spawnError = error.message;
        this.pushLine(`spawn 错误：${error.message}`);
      });
      return { ok: true, started: true, message: "已发起启动" };
    } catch (error) {
      if (logFd !== null) {
        try {
          loadNodeModule<NodeFsModule>("fs")?.closeSync(logFd);
        } catch {
          /* 已经关了 */
        }
      }
      this.state = "stopped";
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, started: false, message: `启动失败：${detail}` };
    }
  }

  /**
   * 从落盘记录认领上次启动的进程。
   *
   * 插件重载后 child 句柄丢失，但进程还活着 —— 不认领的话它就成了
   * 「在跑但没人负责停」的孤儿，用户点停止只会得到「没有需要停止的服务」。
   *
   * 双重确认：PID 仍存活 **且** 端口确实在服务，避免 PID 复用导致误判。
   */
  async adoptFromRecord(baseUrl: string): Promise<boolean> {
    if (this.state === "owned") return true;
    const record = await this.records?.load();
    if (!record) return false;

    // 端口变了 → 记录已失效（用户改了服务地址，或上次是别的端口）
    if (record.port !== parseEndpoint(baseUrl).port) {
      await this.records?.save(null);
      return false;
    }
    if (!isProcessAlive(record.pid)) {
      await this.records?.save(null);
      return false;
    }
    const probe = await this.engine.probe();
    if (!probe.ok) {
      // 进程活着但服务不通 —— 不是可用的服务，不认领
      return false;
    }

    this.ownedPid = record.pid;
    this.state = "owned";
    // 认领回来的服务健康度未知，等真实合成后才知道
    this.resetHealth();
    return true;
  }

  /** 轮询直到服务不可达（说明端口释放了） */
  private async waitForPortFree(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const probe = await this.engine.probe();
      if (!probe.ok) return true;
      if (Date.now() >= deadline) return false;
      await new Promise(resolve => window.setTimeout(resolve, 300));
    }
  }

  /**
   * 停止服务。**只杀我们自己启动（或认领）的进程**；
   * 外部已在运行的服务一律不动（用户可能正为别的应用开着）。
   */
  async stop(): Promise<{ ok: boolean; message: string }> {
    const owned = this.state === "owned" || this.state === "starting";
    if (!owned) {
      return {
        ok: true,
        message: "没有由本插件启动的服务需要停止（可用「朗读：强制停止服务」按端口关闭）",
      };
    }

    if (this.exitHandler && this.child) {
      this.child.off("exit", this.exitHandler);
      this.exitHandler = null;
    }

    // spawn 都没成功（如 ENOENT）时没有真实进程可停，直接清理状态
    if (this.spawnError) {
      this.child = null;
      this.ownedPid = null;
      this.spawnError = null;
      this.state = "stopped";
      await this.records?.save(null);
      return { ok: true, message: "启动未成功，已清理状态" };
    }

    const pid = this.ownedPid ?? this.child?.pid ?? null;

    // 先请求优雅退出，再兜底按 PID 终止。
    // 用「端口是否释放」判断结果 —— 认领回来的进程没有 exit 事件可听。
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
      message: freed ? "服务已退出" : "已发送停止信号，但端口仍被占用（可稍后重试或手动结束该进程）",
    };
  }

  /**
   * 强制停止：不依赖归属判断，直接让配置端口上的服务退出。
   *
   * 用于「插件重载后丢了归属」或「外部启动但现在想关掉」的场景。
   * 会关掉该端口上的任何 GPT-SoVITS 服务，所以调用方应先向用户确认。
   */
  async forceStop(): Promise<{ ok: boolean; message: string }> {
    const probe = await this.engine.probe();
    if (!probe.ok) {
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
        ? "服务已退出"
        : "已发送退出请求，但端口仍被占用。可能是别的程序占着该端口，请检查。",
    };
  }

  /**
   * 插件卸载时的清理。
   *
   * `stopService` 为 false 时**只丢弃句柄、保留进程与归属记录** ——
   * 下次加载会通过 adoptFromRecord 认领回来。这是默认行为：
   * 冷启动要 20–65 秒，热重载/重启 Obsidian 都重启一次代价太大。
   */
  dispose(stopService: boolean): void {
    if (!stopService) return;
    if (this.state === "owned" || this.state === "starting") {
      void this.stop();
    }
  }
}
