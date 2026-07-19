import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SearchCursor } from "@codemirror/search";
import { RegExpCursor } from "./highlighters/regexp-cursor";
import {
  ButtonComponent,
  debounce,
  ItemView,
  MarkdownView,
  Notice,
  Plugin,
  setIcon,
  WorkspaceLeaf,
} from "obsidian";
import { highlightSelectionMatches, reconfigureSelectionHighlighter, SelectionHighlightOptions } from "./highlighters/selection";
import { buildStyles, staticHighlighterExtension } from "./highlighters/static";
import { minimapExtension } from "./highlighters/minimap";
import { scrollbarMarkersExtension } from "./highlighters/scrollbar-markers";
import { DEFAULT_SETTINGS, GlimpseSettings, HighlighterOptions } from "./settings/settings";
import { SettingTab } from "./settings/ui";

export const HIGHLIGHT_INDEX_VIEW = "glimpse-highlight-index";

export class HighlightIndexView extends ItemView {
  plugin: GlimpsePlugin;
  panelsEl!: HTMLElement;
  activePanel = "index";
  private lastActiveMdView: MarkdownView | null = null;
  private lastRenderedMatches: { line: number; text: string }[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: GlimpsePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return HIGHLIGHT_INDEX_VIEW;
  }

  getDisplayText(): string {
    return "高亮索引";
  }

  getIcon(): string {
    return "flower";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const btnContainer = contentEl.createDiv({ cls: "nav-buttons-container" });

    const indexBtn = new ButtonComponent(btnContainer);
    indexBtn.setIcon("sparkles").setTooltip("高亮索引").then(b => {
      b.buttonEl.addClass("clickable-icon");
      b.buttonEl.addEventListener("click", () => { if (this.activePanel !== "index") this.switchPanel("index"); });
    });

    const sourceBtn = new ButtonComponent(btnContainer);
    sourceBtn.setIcon("rotate-3d").setTooltip("滥觞溯源").then(b => {
      b.buttonEl.addClass("clickable-icon");
      b.buttonEl.addEventListener("click", () => { if (this.activePanel !== "source") this.switchPanel("source"); });
    });

    this.panelsEl = contentEl.createDiv({ cls: "glimpse-index-panels" });

    this.app.workspace.onLayoutReady(() => {
      this.switchPanel(this.activePanel);
    });

    // re-render when active leaf changes
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        if (this.activePanel === "index") this.renderIndexPanel();
      })
    );
  }

  switchPanel(panel: string) {
    this.activePanel = panel;
    this.panelsEl.empty();

    if (panel === "index") {
      this.renderIndexPanel();
    }
  }

  renderIndexPanel() {
    const panelsEl = this.panelsEl;

    let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      // find any open markdown leaf
      const leaves = this.app.workspace.getLeavesOfType("markdown");
      if (leaves.length) activeView = leaves[0].view as MarkdownView;
    }
    if (activeView) {
      this.lastActiveMdView = activeView;
    } else if (this.lastActiveMdView) {
      activeView = this.lastActiveMdView;
    } else {
      panelsEl.empty();
      panelsEl.createEl("p", { text: "打开一个文档以查看高亮索引", cls: "glimpse-index-empty" });
      return;
    }

    const cm = (activeView.editor as any)?.cm as EditorView;
    if (!cm) return;

    const cursor = new RegExpCursor(cm.state.doc, "==[^=]+?==");
    const matches: { line: number; text: string }[] = [];
    while (!cursor.next().done) {
      const { from, to } = cursor.value;
      const matchText = cm.state.doc.sliceString(from, to);
      const line = cm.state.doc.lineAt(from);
      const displayText = matchText.replace(/^==|==$/g, "").trim();
      matches.push({ line: line.number, text: displayText });
    }

    // keep previous results if new scan finds nothing
    if (!matches.length && this.lastRenderedMatches.length) return;

    panelsEl.empty();
    this.lastRenderedMatches = matches;
    const section = panelsEl.createDiv({ cls: "glimpse-index-section" });
    const header = section.createDiv({ cls: "glimpse-index-header" });
    header.createSpan({ text: `高亮文本 (${matches.length})`, cls: "glimpse-index-name" });

    for (const m of matches) {
      const card = section.createDiv({ cls: "glimpse-index-card" });
      const cardContent = card.createDiv({ cls: "glimpse-index-card-content" });
      cardContent.createSpan({ text: m.text, cls: "glimpse-index-text" });
      const copyBtn = card.createEl("button", { cls: "glimpse-index-copy clickable-icon" });
      setIcon(copyBtn, "clipboard-paste");
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const textarea = document.createElement("textarea");
        textarea.value = m.text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        new Notice("已复制");
      });
      cardContent.addEventListener("click", () => {
        activeView.editor.setCursor(m.line - 1, 0);
        activeView.editor.scrollIntoView({ from: { line: m.line - 1, ch: 0 }, to: { line: m.line - 1, ch: 0 } }, true);
      });
    }
  }
}

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
    this.updateStaticHighlighter();
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
    this.extensions.remove(this.staticHighlighter);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.push(this.staticHighlighter);
    this.app.workspace.updateOptions();
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
