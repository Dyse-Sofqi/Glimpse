/**
 * 扫描 GPT-SoVITS 安装目录下的音频文件，给用户当参考音频候选。
 *
 * 为什么需要：参考音频是「每请求必带」的字段，但用户很难知道该填哪个路径 ——
 * 网页里选过的参考音频会被 Gradio 存到 `TEMP/gradio/<hash>/` 下，路径又长又难记。
 */
import { isWindows, loadNodeModule } from "../node-bridge";

export interface AudioCandidate {
  /** 绝对路径 */
  path: string;
  /** 相对安装根目录的展示用路径 */
  label: string;
  sizeBytes: number;
}

interface NodeFsModule {
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean; size: number };
}

const AUDIO_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"];

/** 这些目录要么巨大（模型），要么与参考音频无关 */
const SKIP_DIRS = new Set([
  "pretrained_models",
  "runtime",
  "node_modules",
  ".git",
  "__pycache__",
  "logs",
  "asr_opt",
  "slicer_opt",
  "uvr5_opt",
]);

const MAX_DEPTH = 3;

/**
 * 深度优先扫描音频文件。
 * 按体积升序返回 —— 参考音频通常是 3–10 秒（几十到几百 KB），
 * 小的排前面更接近用户要找的东西。
 */
export function scanAudioCandidates(installRoot: string, limit = 150): AudioCandidate[] {
  const fs = loadNodeModule<NodeFsModule>("fs");
  const root = installRoot.trim().replace(/[\\/]+$/, "");
  if (!fs || !root) return [];

  const separator = isWindows() ? "\\" : "/";
  const results: AudioCandidate[] = [];

  const walk = (dir: string, depth: number): void => {
    if (results.length >= limit || depth > MAX_DEPTH) return;
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (results.length >= limit) return;
      const full = `${dir}${separator}${name}`;
      let stat: { isDirectory: () => boolean; size: number };
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(name.toLowerCase())) walk(full, depth + 1);
        continue;
      }
      const lower = name.toLowerCase();
      if (!AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext))) continue;
      results.push({
        path: full,
        label: full.slice(root.length + 1),
        sizeBytes: stat.size,
      });
    }
  };

  walk(root, 0);
  return results.sort((a, b) => a.sizeBytes - b.sizeBytes);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
