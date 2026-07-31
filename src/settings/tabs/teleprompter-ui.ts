import { Platform, Setting } from "obsidian";
import GlimpsePlugin from "../../main";

// 提词器设置 —— 桌面端专用（ADRs/0001），移动端显示占位说明
export function render(containerEl: HTMLElement, plugin: GlimpsePlugin) {
  if (!Platform.isDesktop) {
    containerEl.createEl("p", { text: "提词器仅桌面端可用。" });
    return;
  }

  new Setting(containerEl)
    .setName("字体透明度")
    .setDesc("内容文字的不透明度（百分比）；空内容占位显示上一项文本时在此基础上减半")
    .addSlider(slider =>
      slider
        .setLimits(0, 100, 1)
        .setValue(plugin.settings.teleprompter.fontOpacity)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.fontOpacity = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        })
    );

  new Setting(containerEl)
    .setName("背景透明度")
    .setDesc("悬停时窗口背景的不透明度（百分比）；穿透锁定时始终透明")
    .addSlider(slider =>
      slider
        .setLimits(0, 100, 1)
        .setValue(plugin.settings.teleprompter.bgOpacity)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.bgOpacity = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        })
    );

  new Setting(containerEl)
    .setName("选中提取模式")
    .setDesc("编辑器选中文本时临时覆盖提词器内容，取消选中后恢复原模式内容")
    .addToggle(toggle =>
      toggle
        .setValue(plugin.settings.teleprompter.selectionExtractEnabled)
        .onChange(value => {
          plugin.settings.teleprompter.selectionExtractEnabled = value;
          plugin.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("显示状态栏打开提词器按钮")
    .setDesc("在右下角状态栏显示「打开提词器」按钮，点击打开或聚焦提词器窗口")
    .addToggle(toggle =>
      toggle
        .setValue(plugin.settings.teleprompter.statusBarButton)
        .onChange(value => {
          plugin.settings.teleprompter.statusBarButton = value;
          plugin.saveSettings();
          plugin.updateStatusBarButton();
        })
    );
}
