// originally from: https://github.com/codemirror/search/blob/main/src/selection-match.ts
import { SearchCursor } from "@codemirror/search";
import { combineConfig, Compartment, Extension, Facet, Range } from "@codemirror/state";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type { RegExpExecArray } from "regexp-match-indices/types";
import GlimpsePlugin from "../main";
import { SearchQueries, SearchQuery } from "../settings/settings";
import { StyleSpec } from "style-mod";
import { RegExpCursor } from "./regexp-cursor";

export type StaticHighlightOptions = {
  queries: SearchQueries;
  queryOrder: string[];
  groups: string[];
};

const defaultOptions: StaticHighlightOptions = {
  queries: {},
  queryOrder: [],
  groups: [],
};

export const staticHighlightConfig = Facet.define<StaticHighlightOptions, Required<StaticHighlightOptions>>({
  combine(options: readonly StaticHighlightOptions[]) {
    return combineConfig(options, defaultOptions, {
      queries: (a, b) => a || b,
      queryOrder: (a, b) => a || b,
    });
  },
});

export const staticHighlighterCompartment = new Compartment();

export function staticHighlighterExtension(plugin: GlimpsePlugin): Extension {
  const options = plugin.settings.staticHighlighter;
  return staticHighlighterCompartment.of([
    staticHighlighter,
    staticHighlightConfig.of({...options}),
  ]);
}

export function reconfigureStaticHighlighter(options: StaticHighlightOptions) {
  return staticHighlighterCompartment.reconfigure([
    staticHighlighter,
    staticHighlightConfig.of({...options}),
  ]);
}

export interface Styles {
  [selector: string]: StyleSpec;
}

export function buildStyles(plugin: GlimpsePlugin) {
  const queries: SearchQuery[] = Object.values(plugin.settings.staticHighlighter.queries);
  const styles: Styles = {};
  for (const query of queries) {
    const className = "." + query.class;
    if (!query.color) continue;
    styles[className] = { backgroundColor: query.color };
  }
  const theme = EditorView.theme(styles);
  return theme;
}

class IconWidget extends WidgetType {
  className: string | undefined;

  constructor(className?: string) {
    super();
    this.className = className;
  }

  toDOM() {
    const headerEl = document.createElement("span");
    this.className && headerEl.addClass(this.className);
    return headerEl;
  }

  ignoreEvent() {
    return true;
  }
}

const staticHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    lineDecorations: DecorationSet;
    groupDecorations: DecorationSet;
    widgetDecorations: DecorationSet;

    constructor(view: EditorView) {
      const { token, line, group, widget } = this.getDeco(view);
      this.decorations = token;
      this.lineDecorations = line;
      this.groupDecorations = group;
      this.widgetDecorations = widget;
    }

    update(update: ViewUpdate) {
      const reconfigured = update.startState.facet(staticHighlightConfig) !== update.state.facet(staticHighlightConfig);
      if (update.docChanged || update.viewportChanged || reconfigured) {
        const { token, line, group, widget } = this.getDeco(update.view);
        this.decorations = token;
        this.lineDecorations = line;
        this.groupDecorations = group;
        this.widgetDecorations = widget;
      }
    }

    getDeco(view: EditorView): {
      line: DecorationSet;
      token: DecorationSet;
      group: DecorationSet;
      widget: DecorationSet;
    } {
      const { state } = view,
        tokenDecos: Range<Decoration>[] = [],
        lineDecos: Range<Decoration>[] = [],
        groupDecos: Range<Decoration>[] = [],
        widgetDecos: Range<Decoration>[] = [],
        lineClasses: { [key: number]: string[] } = {},
        queries: SearchQuery[] = Object.values(view.state.facet(staticHighlightConfig).queries);
      for (const part of view.visibleRanges) {
        for (const query of queries) {
          let cursor: RegExpCursor | SearchCursor;
          try {
            if (query.regex) cursor = new RegExpCursor(state.doc, query.query, {}, part.from, part.to);
            else cursor = new SearchCursor(state.doc, query.query, part.from, part.to);
          } catch (err) {
            console.debug(err);
            continue;
          }
          while (!cursor.next().done) {
            const { from, to } = cursor.value;
            const string = state.sliceDoc(from, to).trim();
            const linePos = view.state.doc.lineAt(from)?.from;
            const syntaxNode = syntaxTree(view.state).resolveInner(linePos + 1),
              nodeProps = syntaxNode.type.prop(tokenClassNodeProp),
              excludedSection = ["hmd-codeblock", "hmd-frontmatter"].find(token =>
                nodeProps?.split(" ").includes(token)
              );
            if (excludedSection) continue;
            if (query.mark?.includes("line")) {
              if (!lineClasses[linePos]) lineClasses[linePos] = [];
              lineClasses[linePos].push(query.class);
            }
            if (!query.mark || query.mark?.includes("match")) {
              const markDeco = Decoration.mark({ class: query.class, attributes: { "data-contents": string } });
              tokenDecos.push(markDeco.range(from, to));
            }
            if (query.mark?.includes("start") || query.mark?.includes("end")) {
              const startDeco = Decoration.widget({ widget: new IconWidget(query.class + "-start") });
              const endDeco = Decoration.widget({ widget: new IconWidget(query.class + "-end") });
              if (query.mark?.includes("start")) widgetDecos.push(startDeco.range(from, from));
              if (query.mark?.includes("end")) widgetDecos.push(endDeco.range(to, to));
            }
            if (query.mark?.includes("group")) {
              let groups;
              if (cursor instanceof RegExpCursor) {
                const match = cursor.value?.match as RegExpExecArray;
                groups = match.indices?.groups;
              }
              groups &&
                Object.entries(groups).forEach(group => {
                  try {
                    const [groupName, [groupFrom, groupTo]] = group;
                    const groupDeco = Decoration.mark({ class: groupName });
                    groupDecos.push(groupDeco.range(linePos + groupFrom, linePos + groupTo));
                  } catch (err) {
                    console.debug(err);
                  }
                });
            }
          }
        }
      }
      Object.entries(lineClasses).forEach(([pos, classes]) => {
        // we use the long form attributes: {class: ... } to avoid a CM6 bug with class:
        // the issue was fixed in obs 0.13.20 but we'll leave it like this until the
        // next public release
        pos = parseInt(pos); // since Object.entries returns keys as strings
        const lineDeco = Decoration.line({ attributes: { class: classes.join(" ") } });
        lineDecos.push(lineDeco.range(pos));
      });
      return {
        line: Decoration.set(lineDecos.sort((a, b) => a.from - b.from)),
        token: Decoration.set(tokenDecos.sort((a, b) => a.from - b.from)),
        group: Decoration.set(groupDecos.sort((a, b) => a.from - b.from)),
        widget: Decoration.set(widgetDecos.sort((a, b) => a.from - b.from)),
      };
    }
  },
  {
    provide: plugin => [
      // these are separated out so that we can set decoration priority
      // it's also much easier to sort the decorations when they're grouped
      EditorView.decorations.of(v => v.plugin(plugin)?.lineDecorations || Decoration.none),
      EditorView.decorations.of(v => v.plugin(plugin)?.groupDecorations || Decoration.none),
      EditorView.decorations.of(v => v.plugin(plugin)?.decorations || Decoration.none),
      EditorView.decorations.of(v => v.plugin(plugin)?.widgetDecorations || Decoration.none),
    ],
  }
);
