// originally from: https://github.com/codemirror/search/blob/main/src/selection-match.ts
import { SearchCursor } from "@codemirror/search";
import { combineConfig, Compartment, Extension, Facet } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { cloneDeep } from "lodash";
import { debounce, Debouncer } from "obsidian";

export type SelectionHighlightOptions = {
  highlightSelectedText: boolean;
  minSelectionLength: number;
  maxMatches: number;
  highlightDelay: number;
};

const defaultHighlightOptions: SelectionHighlightOptions = {
  highlightSelectedText: true,
  minSelectionLength: 1,
  maxMatches: 100,
  highlightDelay: 0,
};

export const highlightConfig = Facet.define<SelectionHighlightOptions, Required<SelectionHighlightOptions>>({
  combine(options: readonly SelectionHighlightOptions[]) {
    return combineConfig(options, defaultHighlightOptions, {
      highlightSelectedText: (a, b) => a ?? b,
      minSelectionLength: Math.min,
      maxMatches: Math.min,
      highlightDelay: Math.min,
    });
  },
});

export const highlightCompartment = new Compartment();

export function highlightSelectionMatches(options?: SelectionHighlightOptions): Extension {
  const ext: Extension[] = [matchHighlighter];
  if (options) {
    ext.push(highlightConfig.of(cloneDeep(options)));
  }
  return ext;
}

export function reconfigureSelectionHighlighter(options: SelectionHighlightOptions) {
  return highlightCompartment.reconfigure(highlightConfig.of(cloneDeep(options)));
}

const matchHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    highlightDelay!: number;
    delayedGetDeco!: Debouncer<[view: EditorView]>;

    constructor(view: EditorView) {
      this.updateDebouncer(view);
      this.decorations = this.getDeco(view);
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        // don't immediately remove decorations to prevent issues with things like link clicking
        // https://github.com/nothingislost/obsidian-dynamic-highlights/issues/58
        setTimeout(() => {
          this.decorations = Decoration.none;
          update.view.update([]);
        }, 150);
        // this.decorations = Decoration.none;
        this.delayedGetDeco(update.view);
      }
    }

    updateDebouncer(view: EditorView) {
      this.highlightDelay = view.state.facet(highlightConfig).highlightDelay;
      this.delayedGetDeco = debounce(
        (view: EditorView) => {
          this.decorations = this.getDeco(view);
          view.update([]); // force a view update so that the decorations we just set get applied
        },
        this.highlightDelay,
        true
      );
    }

    getDeco(view: EditorView): DecorationSet {
      const conf = view.state.facet(highlightConfig);
      if (this.highlightDelay != conf.highlightDelay) this.updateDebouncer(view);
      const { state } = view,
        sel = state.selection;
      if (sel.ranges.length > 1) return Decoration.none;
      const range = sel.main,
        matchType = "string";
      if (!conf.highlightSelectedText) return Decoration.none;
      const len = range.to - range.from;
      if (len < conf.minSelectionLength || len > 200) return Decoration.none;
      const query = state.sliceDoc(range.from, range.to).trim();
      if (!query) return Decoration.none;
      const deco = [];
      for (const part of view.visibleRanges) {
        const caseInsensitive = (s: string) => s.toLowerCase();
        const cursor = new SearchCursor(state.doc, query, part.from, part.to, caseInsensitive);
        while (!cursor.next().done) {
          const { from, to } = cursor.value;
          const string = state.sliceDoc(from, to).trim();
          if (from <= range.from && to >= range.to) {
            const mainMatchDeco = Decoration.mark({
              class: `cm-current-${matchType}`,
              attributes: { "data-contents": string },
            });
            deco.push(mainMatchDeco.range(from, to));
          } else if (from >= range.to || to <= range.from) {
            const matchDeco = Decoration.mark({
              class: `cm-matched-${matchType}`,
              attributes: { "data-contents": string },
            });
            deco.push(matchDeco.range(from, to));
          }
          if (deco.length > conf.maxMatches) return Decoration.none;
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
