/**
 * LRC 歌词解析（供侧边栏面板与内嵌歌词显示）。
 * 支持：
 * - 标准 `[mm:ss.xx]` 行时间戳（含 hh:mm:ss.xx）
 * - 主流增强 LRC 的 `<mm:ss.xx>` 逐字（卡拉OK）绝对时间戳
 * - 双语注释 `原文 | 译文` 竖线语法（译文不参与逐字高亮）
 * - SRT 字幕解析（内嵌歌词可能为 SRT 格式）
 */

export interface LyricsWord {
  text: string;
  /** 毫秒 */
  timestamp: number;
}

export interface LyricsLine {
  /** 毫秒 */
  timestamp?: number;
  timestr?: string;
  text: string;
  rows: number;
  words?: LyricsWord[];
  /** 双语注释（竖线分隔的译文），不参与逐字高亮 */
  annotation?: string;
}

/**
 * 逐字拆词正则（卡拉 OK 用）。
 * 规则：CJK/韩文/阿拉伯/天城/泰文/藏文 单字拆分；拉丁/西里尔/亚美尼亚/格鲁吉亚 整词；
 * 空格保留（CSS white-space: pre 保证不被折叠）。
 */
export const WORD_SPLIT_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0900-\u097F\u0E00-\u0E7F\u0F00-\u0FFF\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u3130-\u318F]|[a-zA-Z0-9\u0400-\u04FF\u0500-\u052F\u10A0-\u10FF]+|\s+/g;

const LRC_SPLITTER = /\[(((\d+):)?(\d+):(\d+(\.\d+)?))\]/g;

/** 把 `mm:ss.xx`（或 `hh:mm:ss.xx`）解析为秒；无效返回 NaN */
function parseClock(t: string): number {
  const parts = t.split(":");
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  return NaN;
}

/**
 * 提取逐字时间标记，返回 { 显示文本, 逐字数组 }；无任何标记返回 null。
 * 仅支持主流增强 LRC 的 `<mm:ss.xx>` 绝对时间语法。
 */
function extractPreciseWords(
  text: string,
): { text: string; words: { text: string; timestamp: number }[] } | null {
  const re = /<(\d{1,2}:\d{2}(?:\.\d+)?)>([^<]*)/g;
  const words: { text: string; timestamp: number }[] = [];
  let display = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sec = parseClock(m[1]);
    if (!isFinite(sec)) continue;
    display += m[2];
    words.push({ text: m[2], timestamp: Math.round(sec * 1000) });
  }
  if (words.length > 0) return { text: display, words };
  return null;
}

/**
 * 提取双语注释：用竖线 `原文 | 译文` 分隔。
 * 竖线两边都非空才视为双语，避免误判歌词中孤立的 `|`；多个 `|` 取最后一个作分隔，保留原文中的 `|`。
 */
export function extractAnnotation(text: string): { text: string; annotation?: string } {
  const pipe = text.lastIndexOf("|");
  if (pipe >= 0) {
    const before = text.slice(0, pipe).trim();
    const after = text.slice(pipe + 1).trim();
    if (before && after) {
      return { text: before, annotation: after };
    }
  }
  return { text };
}

interface ParsedLrcLine {
  line: LyricsLine;
}

/** 解析单个 LRC 行（splitter 分块后的 7 元数组） */
function parseLrcParts(parts: string[]): ParsedLrcLine {
  const empty: ParsedLrcLine = { line: { text: "", timestr: "", rows: 1 } };
  try {
    const hours = parts[2] ? parseInt(parts[2], 10) : 0;
    const minutes = parts[3] ? parseInt(parts[3], 10) : 0;
    const seconds = parts[4] ? parseFloat(parts[4]) : 0;
    const timestamp = hours * 3600 + minutes * 60 + seconds;
    const inMin = Math.floor(timestamp / 60);
    const inSec = Math.floor(timestamp % 60);
    const minStr = inMin < 10 ? `0${inMin}` : `${inMin}`;
    const secStr = inSec < 10 ? `0${inSec}` : `${inSec}`;
    const text = parts[6] ? parts[6].trim() : "";
    const rows = parts[6] ? parts[6].split(/\r?\n/g).length - 1 : 0;
    return {
      line: {
        timestamp: timestamp * 1000,
        timestr: `${minStr}:${secStr}`,
        text,
        rows,
      },
    };
  } catch {
    return empty;
  }
}

/** 对单行应用双语注释提取 + 逐字时间戳解析（原地修改并返回该行） */
function enrichLrcLine(line: LyricsLine): LyricsLine {
  if (!line.text) return line;
  const extracted = extractAnnotation(line.text);
  if (extracted.annotation) {
    line.annotation = extracted.annotation;
    line.text = extracted.text;
  }
  const precise = extractPreciseWords(line.text);
  if (precise && precise.words.length > 0) {
    line.text = precise.text;
    line.words = precise.words;
  }
  return line;
}

/** 解析 LRC 文本为歌词行数组（已应用双语注释 + 逐字时间戳） */
export function parseLrc(content: string): LyricsLine[] {
  const lines = content.split(LRC_SPLITTER);
  lines.shift();
  const results: LyricsLine[] = [];
  for (const parts of chunkParts(lines)) {
    const { line } = parseLrcParts(parts);
    if (line.text) {
      results.push(enrichLrcLine(line));
    }
  }
  return results;
}

function chunkParts(parts: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < parts.length; i += 7) out.push(parts.slice(i, i + 7));
  return out;
}

// --- SRT 字幕解析（内嵌歌词可能为 SRT） ---

const SRT_SPLITTER =
  /(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g;

function parseSrtTime(timestamp: string): number[] {
  const parts = /(\d+):(\d{2}):(\d{2}),(\d{3})/.exec(timestamp);
  const t: number[] = [];
  if (!parts) return [0, 0, 0, 0];
  for (let i = 1; i < 5; i++) {
    const p = parseInt(parts[i], 10);
    t.push(p || 0);
  }
  return t;
}

/** 解析 SRT 文本为歌词行数组 */
export function parseSrt(content: string): LyricsLine[] {
  const results: LyricsLine[] = [];
  if (!content.length) return results;
  const blocks = content.split(SRT_SPLITTER);
  blocks.shift();
  for (const parts of chunkN(blocks, 4)) {
    if (parts.length < 4 || !parts[3]) continue;
    const t = parseSrtTime(parts[1].trim());
    const min = t[0] * 60 + t[1];
    const sec = t[2];
    const minStr = min < 10 ? `0${min}` : `${min}`;
    const secStr = sec < 10 ? `0${sec}` : `${sec}`;
    results.push({
      timestamp: t[0] * 3600000 + t[1] * 60000 + t[2] * 1000 + t[3],
      timestr: `${minStr}:${secStr}`,
      text: parts[3].trim(),
      rows: parts[3].split(/\r?\n/g).length - 2,
    });
  }
  return results;
}

function chunkN<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 按内容自动选择 LRC / SRT 解析器（命中时间戳数更多者优先） */
export function parseLyrics(content: string): LyricsLine[] {
  // LRC 每个时间戳产生 7 个分块（6 个捕获组 + 1 段文本），SRT 每个产生 4 个（3 捕获组 + 1）
  const lrcHits = Math.floor((content.split(LRC_SPLITTER).length - 1) / 7);
  const srtHits = Math.floor((content.split(SRT_SPLITTER).length - 1) / 4);
  return srtHits > lrcHits ? parseSrt(content) : parseLrc(content);
}

// --- 序列化（标签编辑弹窗保存用） ---

/**
 * 把 LyricsLine[] 序列化为标准 LRC 文本。
 * 时间戳统一为 `mm:ss.xx`（小时存在时 `hh:mm:ss.xx`），
 * annotation 以 `原文 | 译文` 形式拼回，保证编辑后注释不丢。
 */
export function serializeLrc(lines: LyricsLine[]): string {
  const parts: string[] = [];
  for (const line of lines) {
    const text = line.annotation ? `${line.text} | ${line.annotation}` : line.text;
    if (line.timestamp === undefined) {
      if (text.trim()) parts.push(text);
      continue;
    }
    if (text.trim()) parts.push(`[${formatLrcTimestamp(line.timestamp)}]${text}`);
  }
  return parts.join("\n");
}

/** 毫秒 → `mm:ss.xx`（超过 1 小时 → `hh:mm:ss.xx`） */
export function formatLrcTimestamp(ms: number): string {
  const totalCs = Math.round(Math.max(0, ms) / 10); // 厘秒，四舍五入
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = `${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 时长格式化（秒 → MM:SS，分钟补零，如 205 → 03:25；≥1 小时 → H:MM:SS）；非法输入返回空串 */
export function formatDurationColon(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
