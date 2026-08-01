import { Platform, Setting, SliderComponent } from "obsidian";
import GlimpsePlugin from "../../main";
import { DEFAULT_BG_OPACITY, DEFAULT_FONT_OPACITY } from "../settings";

// 提词器设置 —— 桌面端专用（ADRs/0001），移动端显示占位说明
export function render(containerEl: HTMLElement, plugin: GlimpsePlugin) {
  if (!Platform.isDesktop) {
    containerEl.createEl("p", { text: "提词器仅桌面端可用。" });
    return;
  }

  // 不透明度滑条 + 「重置为初始值」按钮（回写滑条到新默认值）
  let fontOpacitySlider: SliderComponent;
  new Setting(containerEl)
    .setName("字体透明度")
    .setDesc("内容文字的不透明度（百分比）；空内容占位显示上一项文本时在此基础上减半")
    .addSlider(slider => {
      fontOpacitySlider = slider;
      slider
        .setLimits(0, 100, 1)
        .setValue(plugin.settings.teleprompter.fontOpacity)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.fontOpacity = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        });
    })
    .addButton(button =>
      button
        .setIcon("rotate-ccw")
        .setTooltip("重置为初始值")
        .onClick(() => {
          plugin.settings.teleprompter.fontOpacity = DEFAULT_FONT_OPACITY;
          fontOpacitySlider.setValue(DEFAULT_FONT_OPACITY);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        })
    );

  let bgOpacitySlider: SliderComponent;
  new Setting(containerEl)
    .setName("背景透明度")
    .setDesc("悬停时窗口背景的不透明度（百分比）；穿透锁定时始终透明")
    .addSlider(slider => {
      bgOpacitySlider = slider;
      slider
        .setLimits(0, 100, 1)
        .setValue(plugin.settings.teleprompter.bgOpacity)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.bgOpacity = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        });
    })
    .addButton(button =>
      button
        .setIcon("rotate-ccw")
        .setTooltip("重置为初始值")
        .onClick(() => {
          plugin.settings.teleprompter.bgOpacity = DEFAULT_BG_OPACITY;
          bgOpacitySlider.setValue(DEFAULT_BG_OPACITY);
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
