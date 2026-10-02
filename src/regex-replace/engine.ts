/**
 * 正则替换引擎：纯逻辑，无 Obsidian / CM 依赖。
 *
 * 设计核心是**只算一遍替换**：collectMatches 给每处匹配预展开 replacement
 * （含捕获组引用），预览高亮、编辑器点亮、实际写回（Modal 的逐处 changes）与
 * 替换后全文全都从这一份 MatchInfo 派生 —— 不存在「预览一套算法、替换另一套」
 * 的分歧空间。
 *
 * 移植自 obsidian-regex-replace 的 engine.ts，并做了两处收紧：
 * - 去掉了原生 String.replace 路径。预览/替换统一走 substituteGroups，
 *   连「$2 超出捕获组个数时原生留下字面 $2、这里给空串」这类边角都对齐成一种行为；
 * - 全部匹配强制 g（withGlobalFlag），模块语义就是「全部替换」。
 */
import { MatchInfo, ReplaceResult, withGlobalFlag } from "./types";

// 预览窗口的字符预算，以及第一处匹配之前保留的上下文长度。
// 导出常量让 Modal 与引擎共享同一份定义。
export const PREVIEW_WINDOW = 1000;
export const PREVIEW_CONTEXT_BEFORE = 200;

/**
 * 计算预览渲染的文本窗口：文档超过预算时不整篇渲染，窗口锚定第一处匹配
 * （After 视图锚定第一处变化），保证大文档里「要改的地方」一定可见。
 * 返回的坐标在传入文本自身的空间里（Before 是原文空间，After 是输出空间）。
 */
export function computePreviewWindow(
	textLength: number,
	firstMatchIndex: number,
	maxLen: number,
	contextBefore: number
): { start: number; end: number } {
	if (textLength <= maxLen) {
		return { start: 0, end: textLength };
	}
	let start = Math.max(0, firstMatchIndex - contextBefore);
	let end = start + maxLen;
	if (end > textLength) {
		end = textLength;
		start = Math.max(0, end - maxLen);
	}
	return { start, end };
}

/** Before/After 预览共用的文本切片：isReplacement 区分「原样保留」与「替换产生」 */
export interface ReplacementSegment {
	text: string;
	isReplacement: boolean;
}

/** 把原文 + 逐处替换拼成交替切片（After 视图按它渲染并给替换段着色） */
export function buildReplacementSegments(
	text: string,
	matches: MatchInfo[]
): ReplacementSegment[] {
	const segments: ReplacementSegment[] = [];
	let lastIndex = 0;

	for (const match of matches) {
		if (match.index > lastIndex) {
			segments.push({ text: text.substring(lastIndex, match.index), isReplacement: false });
		}
		segments.push({ text: match.replacement, isReplacement: true });
		lastIndex = match.index + match.length;
	}
	if (lastIndex < text.length) {
		segments.push({ text: text.substring(lastIndex), isReplacement: false });
	}
	return segments;
}

export class RegexEngine {
	/**
	 * 完整预览：编译正则、收集逐处匹配（替换文本已展开）并拼出替换后全文。
	 * 任何失败都以 { error } 返回而不是抛异常，调用方据此显示错误行。
	 */
	static preview(
		text: string,
		pattern: string,
		replacement: string,
		flags: string
	): ReplaceResult | { error: string } {
		let regex: RegExp;
		try {
			regex = new RegExp(pattern, withGlobalFlag(flags));
		} catch (e) {
			return { error: e instanceof Error ? e.message : String(e) };
		}

		try {
			const processedReplacement = this.processReplacement(replacement);
			const matches = this.collectMatches(text, processedReplacement, regex);
			return {
				original: text,
				replaced: buildReplacementSegments(text, matches)
					.map(segment => segment.text)
					.join(""),
				matchCount: matches.length,
				matches,
			};
		} catch (e) {
			return { error: e instanceof Error ? e.message : String(e) };
		}
	}

	/** 用户输入里的字面转义：\n \t \r 先变成真实字符，再进替换展开 */
	private static processReplacement(replacement: string): string {
		return replacement
			.replace(/\\n/g, "\n")
			.replace(/\\t/g, "\t")
			.replace(/\\r/g, "\r");
	}

	private static collectMatches(
		text: string,
		replacement: string,
		regex: RegExp
	): MatchInfo[] {
		const matchInfos: MatchInfo[] = [];
		let match: RegExpExecArray | null;

		while ((match = regex.exec(text)) !== null) {
			const matchedText = match[0];
			// 替换展开必须用 exec 结果直接算，不能对匹配子串重跑正则 ——
			// 重跑丢了前后文，lookbehind/lookahead 会在错误位置生效，预览失真。
			matchInfos.push({
				index: match.index,
				length: matchedText.length,
				match: matchedText,
				replacement: this.substituteGroups(matchedText, match, replacement),
			});

			// 空匹配（如零宽断言）不会推进 lastIndex，不手动 +1 会死循环
			if (match.index === regex.lastIndex) {
				regex.lastIndex++;
			}
		}

		return matchInfos;
	}

	/**
	 * 手写替换展开：$& 整个匹配、$1-$99 捕获组、$<name> 命名组、$$ 字面 $。
	 * 与原生 replace 的唯一已知分歧：引用不存在的组（如只有 1 个组却写 $2）
	 * 时这里给空串，原生留字面 $2 —— 本模块的替换也走这里，所见即所得。
	 */
	private static substituteGroups(
		matchedText: string,
		match: RegExpExecArray,
		replacement: string
	): string {
		// 先按 $$ 切开再拼回，字面 $ 永远不会被二次展开，
		// 既不需要哨兵字符，也没有正则灾难回溯的风险
		return replacement
			.split("$$")
			.map(part =>
				part
					.replace(/\$&/g, matchedText)
					.replace(/\$(\d+)/g, (_full: string, n: string): string => {
						const idx = parseInt(n, 10);
						return match[idx] ?? "";
					})
					.replace(/\$<([^>]+)>/g, (_full: string, name: string): string =>
						match.groups?.[name] ?? ""
					)
			)
			.join("$");
	}
}
