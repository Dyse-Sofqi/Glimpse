/**
 * 扫描 GPT / SoVITS 权重并按「音色」配对。
 *
 * 为什么不给两个独立的文件选择器：GPT 权重（.ckpt）与 SoVITS 权重（.pth）
 * 必须来自同一套模型。实测（见 .workbuddy-ai/verify-voice-pairing.ts）
 * **错配不会报错** —— 服务照样返回 200 和音频，只是音色是错的。
 * 这种「静默错误」比直接失败更难发现，所以按同名基名配成一对让用户选。
 */
import { isWindows, loadNodeModule } from "../node-bridge";

export interface VoiceCandidate {
  /** 显示名（去掉扩展名的基名） */
  name: string;
  /** GPT 权重，相对安装根目录的路径；缺失表示没找到配对 */
  gptPath?: string;
  /** SoVITS 权重，相对安装根目录的路径 */
  sovitsPath?: string;
  /** 版本目录提示（如 v2ProPlus），仅用于展示 */
  versionHint: string;
  /** 两项都齐 —— 只有这种才能直接用 */
  complete: boolean;
}

interface NodeFsModule {
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
}

const GPT_DIR = /^GPT_weights/i;
const SOVITS_DIR = /^SoVITS_weights/i;

export function scanVoiceCandidates(installRoot: string): VoiceCandidate[] {
  const fs = loadNodeModule<NodeFsModule>("fs");
  const root = installRoot.trim().replace(/[\\/]+$/, "");
  if (!fs || !root) return [];

  const separator = isWindows() ? "\\" : "/";
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }

  const gptByName = new Map<string, { path: string; version: string }>();
  const sovitsByName = new Map<string, { path: string; version: string }>();

  for (const dirName of entries) {
    const isGpt = GPT_DIR.test(dirName);
    const isSovits = SOVITS_DIR.test(dirName);
    if (!isGpt && !isSovits) continue;

    const dirPath = `${root}${separator}${dirName}`;
    try {
      if (!fs.statSync(dirPath).isDirectory()) continue;
    } catch {
      continue;
    }
    // GPT_weights_v2ProPlus → v2ProPlus；没有后缀则标为「默认」
    const version =
      dirName.replace(GPT_DIR, "").replace(SOVITS_DIR, "").replace(/^_+/, "") || "默认";

    let files: string[];
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const file of files) {
      const dot = file.lastIndexOf(".");
      if (dot <= 0) continue;
      const extension = file.slice(dot).toLowerCase();
      const baseName = file.slice(0, dot);
      const relative = `${dirName}${separator}${file}`;

      if (isGpt && extension === ".ckpt") {
        gptByName.set(baseName, { path: relative, version });
      } else if (isSovits && extension === ".pth") {
        sovitsByName.set(baseName, { path: relative, version });
      }
    }
  }

  const names = new Set([...gptByName.keys(), ...sovitsByName.keys()]);
  const candidates: VoiceCandidate[] = [];
  for (const name of names) {
    const gpt = gptByName.get(name);
    const sovits = sovitsByName.get(name);
    candidates.push({
      name,
      gptPath: gpt?.path,
      sovitsPath: sovits?.path,
      versionHint: gpt?.version ?? sovits?.version ?? "",
      complete: Boolean(gpt && sovits),
    });
  }

  // 配对完整的排前面 —— 那些才是能直接用的
  return candidates.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 按基名查找**配对完整**的音色。
 *
 * 用途：用户用系统原生对话框选了一个 .ckpt 之后，自动按同名基名把 .pth 也配上，
 * 免得他再选一次、也免得配错。
 */
export function findCompleteVoiceByName(
  installRoot: string,
  baseName: string
): VoiceCandidate | undefined {
  return scanVoiceCandidates(installRoot).find(
    candidate => candidate.complete && candidate.name === baseName
  );
}

interface NodeFileFsModule {
  existsSync: (path: string) => boolean;
}

/**
 * 选中任一权重文件后，把同名配对的另一个也找出来（两个方向对称）。
 *
 * 查找顺序：
 * 1. 安装根目录内的 GPT_weights* / SoVITS_weights* 结构 —— 常规布局下
 *    两个文件分居两个目录，同目录里找不到对方；
 * 2. 被选文件的**同目录** —— 自定义布局（两个文件放同一文件夹）也能配上。
 *
 * 安装根内命中时返回相对路径（与设置里的既有约定一致）；同目录命中返回绝对路径
 * （实测 set_weights 两种都接受）。找不到对方时只返回当前选中的那一项。
 */
export function findCounterpartWeights(
  pickedPath: string,
  installRoot: string
): { gptPath?: string; sovitsPath?: string } {
  const normalized = pickedPath.trim();
  const dot = normalized.lastIndexOf(".");
  if (dot <= 0) return {};
  const extension = normalized.slice(dot).toLowerCase();
  if (extension !== ".ckpt" && extension !== ".pth") return {};

  const nameStart = Math.max(
    normalized.lastIndexOf("\\"),
    normalized.lastIndexOf("/")
  );
  const baseName = normalized.slice(nameStart + 1, dot);

  const matched = findCompleteVoiceByName(installRoot, baseName);
  if (matched?.gptPath && matched.sovitsPath) {
    return { gptPath: matched.gptPath, sovitsPath: matched.sovitsPath };
  }

  // 安装根内没配上的，退而查被选文件的同目录
  const fs = loadNodeModule<NodeFileFsModule>("fs");
  if (fs && nameStart > 0) {
    const separator = isWindows() ? "\\" : "/";
    const dir = normalized.slice(0, nameStart);
    const sibling = `${dir}${separator}${baseName}${extension === ".ckpt" ? ".pth" : ".ckpt"}`;
    try {
      if (fs.existsSync(sibling)) {
        return extension === ".ckpt"
          ? { gptPath: normalized, sovitsPath: sibling }
          : { gptPath: sibling, sovitsPath: normalized };
      }
    } catch {
      /* 无法访问同目录，按未配对处理 */
    }
  }

  return extension === ".ckpt" ? { gptPath: normalized } : { sovitsPath: normalized };
}
