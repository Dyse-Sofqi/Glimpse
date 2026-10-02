/**
 * 实时匹配高亮：正则替换 Modal 打开期间，把查找命中同步点亮在编辑器里。
 *
 * 结构与朗读高亮（reader/highlight.ts）同型：外部经 StateEffect 推入匹配区间，
 * StateField 换成装饰。mark 是**行内**装饰，跨行匹配必须按行切开，
 * 否则渲染错位（「一行里只有最后一块亮着」，见 reader 侧的实测注释）。
 *
 * 生命周期刻意做得比朗读高亮简单：高亮只属于「Modal 开着的这段时间」，
 * 关闭即清空，不需要跨编辑器重建，也不会带着旧匹配在用户后续编辑里漂移 ——
 * 装饰虽然会随 transaction.changes 自动平移，但那只是兜底（替换写回的那一次
 * 事务发生的瞬间 Modal 还没关），不作为长期状态维护。
 */
import { EditorState, Extension, Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

/** 编辑器坐标下的一处匹配区间 */
export interface SearchMatchRange {
	from: number;
	to: number;
}

/** 点亮的匹配数上限 —— 与选择高亮的 maxMatches（1000）同量级，
    防止 `\s` 这类超宽正则把装饰集撑到拖垮渲染 */
const MAX_HIGHLIGHT_MARKS = 1000;

/** 设置/清除编辑器内的匹配高亮；传 null 或空数组即清除 */
export const setSearchMatches = StateEffect.define<SearchMatchRange[] | null>();

function buildMatchDecorations(state: EditorState, ranges: SearchMatchRange[]): DecorationSet {
	const doc = state.doc;
	const mark = Decoration.mark({ class: "glimpse-replace-match" });
	const decos: Range<Decoration>[] = [];

	for (const range of ranges) {
		if (decos.length >= MAX_HIGHLIGHT_MARKS) break;
		const from = Math.max(0, Math.min(range.from, doc.length));
		const to = Math.max(from, Math.min(range.to, doc.length));
		// 空匹配（零宽断言等）没有可亮的字符区间，也挂不了 mark
		if (to <= from) continue;

		const firstLine = doc.lineAt(from);
		const lastLine = doc.lineAt(to);
		for (let number = firstLine.number; number <= lastLine.number; number++) {
			const line = doc.line(number);
			const markFrom = Math.max(from, line.from);
			const markTo = Math.min(to, line.to);
			if (markTo > markFrom) decos.push(mark.range(markFrom, markTo));
		}
	}
	// sort=true：逐行切开的 mark 不保证有序
	return Decoration.set(decos, true);
}

export const searchMatchField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(decorations, transaction) {
		// 先随文档变更平移（替换写回的那次事务），再应用效果
		let next = decorations.map(transaction.changes);
		for (const effect of transaction.effects) {
			if (!effect.is(setSearchMatches)) continue;
			next =
				effect.value && effect.value.length > 0
					? buildMatchDecorations(transaction.state, effect.value)
					: Decoration.none;
		}
		return next;
	},
	provide: field => EditorView.decorations.from(field),
});

export function searchHighlightExtension(): Extension {
	// 配色放在 styles.css 的 .glimpse-replace-match，不用 EditorView.theme 内联 ——
	// 用户能用 CSS 片段覆盖（与朗读高亮同一约定）
	return searchMatchField;
}

/** 设置/清除某编辑器的匹配高亮 */
export function applySearchMatches(view: EditorView, ranges: SearchMatchRange[] | null): void {
	view.dispatch({ effects: [setSearchMatches.of(ranges)] });
}
