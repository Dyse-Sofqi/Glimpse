import { MarkdownView, Notice, Setting } from "obsidian";
import GlimpsePlugin from "../../main";
import { RegexReplaceModal } from "../../regex-replace/replace-modal";
import { DEFAULT_REGEX_REPLACE_SETTINGS } from "../../regex-replace/types";

export function render(containerEl: HTMLElement, plugin: GlimpsePlugin) {
	const settings = plugin.settings.regexReplace;

	new Setting(containerEl)
		.setName("打开正则替换")
		.setDesc("在编辑器里按 Ctrl+H、命令面板搜「打开正则替换」，或在正文里右键 →「正则替换…」。支持捕获组引用、逐处预览与全部替换。")
		.addButton(button => button.setButtonText("打开").onClick(() => {
			// 设置页本身没有编辑器上下文，借活动笔记的编辑器打开
			const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) {
				new Notice("请先打开一篇笔记再使用正则替换");
				return;
			}
			new RegexReplaceModal(plugin, view.editor).open();
		}));

	new Setting(containerEl)
		.setName("替换预览")
		.setDesc("在窗口中显示替换前/替换后对照与匹配列表（编辑器内的实时命中高亮不受此项影响）")
		.addToggle(toggle =>
			toggle.setValue(settings.showPreview).onChange(value => {
				settings.showPreview = value;
				plugin.saveSettings();
			})
		);

	new Setting(containerEl)
		.setName("历史记录上限")
		.setDesc("记住最近用过的查找/替换组合，可在窗口底部快速回填（0 = 不记录）")
		.addSlider(slider =>
			slider
				.setLimits(0, 50, 1)
				.setValue(settings.historyLimit)
				.setDynamicTooltip()
				.onChange(value => {
					settings.historyLimit = value;
					plugin.saveSettings();
				})
		)
		.addButton(button =>
			button.setIcon("trash-2").setTooltip("清空历史记录").onClick(() => {
				if (settings.history.length === 0) return;
				settings.history = [];
				plugin.saveSettings();
				new Notice("已清空正则替换历史记录");
			})
		);

	new Setting(containerEl)
		.setName("恢复默认")
		.setDesc("将本页设置恢复到初始值（历史记录保留）")
		.addButton(button =>
			button.setIcon("rotate-ccw").setTooltip("恢复默认").onClick(() => {
				plugin.settings.regexReplace.showPreview = DEFAULT_REGEX_REPLACE_SETTINGS.showPreview;
				plugin.settings.regexReplace.historyLimit = DEFAULT_REGEX_REPLACE_SETTINGS.historyLimit;
				plugin.saveSettings();
				plugin.settingsTab.display();
			})
		);
}
