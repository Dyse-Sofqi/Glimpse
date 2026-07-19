import { Setting, ToggleComponent } from "obsidian";
import GlimpsePlugin from "../../main";

export function render(containerEl: HTMLElement, plugin: GlimpsePlugin) {
  new Setting(containerEl)
    .setName("默认打开高亮索引")
    .addToggle(toggle => {
      toggle
        .setValue(plugin.settings.highlightIndex.autoOpenRightLeaf)
        .onChange(async value => {
          plugin.settings.highlightIndex.autoOpenRightLeaf = value;
          await plugin.saveSettings();
        });
    });
}
