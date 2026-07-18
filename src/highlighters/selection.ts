// originally from: https://github.com/codemirror/search/blob/main/src/selection-match.ts
import { SearchCursor } from "@codemirror/search";
import { combineConfig, Compartment, Extension, Facet } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { cloneDeep } from "lodash";
import { debounce, Debouncer } from "obsidian";
import { setMatchPositions } from "./scrollbar-markers";

// 选区高亮的配置选项
export type SelectionHighlightOptions = {
  highlightSelectedText: boolean;     // 是否启用高亮
  minSelectionLength: number;         // 高亮所需的最小选中字符数
  maxMatches: number;                 // 文本高亮的最大匹配数（滚动条标记不受限）
  highlightDelay: number;             // 高亮更新的防抖延迟(ms)
  minimapEnabled: boolean;            // 是否启用 minimap
};

const defaultHighlightOptions: SelectionHighlightOptions = {
  highlightSelectedText: true,
  minSelectionLength: 2,
  maxMatches: 1000,
  highlightDelay: 200,
  minimapEnabled: true,
};

// Facet — 合并多个配置源，取各字段的极值
export const highlightConfig = Facet.define<SelectionHighlightOptions, Required<SelectionHighlightOptions>>({
  combine(options: readonly SelectionHighlightOptions[]) {
    return combineConfig(options, defaultHighlightOptions, {
      highlightSelectedText: (a, b) => a ?? b,
      minSelectionLength: Math.min,
      maxMatches: Math.min,
      highlightDelay: Math.max,
      minimapEnabled: (a, b) => a ?? b,
    });
  },
});

export const highlightCompartment = new Compartment();

// 创建选区高亮扩展，可选传入覆盖配置
export function highlightSelectionMatches(options?: SelectionHighlightOptions): Extension {
  const ext: Extension[] = [matchHighlighter];
  if (options) {
    ext.push(highlightConfig.of(cloneDeep(options)));
  }
  return ext;
}

// 重建高亮扩展（用于运行时更新配置）
export function reconfigureSelectionHighlighter(options: SelectionHighlightOptions) {
  return highlightCompartment.reconfigure(highlightConfig.of(cloneDeep(options)));
}

// 核心高亮插件
const matchHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    highlightDelay!: number;
    delayedGetDeco!: Debouncer<[view: EditorView]>;
    matchLines: Set<number> = new Set();  // 存储匹配行号，用于滚动条标记
    private clearVersion = 0;             // 避免过期的 setTimeout 擦除新装饰

    constructor(view: EditorView) {
      this.updateDebouncer(view);
      this.decorations = this.getDeco(view);
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged) {
        const expectedVersion = ++this.clearVersion;
        setTimeout(() => {
          if (this.clearVersion !== expectedVersion) return; // 已有更新的调用，跳过
          this.decorations = Decoration.none;
          update.view.update([]);
        }, 150);
        this.delayedGetDeco(update.view);
      }
    }

    // 初始化/更新防抖处理器
    updateDebouncer(view: EditorView) {
      this.highlightDelay = view.state.facet(highlightConfig).highlightDelay;
      this.delayedGetDeco = debounce(
        (view: EditorView) => {
          this.decorations = this.getDeco(view);
          view.update([]); // 强制视图更新以应用新装饰

          // 将 matchLines 转为比例后派发给滚动条标记
          const doc = view.state.doc;
          const totalLines = doc.lines;
          let ratios: number[];
          if (this.matchLines.size > 0 && totalLines > 0) {
            ratios = [...this.matchLines].map(ln => (ln - 1) / totalLines);
          } else {
            ratios = [];
          }
          this.matchLines.clear();
          view.dispatch({ effects: setMatchPositions.of(ratios) });
        },
        this.highlightDelay
        // trailing edge: 选区稳定后才执行，避免调整选区时被忽略
      );
    }

    // 遍历全文搜索选中文本，返回 decorations
    getDeco(view: EditorView): DecorationSet {
      const conf = view.state.facet(highlightConfig);
      if (this.highlightDelay != conf.highlightDelay) this.updateDebouncer(view);
      const { state } = view,
        sel = state.selection;
      if (sel.ranges.length > 1) return Decoration.none;
      if (!conf.highlightSelectedText) return Decoration.none;
      const matchType = "string";
      // 规范化选区边界：CM6 的 anchor/head 可能反向（从右往左拖选时 from > to）
      const selFrom = Math.min(sel.main.from, sel.main.to);
      const selTo = Math.max(sel.main.from, sel.main.to);
      const len = selTo - selFrom;
      if (len < conf.minSelectionLength || len > 30) return Decoration.none;
      const query = state.sliceDoc(selFrom, selTo).trim();
      if (!query) return Decoration.none;
      const deco = [];
      const caseInsensitive = (s: string) => s.toLowerCase();
      // 全文档搜索（不限于可见区域）
      const cursor = new SearchCursor(state.doc, query, 0, state.doc.length, caseInsensitive);
      while (!cursor.next().done) {
        const { from, to } = cursor.value;
        const string = state.sliceDoc(from, to).trim();
        const ln = state.doc.lineAt(from).number;
        this.matchLines.add(ln); // 始终采集行号（滚动条标记不受 maxMatches 限制）
        if (deco.length >= conf.maxMatches) continue;
        if (from <= selFrom && to >= selTo) {
          deco.push(Decoration.mark({
            class: `cm-current-${matchType}`,
            attributes: { "data-contents": string },
          }).range(from, to));
        } else if (from >= selTo || to <= selFrom) {
          deco.push(Decoration.mark({
            class: `cm-matched-${matchType}`,
            attributes: { "data-contents": string },
          }).range(from, to));
        }
      }
      if (deco.length < 1) {
        return Decoration.none;
      }
      return Decoration.set(deco);
    }
  },
  {
    decorations: v => v.decorations,
  }
);
