// Adapted from https://github.com/mgmeyers/obsidian-style-setting

import Ajv from "ajv";
import { App, ButtonComponent, Modal, Setting, TextAreaComponent } from "obsidian";
import { queriesSchema } from "../schema/queries";
import GazerPlugin from "../main";
import { SearchQueries } from "./settings";

export class ImportModal extends Modal {
  plugin: GazerPlugin;

  constructor(app: App, plugin: GazerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    let { contentEl, modalEl } = this;

    modalEl.addClass("modal-style-settings");
    modalEl.addClass("modal-gazer");

    new Setting(contentEl)
      .setName("导入高亮器")
      .setDesc("导入完整或部分配置。警告：可能覆盖现有高亮器");

    new Setting(contentEl).then(setting => {
      // Build an error message container
      const errorSpan = createSpan({
        cls: "style-settings-import-error",
        text: "导入配置出错",
      });

      setting.nameEl.appendChild(errorSpan);

      // Attempt to parse the imported data and close if successful
      const importAndClose = async (str: string) => {
        if (str) {
          try {
            let { queries, queryOrder } = this.plugin.settings.staticHighlighter;
            const importedSettings = JSON.parse(str) as SearchQueries;
            const ajv = new Ajv();
            const validate = ajv.compile(queriesSchema);
            if (!validate(importedSettings)) {
              throw validate.errors?.map(err => `${err.instancePath} ${err.message}`).first();
            }
            queries = Object.assign(queries, importedSettings);
            Object.keys(importedSettings).forEach(key => queryOrder.includes(key) || queryOrder.push(key));
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

      // Build a file input
      setting.controlEl.createEl(
        "input",
        {
          cls: "style-settings-import-input",
          attr: {
            id: "style-settings-import-input",
            name: "style-settings-import-input",
            type: "file",
            accept: ".json",
          },
        },
        importInput => {
          // Set up a FileReader so we can parse the file contents
          importInput.addEventListener("change", e => {
            const reader = new FileReader();
            reader.onload = async (e: ProgressEvent<FileReader>) => {
              if (e.target?.result) {
                await importAndClose(e.target && e.target.result.toString().trim());
              }
            };
            let files = (e.target as HTMLInputElement).files;
            if (files?.length) reader.readAsText(files[0]);
          });
        }
      );

      // Build a label we will style as a link
      setting.controlEl.createEl("label", {
        cls: "style-settings-import-label",
        text: "从文件导入",
        attr: {
          for: "style-settings-import-input",
        },
      });

      new TextAreaComponent(contentEl).setPlaceholder("在此粘贴配置...").then(ta => {
        new ButtonComponent(contentEl).setButtonText("保存").onClick(async () => {
          await importAndClose(ta.getValue().trim());
        });
      });
    });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
