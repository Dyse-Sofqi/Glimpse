/**
 * 段级高亮：用 CM6 装饰器标出正在朗读的段落。
 *
 * 为什么用装饰器而不是像 Note Reader 那样做绝对定位的 DOM 覆盖层：
 * 装饰器自动跟随换行、缩放、字体与主题，不需要 coordsAtPos 测量、
 * 不需要 CSS 变量定位，也没有 z-index 负值、跨行阈值这类补丁。
 * 代价是只在视口内渲染 —— 但我们本来就要滚到当前段，无影响。
 */
import { ChangeSet, EditorState, Extension, Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export interface ReaderHighlightRange {
  from: number;
  to: number;
}

/**
 * 文档变更转发口：controller 订阅它，累计「自分段以来」的变更链。
 *
 * 为什么需要：段的 rawFrom / rawTo 是**分段那一刻**的坐标。装饰本身会随
 * transaction.changes 自动平移（见下面 readerHighlightField.update），但 controller
 * 每次换段、标点细分推进、提词器取文本时都会**从存储坐标重算**区间 —— 用户朗读中
 * 一旦编辑文档，重算就会用到过期坐标，表现为高亮整体偏移（越改越偏）。
 * 把变更链交给 controller，用 `ChangeSet.mapPos` 把旧坐标换算到当前文档即可自动修正。
 *
 * 用模块级转发口而不是 StateField 存变更链：变更链必须能**跨编辑器重建**活下来
 * （切标签页/切工作区时 Obsidian 会销毁并重建 CM 视图，StateField 会随之清零，
 * 而那些编辑已经落到文档里了），而 controller 的生命周期比编辑器长。
 */
export type ReaderDocChangeListener = (view: EditorView, changes: ChangeSet) => void;

let docChangeListener: ReaderDocChangeListener | null = null;

export function setReaderDocChangeListener(listener: ReaderDocChangeListener | null): void {
  docChangeListener = listener;
}

/**
 * 把「旧文档坐标」的区间经变更链换算到新文档；区间被删到不含任何字符时返回 null。
 *
 * 关联方向与 CM 自己平移装饰（`RangeSet.map`：from 取 assoc 1、to 取 assoc -1）**必须一致**，
 * 否则「自动平移」与「重算」两条路径在插入点边界上的取舍相反，换段瞬间高亮会跳动。
 * 实测该约定为：在 from 处插入 → 高亮右移（新字符不算入）；在 to 处插入 → 高亮不动。
 */
export function mapRangeThroughDelta(
  delta: ChangeSet | null,
  range: ReaderHighlightRange
): ReaderHighlightRange | null {
  if (!delta || delta.empty) return range;
  const from = delta.mapPos(range.from, 1);
  const to = delta.mapPos(range.to, -1);
  if (to <= from) return null;
  return { from, to };
}

/** 设置/清除朗读高亮；传 null 清除 */
export const setReaderHighlight = StateEffect.define<ReaderHighlightRange | null>();

/**
 * 把高亮区间切成 CM6 装饰。
 *
 * **区间装饰必须按行切开**：`Decoration.mark` 是**行内**装饰，一条跨行的 mark
 * （段常含换行，尤其带 `\n\n` 的段落断点）在渲染时会错位 —— 实测表现为
 * 「一行里只有最后一块亮着」。所以逐行生成 mark，与行装饰同段推进。
 */
function buildDecorations(state: EditorState, range: ReaderHighlightRange): DecorationSet {
  const doc = state.doc;
  const from = Math.max(0, Math.min(range.from, doc.length));
  const to = Math.max(from, Math.min(range.to, doc.length));
  if (to <= from) return Decoration.none;

  const lineMark = Decoration.line({ class: "glimpse-reader-line" });
  const segmentMark = Decoration.mark({ class: "glimpse-reader-segment" });
  const decos: Range<Decoration>[] = [];
  const firstLine = doc.lineAt(from);
  const lastLine = doc.lineAt(to);
  for (let number = firstLine.number; number <= lastLine.number; number++) {
    const line = doc.line(number);
    decos.push(lineMark.range(line.from));
    const markFrom = Math.max(from, line.from);
    const markTo = Math.min(to, line.to);
    if (markTo > markFrom) decos.push(segmentMark.range(markFrom, markTo));
  }
  // sort=true：行装饰与区间装饰混在一起，必须排序
  return Decoration.set(decos, true);
}

/** 朗读高亮的装饰器字段（导出以便验证脚本按行检查装饰） */
export const readerHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    // 先随文档变更平移，避免用户编辑后高亮错位
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setReaderHighlight)) continue;
      next = effect.value ? buildDecorations(transaction.state, effect.value) : Decoration.none;
    }
    return next;
  },
  provide: field => EditorView.decorations.from(field),
});

export function readerHighlightExtension(): Extension {
  // 配色放在 styles.css 的 .glimpse-reader-line / .glimpse-reader-segment 里，
  // 而不是用 EditorView.theme 内联 —— 这样用户能用 CSS 片段覆盖。
  return [
    readerHighlightField,
    // 变更转发：只转发「文档真的变了」的事务，空变更不参与累计
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      docChangeListener?.(update.view, update.changes);
    }),
  ];
}

/** 当前编辑器是否还挂着朗读高亮装饰。
    编辑器被 Obsidian 卸载重建（切标签页后台叶子）后，StateField 随新 EditorState
    重新初始化为空 → false；controller 据此判断要不要补发（见 controller.restoreHighlight）。 */
export function hasReaderHighlight(view: EditorView): boolean {
  const set = view.state.field(readerHighlightField, false);
  return set !== undefined && set.size > 0;
}

/**
 * 把某位置滚动到可视区中部 —— **只动 cm-scroller，绝不碰祖先容器**。
 *
 * 为什么不用 `EditorView.scrollIntoView`：它在自身滚不到目标时（例如目标靠近
 * 文档顶部、无法居中，或滚动区已到底）会连带滚动裁剪祖先
 * （`.view-content` / `.workspace-leaf-content`）。而朗读播放条挂在 `.view-content`
 * 顶部，祖先一滚就被顶出视野 —— 表现为「首次朗读出声时播放条缩进去」，
 * 以及「段落更替时间隙忽有忽无」（滚动与复位来回拉锯）。
 */
export function scrollPosToCenter(view: EditorView, pos: number): void {
  const scroller = view.scrollDOM;
  if (!scroller) return;
  const block = view.lineBlockAt(pos);
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const target = block.top - (scroller.clientHeight - block.height) / 2;
  scroller.scrollTop = Math.max(0, Math.min(target, maxTop));
}

/**
 * 应用/清除高亮，并按需滚动到该段。
 * 滚动只作用于 cm-scroller（见 scrollPosToCenter），不触发祖先容器滚动。
 *
 * `followCursor`（设置项「光标位置随朗读刷新」，默认关）打开时，**同时把光标移到
 * 「正在读的那一行」的行首** —— 状态栏的位置读数、以及提词器的行提取都会随之更新。
 * 默认关闭是因为朗读会持续接管光标，编辑与取词都会被打断。
 */
export function applyReaderHighlight(
  view: EditorView,
  range: ReaderHighlightRange | null,
  scroll = true,
  followCursor = true
): void {
  view.dispatch({ effects: [setReaderHighlight.of(range)] });
  if (!range) return;
  if (followCursor) {
    // 锚 `to - 1`（正读到的那一格）而不是 `from`：子区间可以整个跨行 ——
    // 行尾是逗号时尤其常见（segmenter 的弱边界会切在逗号之后），
    // 「主唱的\n状态更是越来越好」就是一个子区间。用 `from` 会把光标留在**上一行**，
    // 表现为「换行后的那段高亮时，光标没有更新到该行行首」。
    moveCursorToLineStart(view, Math.max(range.from, range.to - 1));
  }
  if (scroll) scrollPosToCenter(view, range.from);
}

/**
 * 「光标跟随」是否应该为用户操作让路。
 *
 * 两个条件任一成立就让路，**都不成立时自动恢复** —— 没有需要手动解除的挂起状态：
 *   1. 编辑器里有非空选区 —— 移动光标等于毁掉选区（双击定位选中的那段文字正属此类）；
 *   2. 距上一次编辑不到 `graceMs` —— 用户正在打字，此刻把光标挪到朗读行会打断输入。
 *
 * 时间戳只由**文档变更**与**双击定位**刷新，**不能**把朗读自己挪光标也算成「用户活动」：
 * 那会让 grace 窗口被无限续期（朗读每次推进都刷新），光标跟随永远恢复不了。
 */
export function shouldHoldCursorForUser(opts: {
  selectionEmpty: boolean;
  msSinceUserActivity: number;
  graceMs: number;
}): boolean {
  if (!opts.selectionEmpty) return true;
  return opts.graceMs > 0 && opts.msSinceUserActivity < opts.graceMs;
}

/**
 * 把光标移到 pos 所在**行**的行首。
 *
 * 为什么锚行首而不是块首：一段常跨多行（段落内软换行、`\n\n` 段落断点后的续行），
 * 而「块」在 Obsidian 里是整段非空文本 —— 光标跟着**行**走，
 * 同一行内既有块更替（细分高亮推进）又有段更替，光标也只动一次，且总落在行首。
 *
 * 为什么走 CM6 dispatch 而不是 `editor.setCursor(line, ch)`：分段器给的是**整篇字符偏移**，
 * 过 line/ch 坐标还得自己数行，而 CM6 的 selection 直接吃偏移。
 *
 * `scrollIntoView: false`：滚动由 scrollPosToCenter 负责（只动 cm-scroller），
 * 不交给 CM（它会在自身滚不到时连带滚动裁剪祖先，见上）。光标已在该行行首时直接返回，
 * 避免无谓的 dispatch。
 */
function moveCursorToLineStart(view: EditorView, pos: number): void {
  const lineStart = view.state.doc.lineAt(pos).from;
  const current = view.state.selection.main;
  if (current.empty && current.head === lineStart) return;
  view.dispatch({
    selection: { anchor: lineStart },
    scrollIntoView: false,
  });
}
