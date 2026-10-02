/**
 * 正则查找替换 Modal：查找、替换、预览与全部替换。
 *
 * 结构参照 obsidian-regex-replace 的 ReplaceModal，按 Glimpse 的习惯调整：
 * - 标志位只留 i/m/s 复选框 —— 本模块语义就是「全部替换」，g 恒定隐含
 *   （匹配计数与实际替换处数永远一致），不提供「只换第一处」；
 * - 写回不用整篇 setValue，而是「一处匹配 = 一条 change」的批量 dispatch：
 *   一次事务就是一步撤销，光标由 CM 自动映射，选区外内容零扰动；
 * - Modal 开着期间把命中实时点亮到编辑器（highlight.ts），输入即刷新、
 *   关闭即清除；预览里的高亮片段与匹配列表可点击定位到编辑器对应位置。
 *
 * Modal 挡住编辑器，用户无法在打开期间改动文档/选区，所以预览的偏移量
 * 在整个 Modal 生命周期内都是新鲜的，不需要位置重算。
 */
import { Editor, Modal, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import {
	buildReplacementSegments,
	computePreviewWindow,
	PREVIEW_CONTEXT_BEFORE,
	PREVIEW_WINDOW,
	RegexEngine,
} from "./engine";
import { MatchInfo, NO_SELECTION_NOTICE, PatternHistory, ReplaceResult } from "./types";
import { applySearchMatches, SearchMatchRange } from "./highlight";
import { scrollPosToCenter } from "../reader/highlight";
import type GlimpsePlugin from "../main";

/** 匹配列表最多展开的条数，其余折叠为「还有 N 处」 */
const MAX_LIST_ITEMS = 10;
/** 命中的选区文本短于该长度时，转义后预填为查找模式（方便「改这个词」的场景） */
const PREFILL_SELECTION_MAX = 100;

/** 目标文本与它在文档中的起点偏移 */
interface ReplaceTarget {
	text: string;
	base: number;
	isSelection: boolean;
}

export class RegexReplaceModal extends Modal {
	private editor: Editor;
	/** CM6 视图；没有就不做编辑器内点亮，替换退回编辑器 API 兜底 */
	private cm: EditorView | null;
	private searchInput!: HTMLInputElement;
	private replaceInput!: HTMLInputElement;
	private flagCase!: HTMLInputElement;
	private flagMultiline!: HTMLInputElement;
	private flagDotAll!: HTMLInputElement;
	private selectionOnlyBox!: HTMLInputElement;
	private matchCountEl!: HTMLElement;
	private previewEl: HTMLElement | null = null;
	private selectionOnly = false;
	/** 当前预览的匹配（目标文本坐标）与目标文本在文档中的起点 */
	private currentMatches: MatchInfo[] = [];
	private targetBase = 0;

	constructor(private plugin: GlimpsePlugin, editor: Editor) {
		super(plugin.app);
		this.editor = editor;
		this.cm = (editor as unknown as { cm?: unknown }).cm instanceof EditorView
			? ((editor as unknown as { cm: EditorView }).cm)
			: null;
	}

	onOpen(): void {
		this.modalEl.addClass("modal-glimpse", "glimpse-replace-modal");
		this.titleEl.setText("正则查找替换");

		const { contentEl } = this;
		this.createSearchField(contentEl);
		this.createReplaceField(contentEl);
		this.createOptionsRow(contentEl);
		this.matchCountEl = contentEl.createDiv({ cls: "glimpse-replace-count" });
		this.createPreviewSection(contentEl);
		this.createHistoryDropdown(contentEl);
		this.createButtons(contentEl);

		this.initializeFromSelection();
		this.searchInput.focus();
	}

	onClose(): void {
		this.clearEditorHighlight();
		this.contentEl.empty();
	}

	// ---------------------------------------------------------------- 输入区

	private createSearchField(container: HTMLElement): void {
		const field = container.createDiv({ cls: "glimpse-replace-field" });
		field.createEl("label", { text: "查找（正则）" });
		this.searchInput = field.createEl("input", {
			type: "text",
			placeholder: "正则表达式，例如 \\d+ 或 (?<year>\\d{4})-\\d{2}",
			cls: "glimpse-replace-input",
		});
		this.searchInput.addEventListener("input", () => this.updatePreview());
		// Enter 直接触发替换；输入法组词期间的 Enter 是候选确认，不能抢
		this.searchInput.addEventListener("keydown", event => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				this.performReplace();
			}
		});
	}

	private createReplaceField(container: HTMLElement): void {
		const field = container.createDiv({ cls: "glimpse-replace-field" });
		field.createEl("label", { text: "替换为" });
		this.replaceInput = field.createEl("input", {
			type: "text",
			placeholder: "替换文本：$1 / $<name> 引用捕获组，\\n 换行，\\t 制表符",
			cls: "glimpse-replace-input",
		});
		this.replaceInput.addEventListener("input", () => this.updatePreview());
		this.replaceInput.addEventListener("keydown", event => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				this.performReplace();
			}
		});
	}

	private createOptionsRow(container: HTMLElement): void {
		const row = container.createDiv({ cls: "glimpse-replace-options" });
		this.flagCase = this.createOptionCheckbox(row, "忽略大小写 (i)", false);
		this.flagMultiline = this.createOptionCheckbox(row, "多行模式 (m)", false);
		this.flagDotAll = this.createOptionCheckbox(row, "点号匹配换行 (s)", false);
		this.selectionOnlyBox = this.createOptionCheckbox(row, "仅替换选区", false);
	}

	private createOptionCheckbox(
		container: HTMLElement,
		label: string,
		checked: boolean
	): HTMLInputElement {
		const labelEl = container.createEl("label", { cls: "glimpse-replace-option" });
		const box = labelEl.createEl("input", { type: "checkbox" });
		box.checked = checked;
		labelEl.appendText(label);
		box.addEventListener("change", () => this.updatePreview());
		return box;
	}

	// ---------------------------------------------------------------- 预览区

	private createPreviewSection(container: HTMLElement): void {
		if (!this.plugin.settings.regexReplace.showPreview) return;
		const section = container.createDiv({ cls: "glimpse-replace-preview" });
		section.createEl("label", { text: "预览（点击高亮处可定位到编辑器）" });
		this.previewEl = section.createDiv({ cls: "glimpse-replace-preview-body" });
	}

	private createHistoryDropdown(container: HTMLElement): void {
		const history = this.plugin.settings.regexReplace.history;
		if (history.length === 0) return;

		const wrap = container.createDiv({ cls: "glimpse-replace-history" });
		wrap.createEl("label", { text: "历史记录" });
		const select = wrap.createEl("select", { cls: "dropdown" });
		select.createEl("option", { text: "选择一组历史…", value: "" });
		history.forEach((entry, index) => {
			select.createEl("option", {
				text: `${truncate(entry.search, 40)} → ${truncate(entry.replace, 40)}`,
				value: String(index),
			});
		});
		// 选中后立即回填并复位占位项，同一条历史可以连续选两次
		select.addEventListener("change", () => {
			const entry = history[Number(select.value)];
			select.value = "";
			if (entry) this.loadHistory(entry);
		});
	}

	private loadHistory(entry: PatternHistory): void {
		this.searchInput.value = entry.search;
		this.replaceInput.value = entry.replace;
		this.flagCase.checked = entry.flags.includes("i");
		this.flagMultiline.checked = entry.flags.includes("m");
		this.flagDotAll.checked = entry.flags.includes("s");
		this.updatePreview();
	}

	private createButtons(container: HTMLElement): void {
		const row = container.createDiv({ cls: "glimpse-replace-buttons" });
		const replaceButton = row.createEl("button", { text: "全部替换", cls: "mod-cta" });
		replaceButton.addEventListener("click", () => this.performReplace());
		const cancelButton = row.createEl("button", { text: "关闭" });
		cancelButton.addEventListener("click", () => this.close());
	}

	// ---------------------------------------------------------------- 状态流

	/** 打开时已有较短选区 → 转义后预填为查找模式 */
	private initializeFromSelection(): void {
		const selection = this.editor.getSelection();
		if (selection && selection.length < PREFILL_SELECTION_MAX) {
			this.searchInput.value = escapeRegex(selection);
			this.updatePreview();
		}
	}

	private getFlags(): string {
		let flags = "";
		if (this.flagCase.checked) flags += "i";
		if (this.flagMultiline.checked) flags += "m";
		if (this.flagDotAll.checked) flags += "s";
		return flags;
	}

	/**
	 * 目标文本：整篇文档，或仅选区。仅选区而没有选区时返回 null ——
	 * 调用方必须提示并拒绝执行，绝不悄悄扩大到整篇。
	 */
	private getTarget(): ReplaceTarget | null {
		if (this.cm) {
			if (this.selectionOnly) {
				const selection = this.cm.state.selection.main;
				if (selection.empty) return null;
				return {
					text: this.cm.state.doc.sliceString(selection.from, selection.to),
					base: selection.from,
					isSelection: true,
				};
			}
			return { text: this.cm.state.doc.toString(), base: 0, isSelection: false };
		}
		// 无 CM 视图的兜底（理论上到不了）：坐标未知，编辑器内点亮自然关闭
		if (this.selectionOnly) {
			const selection = this.editor.getSelection();
			return selection ? { text: selection, base: 0, isSelection: true } : null;
		}
		return { text: this.editor.getValue(), base: 0, isSelection: false };
	}

	private updatePreview(): void {
		this.selectionOnly = this.selectionOnlyBox.checked;
		const pattern = this.searchInput.value;

		if (!pattern) {
			this.showEmpty();
			this.syncEditorHighlight([]);
			return;
		}
		const target = this.getTarget();
		if (!target) {
			this.showNoSelection();
			this.syncEditorHighlight([]);
			return;
		}

		const result = RegexEngine.preview(target.text, pattern, this.replaceInput.value, this.getFlags());
		if ("error" in result) {
			this.showError(result.error);
			this.syncEditorHighlight([]);
			return;
		}

		this.currentMatches = result.matches;
		this.targetBase = target.base;
		this.showResult(result, target.isSelection);
		this.syncEditorHighlight(result.matches, target.base);
	}

	// ---------------------------------------------------------------- 提示状态

	private showEmpty(): void {
		this.matchCountEl.removeClass("is-error");
		this.matchCountEl.setText("");
		if (this.previewEl) {
			this.previewEl.empty();
			this.previewEl.setText("输入查找内容后，这里显示替换前后对照。");
		}
	}

	private showNoSelection(): void {
		this.matchCountEl.removeClass("is-error");
		this.matchCountEl.setText(NO_SELECTION_NOTICE);
		if (this.previewEl) this.previewEl.empty();
	}

	private showError(message: string): void {
		this.matchCountEl.addClass("is-error");
		this.matchCountEl.setText(`正则有误：${message}`);
		if (this.previewEl) this.previewEl.empty();
	}

	private showResult(result: ReplaceResult, isSelection: boolean): void {
		this.matchCountEl.removeClass("is-error");
		const scope = isSelection ? "（选区内）" : "";
		this.matchCountEl.setText(`${result.matchCount} 处匹配${scope}`);

		if (!this.previewEl) return;
		this.previewEl.empty();
		if (result.matchCount === 0) {
			this.previewEl.setText("没有匹配。");
			return;
		}
		this.renderPreview(result);
	}

	// ---------------------------------------------------------------- 预览渲染

	private renderPreview(result: ReplaceResult): void {
		const text = result.original;

		const beforeSection = this.previewEl!.createDiv({ cls: "glimpse-replace-preview-section" });
		beforeSection.createEl("strong", { text: "替换前" });
		const beforeContent = beforeSection.createDiv();
		const firstHit = this.renderBeforeText(beforeContent, text, result.matches);

		const afterSection = this.previewEl!.createDiv({ cls: "glimpse-replace-preview-section" });
		afterSection.createEl("strong", { text: "替换后" });
		this.renderAfterText(afterSection.createDiv(), text, result.matches);

		this.renderMatchList(result.matches);

		// 滚到第一处高亮：nearest 只在目标不在视区时才滚，打字时保持安静
		if (firstHit) {
			window.requestAnimationFrame(() => firstHit.scrollIntoView({ block: "nearest" }));
		}
	}

	/** 替换前视图：原文窗口内点亮每处匹配，片段可点击定位 */
	private renderBeforeText(
		container: HTMLElement,
		text: string,
		matches: MatchInfo[]
	): HTMLElement | null {
		const firstIndex = matches.length > 0 ? matches[0].index : 0;
		const { start: winStart, end: winEnd } = computePreviewWindow(
			text.length,
			firstIndex,
			PREVIEW_WINDOW,
			PREVIEW_CONTEXT_BEFORE
		);

		if (winStart > 0) {
			container.createSpan({ text: "…", cls: "glimpse-replace-truncated" });
		}

		let firstHit: HTMLElement | null = null;
		let cursor = winStart;
		for (const match of matches) {
			const mEnd = match.index + match.length;
			if (mEnd <= winStart) continue;
			if (match.index >= winEnd) break;

			const clipStart = Math.max(match.index, winStart);
			const clipEnd = Math.min(mEnd, winEnd);
			if (clipStart > cursor) {
				container.createSpan({ text: text.substring(cursor, clipStart) });
			}
			const hit = container.createSpan({
				text: text.substring(clipStart, clipEnd),
				cls: "glimpse-replace-hit",
			});
			hit.addEventListener("click", () => this.jumpToMatch(match));
			if (!firstHit) firstHit = hit;
			cursor = clipEnd;
		}
		if (cursor < winEnd) {
			container.createSpan({ text: text.substring(cursor, winEnd) });
		}
		if (winEnd < text.length) {
			container.createSpan({ text: "…", cls: "glimpse-replace-truncated" });
		}
		return firstHit;
	}

	/** 替换后视图：交替切片渲染，替换段着色；窗口锚定第一处变化（输出空间坐标） */
	private renderAfterText(container: HTMLElement, text: string, matches: MatchInfo[]): void {
		const segments = buildReplacementSegments(text, matches);

		let outStart = 0;
		let firstChange = 0;
		let foundChange = false;
		const ranges = segments.map(segment => {
			const range = { start: outStart, end: outStart + segment.text.length, segment };
			if (segment.isReplacement && !foundChange) {
				// 空串替换（删除）在输出里没有长度，锚定它的起点即可
				firstChange = outStart;
				foundChange = true;
			}
			outStart += segment.text.length;
			return range;
		});
		const totalOut = outStart;

		const { start: winStart, end: winEnd } = computePreviewWindow(
			totalOut,
			firstChange,
			PREVIEW_WINDOW,
			PREVIEW_CONTEXT_BEFORE
		);

		if (winStart > 0) {
			container.createSpan({ text: "…", cls: "glimpse-replace-truncated" });
		}
		for (const { start: segStart, end: segEnd, segment } of ranges) {
			if (segEnd <= winStart) continue;
			if (segStart >= winEnd) break;
			const clipFrom = Math.max(segStart, winStart) - segStart;
			const clipTo = Math.min(segEnd, winEnd) - segStart;
			container.createSpan({
				text: segment.text.substring(clipFrom, clipTo),
				cls: segment.isReplacement ? "glimpse-replace-result" : undefined,
			});
		}
		if (winEnd < totalOut) {
			container.createSpan({ text: "…", cls: "glimpse-replace-truncated" });
		}
	}

	private renderMatchList(matches: MatchInfo[]): void {
		const listSection = this.previewEl!.createDiv({ cls: "glimpse-replace-list-section" });
		listSection.createEl("strong", { text: `匹配列表（前 ${Math.min(matches.length, MAX_LIST_ITEMS)} 处）` });
		const listEl = listSection.createEl("ul", { cls: "glimpse-replace-list" });

		for (const match of matches.slice(0, MAX_LIST_ITEMS)) {
			const item = listEl.createEl("li", { cls: "glimpse-replace-list-item" });
			item.createSpan({ text: `"${truncate(match.match, 30)}"`, cls: "glimpse-replace-hit-text" });
			item.createSpan({ text: " → " });
			item.createSpan({ text: `"${truncate(match.replacement, 30)}"`, cls: "glimpse-replace-result-text" });
			item.addEventListener("click", () => this.jumpToMatch(match));
		}
		if (matches.length > MAX_LIST_ITEMS) {
			listEl.createEl("li", {
				text: `…还有 ${matches.length - MAX_LIST_ITEMS} 处`,
				cls: "glimpse-replace-more",
			});
		}
	}

	// ---------------------------------------------------------------- 编辑器联动

	/** 把匹配点亮到编辑器里；坐标经 base 换算到文档空间（选区模式 base = 选区起点） */
	private syncEditorHighlight(matches: MatchInfo[], base = this.targetBase): void {
		if (!this.cm) return;
		const ranges: SearchMatchRange[] = [];
		for (const match of matches) {
			// 空匹配没有可亮的区间
			if (match.length === 0) continue;
			ranges.push({ from: base + match.index, to: base + match.index + match.length });
		}
		applySearchMatches(this.cm, ranges);
	}

	private clearEditorHighlight(): void {
		if (!this.cm) return;
		try {
			applySearchMatches(this.cm, null);
		} catch {
			// 编辑器可能已随叶子关闭而销毁，清不掉就随它去 —— StateField 会随视图一起消失
		}
	}

	/** 定位到某处匹配：光标落在匹配上、滚动到视区中部，随后关闭 Modal 让位给编辑器 */
	private jumpToMatch(match: MatchInfo): void {
		if (!this.cm) return;
		const from = this.targetBase + match.index;
		const to = from + match.length;
		this.cm.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: false });
		scrollPosToCenter(this.cm, to > from ? to - 1 : from);
		this.close();
	}

	// ---------------------------------------------------------------- 执行替换

	private performReplace(): void {
		const pattern = this.searchInput.value;
		if (!pattern) {
			new Notice("请先输入查找内容");
			return;
		}
		const target = this.getTarget();
		if (!target) {
			new Notice(NO_SELECTION_NOTICE);
			return;
		}
		// 用预览同一套计算拿逐处匹配 —— 点「全部替换」时看到什么就换什么
		const result = RegexEngine.preview(target.text, pattern, this.replaceInput.value, this.getFlags());
		if ("error" in result) {
			new Notice(`替换失败：${result.error}`);
			return;
		}
		if (result.matchCount === 0) {
			new Notice("没有匹配，未做任何修改");
			return;
		}

		this.applyMatches(target, result.matches);
		this.addHistory(pattern, this.replaceInput.value, this.getFlags());
		new Notice(`已替换 ${result.matchCount} 处`);
		this.close();
	}

	/** 「一处匹配 = 一条 change」写回：一次事务即一步撤销，光标与选区由 CM 自动映射。
	    替换前后文本相同的匹配直接跳过，不给撤销栈留噪音 */
	private applyMatches(target: ReplaceTarget, matches: MatchInfo[]): void {
		const changes = matches
			.filter(match => match.replacement !== match.match)
			.map(match => ({
				from: target.base + match.index,
				to: target.base + match.index + match.length,
				insert: match.replacement,
			}));
		if (changes.length === 0) return;

		if (this.cm) {
			this.cm.dispatch({ changes });
			return;
		}
		// 兜底：拼出替换后全文一次性写回（无 CM 视图时到不了这里）
		const replaced = buildReplacementSegments(target.text, matches)
			.map(segment => segment.text)
			.join("");
		if (target.isSelection) {
			this.editor.replaceSelection(replaced);
		} else {
			const cursor = this.editor.getCursor();
			this.editor.setValue(replaced);
			this.editor.setCursor(cursor);
		}
	}

	private addHistory(search: string, replace: string, flags: string): void {
		const settings = this.plugin.settings.regexReplace;
		if (settings.historyLimit <= 0) return;
		settings.history = [
			{ search, replace, flags, timestamp: Date.now() },
			// 同一组输入只留最新一条
			...settings.history.filter(
				entry => !(entry.search === search && entry.replace === replace && entry.flags === flags)
			),
		].slice(0, settings.historyLimit);
		void this.plugin.saveSettings();
	}
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(text: string, maxLen: number): string {
	return text.length <= maxLen ? text : `${text.substring(0, maxLen)}…`;
}
