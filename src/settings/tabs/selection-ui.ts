import { Setting, SliderComponent, ToggleComponent } from "obsidian";
import GlimpsePlugin from "../../main";
import { DEFAULT_SETTINGS } from "../settings";

export function render(containerEl: HTMLElement, plugin: GlimpsePlugin) {
  new Setting(containerEl).setName("高亮当前选中文本的所有出现位置").addToggle(toggle => {
    toggle.setValue(plugin.settings.selectionHighlighter.highlightSelectedText).onChange(value => {
      plugin.settings.selectionHighlighter.highlightSelectedText = value;
      plugin.saveSettings();
      plugin.updateSelectionHighlighter();
    });
  });
  let maxLengthSlider: SliderComponent;
  new Setting(containerEl)
    .setName("选择检索的字符串上限")
    .setDesc("选中文本超过该长度时不再进行高亮检索，避免超长选择拖慢匹配")
    .addSlider(slider => {
      maxLengthSlider = slider;
      slider
        .setLimits(2, 60, 1)
        .setValue(plugin.settings.selectionHighlighter.maxSelectionLength)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.selectionHighlighter.maxSelectionLength = value;
          plugin.saveSettings();
          plugin.updateSelectionHighlighter();
        });
    })
    .addButton(button =>
      button
        .setIcon("rotate-ccw")
        .setTooltip("恢复默认")
        .onClick(() => {
          plugin.settings.selectionHighlighter.maxSelectionLength =
            DEFAULT_SETTINGS.selectionHighlighter.maxSelectionLength;
          maxLengthSlider.setValue(DEFAULT_SETTINGS.selectionHighlighter.maxSelectionLength);
          plugin.saveSettings();
          plugin.updateSelectionHighlighter();
        })
    );

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
