/**
 * 偏移保持的文本过滤管线。
 *
 * 朗读要跳过 frontmatter / 代码块 / URL 等，但高亮必须落回**原文位置**。
 * 所以过滤不能丢偏移信息 —— 做法是逐字符记一个「保留掩码」，再据此同时产出
 * 过滤后文本与「过滤下标 → 原文下标」的映射数组。
 *
 * 注意：全程按 UTF-16 code unit 处理。CodeMirror 的位置也用 UTF-16 偏移，
 * 两者对齐才不会在 emoji / 增补平面字符上错位。
 */
import { ReaderFilterSettings } from "./settings-types";

/** 过滤后下标 ↔ 原文下标 的双向映射 */
export interface PositionMap {
  /** 未过滤任何字符时为 true，此时双向映射退化为恒等（零成本） */
  readonly isIdentity: boolean;
  readonly rawLength: number;
  readonly filteredLength: number;
  /** 过滤后第 index 个字符 → 原文下标 */
  filteredToRaw(index: number): number;
  /** 原文下标 pos → 过滤后下标（二分查找） */
  rawToFiltered(pos: number): number;
}

class MappedPosition implements PositionMap {
  private readonly mapping: number[] | null;
  readonly rawLength: number;

  constructor(mapping: number[] | null, rawLength: number) {
    this.mapping = mapping;
    this.rawLength = rawLength;
  }

  get isIdentity(): boolean {
    return this.mapping === null;
  }

  get filteredLength(): number {
    return this.mapping === null ? this.rawLength : this.mapping.length;
  }

  filteredToRaw(index: number): number {
    if (this.mapping === null) return index;
    if (index < 0) return 0;
    if (index >= this.mapping.length) return this.rawLength;
    return this.mapping[index];
  }

  rawToFiltered(pos: number): number {
    if (this.mapping === null) {
      return Math.max(0, Math.min(pos, this.rawLength));
    }
    // 二分找第一个 mapping[i] >= pos
    let lo = 0;
    let hi = this.mapping.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.mapping[mid] < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

/** 恒等映射（用于空文本或无需过滤的场景） */
export function identityPositionMap(rawLength: number): PositionMap {
  return new MappedPosition(null, rawLength);
}

function drop(mask: Uint8Array, from: number, to: number): void {
  const start = Math.max(0, from);
  const end = Math.min(mask.length, to);
  for (let i = start; i < end; i++) mask[i] = 0;
}

/**
 * 行首 blockquote 前缀（`> ` / `>>` / `> > ` …）的长度，0 表示不是引用行。
 *
 * 引用块里的 Markdown 结构全部以 `> ` 打头（`> ```js`、`> - 列表`、`> # 标题`），
 * 若直接拿原始行文本判定，这些规则会**整行失配** —— 于是 callout 里的代码块、
 * 表格、列表记号全都会被念出来。所以行级规则一律先剥掉这段前缀再判定。
 */
const QUOTE_PREFIX = /^\s*(?:>[ \t]?)+/;

function quotePrefixLength(text: string): number {
  const m = QUOTE_PREFIX.exec(text);
  return m ? m[0].length : 0;
}

/** 遍历行；end 不含换行符。空文档也会回调一次 */
function eachLine(
  raw: string,
  fn: (start: number, end: number, text: string) => void
): void {
  let start = 0;
  for (;;) {
    let nl = raw.indexOf("\n", start);
    if (nl === -1) nl = raw.length;
    fn(start, nl, raw.slice(start, nl));
    if (nl >= raw.length) return;
    start = nl + 1;
  }
}

function markFrontmatter(raw: string, mask: Uint8Array): void {
  const head = /^\uFEFF?---[ \t]*\r?\n/.exec(raw);
  if (!head) return;
  const closeRe = /^(?:---|\.\.\.)[ \t]*\r?$/;
  let cursor = head[0].length;
  for (;;) {
    let nl = raw.indexOf("\n", cursor);
    if (nl === -1) nl = raw.length;
    if (closeRe.test(raw.slice(cursor, nl))) {
      drop(mask, 0, Math.min(nl + 1, raw.length));
      return;
    }
    if (nl >= raw.length) return; // 没有闭合 → 视为普通文本，不动
    cursor = nl + 1;
  }
}

function markFencedCode(raw: string, mask: Uint8Array): void {
  let openAt = -1;
  let fenceChar = "";
  let fenceLen = 0;
  eachLine(raw, (start, end, text) => {
    const body = text.slice(quotePrefixLength(text));
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(body);
    if (openAt === -1) {
      if (open) {
        openAt = start;
        fenceChar = open[1][0];
        fenceLen = open[1].length;
      }
      return;
    }
    const close = /^\s{0,3}(`{3,}|~{3,})\s*\r?$/.exec(body);
    if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
      drop(mask, openAt, Math.min(end + 1, raw.length));
      openAt = -1;
    }
  });
  if (openAt !== -1) drop(mask, openAt, raw.length);
}

function markTables(raw: string, mask: Uint8Array): void {
  eachLine(raw, (start, end, text) => {
    const trimmed = text.slice(quotePrefixLength(text)).trim();
    if (!trimmed || !trimmed.includes("|")) return;
    const isRow = trimmed.startsWith("|");
    const isSeparator = /^[\s:|-]*\|[\s:|-]*$/.test(trimmed) && trimmed.includes("-");
    if (isRow || isSeparator) drop(mask, start, Math.min(end + 1, raw.length));
  });
}

function markHeadingMarks(raw: string, mask: Uint8Array): void {
  eachLine(raw, (start, _end, text) => {
    const qp = quotePrefixLength(text);
    const m = /^#{1,6}[ \t]+/.exec(text.slice(qp));
    if (m) drop(mask, start + qp, start + qp + m[0].length);
  });
}

function markQuoteMarks(raw: string, mask: Uint8Array): void {
  eachLine(raw, (start, _end, text) => {
    const len = quotePrefixLength(text);
    if (len > 0) drop(mask, start, start + len);
  });
}

/**
 * callout 标记：`> [!note] 标题` / `> [!warning]-` / `> [!tip]+`。
 *
 * 只剔掉 `[!type]` 与紧随其后的折叠符 `+` / `-`，**保留标题文字** ——
 * 与 headingMarks 同一个取舍：记号是语法，标题是要读的内容。
 *
 * 判定放在「剥掉 blockquote 前缀之后」，所以嵌套 callout（`> > [!tip]`）同样命中。
 * 副作用：`[!xxx]` 出现在引用块的非首行时也会被剔掉（Obsidian 那时不渲染成 callout），
 * 但这种写法在正文里几乎不会是「想朗读的文字」，剔除是更安全的一侧。
 *
 * 必须处理掉：残留的 `[!note]` 不只是被念出来 —— 里面的 `!` 会被分段器当成
 * 句末感叹号（STRONG_END），把 `[!note] 标题` 切出 `[!` 这种两字碎段。
 */
const CALLOUT_MARK = /^\[!([^\]]+)\]([+-]?)/;

function markCalloutMarks(raw: string, mask: Uint8Array): void {
  eachLine(raw, (start, _end, text) => {
    const qp = quotePrefixLength(text);
    const m = CALLOUT_MARK.exec(text.slice(qp));
    if (m) drop(mask, start + qp, start + qp + m[0].length);
  });
}

/** 列表记号：`- ` / `* ` / `+ ` / `1. ` / `1) ` 以及其后的任务框 `[ ]` */
const LIST_MARKER = /^(\s*)(?:[-+*]|\d{1,9}[.)])([ \t]+)(?:\[[ xX]\][ \t]+)?/;

function markListMarks(raw: string, mask: Uint8Array): void {
  eachLine(raw, (start, _end, text) => {
    const qp = quotePrefixLength(text);
    const m = LIST_MARKER.exec(text.slice(qp));
    if (m) drop(mask, start + qp + m[1].length, start + qp + m[0].length);
  });
}

/**
 * 收集「结构性断点」的原文下标 —— 列表项行尾、标题行尾、callout 标题行尾。
 * 这些位置在过滤后文本里已经看不出结构（记号被剔掉了），
 * 所以必须在过滤阶段就把断点信息传给分段器，否则列表会被并成一大段。
 */
function collectStructuralBreaks(
  raw: string,
  filters: ReaderFilterSettings,
  breaks: number[]
): void {
  if (!filters.listMarks && !filters.headingMarks && !filters.calloutMarks) return;
  eachLine(raw, (_start, end, text) => {
    const body = text.slice(quotePrefixLength(text));
    const isList = filters.listMarks && LIST_MARKER.test(body);
    const isHeading = filters.headingMarks && /^#{1,6}[ \t]+/.test(body);
    // callout 标题行单独成段：标题与正文之间应当有停顿，而不是并成一段念过去
    const isCallout = filters.calloutMarks && CALLOUT_MARK.test(body);
    if (isList || isHeading || isCallout) breaks.push(Math.min(end, raw.length));
  });
}

function markLineFilters(
  raw: string,
  mask: Uint8Array,
  filters: ReaderFilterSettings
): void {
  const phrase = filters.phraseLineEnabled ? filters.phraseLine : "";
  const prefix = filters.prefixLineEnabled ? filters.prefixLine : "";
  if (!phrase && !prefix) return;
  eachLine(raw, (start, end, text) => {
    // 前缀判定同样要先剥掉引用记号，否则 `> 注意：…` 这种引用里的行永远匹配不上
    const body = text.slice(quotePrefixLength(text));
    const hit =
      (phrase !== "" && text.includes(phrase)) ||
      (prefix !== "" && body.trimStart().startsWith(prefix));
    if (hit) drop(mask, start, Math.min(end + 1, raw.length));
  });
}

function markImages(raw: string, mask: Uint8Array): void {
  for (const m of raw.matchAll(/!\[[^\]]*\]\([^)]*\)/g)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  for (const m of raw.matchAll(/!\[\[[^\]]*\]\]/g)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
}

function markLinks(raw: string, mask: Uint8Array): void {
  // [文字](地址) → 保留「文字」，丢掉方括号与地址
  for (const m of raw.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) {
    const start = m.index ?? 0;
    const labelLength = m[1].length;
    drop(mask, start, start + 1);
    drop(mask, start + 1 + labelLength, start + m[0].length);
  }
  for (const m of raw.matchAll(/<https?:\/\/[^>\s]+>/g)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  for (const m of raw.matchAll(/https?:\/\/[^\s<>()[\]{}"']+/g)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
}

function markWikiLinks(raw: string, mask: Uint8Array): void {
  for (const m of raw.matchAll(/\[\[([^\]]*)\]\]/g)) {
    const start = m.index ?? 0;
    const inner = m[1];
    const bar = inner.lastIndexOf("|");
    const keepFrom = bar === -1 ? 0 : bar + 1; // 有别名就保留别名
    drop(mask, start, start + 2 + keepFrom);
    drop(mask, start + 2 + inner.length, start + m[0].length);
  }
}

function markInlineCode(raw: string, mask: Uint8Array): void {
  for (const m of raw.matchAll(/`[^`\n]*`/g)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
}

function markTags(raw: string, mask: Uint8Array): void {
  for (const m of raw.matchAll(/(^|[\s([{>])#([\p{L}\p{N}_\-/]+)/gu)) {
    const hashAt = (m.index ?? 0) + m[1].length;
    drop(mask, hashAt, hashAt + 1 + m[2].length);
  }
}

function markEmoji(raw: string, mask: Uint8Array): void {
  for (const m of raw.matchAll(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
}

function markHighlightMarks(raw: string, mask: Uint8Array): void {
  for (const m of raw.matchAll(/==/g)) {
    drop(mask, m.index ?? 0, (m.index ?? 0) + 2);
  }
}

function markChars(raw: string, mask: Uint8Array, char: string): void {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === char) mask[i] = 0;
  }
}

function markBackslashEscapes(raw: string, mask: Uint8Array): void {
  for (let i = 0; i + 1 < raw.length; i++) {
    // 只处理「反斜杠 + 标点」这种 Markdown 转义；「反斜杠 + 字母」原样保留
    if (raw[i] === "\\" && /[!-/:-@[-`{-~]/.test(raw[i + 1])) mask[i] = 0;
  }
}

function applyFilters(
  raw: string,
  filters: ReaderFilterSettings,
  mask: Uint8Array
): void {
  // 结构性的先处理，避免行内规则误伤结构
  if (filters.frontmatter) markFrontmatter(raw, mask);
  if (filters.fencedCode) markFencedCode(raw, mask);
  if (filters.tables) markTables(raw, mask);
  if (filters.headingMarks) markHeadingMarks(raw, mask);
  if (filters.quoteMarks) markQuoteMarks(raw, mask);
  if (filters.calloutMarks) markCalloutMarks(raw, mask);
  if (filters.listMarks) markListMarks(raw, mask);
  markLineFilters(raw, mask, filters);
  if (filters.imageEmbeds) markImages(raw, mask);
  if (filters.links) markLinks(raw, mask);
  if (filters.wikiLinks) markWikiLinks(raw, mask);
  if (filters.inlineCode) markInlineCode(raw, mask);
  if (filters.tags) markTags(raw, mask);
  if (filters.emoji) markEmoji(raw, mask);
  if (filters.highlightMarks) markHighlightMarks(raw, mask);
  if (filters.asterisks) markChars(raw, mask, "*");
  if (filters.underscores) markChars(raw, mask, "_");
  if (filters.backslashEscapes) markBackslashEscapes(raw, mask);
}

/**
 * 折叠冗余空白。
 *
 * 必须作用在**过滤后**的字符流上：URL / 链接被剔除后常留下成串空格
 * （`访问 [链接](url) 或看` → `访问  或看`），这些空格在原文里并不相邻，
 * 所以按原文扫描是抓不到的。
 *
 * 只折叠空格与制表符，**不动换行** —— 段落换行是分段器的强边界依据。
 * 同时去掉行尾空格。
 *
 * 注意：丢字符不影响映射正确性，因为我们同步丢弃对应的 mapping 项。
 */
function collapseWhitespace(
  chars: string[],
  mapping: number[]
): { chars: string[]; mapping: number[] } {
  const outChars: string[] = [];
  const outMapping: number[] = [];
  let previousWasSpace = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") {
      // 行尾空格去掉
      if (previousWasSpace && outChars.length > 0) {
        outChars.pop();
        outMapping.pop();
      }
      previousWasSpace = false;
      outChars.push(ch);
      outMapping.push(mapping[i]);
      continue;
    }
    if (ch === " " || ch === "\t") {
      if (previousWasSpace) continue;
      previousWasSpace = true;
      outChars.push(ch);
      outMapping.push(mapping[i]);
      continue;
    }
    previousWasSpace = false;
    outChars.push(ch);
    outMapping.push(mapping[i]);
  }

  return { chars: outChars, mapping: outMapping };
}

/** 原文里是否存在需要折叠的空白（用于决定能否走恒等快路径） */
const COLLAPSIBLE_WHITESPACE = /[ \t]{2,}|[ \t]\r?\n/;

export interface ReadableText {
  /** 过滤后的纯文本，交给 TTS 与分句器 */
  text: string;
  /** 过滤后下标 → 原文下标 */
  map: PositionMap;
  /**
   * 过滤后坐标下的强制断点（段必须在此结束），升序去重。
   * 承载过滤阶段才能看到的结构信息：列表项行尾、标题行尾。
   */
  forcedBreaks: number[];
}

/** 按过滤设置把原文转成朗读文本，同时保留回原文的偏移映射 */
export function buildReadableText(
  raw: string,
  filters: ReaderFilterSettings
): ReadableText {
  if (raw.length === 0) {
    return { text: "", map: identityPositionMap(0), forcedBreaks: [] };
  }

  const mask = new Uint8Array(raw.length).fill(1);
  applyFilters(raw, filters, mask);

  const breaksRaw: number[] = [];
  collectStructuralBreaks(raw, filters, breaksRaw);

  // 快路径：既没有字符被过滤掉，也没有需要折叠的空白 → 直接用原文，映射退化为恒等
  let dropped = false;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) {
      dropped = true;
      break;
    }
  }
  if (!dropped && !COLLAPSIBLE_WHITESPACE.test(raw)) {
    const map = identityPositionMap(raw.length);
    return {
      text: raw,
      map,
      forcedBreaks: dedupeSorted(breaksRaw.map(at => map.rawToFiltered(at))),
    };
  }

  const chars: string[] = [];
  const mapping: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (mask[i] === 0) continue;
    chars.push(raw[i]);
    mapping.push(i);
  }
  const collapsed = collapseWhitespace(chars, mapping);

  // 折叠后仍可能是恒等（例如原文本来就只有单个空格）→ 再给一次快路径
  let identity = collapsed.mapping.length === raw.length;
  if (identity) {
    for (let i = 0; i < collapsed.mapping.length; i++) {
      if (collapsed.mapping[i] !== i) {
        identity = false;
        break;
      }
    }
  }
  const map = identity
    ? identityPositionMap(raw.length)
    : new MappedPosition(collapsed.mapping, raw.length);
  return {
    text: collapsed.chars.join(""),
    map,
    forcedBreaks: dedupeSorted(breaksRaw.map(at => map.rawToFiltered(at))),
  };
}

function dedupeSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    if (out.length === 0 || out[out.length - 1] !== value) out.push(value);
  }
  return out;
}
