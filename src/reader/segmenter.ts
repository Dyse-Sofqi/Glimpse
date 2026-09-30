/**
 * 分段器：把过滤后的朗读文本切成「一次合成」的段，并翻译回原文区间。
 *
 * 规则借鉴 zhuomianling 的 StreamingVoiceCommitter（MIT），但按朗读场景做了调整：
 * - 段落换行 \n\n 视为强边界（笔记的段落是最自然的停顿）
 * - 硬上限默认 150 字（对方是 80；实测 150 字约 19s 合成、30s 音频，流水线仍跟得上）
 * - 首段单独设上限（默认 25 字）：固定开销 1.0s 消不掉，首段短才能让播放尽快开始
 * - 触及硬上限时回看一小段，优先在空格/标点/换行处断开，避免从词中间截断
 * - **段尾标点剥掉、纯标点段不发**：服务端对纯标点文本直接回
 *   `400 tts failed —— 请输入有效文本`，而「省略号独占一行」这种写法很常见（见 DROPPABLE_TAIL）
 */
import { ReaderSegmentSettings } from "./settings-types";
import { buildReadableText, PositionMap, ReadableText } from "./text-pipeline";

export interface Segment {
  /** 交给 TTS 的文本（已去掉首尾空白） */
  text: string;
  /** 对应原文的起始下标（含） */
  rawFrom: number;
  /** 对应原文的结束下标（不含） */
  rawTo: number;
}

const STRONG_END = /[。！？!?]/;
const SECONDARY_END = /[、，,；;]/;
const TRAILING_MARKS = /[。！？!?…~～.]/;
const CLOSING_MARKS = /[”’」』）》】）\]\}]/;

/**
 * 段尾可剥掉的标点：TTS 对**纯标点文本**直接返回 `400 请输入有效文本`，
 * 所以段尾标点一律剥掉（剥完没内容就整段不发），绝不单独送合成。
 * **只收句末/停顿类，不含收尾引号括号（」』）】》”’"' 等）**——它们是显示内容的
 * 一部分：句子以 `」。`/`」,` 结尾且段界正好落在句尾时，若把 」 一起剥掉，
 * rawTo 收到引号之前，提词器切片和编辑器高亮都会把收尾引号裁掉（实测）。
 * 下游本来就按「剥到收尾引号为止」设计（clause-highlight 的 TRAILING_PUNCT
 * 不含它们），这里保持一致即可；纯标点段（独占一行的 」』））的拦截由
 * isSpeakable 负责，不依赖尾剥。
 * 也**不含破折号连字符** —— 段尾真出现它们就留着，
 * 免得把 `——` 里的连字符剥成一个孤零零的破折号。
 */
const DROPPABLE_TAIL = /[。！？!?…~～．.，,、；;：:]/;

/**
 * 段文本是否含「可发声内容」。
 * 只剩标点/空白的段一律不送 TTS —— 实测服务端会回 `400 tts failed —— 请输入有效文本`，
 * 而这类段在实际笔记里很常见（省略号独占一行、纯标点的装饰行）。
 */
function isSpeakable(text: string): boolean {
  return /[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(text);
}

/** 在 textTo 之前回退掉「紧邻的空白 + 标点串」，返回仍含内容的新结束位置（都可能等于 from） */
function trimDroppableTail(text: string, from: number, textTo: number): number {
  let end = textTo;
  for (;;) {
    const before = end;
    while (end > from && /\s/.test(text[end - 1])) end--;
    while (end > from && DROPPABLE_TAIL.test(text[end - 1])) end--;
    if (end === before) return end;
  }
}

/**
 * 判断句点是否为句末。
 * 排除：小数（3.14）、点串的非末位（".." 只在最后一个点上判定）、
 * 后面紧跟字母数字的情况（e.g. / U.S.A 中间的点）、
 * 以及点号缩写串本身（U.S.A. 末尾的点——实测若不排除会切出 4 字碎段，
 * 而 2 字时合成耗时已接近音频时长，非常浪费）。
 */
function isSentencePeriod(text: string, i: number): boolean {
  if (text[i] !== ".") return false;
  const prev = text[i - 1];
  const next = text[i + 1];
  if (prev && next && /\d/.test(prev) && /\d/.test(next)) return false;
  if (next === ".") return false;
  if (next && /[A-Za-z0-9]/.test(next)) return false;
  // 点号缩写串：回看一小段，若形如 U.S.A / i.e / e.g 则不视为句末
  const before = text.slice(Math.max(0, i - 12), i);
  if (/(?:[A-Za-z]\.){2,}[A-Za-z]$/.test(before)) return false;
  return true;
}

/** 吞掉句末的标点串与收尾括号，避免把「。”」拆到下一段 */
function consumeEnd(text: string, from: number): number {
  let i = from;
  while (i < text.length && TRAILING_MARKS.test(text[i])) i++;
  while (i < text.length && CLOSING_MARKS.test(text[i])) i++;
  return i;
}

/**
 * 硬上限处回看，优先落在自然停顿上。
 * 标点/换行优先于空格：只按空格回看容易把句子拦腰截断、给下一段剩个 4 字尾巴
 * （实测「圆周率是 3.14159，见 U.S.A. 的资料。第二句在这里。」在 25 字上限下
 * 会切成 [21, 4, 7] 三段，而 4 字段的合成耗时几乎等于音频时长，非常浪费）。
 * 扫描从 hardEnd 起（含），所以可以把正好落在上限处的句末标点一起收进来。
 */
function preferNaturalBreak(text: string, start: number, hardEnd: number, lookback = 20): number {
  const floor = Math.max(start + 1, hardEnd - lookback);
  let spaceFallback = -1;
  for (let i = Math.min(hardEnd, text.length - 1); i >= floor; i--) {
    const ch = text[i];
    if (STRONG_END.test(ch) || SECONDARY_END.test(ch) || ch === "\n" || ch === "…") {
      return i + 1;
    }
    if (ch === " " && spaceFallback === -1) spaceFallback = i + 1;
  }
  return spaceFallback !== -1 ? spaceFallback : hardEnd;
}

/** 从 start 起找本段结束位置（返回过滤后文本的下标，不含） */
function findSegmentEnd(
  text: string,
  start: number,
  maxChars: number,
  secondaryMinChars: number,
  forcedBreaks: Set<number>
): number {
  let count = 0;
  for (let i = start; i < text.length; i++) {
    count += 1;
    const ch = text[i];

    // 结构性断点（列表项行尾、标题行尾）：必须在此结束
    if (forcedBreaks.has(i)) return i;

    // 段落换行：结束在换行之前（换行本身不发声）
    if (ch === "\n" && text[i + 1] === "\n") return i;

    if (
      STRONG_END.test(ch) ||
      (ch === "." && isSentencePeriod(text, i)) ||
      (ch === "…" && (text[i - 1] === "…" || text[i + 1] === "…"))
    ) {
      return consumeEnd(text, i + 1);
    }

    if (count >= secondaryMinChars && SECONDARY_END.test(ch)) return i + 1;
    if (count >= maxChars) return i + 1;
  }
  return text.length;
}

/**
 * 首段渐进（ramp-up）：按「无空档」条件算出开头若干段的长度上限。
 *
 * 条件：第 k 段的音频要能覆盖第 k+1 段的合成耗时，否则播到段末会出现静默等待。
 *   audio(L) = (0.216 / speed) × L   —— 0.216 s/字为本机实测（speed 1.0）
 *   synth(L) = 1.0 + 0.12 × L        —— 1.0s 固定开销 + 0.12 s/字，均为本机实测
 * 于是 L_{k+1} ≤ ((audioPerChar / speed) × L_k − fixedSynthSec) / synthPerChar。
 *
 * 首段短 → 首字延迟低；后续段按此递增加长 → 全程无空档。
 * 若某步算出的下一段不长于当前段（speed 偏高、RTF 接近或超过 1 时会发生），
 * 说明追不上：直接放到段上限并接受一次空档，不再继续爬坡。
 */
export function buildLimitPlan(
  firstMaxChars: number,
  maxChars: number,
  speedFactor: number,
  audioPerChar = 0.216,
  fixedSynthSec = 1.0,
  synthPerChar = 0.12
): number[] {
  const speed = Math.max(0.1, speedFactor);
  const cap = Math.max(Math.floor(firstMaxChars), Math.floor(maxChars));
  const plan = [Math.max(1, Math.floor(firstMaxChars))];
  for (let guard = 0; guard < 12 && plan[plan.length - 1] < cap; guard++) {
    const previous = plan[plan.length - 1];
    const next = Math.floor(
      ((audioPerChar * previous) / speed - fixedSynthSec) / synthPerChar
    );
    if (next <= previous) {
      plan.push(cap);
      break;
    }
    plan.push(Math.min(cap, next));
  }
  return plan;
}

/** 把过滤后文本切成段，并把每段映射回原文区间 */
export function segmentText(
  filtered: string,
  map: PositionMap,
  options: ReaderSegmentSettings,
  forcedBreaks: number[] = [],
  /** 逐段长度上限（首段渐进的爬坡表）；省略时首段用 firstMaxChars、其余用 maxChars */
  limits?: number[]
): Segment[] {
  const maxChars = Math.max(8, Math.floor(options.maxChars));
  const secondaryMinChars = Math.max(1, Math.floor(options.secondaryMinChars));
  const firstMaxChars = Math.max(4, Math.floor(options.firstMaxChars));
  const breakSet = new Set(forcedBreaks.filter(at => at > 0));

  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < filtered.length) {
    // 段首空白不发声，跳过（但影响映射，所以只移动 cursor）
    while (cursor < filtered.length && /\s/.test(filtered[cursor])) cursor++;
    if (cursor >= filtered.length) break;

    const index = segments.length;
    const limit =
      limits && index < limits.length
        ? Math.max(4, Math.floor(limits[index]))
        : index === 0
          ? firstMaxChars
          : maxChars;
    let end = findSegmentEnd(filtered, cursor, limit, secondaryMinChars, breakSet);
    if (end <= cursor) end = Math.min(cursor + 1, filtered.length);
    // 硬上限截断时才回看自然停顿；结构性断点与标点断点本身就是好位置
    if (end - cursor >= limit && !breakSet.has(end)) {
      end = preferNaturalBreak(filtered, cursor, end);
    }

    // 段尾空白也不发声；再剥掉段尾标点串（纯标点文本会被服务端 400 拒绝）
    const textEnd = trimDroppableTail(filtered, cursor, end);
    if (textEnd <= cursor) {
      cursor = Math.max(end, cursor + 1);
      continue;
    }
    const text = filtered.slice(cursor, textEnd);
    // 剥完仍无字母/数字/emoji（整段就是标点，如独占一行的「…」）→ 不发这段
    if (!isSpeakable(text)) {
      cursor = Math.max(end, cursor + 1);
      continue;
    }

    segments.push({
      text,
      rawFrom: map.filteredToRaw(cursor),
      rawTo: map.filteredToRaw(textEnd - 1) + 1,
    });
    cursor = end;
  }

  return segments;
}

/** 一步到位：原文 + 过滤设置 + 分段设置 → 朗读文本与段列表 */
export function buildSegments(
  raw: string,
  filters: Parameters<typeof buildReadableText>[1],
  options: ReaderSegmentSettings,
  /** 逐段长度上限（首段渐进爬坡表），见 buildLimitPlan */
  limits?: number[]
): { readable: ReadableText; segments: Segment[] } {
  const readable = buildReadableText(raw, filters);
  return {
    readable,
    segments: segmentText(
      readable.text,
      readable.map,
      options,
      readable.forcedBreaks,
      limits
    ),
  };
}

/**
 * 「从光标读」的截断：把包含光标的段在光标处切开，只保留光标之后的内容。
 *
 * 背景：分段以「弱边界需累积 36 字」合并分句，一个段常含多个逗号分句 ——
 * 光标停在段中间时整段照读会把光标前面的分句也读进去。
 *
 * - 光标在段首（或更前）→ 原段原样返回
 * - 光标在段中间 → 新段：text 从光标后第一个非空白字符开始，
 *   rawFrom 指向该字符（段级高亮从光标处亮起），rawTo 不变
 * - 光标在段尾（含段尾空白）之后 → null（调用方应从下一段开始）
 *
 * rawToFiltered 是 ceil 语义（返回第一个 >= pos 的保留字符）：
 * 光标落在被过滤字符上时自动从其后第一个保留字符开始，与「从光标之后读」的直觉一致。
 */
export function trimSegmentAtCursor(
  segment: Segment,
  map: PositionMap,
  offset: number
): Segment | null {
  const first = map.rawToFiltered(segment.rawFrom);
  const cut = map.rawToFiltered(Math.max(offset, segment.rawFrom));
  if (cut >= map.rawToFiltered(segment.rawTo)) return null; // 光标在段尾之后

  let textCut = cut - first;
  if (textCut <= 0) return segment; // 光标在段首之前，整段照读
  const text = segment.text;
  while (textCut < text.length && /\s/.test(text[textCut])) textCut++;
  if (textCut >= text.length) return null; // 截在了段尾空白里

  // 与 segmentText 同样剥掉尾标点：光标截出来的尾巴也可能只剩标点（服务端会 400）
  const textEnd = trimDroppableTail(text, textCut, text.length);
  if (textEnd <= textCut) return null; // 光标之后没有可发声内容
  const trimmed = text.slice(textCut, textEnd);
  if (!isSpeakable(trimmed)) return null;

  return {
    text: trimmed,
    rawFrom: map.filteredToRaw(first + textCut),
    rawTo: map.filteredToRaw(first + textEnd - 1) + 1,
  };
}
