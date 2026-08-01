// Adapted from https://github.com/mgmeyers/obsidian-style-setting

import Ajv from "ajv";
import { App, ButtonComponent, Modal, Setting, TextAreaComponent } from "obsidian";
import { queriesSchema } from "../schema/queries";
import GlimpsePlugin from "../main";

interface ImportPayload {
  queries: Record<string, any>;
  groups?: string[];
}

export class ImportModal extends Modal {
  plugin: GlimpsePlugin;

  constructor(app: App, plugin: GlimpsePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    let { contentEl, modalEl } = this;

    // 仅用 modal-glimpse：不带 modal-style-settings，避免 style-settings 插件的
    // `.modal-style-settings { height: 70vh }` 撑高弹窗
    modalEl.addClass("modal-glimpse");

    const titleSetting = new Setting(contentEl)
      .setName("导入高亮器")
      .setDesc("导入完整或部分配置。警告：可能覆盖现有高亮器");

    // Build an error message container
    const errorSpan = createSpan({
      cls: "style-settings-import-error",
      text: "导入配置出错",
    });
    titleSetting.nameEl.appendChild(errorSpan);

    // Attempt to parse the imported data and close if successful
    const importAndClose = async (str: string) => {
      if (str) {
        try {
          let { queries, queryOrder, groups } = this.plugin.settings.staticHighlighter;
          const imported = JSON.parse(str) as ImportPayload;
          const importedQueries = imported.queries || imported;
          const ajv = new Ajv();
          const validate = ajv.compile(queriesSchema);
          if (!validate(importedQueries)) {
            throw validate.errors?.map(err => `${err.instancePath} ${err.message}`).first();
          }
          queries = Object.assign(queries, importedQueries);
          Object.keys(importedQueries).forEach(key => queryOrder.includes(key) || queryOrder.push(key));
          // old format without groups → strip group field, all go to 默认
          if (!imported.groups) {
            Object.keys(importedQueries).forEach(key => { delete queries[key].group; });
          }
          if (imported.groups) {
            imported.groups.forEach(g => {
              if (!groups.includes(g)) groups.push(g);
            });
          }
          await this.plugin.saveSettings();
          this.plugin.updateStaticHighlighter();
          this.plugin.updateStyles();
          this.plugin.updateCustomCSS();
          this.plugin.settingsTab.display();
          this.close();
        } catch (e) {
          errorSpan.addClass("active");
          errorSpan.setText(`导入高亮器出错: ${e}`);
        }
      } else {
        errorSpan.addClass("active");
        errorSpan.setText(`导入高亮器出错: 配置为空`);
      }
    };

    // 隐藏的文件输入：供「从文件导入」按钮触发
    const fileInput = contentEl.createEl("input", {
      cls: "style-settings-import-input",
      attr: {
        type: "file",
        accept: ".json",
      },
    });
    fileInput.style.display = "none";
    fileInput.addEventListener("change", e => {
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          await importAndClose(e.target.result.toString().trim());
        }
      };
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) reader.readAsText(files[0]);
    });

    // 按钮行在文本框上方：从文件导入 + 导入（与导出共用 glimpse-config-* 类）
    const actionsEl = contentEl.createDiv({ cls: "glimpse-config-actions" });
    new ButtonComponent(actionsEl)
      .setButtonText("从文件导入")
      .onClick(() => fileInput.click());

    let ta!: TextAreaComponent;
    new ButtonComponent(actionsEl)
      .setButtonText("从下面粘贴板导入")
      .setCta()
      .onClick(async () => {
        await importAndClose(ta.getValue().trim());
      });

    // 粘贴区：样式化纯 textarea（与导出共用 glimpse-config-* 类）
    const editorWrapper = contentEl.createDiv({ cls: "glimpse-config-editor" });
    ta = new TextAreaComponent(editorWrapper);
    ta.setPlaceholder("在此粘贴配置...");
    ta.inputEl.addClass("glimpse-config-textarea");
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
