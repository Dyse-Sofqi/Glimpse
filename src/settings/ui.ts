import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import Pickr from "@simonwep/pickr";
import {
  App,
  ButtonComponent,
  Notice,
  PluginSettingTab,
  Scope,
  setIcon,
  Setting,
  TextAreaComponent,
  TextComponent,
  ToggleComponent,
} from "obsidian";
import Sortable from "sortablejs";
import { basicSetup } from "../editor/extensions";
import GazerPlugin from "../main";
import { ExportModal } from "./export";
import { ImportModal } from "./import";
import { markTypes } from "./settings";
import { materialPalenight } from "../editor/theme-dark";
import { basicLightTheme } from "../editor/theme-light";

export class SettingTab extends PluginSettingTab {
  plugin: GazerPlugin;
  editor!: EditorView;
  scope!: Scope;
  pickrInstance!: Pickr;

  constructor(app: App, plugin: GazerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    // this.scope = new Scope(app.scope);
  }

  hide() {
    this.editor?.destroy();
    this.pickrInstance && this.pickrInstance.destroyAndRemove();
    // this.app.keymap.popScope(this.scope);
  }

  display(): void {
    // this.app.keymap.pushScope(this.scope);
    const { containerEl } = this;
    containerEl.empty();
    const config = this.plugin.settings.staticHighlighter;
    const importExportEl = containerEl.createDiv("import-export-wrapper");
    importExportEl.createEl(
      "a",
      {
        cls: "gazer-import",
        text: "导入",
        href: "#",
      },
      el => {
        el.addEventListener("click", e => {
          e.preventDefault();
          new ImportModal(this.plugin.app, this.plugin).open();
        });
      }
    );
    importExportEl.createEl(
      "a",
      {
        cls: "gazer-export",
        text: "导出",
        href: "#",
      },
      el => {
        el.addEventListener("click", e => {
          e.preventDefault();
          new ExportModal(this.plugin.app, this.plugin, "All", config.queries).open();
        });
      }
    );
    containerEl
      .createEl("h3", {
        text: "持久高亮",
      })
      .addClass("persistent-highlights");
    containerEl.addClass("gazer-settings");

    const defineQueryUI = new Setting(containerEl);

    defineQueryUI
      .setName("定义持久高亮器")
      .setClass("highlighter-definition")
      .setDesc(
        `在此处定义高亮器名称、背景色和搜索词/表达式。输入正则查询时请启用正则开关。定义完成后记得点击保存按钮。`
      );

    const classInput = new TextComponent(defineQueryUI.controlEl);
    classInput.setPlaceholder("高亮器名称");
    classInput.inputEl.ariaLabel = "高亮器名称";
    classInput.inputEl.addClass("highlighter-name");

    const colorWrapper = defineQueryUI.controlEl.createDiv("color-wrapper");

    let pickrInstance: Pickr;
    const colorPicker = new ButtonComponent(colorWrapper);

    colorPicker.setClass("highlightr-color-picker").then(() => {
      this.pickrInstance = pickrInstance = new Pickr({
        el: colorPicker.buttonEl,
        container: colorWrapper,
        theme: "nano",
        defaultRepresentation: "HEXA",
        default: "#42188038",
        comparison: false,
        components: {
          preview: true,
          opacity: true,
          hue: true,
          interaction: {
            hex: true,
            rgba: false,
            hsla: true,
            hsva: false,
            cmyk: false,
            input: true,
            clear: true,
            cancel: true,
            save: true,
          },
        },
      });
      colorWrapper.querySelector(".pcr-button")!.ariaLabel = "Background color picker";

      pickrInstance
        .on("clear", (instance: Pickr) => {
          instance.hide();
          classInput.inputEl.setAttribute("style", `background-color: none; color: var(--text-normal);`);
        })
        .on("cancel", (instance: Pickr) => {
          instance.hide();
        })
        .on("change", (color: Pickr.HSVaColor) => {
          const colorHex = color?.toHEXA().toString() || "";
          let newColor;
          colorHex && colorHex.length == 6 ? (newColor = `${colorHex}A6`) : (newColor = colorHex);
          classInput.inputEl.setAttribute("style", `background-color: ${newColor}; color: var(--text-normal);`);
        })
        .on("save", (color: Pickr.HSVaColor, instance: Pickr) => {
          instance.hide();
        });
    });

    const queryWrapper = defineQueryUI.controlEl.createDiv("query-wrapper");
    const queryInput = new TextComponent(queryWrapper);
    queryInput.setPlaceholder("搜索词");
    queryInput.inputEl.addClass("highlighter-settings-query");

    const queryTypeInput = new ToggleComponent(queryWrapper);
    queryTypeInput.toggleEl.addClass("highlighter-settings-regex");
    queryTypeInput.toggleEl.ariaLabel = "启用正则";
    queryTypeInput.onChange(value => {
      if (value) {
        queryInput.setPlaceholder("搜索表达式");
        // groupWrapper.show();
        marks.group?.element.show();
      } else {
        queryInput.setPlaceholder("搜索词");
        marks.group?.element.hide();
      }
    });

    type MarkTypes = Record<markTypes, { description: string; defaultState: boolean }>;
    type MarkItems = Partial<Record<markTypes, { element: HTMLElement; component: ToggleComponent }>>;
    const buildMarkerTypes = (parentEl: HTMLElement) => {
      const types: MarkItems = {};
      const marks: MarkTypes = {
        match: { description: "匹配", defaultState: true },
        group: { description: "捕获组", defaultState: false },
        line: { description: "父行", defaultState: false },
        start: { description: "开始", defaultState: false },
        end: { description: "结束", defaultState: false },
      };
      const container = parentEl.createDiv("mark-wrapper");
      let type: markTypes;
      for (type in marks) {
        const mark = marks[type];
        const wrapper = container.createDiv("mark-wrapper");
        if (type === "group") wrapper.hide();
        wrapper.createSpan("match-type").setText(mark.description);
        const component = new ToggleComponent(wrapper).setValue(mark.defaultState);
        types[type] = {
          element: wrapper,
          component: component,
        };
      }
      return types;
    };
    const marks = buildMarkerTypes(defineQueryUI.controlEl);

    const customCSSWrapper = defineQueryUI.controlEl.createDiv("custom-css-wrapper");
    customCSSWrapper.createSpan("setting-item-name").setText("自定义 CSS");
    const customCSSEl = new TextAreaComponent(customCSSWrapper);
    this.editor = editorFromTextArea(customCSSEl.inputEl, basicSetup);
    customCSSEl.inputEl.addClass("custom-css");

    const saveButton = new ButtonComponent(queryWrapper);
    saveButton
      .setClass("action-button")
      .setClass("action-button-save")
      .setClass("mod-cta")
      .setIcon("save")
      .setTooltip("保存")
      .onClick(async (buttonEl: any) => {
        const className = classInput.inputEl.value.replace(/ /g, "-");
        const hexValue = pickrInstance.getSelectedColor()?.toHEXA().toString();
        const queryValue = queryInput.inputEl.value;
        const queryTypeValue = queryTypeInput.getValue();
        const customCss = this.editor.state.doc.toString();

        if (className) {
          if (!config.queryOrder.includes(className)) {
            config.queryOrder.push(className);
          }
          const enabledMarks = Object.entries(marks)
            .map(([type, item]) => item.component.getValue() && type)
            .filter(m => m);
          config.queries[className] = {
            class: className,
            color: hexValue ? hexValue : "",
            regex: queryTypeValue,
            query: queryValue,
            mark: enabledMarks,
            css: customCss,
          };
          await this.plugin.saveSettings();
          this.plugin.updateStaticHighlighter();
          this.plugin.updateCustomCSS();
          this.plugin.updateStyles();
          this.display();
        } else if (className && !hexValue) {
          new Notice("缺少高亮器颜色值");
        } else if (!className && hexValue) {
          new Notice("缺少高亮器名称");
        } else if (!/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className)) {
          new Notice("缺少高亮器名称");
        } else {
          new Notice("缺少高亮器设置值");
        }
      });

    const highlightersContainer = containerEl.createEl("div", {
      cls: "highlighter-container",
    });

    this.plugin.settings.staticHighlighter.queryOrder.forEach((highlighter: string) => {
      const { query, regex } = config.queries[highlighter];
      const color = config.queries[highlighter].color;
      const settingItem = highlightersContainer.createEl("div");
      settingItem.id = "dh-" + highlighter;
      const desc: string[] = [];
      desc.push((regex ? "搜索表达式: " : "搜索词: ") + query);

      const setting = new Setting(settingItem)
        .setClass("highlighter-details")
        .setName(highlighter)
        .setDesc(desc.join(" | "));

      // drag handle
      const dragIcon = setting.settingEl.createEl("span");
      dragIcon.addClass("highlighter-setting-icon-drag");
      setIcon(dragIcon, "grip-vertical");
      dragIcon.ariaLabel = "拖动排序";
      setting.settingEl.prepend(dragIcon);

      // color preview — between drag icon and nameEl
      const colorIcon = setting.settingEl.createEl("span");
      colorIcon.addClass("highlighter-style-preview");
      colorIcon.textContent = "预览";
      let previewStyles = "";
      if (color) previewStyles += `background-color: ${color}; `;
      const customCss = config.queries[highlighter].css;
      if (customCss) {
        const blockMatch = customCss.match(/\{([^}]+)\}/);
        previewStyles += blockMatch ? blockMatch[1] : customCss;
      }
      if (previewStyles) colorIcon.setAttribute("style", previewStyles + " width: auto;");
      setting.settingEl.insertBefore(colorIcon, dragIcon.nextSibling);

      setting
        .addButton(button => {
          button
            .setClass("action-button")
            .setClass("action-button-edit")
            .setClass("mod-cta")
            .setIcon("pencil")
            .setTooltip("编辑")
            .onClick(async evt => {
              const options = config.queries[highlighter];
              classInput.inputEl.value = highlighter;
              pickrInstance.setColor(options.color);
              queryInput.inputEl.value = options.query;
              pickrInstance.setColor(options.color);
              queryTypeInput.setValue(options.regex);
              const extensions = basicSetup;
              if (document.body.hasClass("theme-dark")) {
                extensions.push(materialPalenight);
              } else {
                extensions.push(basicLightTheme);
              }
              this.editor.setState(EditorState.create({ doc: options.css ? options.css : "", extensions: extensions }));
              if (options?.mark) {
                Object.entries(marks).map(([key, value]) =>
                  options.mark!.includes(key) ? value.component.setValue(true) : value.component.setValue(false)
                );
              } else {
                Object.entries(marks).map(([key, value]) =>
                  key === "match" ? value.component.setValue(true) : value.component.setValue(false)
                );
              }
              containerEl.scrollTop = 0;
            });
        })
        .addButton(button => {
          button
            .setClass("action-button")
            .setClass("action-button-delete")
            .setIcon("trash")
            .setClass("mod-warning")
            .setTooltip("删除")
            .onClick(async () => {
              new Notice(`${highlighter} 高亮已删除`);
              delete config.queries[highlighter];
              config.queryOrder.remove(highlighter);
              await this.plugin.saveSettings();
              this.plugin.updateStyles();
              this.plugin.updateStaticHighlighter();
              highlightersContainer.querySelector(`#dh-${highlighter}`)!.detach();
            });
        });
    });
    const sortableEl = Sortable.create(highlightersContainer, {
      animation: 500,
      ghostClass: "highlighter-sortable-ghost",
      chosenClass: "highlighter-sortable-chosen",
      dragClass: "highlighter-sortable-drag",
      handle: ".highlighter-setting-icon-drag",
      dragoverBubble: true,
      forceFallback: true,
      fallbackClass: "highlighter-sortable-fallback",
      easing: "cubic-bezier(1, 0, 0, 1)",
      onSort: command => {
        const arrayResult = config.queryOrder;
        const [removed] = arrayResult.splice(command.oldIndex!, 1);
        arrayResult.splice(command.newIndex!, 0, removed);
        this.plugin.settings.staticHighlighter.queryOrder = arrayResult;
        this.plugin.saveSettings();
      },
    });

    containerEl.createEl("h3", {
      text: "选择高亮",
    });
    new Setting(containerEl).setName("高亮当前选中文本的所有出现位置").addToggle(toggle => {
      toggle.setValue(this.plugin.settings.selectionHighlighter.highlightSelectedText).onChange(value => {
        this.plugin.settings.selectionHighlighter.highlightSelectedText = value;
        this.plugin.saveSettings();
        this.plugin.updateSelectionHighlighter();
      });
    });
    new Setting(containerEl)
      .setName("高亮延迟")
      .setDesc("高亮出现的延迟时间（毫秒），需大于 200ms")
      .addText(text => {
        text.inputEl.type = "number";
        text.setValue(String(this.plugin.settings.selectionHighlighter.highlightDelay)).onChange(value => {
          if (parseInt(value) < 200) value = "200";
          if (parseInt(value) >= 0) this.plugin.settings.selectionHighlighter.highlightDelay = parseInt(value);
          this.plugin.saveSettings();
          this.plugin.updateSelectionHighlighter();
        });
      });
  }
}

function editorFromTextArea(textarea: HTMLTextAreaElement, extensions: Extension) {
  const view = new EditorView({
    state: EditorState.create({ doc: textarea.value, extensions }),
  });
  textarea.parentNode!.insertBefore(view.dom, textarea);
  textarea.style.display = "none";
  if (textarea.form)
    textarea.form.addEventListener("submit", () => {
      textarea.value = view.state.doc.toString();
    });
  return view;
}
