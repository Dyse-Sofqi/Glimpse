/**
 * 音乐模块共享常量与类型。
 */

export const MUSIC_VIEW_TYPE = "glimpse-music-panel";

export type PlayMode = "off" | "single" | "sequential" | "shuffle";
/** 循环切换的播放模式：单曲循环 / 顺序播放 / 乱序播放（各有专属图标）。
 *  off 不参与切换，仅为兼容旧持久化数据保留类型 */
export const PLAY_MODES: PlayMode[] = ["single", "sequential", "shuffle"];

export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const VOLUME_OPTIONS = [0, 25, 50, 75, 100];

/** 按每 n 个元素分块（lodash/chunk 的零依赖替代） */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 多源下载/歌词搜索的来源平台 */
export type MusicSource = "netease" | "qq" | "kugou" | "kuwo";
export const MUSIC_SOURCES: MusicSource[] = ["netease", "qq", "kugou", "kuwo"];

/** 来源 → 中文标签（结果行/候选行来源胶囊） */
export const SOURCE_LABELS: Record<string, string> = {
  netease: "网易云",
  qq: "QQ",
  kugou: "酷狗",
  kuwo: "酷我",
};

/**
 * 由字节构造 Blob（供试听/封面预览播放用）。
 * TS 5.7+ 的 Uint8Array 泛型（ArrayBufferLike）与 BlobPart（ArrayBuffer）不结构兼容，
 * 而运行时底层数组均为普通 ArrayBuffer，此处断言安全且零拷贝。
 */
export function blobOf(bytes: Uint8Array, mime: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: mime });
}

/**
 * 适配 Obsidian 旧版 vault.modifyBinary/createBinary 的 ArrayBuffer 参数类型。
 * 运行时接受任意 ArrayBufferView（Node fs 层统一处理），断言安全且零拷贝。
 */
export function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes as unknown as ArrayBuffer;
}
