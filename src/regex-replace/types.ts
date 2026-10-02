/**
 * 正则替换模块的共享类型。
 *
 * 逻辑层刻意不依赖 Obsidian：匹配收集、替换展开与预览都是纯函数
 * （string -> string | { error }），这样「预览里看到什么」与「实际替换成什么」
 * 由同一份数据（MatchInfo.replacement）保证 —— 见 engine.ts 的说明。
 */

/** 单处匹配的信息。预览高亮、编辑器点亮与实际替换都从这里取数据 */
export interface MatchInfo {
	/** 匹配在目标文本内的字符偏移。目标文本是整篇笔记或选区（见 Modal 的 getTarget） */
	index: number;
	length: number;
	/** 命中的原文 */
	match: string;
	/** 展开捕获组引用后的替换文本（$1、$<name>、$&、$$ 都已处理完） */
	replacement: string;
}

export interface ReplaceResult {
	original: string;
	/** 替换后的全文 —— 由逐处拼接而来，与 matches 严格一致 */
	replaced: string;
	matchCount: number;
	matches: MatchInfo[];
}

/** 一条替换历史（回填到 Modal 的一组输入） */
export interface PatternHistory {
	search: string;
	replace: string;
	/** 不含 g —— 本模块的替换总是全局的，g 是隐含语义 */
	flags: string;
	timestamp: number;
}

export interface RegexReplaceSettings {
	/** Modal 中是否显示替换前/后预览区 */
	showPreview: boolean;
	/** 历史记录上限（0 = 不记录） */
	historyLimit: number;
	history: PatternHistory[];
}

export const DEFAULT_REGEX_REPLACE_SETTINGS: RegexReplaceSettings = {
	showPreview: true,
	historyLimit: 10,
	history: [],
};

/** 仅选区模式下没有选区时的提示。拒绝而不是悄悄扩大到整篇 ——
    这个开关的意义就是「其余部分绝不动」，扩大范围等于开关失效 */
export const NO_SELECTION_NOTICE = "仅替换选区内容 —— 请先在笔记中选中一段文本。";

/** 统一补上 g 标志：匹配计数按全部命中收集（exec 循环也只对 g 正则成立），
    实际替换同样必须全部替换，否则「预览报 10 处、只换了 1 处」 */
export function withGlobalFlag(flags: string): string {
	return flags.includes("g") ? flags : `${flags}g`;
}
