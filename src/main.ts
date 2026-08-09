import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  ButtonComponent,
  debounce,
  MarkdownView,
  Platform,
  Plugin,
} from "obsidian";
import { highlightSelectionMatches, reconfigureSelectionHighlighter, SelectionHighlightOptions } from "./highlighters/selection";
import { buildStyles, reconfigureStaticHighlighter, staticHighlighterExtension } from "./highlighters/static";
import { minimapExtension } from "./highlighters/minimap";
import { scrollbarMarkersExtension } from "./highlighters/scrollbar-markers";
import { DEFAULT_SETTINGS, GlimpseSettings, HighlighterOptions } from "./settings/settings";
import { SettingTab } from "./settings/ui";
import { HIGHLIGHT_INDEX_VIEW, HighlightIndexView } from "./highlight-index-view";
import { TeleprompterManager } from "./teleprompter";


export default class GlimpsePlugin extends Plugin {
  settings!: GlimpseSettings;
  extensions!: Extension[];
  styles!: Extension;
  staticHighlighter!: Extension;
  selectionHighlighter!: Extension;
  minimapExtension!: Extension;
  settingsTab!: SettingTab;
  private cssSheets: CSSStyleSheet[] = [];
  teleprompterManager!: TeleprompterManager;
  private statusBarItem?: HTMLElement;

  async onload() {
    await this.loadSettings();
    // 提词器先于视图注册初始化：高亮索引视图 onOpen（layout-ready 可能同步触发）
    // 会经 anchoredDocPath 读 teleprompterManager，晚初始化即 undefined 崩溃
    this.teleprompterManager = new TeleprompterManager(this);
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

    // 提词器 —— 桌面端专用（ADRs/0001）
    this.register(() => this.teleprompterManager.onunload());
    this.addCommand({
      id: "open-teleprompter",
      name: "打开提词器",
      callback: () => {
        if (!Platform.isDesktop) return;
        this.teleprompterManager.openOrFocus();
      },
    });
    this.addCommand({
      id: "close-all-teleprompters",
      name: "关闭所有提词器",
      callback: () => {
        if (!Platform.isDesktop) return;
        this.teleprompterManager.closeAll();
      },
    });

    // 状态栏「打开提词器」按钮（随设置显隐）
    this.updateStatusBarButton();
  }

  /** 状态栏「打开提词器」按钮：图标 presentation，右下角；设置关闭或移动端时移除 */
  updateStatusBarButton() {
    const show = this.settings.teleprompter.statusBarButton !== false && Platform.isDesktop;
    if (!show) {
      this.statusBarItem?.detach();
      this.statusBarItem = undefined;
      return;
    }
    if (this.statusBarItem) return;
    const item = (this.statusBarItem = this.addStatusBarItem());
    item.addClass("glimpse-tp-statusbar-btn");
    // 状态栏 flex-direction: row-reverse —— addStatusBarItem 追加到末尾会落在最左，
    // 移到首位即为右下角（时钟旁）
    const statusBar = document.querySelector(".status-bar");
    if (statusBar) statusBar.prepend(item);
    new ButtonComponent(item)
      .setClass("clickable-icon")
      .setIcon("lucide-presentation")
      .setTooltip("打开提词器")
      .onClick(() => {
        if (!Platform.isDesktop) return;
        this.teleprompterManager.openOrFocus();
      });
    this.register(() => item.detach());
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
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // 提词器设置单独深层合并（浅合并下 windows[] 数组会被整体覆盖）
    this.settings.teleprompter = Object.assign({}, DEFAULT_SETTINGS.teleprompter, data?.teleprompter ?? {});
    // 强制对齐项目默认值并写回磁盘，避免 data.json 残留旧值
    let changed = false;
    if (this.settings.selectionHighlighter.minSelectionLength !== DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength) {
      this.settings.selectionHighlighter.minSelectionLength = DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength;
      changed = true;
    }
    if (this.settings.selectionHighlighter.maxSelectionLength === undefined) {
      this.settings.selectionHighlighter.maxSelectionLength = DEFAULT_SETTINGS.selectionHighlighter.maxSelectionLength;
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

  /** 注入用户自定义 CSS。审核要求禁止创建/挂载 <style> 元素；
     改用 CSSStyleSheet + document.adoptedStyleSheets（无样式元素，Chromium 全支持） */
  initCSS() {
    this.updateCustomCSS();
    this.register(() => {
      for (const s of this.cssSheets) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== s);
      }
    });
  }

  updateCustomCSS() {
    // 卸载旧注入的 stylesheet
    for (const s of this.cssSheets) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== s);
    }
    this.cssSheets = [];
    const css = Object.values(this.settings.staticHighlighter.queries)
      .map(q => q?.css)
      .filter((c): c is string => !!c)
      .join("\n");
    if (css) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets.push(sheet);
      this.cssSheets.push(sheet);
    }
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
    // Dispatch compartment reconfigure to already-open editors
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
