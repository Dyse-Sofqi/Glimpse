/**
 * 段内按标点细分高亮（纯显示层）。
 *
 * 实际分段（决定 TTS 请求粒度）不动 —— 这里只把正在播放的段按标点拆成子区间，
 * 播放时按音频时钟推进高亮，让段级高亮细到分句、实时跟随。
 *
 * 时间分配：没有逐词时间戳，按「字符权重累计占比」估算当前读到哪个子区间
 * （与 docs/reader-handoff.md §5 逐词方案同一思路，粒度到分句）。
 * 每段开始时重新按实际音频时长归一，误差不跨段累积。
 *
 * 高亮区间**不含块尾标点**：标点仍属于本子区间（停顿时间算进时长权重），但不涂色 ——
 * 见 ClauseSpan.textContentTo。整段路径（不细分）走同一待遇，见 segmentContentRawRange。
 */
import type { Segment } from "./segmenter";
import type { PositionMap } from "./text-pipeline";

export interface ClauseSpan {
  /** 段文本内的起止下标（textTo 不含；尾标点并入前面的子区间） */
  textFrom: number;
  textTo: number;
  /**
   * 不含尾标点的结束下标（textTo 的「内容边界」）。
   *
   * 标点照旧属于本子区间 —— 它的停顿时间也要算进时长权重里 —— 但**高亮不覆盖它**：
   * 亮起一整句后再把末尾的「。」也涂上色，视觉上像多标了一个字，读起来很别扭。
   * 所以高亮区间取 [textFrom, textContentTo)，进度权重仍按 [textFrom, textTo) 统计。
   */
  textContentTo: number;
  /** 时长权重（相对值） */
  weight: number;
}

/** 分句标点：强边界 + 弱边界 + 冒号破折号（子区间只做显示，比分段规则细） */
const CLAUSE_PUNCT = /[。！？!?…；;，、：:—～]/;

/** 块尾标点（= 分句标点 + 半角句点，覆盖英文句末）—— 这些不纳入高亮 */
const TRAILING_PUNCT = /[。！？!?…；;，、：:—～.]/;

/** 单字符时长权重：CJK 全角 ≈ 1，拉丁/数字 ≈ 0.5，空白 ≈ 0.2，标点 ≈ 0.6（含停顿） */
function charWeight(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (CLAUSE_PUNCT.test(ch)) return 0.6;
  if (/\s/.test(ch)) return 0.2;
  if (
    (code >= 0x2e80 && code <= 0x9fff) || // CJK 部首/标点/汉字
    (code >= 0xf900 && code <= 0xfaff) || // 兼容汉字
    (code >= 0xff00 && code <= 0xffef) // 全角字符
  ) {
    return 1;
  }
  return 0.5;
}

/** 把段文本按标点拆成子区间；连续标点（？！……）并入当前子区间，但不计入高亮内容 */
export function splitClauses(text: string): ClauseSpan[] {
  const spans: ClauseSpan[] = [];
  let from = 0;
  let weight = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    weight += charWeight(ch);
    const isLast = i === text.length - 1;
    // 标点自身结束本子区间的「内容」（高亮到它之前为止）
    const contentTo = CLAUSE_PUNCT.test(ch) ? i : i + 1;
    if (CLAUSE_PUNCT.test(ch) || isLast) {
      // 吸收紧随的连续标点（…… ？！ ），避免拆出单字符子区间
      let to = i + 1;
      while (to < text.length && CLAUSE_PUNCT.test(text[to])) {
        weight += charWeight(text[to]);
        to++;
      }
      if (to > from) spans.push({ textFrom: from, textTo: to, textContentTo: contentTo, weight });
      from = to;
      i = to - 1;
      weight = 0;
    }
  }
  return spans;
}

/** 播放进度 ratio ∈ [0,1] → 当前子区间下标（单调不减，终点落在最后一个） */
export function clauseIndexAt(spans: ClauseSpan[], ratio: number): number {
  if (spans.length === 0) return -1;
  const clamped = Math.min(1, Math.max(0, ratio));
  const total = spans.reduce((sum, span) => sum + span.weight, 0);
  if (total <= 0) return spans.length - 1;
  let acc = 0;
  for (let i = 0; i < spans.length; i++) {
    acc += spans[i].weight;
    if (clamped * total < acc) return i;
  }
  return spans.length - 1;
}

export interface RawSpan {
  from: number;
  to: number;
}

/**
 * 段在过滤后文本里占的区间 `[start, end)`。
 *
 * **这是所有原文换算的唯一锚点**：分段器给的 `rawFrom`/`rawTo` 是原文坐标，
 * 而子区间下标是过滤后坐标，两者只在段内这一小段上可靠。任何越过段界的查询
 * （`rawToFiltered` 的 ceil 语义会一路滑到段外）都会算出倒挂区间，表现为整段不亮。
 */
function segmentFilteredBounds(segment: Segment, map: PositionMap): { start: number; end: number } {
  const start = map.rawToFiltered(segment.rawFrom);
  const end = Math.max(start, map.rawToFiltered(segment.rawTo));
  return { start, end };
}

/** 把过滤后下标夹回段内 */
function clampToSegment(index: number, start: number, end: number): number {
  return Math.max(start, Math.min(end, index));
}

/**
 * 「过滤后坐标的内容结束处」→ 原文下标（不含尾标点）。
 *
 * `toFiltered` = 内容结束的过滤后下标（一般正落在句末标点上）。先夹回段内再换算 ——
 * 不夹的话 `rawToFiltered` 的 ceil 语义会一路滑到段外，算出倒挂区间。
 */
function contentEndRaw(map: PositionMap, toFiltered: number, start: number, end: number): number {
  const index = clampToSegment(toFiltered, start, end);
  return map.filteredToRaw(index);
}

/**
 * 整段的高亮区间：**去掉结尾的连续标点**（不细分时用）。
 *
 * 思路：先数出段尾有**几个保留字符**是标点，得到「内容结束的过滤后下标」，
 * 再从这个下标往回走 —— 只要它落在标点上就继续退（`filteredToRaw` 可能正好指到
 * 标点本身，也可能因为标点被过滤而越界），停在第一个非标点的保留字符上。
 *
 * 为什么不在原文坐标里数：`segment.text` 是过滤后文本，`rawFrom`/`rawTo` 是原文坐标，
 * 段内夹着被过滤字符时两者差值对不上 —— 实测 `被 \`码\` 隔开的末尾。` 原文长 12、
 * 过滤后只剩 8，按原文长度回退会多退好几个字。
 */
export function segmentContentRawRange(segment: Segment, map: PositionMap): RawSpan {
  const text = segment.text;
  const { start, end } = segmentFilteredBounds(segment, map);
  const filteredLength = end - start; // 段在过滤后文本里占的字符数
  let i = text.length;
  while (i > 0 && /\s/.test(text[i - 1])) i--; // 段尾空白不发声
  if (i === 0 || !TRAILING_PUNCT.test(text[i - 1])) return { from: segment.rawFrom, to: segment.rawTo };

  let punctStart = i;
  while (punctStart > 0 && TRAILING_PUNCT.test(text[punctStart - 1])) punctStart--;
  if (punctStart === 0) return { from: segment.rawFrom, to: segment.rawTo }; // 整段都是标点：无可亮内容

  // 内容结束的过滤后下标 → 收回段内、并跳过落在标点上的那一格
  let contentEnd = clampToSegment(start + filteredLength - (i - punctStart), start, end);
  while (contentEnd > start && TRAILING_PUNCT.test(text[contentEnd - 1 - start])) contentEnd--;
  const to = map.filteredToRaw(contentEnd);
  return to > segment.rawFrom ? { from: segment.rawFrom, to } : { from: segment.rawFrom, to: segment.rawTo };
}

/**
 * 把段的子区间换算成原文区间（供 CM6 高亮；换算与段构建同一套映射约定）。
 * 同时返回带权重的文本子区间（进度定位用）。
 * 返回 null 表示无需细分（拿不到映射 / 只有单个子区间）。
 *
 * 高亮区间**不含尾标点**（见 ClauseSpan.textContentTo），且**绝不越出段界**：
 * 子区间下标是过滤后坐标，一律先夹回 `[start, end)` 再换算 —— 不夹的话
 * `rawToFiltered` 会滑到段外，算出 `from > to` 的倒挂区间，`buildDecorations`
 * 拿到 `to <= from` 直接返回空集，表现就是「整段完全不亮」。
 */
export function clauseRawSpans(
  segment: Segment,
  map: PositionMap
): { spans: ClauseSpan[]; raw: RawSpan[] } | null {
  const spans = splitClauses(segment.text);
  if (spans.length <= 1) return null;
  const { start, end } = segmentFilteredBounds(segment, map);
  const raw = spans.map(span => {
    const from = clampToSegment(start + span.textFrom, start, end);
    const contentTo = clampToSegment(start + span.textContentTo, from, end);
    // 内容边界落在段尾时，尾标点可能是连续一串（？？），交给整段那套整串退掉
    const to =
      span.textContentTo >= segment.text.length
        ? segmentContentRawRange(segment, map).to
        : contentEndRaw(map, contentTo, from, end);
    return { from: map.filteredToRaw(from), to: Math.max(map.filteredToRaw(from), to) };
  });
  return { spans, raw };
}
