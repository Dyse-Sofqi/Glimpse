// Adapted from https://github.com/mgmeyers/obsidian-style-setting

import { App, Modal, Setting, TextAreaComponent } from "obsidian";
import GlimpsePlugin from "../main";


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

    modalEl.addClass("modal-style-settings");
    modalEl.addClass("modal-glimpse");


    new Setting(contentEl).setName(`导出设置: ${this.section}`).then(setting => {
      const output = JSON.stringify(this.exportData, null, 2);

      // Build a copy to clipboard link
      setting.controlEl.createEl(
        "a",
        {
          cls: "style-settings-copy",
          text: "复制到剪贴板",
          href: "#",
        },
        copyButton => {
          new TextAreaComponent(contentEl).setValue(output).then(textarea => {
            copyButton.addEventListener("click", e => {
              e.preventDefault();

              // Select the textarea contents and copy them to the clipboard
              textarea.inputEl.select();
              textarea.inputEl.setSelectionRange(0, 99999);
              document.execCommand("copy");

              copyButton.addClass("success");

              setTimeout(() => {
                // If the button is still in the dom, remove the success class
                if (copyButton.parentNode) {
                  copyButton.removeClass("success");
                }
              }, 2000);
            });
          });
        }
      );

      // Build a download link
      setting.controlEl.createEl("a", {
        cls: "style-settings-download",
        text: "下载",
        attr: {
          download: "glimpse.json",
          href: `data:application/json;charset=utf-8,${encodeURIComponent(output)}`,
        },
      });
    });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
