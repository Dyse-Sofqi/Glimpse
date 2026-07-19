import { Setting, ToggleComponent } from "obsidian";
import GlimpsePlugin from "../../main";

export function render(containerEl: HTMLElement, plugin: GlimpsePlugin) {
  new Setting(containerEl).setName("高亮当前选中文本的所有出现位置").addToggle(toggle => {
    toggle.setValue(plugin.settings.selectionHighlighter.highlightSelectedText).onChange(value => {
      plugin.settings.selectionHighlighter.highlightSelectedText = value;
      plugin.saveSettings();
      plugin.updateSelectionHighlighter();
    });
  });
  new Setting(containerEl)
    .setName("高亮延迟")
    .setDesc("高亮出现的延迟时间（毫秒），需大于 200ms")
    .addText(text => {
      text.inputEl.type = "number";
      text.setValue(String(plugin.settings.selectionHighlighter.highlightDelay)).onChange(value => {
        if (parseInt(value) < 200) value = "200";
        if (parseInt(value) >= 0) plugin.settings.selectionHighlighter.highlightDelay = parseInt(value);
        plugin.saveSettings();
        plugin.updateSelectionHighlighter();
      });
    });

  new Setting(containerEl)
    .setName("缩略图")
    .setDesc("在编辑器右侧显示缩略图（类似 VS Code minimap），可拖动滑块滚动文档")
    .addToggle(toggle => {
      toggle
        .setValue(plugin.settings.selectionHighlighter.minimapEnabled)
        .onChange(async value => {
          plugin.settings.selectionHighlighter.minimapEnabled = value;
          await plugin.saveSettings();
          plugin.updateSelectionHighlighter();
        });
    });
}
