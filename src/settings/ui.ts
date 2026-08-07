import { App, PluginSettingTab, TextAreaComponent } from "obsidian";
import Pickr from "@simonwep/pickr";
import GlimpsePlugin from "../main";
import { render as renderPersistent } from "./tabs/persistent-ui";
import { render as renderSelection } from "./tabs/selection-ui";
import { render as renderIndex } from "./tabs/index-ui";
import { render as renderTeleprompter } from "./tabs/teleprompter-ui";

export class SettingTab extends PluginSettingTab {
  plugin: GlimpsePlugin;
  editor!: TextAreaComponent;
  pickrInstance!: Pickr;
  fontColorPickr: Pickr | undefined; // 提词器「字体颜色」选择器（hide/重建时销毁）
  activeGroup: string = "默认";
  _dragItemId: string | undefined;
  activeMainTab = "persistent";

  constructor(app: App, plugin: GlimpsePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide() {
    this.pickrInstance && this.pickrInstance.destroyAndRemove();
    this.fontColorPickr && this.fontColorPickr.destroyAndRemove();
    this.fontColorPickr = undefined;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("glimpse-settings");

    // main tab bar: 持久高亮 | 选择高亮 | 高亮索引 | 提词器
    const mainTabBarEl = containerEl.createDiv({ cls: "glimpse-main-tab-bar" });
    const persistentTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "持久高亮" });
    const selectionTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "选择高亮" });
    const indexTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "高亮索引" });
    const teleprompterTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "提词器" });
    if (this.activeMainTab === "persistent") persistentTab.addClass("active");
    else if (this.activeMainTab === "selection") selectionTab.addClass("active");
    else if (this.activeMainTab === "index") indexTab.addClass("active");
    else teleprompterTab.addClass("active");
    persistentTab.addEventListener("click", () => { this.activeMainTab = "persistent"; this.display(); });
    selectionTab.addEventListener("click", () => { this.activeMainTab = "selection"; this.display(); });
    indexTab.addEventListener("click", () => { this.activeMainTab = "index"; this.display(); });
    teleprompterTab.addEventListener("click", () => { this.activeMainTab = "teleprompter"; this.display(); });

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

    // ── teleprompter tab content ──
    const teleprompterContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "teleprompter") teleprompterContent.style.display = "none";
    renderTeleprompter(teleprompterContent, this.plugin, this);
  }
}
