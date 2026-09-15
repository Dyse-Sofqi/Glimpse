// 自定义 CSS 的代码输入框：基于 CodeMirror 6 + @codemirror/lang-css。
//
// 相比原来的 <textarea>，这里拿到了：语法高亮、括号/引号自动闭合、括号匹配、
// 撤销历史，以及**按输入自动补全 CSS** —— 补全词表来自 @codemirror/lang-css 的
// cssCompletionSource（`css()` 已把它挂进 languageData.autocomplete），
// 因此不必自己维护 CSS 属性/取值词表，也不会随 CSS 规范更新而过时。
//
// 主题：高亮色全部走 Obsidian 的 CSS 变量，浅色/深色主题自动跟随；
// 外观（边框、底色、字号、高度）见 styles.css 的 .custom-css-wrapper 段。
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** 设置页里「读写一段文本」的最小契约 */
export interface ValueEditor {
  getValue(): string;
  setValue(value: string): void;
}

export interface CssEditorConfig {
  /** 承载编辑器的容器 */
  container: HTMLElement;
  /** 初始内容 */
  value?: string;
  /** 空内容时的占位提示 */
  placeholder?: string;
}

export interface CssEditorHandle extends ValueEditor {
  destroy(): void;
}

/** 用 Obsidian 主题变量着色，浅色/深色自动跟随；tag 名与 @lezer/css 实际标注的一致 */
const cssHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--color-purple)" },
  { tag: [tags.className, tags.tagName, tags.labelName, tags.namespace], color: "var(--color-blue)" },
  { tag: tags.variableName, color: "var(--color-cyan)" },
  { tag: tags.string, color: "var(--color-green)" },
  { tag: [tags.number, tags.unit], color: "var(--color-orange)" },
  { tag: [tags.keyword, tags.operatorKeyword], color: "var(--color-red)" },
  { tag: tags.comment, color: "var(--text-faint)", fontStyle: "italic" },
  { tag: [tags.punctuation, tags.separator, tags.paren, tags.squareBracket], color: "var(--text-muted)" },
]);

export function createCssEditor(config: CssEditorConfig): CssEditorHandle {
  const view = new EditorView({
    parent: config.container,
    state: EditorState.create({
      doc: config.value ?? "",
      extensions: [
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        css(), // 语法解析 + cssCompletionSource 补全
        autocompletion(),
        syntaxHighlighting(cssHighlightStyle),
        EditorView.lineWrapping,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        ...(config.placeholder ? [placeholderExt(config.placeholder)] : []),
      ],
    }),
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    destroy: () => view.destroy(),
  };
}
