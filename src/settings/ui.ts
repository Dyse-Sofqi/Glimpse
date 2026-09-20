import { App, PluginSettingTab } from "obsidian";
import GlimpsePlugin from "../main";
import type { ValueEditor } from "./css-editor";
import { render as renderPersistent } from "./tabs/persistent-ui";
import { render as renderSelection } from "./tabs/selection-ui";
import { render as renderIndex } from "./tabs/index-ui";
import { render as renderTeleprompter } from "./tabs/teleprompter-ui";
import { render as renderMusic } from "./tabs/music-ui";

/** 主标签页定义：id 用于选中判定，render 负责填充该页内容 */
interface MainTab {
  id: string;
  label: string;
  render: (el: HTMLElement, tab: SettingTab) => void;
}

const MAIN_TABS: MainTab[] = [
  { id: "persistent", label: "持久高亮", render: (el, tab) => renderPersistent(el, tab.plugin, tab) },
  { id: "selection", label: "选择高亮", render: (el, tab) => renderSelection(el, tab.plugin) },
  { id: "index", label: "高亮索引", render: (el, tab) => renderIndex(el, tab.plugin) },
  { id: "teleprompter", label: "提词器", render: (el, tab) => renderTeleprompter(el, tab.plugin, tab) },
  { id: "music", label: "音乐", render: (el, tab) => renderMusic(el, tab.plugin, tab) },
];

export class SettingTab extends PluginSettingTab {
  plugin: GlimpsePlugin;
  editor!: ValueEditor;
  /** 持久高亮当前选中的分组 */
  activeGroup: string = "默认";
  /** 正在拖拽的高亮器名称（跨分组拖放时临时记录） */
  _dragItemId: string | undefined;
  /** 当前显示的主标签页 */
  activeMainTab = "persistent";

  /** 本次渲染创建、需在重建或关闭时释放的资源（色板实例等） */
  private disposables: Array<() => void> = [];

  constructor(app: App, plugin: GlimpsePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** 登记资源释放函数；display() 重入或 hide() 时统一执行 */
  registerDisposable(dispose: () => void) {
    this.disposables.push(dispose);
  }

  private releaseDisposables() {
    for (const dispose of this.disposables) dispose();
    this.disposables = [];
  }

  hide() {
    this.releaseDisposables();
  }

  display(): void {
    // 先释放上一轮渲染留下的资源（DOM 清空后色板实例仍持有引用），再重建
    this.releaseDisposables();
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("glimpse-settings");

    const tabBarEl = containerEl.createDiv({ cls: "glimpse-main-tab-bar" });
    for (const tab of MAIN_TABS) {
      const tabEl = tabBarEl.createEl("span", { cls: "glimpse-main-tab", text: tab.label });
      if (this.activeMainTab === tab.id) tabEl.addClass("active");
      tabEl.addEventListener("click", () => {
        if (this.activeMainTab === tab.id) return;
        this.activeMainTab = tab.id;
        this.display();
      });
    }

    // 四页内容全部渲染，非当前页整体隐藏（切页时不丢失已填写的表单状态）
    for (const tab of MAIN_TABS) {
      const contentEl = containerEl.createDiv({ cls: "glimpse-tab-content" });
      if (this.activeMainTab !== tab.id) contentEl.hide();
      tab.render(contentEl, this);
    }
  }
}
