// Adapted from https://github.com/mgmeyers/obsidian-style-setting

import { App, ButtonComponent, Modal, Notice, Setting, TextAreaComponent } from "obsidian";
import GlimpsePlugin from "../main";

/** 复制文本到剪贴板：优先异步 Clipboard API，失败降级临时 textarea + execCommand */
export async function copyText(str: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(str);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = str;
    ta.style.setProperty("position", "fixed");
    ta.style.setProperty("opacity", "0");
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, 999999);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export class ExportModal extends Modal {
  plugin: GlimpsePlugin;
  section: string;
  exportData: object;

  constructor(app: App, plugin: GlimpsePlugin, section: string, exportData: object) {
    super(app);
    this.plugin = plugin;
    this.exportData = exportData;
    this.section = section;
  }

  onOpen() {
    let { contentEl, modalEl } = this;

    // 仅用 modal-glimpse：不带 modal-style-settings，避免 style-settings 插件的
    // `.modal-style-settings { height: 70vh }` 撑高弹窗
    modalEl.addClass("modal-glimpse");

    new Setting(contentEl).setName(`导出设置: ${this.section}`);

    const output = JSON.stringify(this.exportData, null, 2);

    // 按钮行在文本框上方：导出到文件 + 导出到粘贴板
    const actionsEl = contentEl.createDiv({ cls: "glimpse-config-actions" });

    new ButtonComponent(actionsEl)
      .setButtonText("导出到文件")
      .onClick(() => {
        const a = document.createElement("a");
        a.href = `data:application/json;charset=utf-8,${encodeURIComponent(output)}`;
        a.download = "glimpse.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });

    new ButtonComponent(actionsEl)
      .setButtonText("导出到粘贴板")
      .setCta()
      .onClick(async () => {
        const ok = await copyText(output);
        new Notice(ok ? "配置已复制到剪贴板" : "复制失败，请手动选择编辑器文本复制");
      });

    // JSON 展示框：样式化纯 textarea（与导入共用 glimpse-config-* 类）
    const editorWrapper = contentEl.createDiv({ cls: "glimpse-config-editor" });
    const ta = new TextAreaComponent(editorWrapper);
    ta.setValue(output);
    ta.inputEl.addClass("glimpse-config-textarea");
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
