import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  debounce,
  MarkdownView,
  Plugin,
} from "obsidian";
import { highlightSelectionMatches, reconfigureSelectionHighlighter, SelectionHighlightOptions } from "./highlighters/selection";
import { buildStyles, staticHighlighterExtension, reconfigureStaticHighlighter, StaticHighlightOptions } from "./highlighters/static";
import { minimapExtension } from "./highlighters/minimap";
import { scrollbarMarkersExtension } from "./highlighters/scrollbar-markers";
import { DEFAULT_SETTINGS, GlimpseSettings, HighlighterOptions } from "./settings/settings";
import { SettingTab } from "./settings/ui";
import { HIGHLIGHT_INDEX_VIEW, HighlightIndexView } from "./highlight-index-view";


export default class GlimpsePlugin extends Plugin {
  settings!: GlimpseSettings;
  extensions!: Extension[];
  styles!: Extension;
  staticHighlighter!: Extension;
  selectionHighlighter!: Extension;
  minimapExtension!: Extension;
  styleEl!: HTMLElement;
  settingsTab!: SettingTab;

  async onload() {
    await this.loadSettings();
    this.registerView(HIGHLIGHT_INDEX_VIEW, (leaf) => new HighlightIndexView(leaf, this));
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions = [];
    this.updateSelectionHighlighter();
    this.updateMinimap();
    this.extensions.push(scrollbarMarkersExtension());
    this.extensions.push(this.staticHighlighter);
    this.updateStyles();
    this.registerEditorExtension(this.extensions);
    this.initCSS();
    if (this.settings.highlightIndex.autoOpenRightLeaf) {
      this.app.workspace.onLayoutReady(() => this.openHighlightIndex());
    }

    this.addCommand({
      id: "open-highlight-index",
      name: "打开高亮索引",
      callback: () => this.openHighlightIndex(),
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(HIGHLIGHT_INDEX_VIEW);
  }

  openHighlightIndex() {
    const existing = this.app.workspace.getLeavesOfType(HIGHLIGHT_INDEX_VIEW);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const rightLeaf = this.app.workspace.getRightLeaf(false);
    if (rightLeaf) {
      rightLeaf.setViewState({ type: HIGHLIGHT_INDEX_VIEW, active: true });
      this.app.workspace.revealLeaf(rightLeaf);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // 强制对齐项目默认值并写回磁盘，避免 data.json 残留旧值
    let changed = false;
    if (this.settings.selectionHighlighter.minSelectionLength !== DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength) {
      this.settings.selectionHighlighter.minSelectionLength = DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength;
      changed = true;
    }
    if (this.settings.selectionHighlighter.maxMatches !== DEFAULT_SETTINGS.selectionHighlighter.maxMatches) {
      this.settings.selectionHighlighter.maxMatches = DEFAULT_SETTINGS.selectionHighlighter.maxMatches;
      changed = true;
    }
    if (this.settings.selectionHighlighter.highlightDelay < 200) {
      this.settings.selectionHighlighter.highlightDelay = 200;
      changed = true;
    }
    if (changed) await this.saveSettings();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  initCSS() {
    const styleEl = (this.styleEl = document.createElement("style"));
    styleEl.setAttribute("type", "text/css");
    document.head.appendChild(styleEl);
    this.register(() => styleEl.detach());
    this.updateCustomCSS();
  }

  updateCustomCSS() {
    this.styleEl.textContent = Object.values(this.settings.staticHighlighter.queries)
      .map(q => q && q.css)
      .join("\n");
    this.app.workspace.trigger("css-change");
  }

  updateStyles() {
    this.extensions.remove(this.styles);
    this.styles = buildStyles(this);
    this.extensions.push(this.styles);
    this.app.workspace.updateOptions();
  }

  updateStaticHighlighter() {
    // Update extensions array (used by registerEditorExtension for new editors)
    this.extensions.remove(this.staticHighlighter);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.push(this.staticHighlighter);
    this.app.workspace.updateOptions();
    // Dispatch compartment reconfigure to open editors
    const options = this.settings.staticHighlighter;
    this.iterateCM6(view => {
      view.dispatch({
        effects: reconfigureStaticHighlighter(options),
      });
    });
  }

  updateSelectionHighlighter() {
    this.extensions.remove(this.selectionHighlighter);
    this.selectionHighlighter = highlightSelectionMatches(this.settings.selectionHighlighter)
    this.extensions.push(this.selectionHighlighter);
    this.updateMinimap();
    this.app.workspace.updateOptions();
  }

  updateMinimap() {
    this.extensions.remove(this.minimapExtension);
    if (this.settings.selectionHighlighter.minimapEnabled) {
      this.minimapExtension = minimapExtension({ enabled: true, width: 80 });
      this.extensions.push(this.minimapExtension);
    }
  }

  iterateCM6(callback: (editor: EditorView) => unknown) {
    this.app.workspace.iterateAllLeaves(leaf => {
      leaf?.view instanceof MarkdownView &&
        (leaf.view.editor as any)?.cm instanceof EditorView &&
        callback((leaf.view.editor as any).cm);
    });
  }

  updateConfig = debounce(
    (type: string, config: HighlighterOptions) => {
      if (type !== "selection") return;
      this.iterateCM6(view => {
        view.dispatch({
          effects: reconfigureSelectionHighlighter(config as SelectionHighlightOptions),
        });
      });
    },
    1000,
    true
  );
}
