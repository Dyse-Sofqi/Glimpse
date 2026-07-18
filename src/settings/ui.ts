import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import Pickr from "@simonwep/pickr";
import {
  App,
  ButtonComponent,
  Modal,
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
import GlimpsePlugin from "../main";
import { ExportModal } from "./export";
import { ImportModal } from "./import";
import { materialPalenight } from "../editor/theme-dark";
import { basicLightTheme } from "../editor/theme-light";

export class SettingTab extends PluginSettingTab {
  plugin: GlimpsePlugin;
  editor!: EditorView;
  scope!: Scope;
  pickrInstance!: Pickr;
  activeGroup: string = "默认";
  _dragItemId: string | undefined;
  activeMainTab = "persistent";

  constructor(app: App, plugin: GlimpsePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide() {
    this.editor?.destroy();
    this.pickrInstance && this.pickrInstance.destroyAndRemove();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("glimpse-settings");

    // main tab bar: 持久高亮 | 选择高亮
    const mainTabBarEl = containerEl.createDiv({ cls: "glimpse-main-tab-bar" });
    const persistentTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "持久高亮" });
    const selectionTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "选择高亮" });
    if (this.activeMainTab === "persistent") persistentTab.addClass("active");
    else selectionTab.addClass("active");
    persistentTab.addEventListener("click", () => { this.activeMainTab = "persistent"; this.display(); });
    selectionTab.addEventListener("click", () => { this.activeMainTab = "selection"; this.display(); });

    // ── persistent highlight tab content ──
    const persistentContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "persistent") persistentContent.style.display = "none";

    const config = this.plugin.settings.staticHighlighter;

    const defineQueryUI = new Setting(persistentContent);
    defineQueryUI
      .setName("定义持久高亮器")
      .setClass("highlighter-definition")
      .setDesc("在此处定义高亮器名称、背景色和搜索词/表达式。输入正则查询时请启用正则开关。定义完成后记得点击保存按钮。");

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
          interaction: { hex: true, rgba: false, hsla: true, hsva: false, cmyk: false, input: true, clear: true, cancel: true, save: true },
        },
      });
      colorWrapper.querySelector(".pcr-button")!.ariaLabel = "Background color picker";

      pickrInstance
        .on("clear", (instance: Pickr) => {
          instance.hide();
          classInput.inputEl.style.removeProperty("--picker-bg");
          classInput.inputEl.style.removeProperty("color");
        })
        .on("cancel", (instance: Pickr) => instance.hide())
        .on("change", (color: Pickr.HSVaColor) => {
          const colorHex = color?.toHEXA().toString() || "";
          const newColor = colorHex && colorHex.length === 6 ? `${colorHex}A6` : colorHex;
          classInput.inputEl.style.setProperty("--picker-bg", newColor);
          classInput.inputEl.style.setProperty("color", "var(--text-normal)");
        })
        .on("save", (color: Pickr.HSVaColor, instance: Pickr) => instance.hide());
    });

    const queryWrapper = defineQueryUI.controlEl.createDiv("query-wrapper");
    const queryInput = new TextComponent(queryWrapper);
    queryInput.setPlaceholder("搜索词");
    queryInput.inputEl.addClass("highlighter-settings-query");

    const queryTypeInput = new ToggleComponent(queryWrapper);
    queryTypeInput.toggleEl.addClass("highlighter-settings-regex");
    queryTypeInput.toggleEl.ariaLabel = "启用正则";

    // mark toggles: match, line, start, end, group
    const marksWrapper = defineQueryUI.controlEl.createDiv({ cls: "mark-wrapper" });
    const marks: { [key: string]: { container: HTMLDivElement; toggle: ToggleComponent } } = {};
    const toggleLabels: Record<string, string> = { match: "匹配", line: "父行", start: "开始", end: "结束", group: "捕获组" };
    Object.entries(toggleLabels).forEach(([key, label]) => {
      const item = marksWrapper.createDiv();
      item.createSpan({ text: label });
      const toggle = new ToggleComponent(item);
      toggle.setValue(key === "match");
      marks[key] = { container: item, toggle };
    });

    queryTypeInput.onChange(value => {
      queryInput.setPlaceholder(value ? "搜索表达式" : "搜索词");
      const gw = marks["group"]?.container;
      if (gw) gw.style.visibility = value ? "" : "hidden";
    });
    { const gw = marks["group"]?.container; if (gw) gw.style.visibility = "hidden"; }

    const customCSSWrapper = defineQueryUI.controlEl.createDiv("custom-css-wrapper");
    customCSSWrapper.createSpan("setting-item-name").setText("自定义 CSS");
    const customCSSEl = new TextAreaComponent(customCSSWrapper);
    this.editor = editorFromTextArea(customCSSEl.inputEl, basicSetup);
    customCSSEl.inputEl.addClass("custom-css");

    const importBtn = new ButtonComponent(queryWrapper);
    importBtn
      .setClass("action-button")
      .setClass("action-button-save")
      .setClass("mod-cta")
      .setIcon("clipboard-copy")
      .setTooltip("从剪贴板导入")
      .onClick(async () => {
        try {
          const text = await navigator.clipboard.readText();
          const data = JSON.parse(text);
          const entry = Object.entries(data?.queries || {})[0];
          if (!entry) { new Notice("剪贴板数据格式无效"); return; }
          const [name, opts] = entry;
          classInput.inputEl.value = name;
          if (opts.color) pickrInstance.setColor(opts.color);
          queryInput.inputEl.value = opts.query || "";
          queryTypeInput.setValue(!!opts.regex);
          Object.entries(marks).forEach(([key, m]) => {
            m.toggle.setValue(opts.mark?.includes(key) ?? false);
          });
          const extensions = [...basicSetup];
          if (document.body.hasClass("theme-dark")) {
            extensions.push(materialPalenight);
          } else {
            extensions.push(basicLightTheme);
          }
          this.editor.setState(EditorState.create({
            doc: opts.css ?? "",
            extensions,
          }));
          new Notice(`已导入: ${name}`);
        } catch (e) {
          new Notice("剪贴板读取或解析失败");
        }
      });

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

        const enabledMarks = Object.entries(marks)
          .filter(([, m]) => m.toggle.getValue())
          .map(([k]) => k);

        if (className) {
          if (!config.queryOrder.includes(className)) {
            config.queryOrder.push(className);
          }
          config.queries[className] = {
            class: className,
            color: hexValue ?? "",
            regex: queryTypeValue,
            query: queryValue,
            mark: enabledMarks,
            css: customCss,
            group: this.activeGroup === "默认" ? undefined : this.activeGroup,
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

    // toolbar: toggle all, import, export
    const toolbarEl = persistentContent.createDiv({ cls: "glimpse-toolbar" });

    const allMatchOn = config.queryOrder.every(h => config.queries[h]?.mark?.includes("match") ?? true);
    new ButtonComponent(toolbarEl).setClass("action-button").setButtonText(allMatchOn ? "全部禁止" : "全部启用").onClick(async () => {
      const newVal = !allMatchOn;
      config.queryOrder.forEach(h => {
        const q = config.queries[h];
        if (newVal) {
          q.mark = [...(q.mark || []), "match"];
        } else {
          q.mark = q.mark?.filter((m: string) => m !== "match") || [];
        }
      });
      await this.plugin.saveSettings();
      this.plugin.updateStaticHighlighter();
      this.plugin.updateStyles();
      this.display();
    });

    new ButtonComponent(toolbarEl).setClass("action-button").setButtonText("一键导入").onClick(() => {
      new ImportModal(this.plugin.app, this.plugin).open();
    });

    new ButtonComponent(toolbarEl).setClass("action-button").setButtonText("一键导出").onClick(() => {
      new ExportModal(this.plugin.app, this.plugin, "全部", {
        queries: config.queries,
        groups: config.groups,
      }).open();
    });

    // group tabs
    const groupTabEl = persistentContent.createDiv({ cls: "glimpse-group-tabs" });
    const tabBarEl = groupTabEl.createDiv({ cls: "glimpse-group-tab-bar" });
    const allGroups = ["默认", ...(config.groups || [])];
    allGroups.forEach(g => {
      const tabEl = tabBarEl.createEl("span", { cls: "glimpse-group-tab", text: g });
      if (g === this.activeGroup) tabEl.addClass("active");
      tabEl.addEventListener("click", () => {
        this.activeGroup = g;
        this.display();
      });
      // drop target for dragged highlighters
      tabEl.addEventListener("dragover", e => {
        if (!this._dragItemId) return;
        e.preventDefault();
        tabEl.addClass("drag-hover");
      });
      tabEl.addEventListener("dragleave", () => {
        tabEl.removeClass("drag-hover");
      });
      tabEl.addEventListener("drop", e => {
        e.preventDefault();
        tabEl.removeClass("drag-hover");
        if (!this._dragItemId || g === this.activeGroup) return;
        const draggedId = this._dragItemId;
        this._dragItemId = undefined;
        if (!config.queries[draggedId]) return;
        config.queries[draggedId].group = g === "默认" ? undefined : g;
        this.activeGroup = g;
        this.plugin.saveSettings();
        this.display();
      });
    });

    // group action buttons: add, delete, rename
    const groupActionsEl = groupTabEl.createDiv({ cls: "glimpse-group-actions" });

    const addGroupBtn = new ButtonComponent(groupActionsEl);
    addGroupBtn.setIcon("plus").setClass("clickable-icon").setTooltip("新建分组").onClick(() => {
      const modal = new Modal(this.app);
      modal.titleEl.setText("新建分组");
      const input = new TextComponent(modal.contentEl);
      input.inputEl.addClass("glimpse-modal-input");
      input.setPlaceholder("输入分组名称");
      input.inputEl.focus();
      new Setting(modal.contentEl)
        .addButton(b => b.setButtonText("取消").onClick(() => { modal.close(); }))
        .addButton(b => b.setButtonText("确认").setClass("mod-cta").onClick(() => {
          const name = input.getValue().trim();
          if (!name) { new Notice("分组名不能为空"); return; }
          if (["默认", ...(config.groups || [])].includes(name)) { new Notice("分组名已存在"); return; }
          if (!config.groups) config.groups = [];
          config.groups.push(name);
          this.activeGroup = name;
          this.plugin.saveSettings();
          this.display();
          modal.close();
        }));
      modal.open();
    });

    // rename group button
    const renameGroupBtn = new ButtonComponent(groupActionsEl);
    renameGroupBtn.setIcon("folder-pen").setClass("clickable-icon").setTooltip("重命名分组").onClick(() => {
      if (this.activeGroup === "默认") return;
      const modal = new Modal(this.app);
      modal.titleEl.setText(`重命名分组"${this.activeGroup}"`);
      const input = new TextComponent(modal.contentEl);
      input.inputEl.addClass("glimpse-modal-input");
      input.setValue(this.activeGroup);
      input.inputEl.focus();
      input.inputEl.select();
      new Setting(modal.contentEl)
        .addButton(b => b.setButtonText("取消").onClick(() => { modal.close(); }))
        .addButton(b => b.setButtonText("确认").setClass("mod-cta").onClick(() => {
          const newName = input.getValue().trim();
          if (!newName || newName === this.activeGroup) { modal.close(); return; }
          if (["默认", ...(config.groups || [])].includes(newName)) {
            new Notice("分组名已存在");
            return;
          }
          // update group name on all highlighters in this group
          config.queryOrder.forEach(h => {
            if (config.queries[h]?.group === this.activeGroup) config.queries[h].group = newName;
          });
          const idx = config.groups?.indexOf(this.activeGroup);
          if (idx !== undefined && idx > -1) config.groups![idx] = newName;
          this.activeGroup = newName;
          this.plugin.saveSettings();
          this.display();
          modal.close();
        }));
      modal.open();
    });

    // delete group button
    const delGroupBtn = new ButtonComponent(groupActionsEl);
    delGroupBtn.setIcon("delete").setClass("clickable-icon").onClick(async () => {
      if (this.activeGroup === "默认") return;
      const groupHighlighters = config.queryOrder.filter(h => config.queries[h]?.group === this.activeGroup);
      if (groupHighlighters.length > 0) {
        const confirmed = await new Promise<boolean>(resolve => {
          const confirmModal = new Modal(this.app);
          confirmModal.contentEl.createEl("p", { text: `确定删除分组"${this.activeGroup}"？该组包含 ${groupHighlighters.length} 个高亮器。` });
          new Setting(confirmModal.contentEl)
            .addButton(b => b.setButtonText("取消").onClick(() => { confirmModal.close(); resolve(false); }))
            .addButton(b => b.setButtonText("删除").setClass("mod-warning").onClick(() => { confirmModal.close(); resolve(true); }));
          confirmModal.open();
        });
        if (!confirmed) return;
      }
      const idx = config.groups?.indexOf(this.activeGroup);
      if (idx !== undefined && idx > -1) config.groups?.splice(idx, 1);
      this.activeGroup = "默认";
      await this.plugin.saveSettings();
      this.display();
    });

    const highlightersContainer = persistentContent.createEl("div", { cls: "highlighter-container" });

    const filteredOrder = config.queryOrder.filter(h => {
      const q = config.queries[h];
      if (this.activeGroup === "默认") return !q.group || q.group === "默认";
      return q.group === this.activeGroup;
    });
    filteredOrder.forEach((highlighter: string) => {
      const { query, regex, mark } = config.queries[highlighter];
      const color = config.queries[highlighter].color;
      const settingItem = highlightersContainer.createEl("div");
      settingItem.id = "dh-" + highlighter;
      settingItem.draggable = true;
      settingItem.addEventListener("dragstart", () => { this._dragItemId = highlighter; });
      settingItem.addEventListener("dragend", () => { this._dragItemId = undefined; });
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
            .setClass("clickable-icon")
            .setClass("action-button-edit")
            .setIcon("pencil")
            .setTooltip("编辑")
            .onClick(async evt => {
              const options = config.queries[highlighter];
              classInput.inputEl.value = highlighter;
              pickrInstance.setColor(options.color);
              queryInput.inputEl.value = options.query;
              pickrInstance.setColor(options.color);
              queryTypeInput.setValue(options.regex);
              // restore mark toggle states
              Object.entries(marks).forEach(([key, m]) => {
                m.toggle.setValue(options.mark?.includes(key) ?? true);
              });
              const extensions = basicSetup;
              if (document.body.hasClass("theme-dark")) {
                extensions.push(materialPalenight);
              } else {
                extensions.push(basicLightTheme);
              }
              this.editor.setState(EditorState.create({ doc: options.css ?? "", extensions }));
              containerEl.scrollTop = 0;
            });
        })
        .addButton(button => {
          button
            .setClass("clickable-icon")
            .setIcon("clipboard-paste")
            .setTooltip("导出")
            .onClick(() => {
              const data = { queries: { [highlighter]: config.queries[highlighter] }, groups: [] };
              new ExportModal(this.plugin.app, this.plugin, highlighter, data).open();
            });
        })
        .addButton(button => {
          button
            .setClass("clickable-icon")
            .setClass("action-button-delete")
            .setIcon("trash")
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

      // match toggle after delete button
      const matchWrapper = setting.controlEl.createDiv({ cls: "match-toggle-wrapper" });
      new ToggleComponent(matchWrapper)
        .setValue(mark?.includes("match") ?? true)
        .onChange(async val => {
          const options = config.queries[highlighter];
          if (val) {
            options.mark = [...(options.mark || []), "match"];
          } else {
            options.mark = options.mark?.filter((m: string) => m !== "match") || [];
          }
          setting.settingEl.toggleClass("match-disabled", !val);
          await this.plugin.saveSettings();
          this.plugin.updateStaticHighlighter();
          this.plugin.updateStyles();
        });
      if (!(mark?.includes("match") ?? true)) setting.settingEl.addClass("match-disabled");
    });
    const sortableEl = Sortable.create(highlightersContainer, {
      animation: 500,
      ghostClass: "highlighter-sortable-ghost",
      chosenClass: "highlighter-sortable-chosen",
      dragClass: "highlighter-sortable-drag",
      handle: ".highlighter-setting-icon-drag",
      dragoverBubble: true,
      fallbackClass: "highlighter-sortable-fallback",
      easing: "cubic-bezier(1, 0, 0, 1)",
      onSort: async command => {
        const items = highlightersContainer.querySelectorAll('[id^="dh-"]');
        const domOrder = Array.from(items).map(el => el.id.replace("dh-", ""));
        const nonFiltered = config.queryOrder.filter(h => !domOrder.includes(h));
        config.queryOrder = [...domOrder, ...nonFiltered];
        this.plugin.settings.staticHighlighter.queryOrder = config.queryOrder;
        await this.plugin.saveSettings();
      },
    });

    // ── selection highlight tab content ──
    const selectionContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "selection") selectionContent.style.display = "none";

    new Setting(selectionContent).setName("高亮当前选中文本的所有出现位置").addToggle(toggle => {
      toggle.setValue(this.plugin.settings.selectionHighlighter.highlightSelectedText).onChange(value => {
        this.plugin.settings.selectionHighlighter.highlightSelectedText = value;
        this.plugin.saveSettings();
        this.plugin.updateSelectionHighlighter();
      });
    });
    new Setting(selectionContent)
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

    new Setting(selectionContent)
      .setName("缩略图")
      .setDesc("在编辑器右侧显示缩略图（类似 VS Code minimap），可拖动滑块滚动文档")
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.selectionHighlighter.minimapEnabled)
          .onChange(async value => {
            this.plugin.settings.selectionHighlighter.minimapEnabled = value;
            await this.plugin.saveSettings();
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
