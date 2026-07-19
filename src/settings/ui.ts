import { EditorView } from "@codemirror/view";
import { App, PluginSettingTab } from "obsidian";
import Pickr from "@simonwep/pickr";
import GlimpsePlugin from "../main";
import { render as renderPersistent } from "./tabs/persistent-ui";
import { render as renderSelection } from "./tabs/selection-ui";
import { render as renderIndex } from "./tabs/index-ui";

export class SettingTab extends PluginSettingTab {
  plugin: GlimpsePlugin;
  editor!: EditorView;
  pickrInstance!: Pickr;
  activeGroup: string = "默认";
  _dragItemId: string | undefined;
  activeMainTab = "persistent";

  constructor(app: App, plugin: GlimpsePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide() {
    this.editor?.destroy();
    this.pickrInstance && this.pickrInstance.destroyAndRemove();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("glimpse-settings");

    // main tab bar: 持久高亮 | 选择高亮 | 高亮索引
    const mainTabBarEl = containerEl.createDiv({ cls: "glimpse-main-tab-bar" });
    const persistentTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "持久高亮" });
    const selectionTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "选择高亮" });
    const indexTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "高亮索引" });
    if (this.activeMainTab === "persistent") persistentTab.addClass("active");
    else if (this.activeMainTab === "selection") selectionTab.addClass("active");
    else indexTab.addClass("active");
    persistentTab.addEventListener("click", () => { this.activeMainTab = "persistent"; this.display(); });
    selectionTab.addEventListener("click", () => { this.activeMainTab = "selection"; this.display(); });
    indexTab.addEventListener("click", () => { this.activeMainTab = "index"; this.display(); });

    // ── persistent highlight tab content ──
    const persistentContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "persistent") persistentContent.style.display = "none";
    renderPersistent(persistentContent, this.plugin, this);

    // ── selection highlight tab content ──
    const selectionContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "selection") selectionContent.style.display = "none";
    renderSelection(selectionContent, this.plugin);

    // ── highlight index tab content ──
    const indexContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "index") indexContent.style.display = "none";
    renderIndex(indexContent, this.plugin);
  }
}
