/**
 * Qwen3-TTS 一键环境准备。
 *
 * 把「找模型目录 → 挑 Python → 建 venv → pip install qwen-tts → 回填路径」
 * 压成一个按钮，全部步骤幂等：已有就复用，不重复安装。
 *
 * 取舍：
 * - venv 固定建在模型目录旁（<模型目录>/../glimpse-qwen-tts-env）：
 *   与模型同盘、不在 vault 内（避免被同步），且无需用户再选位置
 * - Python 自动挑选：解析 `py -0p`，优先 3.12 > 3.11 > 3.13 > 3.10，
 *   排除 3.14+（torch/qwen-tts 轮子兼容性未验证）与 <3.10
 * - pip 安装输出重定向到日志文件（管道会随插件重载失效，见 GPT-SoVITS 坑 1），
 *   靠轮询文件大小给出进度；5 分钟无输出判定为停滞
 * - 首次安装失败自动用清华镜像重试一次（国内直连 PyPI 常超时）
 */
import { isWindows, killProcess, loadNodeModule } from "../node-bridge";
import { checkQwenPython, validateQwenModelPath } from "./qwen-launcher";

export interface QwenSetupOptions {
  /** 设置里现有的模型目录（可为空，空则自动扫描） */
  modelPath: string;
  /** 设置里现有的解释器（可为空，或已是装好 qwen-tts 的环境则直接复用） */
  pythonPath: string;
  /** pip 安装日志文件路径（用于进度轮询与排障） */
  setupLogPath?: string | null;
  onProgress: (message: string) => void;
}

export interface QwenSetupResult {
  ok: boolean;
  message: string;
  /** 自动找到/确认的模型目录（应回填设置） */
  modelPath?: string;
  /** 准备好的解释器路径（应回填设置） */
  pythonPath?: string;
}

interface NodeProcessModule {
  execFile: (
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: (error: { message?: string } | null, stdout: string, stderr: string) => void
  ) => unknown;
  spawn: (
    command: string,
    args: string[],
    options: Record<string, unknown>
  ) => { pid?: number; on: (event: string, listener: (...args: unknown[]) => void) => unknown };
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

function joinPath(root: string, ...parts: string[]): string {
  const separator = isWindows() ? "\\" : "/";
  return [root.replace(/[\\/]+$/, ""), ...parts].join(separator);
}

function dirNameOf(path: string): string {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index > 0 ? path.slice(0, index) : path;
}

/** execFile 的 Promise 包装；非零退出与 spawn 失败都归入 error */
function runFile(
  file: string,
  args: string[],
  timeoutMs: number
): Promise<{ ok: true; stdout: string } | { ok: false; detail: string }> {
  const cp = loadNodeModule<NodeProcessModule>("child_process");
  if (!cp?.execFile) {
    return Promise.resolve({ ok: false, detail: "当前环境无法启动子进程" });
  }
  return new Promise(resolve => {
    try {
      cp.execFile(
        file,
        args,
        { timeout: timeoutMs, windowsHide: true, encoding: "utf8" } as never,
        (error, stdout, stderr) => {
          if (!error) {
            resolve({ ok: true, stdout: String(stdout ?? "") });
            return;
          }
          const output = [error.message ?? "", String(stderr ?? "")].join("\n").trim();
          resolve({ ok: false, detail: output.slice(0, 400) || "进程执行失败" });
        }
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      resolve({ ok: false, detail });
    }
  });
}

// ── 第 1 步：模型目录 ─────────────────────────────────────────

const MODEL_NAME_PATTERN = /qwen3[\s_-]*tts/i;
/** 深度扫描时跳过的系统目录（减少无谓的 readdir） */
const SCAN_SKIP = new Set([
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "users",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "perflogs",
  "appdata",
]);
const SCAN_DIR_BUDGET = 5000;

/** 在所有盘符的深度 ≤2 内找名字像 Qwen3-TTS 且结构完整的模型目录 */
export function scanForQwenModel(): string | null {
  const fs = loadNodeModule<NodeFsModule>("fs");
  if (!fs) return null;
  let visited = 0;

  const isValidModel = (dir: string): string | null =>
    validateQwenModelPath(dir).ok ? dir : null;

  const matches = (name: string): boolean => MODEL_NAME_PATTERN.test(name);

  for (let letter = 67; letter <= 90; letter++) {
    const driveRoot = `${String.fromCharCode(letter)}:\\`;
    if (!fs.existsSync(driveRoot)) continue;
    let level1: string[];
    try {
      level1 = fs.readdirSync(driveRoot);
    } catch {
      continue;
    }
    for (const name1 of level1) {
      if (visited++ > SCAN_DIR_BUDGET) return null;
      const dir1 = joinPath(driveRoot, name1);
      let isDir = false;
      try {
        isDir = fs.statSync(dir1).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      if (matches(name1) && isValidModel(dir1)) return dir1;
      if (SCAN_SKIP.has(name1.toLowerCase())) continue;
      let level2: string[];
      try {
        level2 = fs.readdirSync(dir1);
      } catch {
        continue;
      }
      for (const name2 of level2) {
        if (visited++ > SCAN_DIR_BUDGET) return null;
        if (!matches(name2)) continue;
        const dir2 = joinPath(dir1, name2);
        try {
          if (!fs.statSync(dir2).isDirectory()) continue;
        } catch {
          continue;
        }
        if (isValidModel(dir2)) return dir2;
      }
    }
  }
  return null;
}

// ── 第 2 步：挑选 Python ─────────────────────────────────────

/** 候选优先级：3.12 > 3.11 > 3.13 > 3.10；3.14+ 与 <3.10 不参与自动挑选 */
const PREFERRED_MINORS = [12, 11, 13, 10];

function versionKeyOf(tag: string): [number, number] | null {
  const match = /(\d+)\.(\d+)/.exec(tag);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/** 从 py -0p 的输出解析出解释器路径（去重）。默认项行形如 `-V:3.14[-64] *   C:\...\python.exe` */
export function parsePyLauncherList(output: string): string[] {
  const paths = new Set<string>();
  for (const match of output.matchAll(/-V:\S+\s+(?:\*\s+)?(\S+\.exe)/g)) {
    paths.add(match[1]);
  }
  return [...paths];
}

/** 按 3.12 > 3.11 > 3.13 > 3.10 的偏好，从候选里挑出第一个真实可用的解释器 */
export async function pickPython(candidates: string[]): Promise<string | null> {
  const byMinor = new Map<number, string[]>();
  for (const candidate of candidates) {
    const probe = await runFile(candidate, ["-c", "import sys; print('%d.%d' % sys.version_info[:2])"], 15_000);
    if (!probe.ok) continue;
    const version = versionKeyOf(probe.stdout.trim());
    if (!version || version[0] !== 3) continue;
    if (!PREFERRED_MINORS.includes(version[1])) continue;
    const list = byMinor.get(version[1]) ?? [];
    list.push(candidate);
    byMinor.set(version[1], list);
  }
  for (const minor of PREFERRED_MINORS) {
    const list = byMinor.get(minor);
    if (list && list.length > 0) return list[0];
  }
  return null;
}

async function detectPython(onProgress: (message: string) => void): Promise<string | null> {
  onProgress("正在查找可用的 Python（3.10–3.13）…");
  const candidates: string[] = [];
  const pyList = await runFile("py", ["-0p"], 15_000);
  if (pyList.ok) candidates.push(...parsePyLauncherList(pyList.stdout));
  candidates.push("python");
  const unique = [...new Set(candidates)];
  const picked = await pickPython(unique);
  if (picked) {
    onProgress(`已选用 Python：${picked}`);
  }
  return picked;
}

// ── 第 3/4 步：venv 与安装 ───────────────────────────────────

function venvPythonOf(venvDir: string): string {
  return isWindows()
    ? joinPath(venvDir, "Scripts", "python.exe")
    : joinPath(venvDir, "bin", "python");
}

/**
 * pip 安装：输出重定向到日志文件，轮询文件大小给出进度。
 * 返回成功与否与失败时的日志尾部。
 */
function pipInstall(
  python: string,
  args: string[],
  logPath: string,
  onProgress: (message: string) => void
): Promise<{ ok: boolean; tail: string[] }> {
  const fs = loadNodeModule<NodeFsModule>("fs");
  const cp = loadNodeModule<NodeProcessModule>("child_process");
  if (!fs || !cp?.spawn) {
    return Promise.resolve({ ok: false, tail: ["当前环境无法启动子进程"] });
  }

  return new Promise(resolve => {
    let logFd: number | null = null;
    try {
      logFd = fs.openSync(logPath, "w");
    } catch {
      logFd = null;
    }

    const readTail = (): string[] => {
      if (logFd !== null) {
        try {
          fs.closeSync(logFd);
        } catch {
          /* 已经关了 */
        }
        logFd = null;
      }
      try {
        const fd = fs.openSync(logPath, "r");
        try {
          const size = fs.fstatSync(fd).size;
          if (size <= 0) return [];
          const buffer = new Uint8Array(size);
          fs.readSync(fd, buffer, 0, size, 0);
          return new TextDecoder("utf-8")
            .decode(buffer)
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
        } finally {
          fs.closeSync(fd);
        }
      } catch {
        return [];
      }
    };

    let child: ReturnType<NodeProcessModule["spawn"]>;
    try {
      child = cp.spawn(python, args, {
        windowsHide: true,
        stdio: logFd !== null ? ["ignore", logFd, logFd] : ["ignore", "ignore", "ignore"],
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      resolve({ ok: false, tail: [detail] });
      return;
    }

    /** 当前日志大小；打不开时返回上次值（可能还没写出来） */
    const sizeOfLog = (): number => {
      let fd = -1;
      try {
        fd = fs.openSync(logPath, "r");
        return fs.fstatSync(fd).size;
      } catch {
        return lastSize;
      } finally {
        if (fd >= 0) {
          try {
            fs.closeSync(fd);
          } catch {
            /* ignore */
          }
        }
      }
    };

    const startedAt = Date.now();
    let lastSize = -1;
    let lastChangeAt = Date.now();
    const timer = window.setInterval(() => {
      const size = sizeOfLog();
      if (size !== lastSize) {
        lastSize = size;
        lastChangeAt = Date.now();
        onProgress(`正在安装 qwen-tts…（已进行 ${Math.round((Date.now() - startedAt) / 1000)} 秒）`);
      }
      // 5 分钟没有任何输出 → 判定停滞（大文件下载也不该静默这么久）
      if (Date.now() - lastChangeAt > 300_000) {
        window.clearInterval(timer);
        const tail = readTail();
        try {
          killProcess(child.pid ?? 0);
        } catch {
          /* 进程可能已退出 */
        }
        resolve({ ok: false, tail: tail.slice(-8) });
      }
    }, 2000);

    child.on("exit", () => {
      window.clearInterval(timer);
      const tail = readTail();
      resolve({ ok: true, tail: tail.slice(-8) });
    });
    child.on("error", error => {
      window.clearInterval(timer);
      resolve({ ok: false, tail: [String(error)] });
    });
  });
}

function exitCodeOf(tail: string[]): boolean {
  // pip 失败时最后一带会有 "ERROR" 行；成功则通常以 "Successfully installed" 结尾
  return tail.some(line => /Successfully installed/i.test(line));
}

// ── GPU / CUDA torch ─────────────────────────────────────────
//
// 关键认知：**PyTorch 不使用系统安装的 CUDA Toolkit** —— Windows 版 torch 的轮子
// 自带 CUDA 运行时，而 PyPI 默认源上只有 CPU 版（+cpu）。`torch.cuda.is_available()`
// 只看 torch 自带的运行时与驱动，系统装没装 CUDA 无关。所以检测到 NVIDIA GPU 时
// 必须从 PyTorch 官方源显式安装 CUDA 版 torch（约 3 GB），否则 qwen-tts 依赖解析
// 会把 +cpu 版拉进来，服务端日志报「CUDA 不可用，已降级到 CPU」。

export interface GpuInfo {
  name: string;
  /** 驱动支持的 CUDA 运行时版本（nvidia-smi 表头里的 CUDA Version / UMD Version） */
  driverCuda: number;
}

/** 探测 NVIDIA GPU 与驱动支持的 CUDA 版本；无 NVIDIA 环境返回 null */
export async function detectGpu(): Promise<GpuInfo | null> {
  const query = await runFile("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], 15_000);
  if (!query.ok || !query.stdout.trim()) return null;
  const name = query.stdout.trim().split(/\r?\n/)[0].trim();
  if (!name || /nvidia-smi.*failed/i.test(name)) return null;
  const table = await runFile("nvidia-smi", [], 15_000);
  const versionMatch = table.ok ? /CUDA(?: UMD)? Version:\s*([\d.]+)/.exec(table.stdout) : null;
  const driverCuda = versionMatch ? Number(versionMatch[1]) : 0;
  return { name, driverCuda };
}

/**
 * PyTorch 官方源的 CUDA 构建标签，按新旧排序。
 * 选法：驱动支持的 CUDA 版本 ≥ 标签要求的最低版本即可用，取最新的一个。
 */
const TORCH_CUDA_TAGS: ReadonlyArray<{ tag: string; minCuda: number }> = [
  { tag: "cu132", minCuda: 13.2 },
  { tag: "cu130", minCuda: 13.0 },
  { tag: "cu128", minCuda: 12.8 },
  { tag: "cu126", minCuda: 12.6 },
  { tag: "cu124", minCuda: 12.4 },
  { tag: "cu121", minCuda: 12.1 },
];

export function pickTorchTag(driverCuda: number): string | null {
  for (const entry of TORCH_CUDA_TAGS) {
    if (driverCuda + 1e-9 >= entry.minCuda) return entry.tag;
  }
  return null;
}

export interface TorchCudaStatus {
  installed: boolean;
  available: boolean;
  version: string;
}

/** venv 里 torch 的 CUDA 可用性（未装 torch 时 installed=false） */
export async function torchCudaStatus(python: string): Promise<TorchCudaStatus> {
  const probe = await runFile(
    python,
    ["-c", "import torch; print(torch.__version__, torch.cuda.is_available())"],
    120_000
  );
  if (!probe.ok) return { installed: false, available: false, version: "" };
  const [version = "", flag = ""] = probe.stdout.trim().split(/\s+/);
  return { installed: version.startsWith("2."), available: flag === "True", version };
}

const TORCH_INDEX_BASE = "https://download.pytorch.org/whl";

/**
 * 在 venv 里装 CUDA 版 torch：按驱动支持的最新 cu 标签尝试，失败降级到更旧的标签。
 * 已装的 +cpu torch 会被先卸载 —— PEP 440 的本地版本序里 `+cpu` 排在 `+cuXXX` 之后，
 * 直接 `pip install -U` 会被 pip 认为「已是最新」而跳过（经典陷阱）。
 */
async function installCudaTorch(
  python: string,
  gpu: GpuInfo,
  logPath: string,
  onProgress: (message: string) => void
): Promise<{ ok: boolean; tag?: string; detail?: string }> {
  const startIndex = TORCH_CUDA_TAGS.findIndex(entry => entry.tag === pickTorchTag(gpu.driverCuda));
  if (startIndex < 0) {
    return {
      ok: false,
      detail: `驱动支持的 CUDA（${gpu.driverCuda}）低于全部可用 torch CUDA 构建的要求`,
    };
  }
  for (let index = startIndex; index < TORCH_CUDA_TAGS.length; index++) {
    const { tag } = TORCH_CUDA_TAGS[index];
    onProgress(`正在为 ${gpu.name} 安装 CUDA 版 torch（${tag}，约 3 GB）…`);
    await runFile(python, ["-m", "pip", "uninstall", "-y", "torch"], 120_000);
    const install = await pipInstall(
      python,
      ["-m", "pip", "install", "-U", "--progress-bar", "off", "torch", "--index-url", `${TORCH_INDEX_BASE}/${tag}`],
      logPath,
      onProgress
    );
    if (install.ok && exitCodeOf(install.tail)) {
      const status = await torchCudaStatus(python);
      if (status.available) return { ok: true, tag };
      onProgress(`${tag} 安装完成但 CUDA 仍不可用，尝试更旧的构建…`);
    }
  }
  return {
    ok: false,
    detail: `所有 CUDA 构建都未能装出可用的 GPU torch。可手动执行：\n` +
      `"${python}" -m pip install -U torch --index-url ${TORCH_INDEX_BASE}/${TORCH_CUDA_TAGS[startIndex].tag}`,
  };
}

// ── 编排 ─────────────────────────────────────────────────────

const TUNA_MIRROR = "https://pypi.tuna.tsinghua.edu.cn/simple";

export async function prepareQwenEnvironment(
  options: QwenSetupOptions
): Promise<QwenSetupResult> {
  const { onProgress } = options;

  // 1. 模型目录：已有且有效就用，否则自动扫描
  let modelPath = options.modelPath.trim();
  if (modelPath && !validateQwenModelPath(modelPath).ok) {
    onProgress("已填的模型目录无效，尝试自动查找…");
    modelPath = "";
  }
  if (!modelPath) {
    onProgress("正在扫描各盘符查找 Qwen3-TTS 模型目录…");
    const found = scanForQwenModel();
    if (!found) {
      return {
        ok: false,
        message:
          "没有找到 Qwen3-TTS 模型目录（已扫描各盘符两层）。\n" +
          "请在「模型目录」点「浏览…」手动选择包含 config.json 的模型目录。",
      };
    }
    modelPath = found;
    onProgress(`已找到模型目录：${modelPath}`);
  }

  // GPU 探测：决定是否需要 CUDA 版 torch（无 N 卡则全程 CPU 也没问题）
  onProgress("正在检测显卡…");
  const gpu = await detectGpu();
  if (gpu) {
    onProgress(`检测到 ${gpu.name}（驱动支持 CUDA ${gpu.driverCuda}）`);
  }

  // 2. 解释器：已可用就复用（幂等的关键）；但若 torch 是 CPU 版且机器有 N 卡，先自愈换装
  const existing = options.pythonPath.trim();
  if (existing) {
    onProgress("正在检查已配置的 Python 环境…");
    const check = await checkQwenPython(existing);
    if (check.ok) {
      if (!gpu) {
        return {
          ok: true,
          message: `环境已就绪，无需重复安装（未检测到 NVIDIA GPU，将使用 CPU 合成）。\n${check.message}`,
          modelPath,
          pythonPath: existing,
        };
      }
      const status = await torchCudaStatus(existing);
      if (status.available) {
        return {
          ok: true,
          message: `环境已就绪（GPU：${gpu.name}，torch ${status.version}）。\n${check.message}`,
          modelPath,
          pythonPath: existing,
        };
      }
      onProgress(
        `环境里是 ${status.installed ? `CPU 版 torch（${status.version}）` : "缺少 torch"}，正在换装 CUDA 版…`
      );
      const healed = await installCudaTorch(
        existing,
        gpu,
        options.setupLogPath ?? joinPath(dirNameOf(existing), "pip-install.log"),
        onProgress
      );
      if (!healed.ok) {
        return {
          ok: false,
          message: `换装 CUDA 版 torch 失败：${healed.detail ?? "原因未知"}`,
          modelPath,
          pythonPath: existing,
        };
      }
      const after = await torchCudaStatus(existing);
      return {
        ok: true,
        message:
          `已为 ${gpu.name} 换装 CUDA 版 torch（${healed.tag}，当前 ${after.version}）。\n` +
          "点「启动本地服务」即可用 GPU 合成。",
        modelPath,
        pythonPath: existing,
      };
    }
    onProgress("已配置的解释器不可用，改用自动挑选…");
  }
  const basePython = await detectPython(onProgress);
  if (!basePython) {
    return {
      ok: false,
      message:
        "没有找到 Python 3.10–3.13。请先安装 Python 3.12（https://www.python.org 或 uv），" +
        "或在「Python 解释器」手动指定。",
    };
  }

  // 3. venv：建在模型目录旁，已存在则复用
  const venvDir = joinPath(dirNameOf(modelPath), "glimpse-qwen-tts-env");
  const venvPython = venvPythonOf(venvDir);
  const fs = loadNodeModule<NodeFsModule>("fs");
  if (fs?.existsSync(venvPython)) {
    onProgress(`检测到已有环境，直接复用：${venvDir}`);
  } else {
    onProgress("正在创建独立 Python 环境（约 10–30 秒）…");
    const created = await runFile(basePython, ["-m", "venv", venvDir], 300_000);
    if (!created.ok || !fs?.existsSync(venvPython)) {
      return {
        ok: false,
        message: `创建 Python 环境失败：${created.ok ? "venv 目录不完整" : created.detail}`,
        modelPath,
      };
    }
  }

  // 3.5 GPU：在装 qwen-tts **之前**预装 CUDA 版 torch ——
  //     否则 qwen-tts 的依赖解析会把 PyPI 默认源的 +cpu torch 拉进来
  if (gpu) {
    const torchStatus = await torchCudaStatus(venvPython);
    if (!torchStatus.available) {
      const installed = await installCudaTorch(
        venvPython,
        gpu,
        options.setupLogPath ?? joinPath(venvDir, "pip-install.log"),
        onProgress
      );
      if (!installed.ok) {
        onProgress("CUDA 版 torch 未装上，先继续 CPU 路线（结束后可重试「一键准备环境」）");
      }
    }
  }

  // 4. 安装 qwen-tts（失败自动换清华镜像重试一次）
  onProgress("正在安装 qwen-tts（首次需下载数 GB，取决于网速）…");
  const baseArgs = ["-m", "pip", "install", "-U", "--progress-bar", "off", "qwen-tts"];
  const logPath = options.setupLogPath ?? joinPath(venvDir, "pip-install.log");
  let install = await pipInstall(venvPython, baseArgs, logPath, onProgress);
  if (!install.ok || !exitCodeOf(install.tail)) {
    onProgress("直连 PyPI 安装失败，改用清华镜像重试…");
    install = await pipInstall(
      venvPython,
      [...baseArgs, "-i", TUNA_MIRROR],
      logPath,
      onProgress
    );
  }
  if (!install.ok || !exitCodeOf(install.tail)) {
    const tail = install.tail.length > 0 ? `\n日志尾部：\n${install.tail.join("\n")}` : "";
    return {
      ok: false,
      message: `安装 qwen-tts 失败。可稍后重试；若网络不畅可手动执行：\n` +
        `"${venvPython}" -m pip install -U qwen-tts -i ${TUNA_MIRROR}${tail}`,
      modelPath,
      pythonPath: venvPython,
    };
  }

  // 5. 终检：真实 import 一次才算数，并如实汇报 GPU 状态
  onProgress("安装完成，正在做最终校验…");
  const finalCheck = await checkQwenPython(venvPython);
  if (!finalCheck.ok) {
    return {
      ok: false,
      message: `安装似乎完成，但校验未通过：${finalCheck.message}`,
      modelPath,
      pythonPath: venvPython,
    };
  }

  let gpuLine = "未检测到 NVIDIA GPU，将使用 CPU 合成";
  if (gpu) {
    const status = await torchCudaStatus(venvPython);
    gpuLine = status.available
      ? `GPU：${gpu.name}（CUDA 版 torch ${status.version} 可用）`
      : `GPU：${gpu.name}，但 CUDA 不可用（${status.installed ? `torch ${status.version} 是 CPU 版` : "torch 未装好"}）—— 可重试「一键准备环境」`;
  }

  return {
    ok: true,
    message:
      `环境已就绪：\n模型：${modelPath}\n解释器：${venvPython}\n${gpuLine}\n` +
      `${finalCheck.message}\n现在可以点「启动本地服务」了。`,
    modelPath,
    pythonPath: venvPython,
  };
}
