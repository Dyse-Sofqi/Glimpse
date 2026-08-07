import { ButtonComponent, DropdownComponent, Platform, Setting, SliderComponent } from "obsidian";
import Pickr from "@simonwep/pickr";
import GlimpsePlugin from "../../main";
import { DEFAULT_BG_OPACITY, DEFAULT_FONT_OPACITY } from "../settings";
import { FontPickerModal } from "../font-picker-modal";
import { patchPickrDrag } from "../pickr-drag";
import type { SettingTab } from "../ui";

// 提词器设置 —— 桌面端专用（ADRs/0001），移动端显示占位说明
export function render(containerEl: HTMLElement, plugin: GlimpsePlugin, tab: SettingTab) {
  if (!Platform.isDesktop) {
    containerEl.createEl("p", { text: "提词器仅桌面端可用。" });
    return;
  }
  // 清理上次渲染残留的字体颜色选择器（tab 重建/切换时）
  if (tab.fontColorPickr) {
    tab.fontColorPickr.destroyAndRemove();
    tab.fontColorPickr = undefined;
  }

  // 不透明度滑条 + 「重置为初始值」按钮（回写滑条到新默认值）
  let fontOpacitySlider: SliderComponent;
  new Setting(containerEl)
    .setName("字体透明度")
    .setDesc("内容文字的不透明度（百分比）；空内容占位显示上一项文本时在此基础上减半")
    .addSlider(slider => {
      fontOpacitySlider = slider;
      slider
        .setLimits(0, 100, 1)
        .setValue(plugin.settings.teleprompter.fontOpacity)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.fontOpacity = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        });
    })
    .addButton(button =>
      button
        .setIcon("rotate-ccw")
        .setTooltip("重置为初始值")
        .onClick(() => {
          plugin.settings.teleprompter.fontOpacity = DEFAULT_FONT_OPACITY;
          fontOpacitySlider.setValue(DEFAULT_FONT_OPACITY);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        })
    );

  // 正文字体 —— 摘要 + 「选择字体」按钮，打开字体选择模态（多选 + 拖拽排序 + 自定义）
  const fontSetting = new Setting(containerEl).setName("字体");
  const summarySpan = fontSetting.descEl.createSpan({ cls: "glimpse-tp-font-summary" });
  fontSetting.descEl.createEl("br");
  fontSetting.descEl.appendText("点击「选择字体」勾选本机字体并拖拽调整优先级：列表靠前且本机存在的字体优先生效，不存在自动顺延；留空则跟随主题默认字体。");
  const updateFontSummary = () => {
    const stack = (plugin.settings.teleprompter.fontFamily || "").trim();
    summarySpan.setText(stack
      ? stack.split(",").map(s => s.trim()).filter(Boolean).join(" → ")
      : "跟随主题");
  };
  updateFontSummary();
  fontSetting.addButton(button =>
    button
      .setButtonText("选择字体")
      .setCta()
      .onClick(() => {
        const modal = new FontPickerModal(plugin.app, plugin);
        modal.onConfirm = stack => {
          plugin.settings.teleprompter.fontFamily = stack;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
          plugin.teleprompterManager.refitAll();
          updateFontSummary();
        };
        modal.open();
      })
  );

  // 字重 —— 下拉预设；「跟随主题」= null（字重影响字宽，变更后重排宽度）
  let fontWeightDropdown: DropdownComponent;
  new Setting(containerEl)
    .setName("字重")
    .setDesc("正文文字的字重；「跟随主题」使用主题默认")
    .addDropdown(dropdown => {
      fontWeightDropdown = dropdown;
      dropdown
        .addOption("inherit", "跟随主题")
        .addOption("300", "细体 300")
        .addOption("400", "常规 400")
        .addOption("500", "中等 500")
        .addOption("600", "半粗 600")
        .addOption("700", "加粗 700")
        .setValue(
          plugin.settings.teleprompter.fontWeight == null
            ? "inherit"
            : String(plugin.settings.teleprompter.fontWeight)
        )
        .onChange(v => {
          plugin.settings.teleprompter.fontWeight = v === "inherit" ? null : parseInt(v, 10);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
          plugin.teleprompterManager.refitAll();
        });
    })
    .addButton(button =>
      button
        .setIcon("rotate-ccw")
        .setTooltip("重置为初始值")
        .onClick(() => {
          plugin.settings.teleprompter.fontWeight = null;
          fontWeightDropdown.setValue("inherit");
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
          plugin.teleprompterManager.refitAll();
        })
    );

  // 字体颜色 —— Pickr 色板（复用 persistent-ui 模式）；null = 跟随主题，「清除」恢复
  const colorSetting = new Setting(containerEl)
    .setName("字体颜色")
    .setDesc("正文文字颜色；点击色块选取，点「清除」恢复跟随主题");
  const colorWrapper = colorSetting.controlEl.createDiv("color-wrapper");
  const colorButton = new ButtonComponent(colorWrapper);
  let fontColorPickr: Pickr | undefined;
  colorButton.setClass("highlightr-color-picker").then(() => {
    const pickr = (tab.fontColorPickr = fontColorPickr = new Pickr({
      el: colorButton.buttonEl,
      container: colorWrapper,
      theme: "nano",
      position: "left-start", // 弹层在按钮左侧，避免被下方内容遮挡
      defaultRepresentation: "HEXA",
      default: plugin.settings.teleprompter.fontColor ?? "#FFFFFF",
      comparison: false,
      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
          hex: true,
          rgba: false,
          hsla: false,
          hsva: false,
          cmyk: false,
          input: true,
          clear: true,
          cancel: true,
          save: true,
        },
      },
    }));
    patchPickrDrag(pickr); // Obsidian 拦截 document mousemove，用 pointer 事件桥接拖拽
    pickr
      .on("clear", (instance: Pickr) => {
        instance.hide();
        plugin.settings.teleprompter.fontColor = null;
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
      })
      .on("cancel", (instance: Pickr) => instance.hide())
      .on("change", (color: Pickr.HSVaColor) => {
        // 取 RRGGBB 段（忽略 alpha；透明度由「字体透明度」独立控制）
        const hex = (color?.toHEXA().toString() || "").slice(0, 7);
        plugin.settings.teleprompter.fontColor = hex;
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
      })
      .on("save", (_color: Pickr.HSVaColor, instance: Pickr) => instance.hide());
  });

  // 重置为初始值：跟随主题（null），并重置色板外观
  colorSetting.addButton(button =>
    button
      .setIcon("rotate-ccw")
      .setTooltip("重置为初始值")
      .onClick(() => {
        plugin.settings.teleprompter.fontColor = null;
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
        if (fontColorPickr) (fontColorPickr as any).setColor(null, true); // 静默重置，不触发 clear 事件
      })
  );

  let bgOpacitySlider: SliderComponent;
  new Setting(containerEl)
    .setName("背景透明度")
    .setDesc("悬停时窗口背景的不透明度（百分比）；穿透锁定时始终透明")
    .addSlider(slider => {
      bgOpacitySlider = slider;
      slider
        .setLimits(0, 100, 1)
        .setValue(plugin.settings.teleprompter.bgOpacity)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.bgOpacity = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        });
    })
    .addButton(button =>
      button
        .setIcon("rotate-ccw")
        .setTooltip("重置为初始值")
        .onClick(() => {
          plugin.settings.teleprompter.bgOpacity = DEFAULT_BG_OPACITY;
          bgOpacitySlider.setValue(DEFAULT_BG_OPACITY);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        })
    );

  new Setting(containerEl)
    .setName("选中提取模式")
    .setDesc("编辑器选中文本时临时覆盖提词器内容，取消选中后恢复原模式内容")
    .addToggle(toggle =>
      toggle
        .setValue(plugin.settings.teleprompter.selectionExtractEnabled)
        .onChange(value => {
          plugin.settings.teleprompter.selectionExtractEnabled = value;
          plugin.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("显示状态栏打开提词器按钮")
    .setDesc("在右下角状态栏显示「打开提词器」按钮，点击打开或聚焦提词器窗口")
    .addToggle(toggle =>
      toggle
        .setValue(plugin.settings.teleprompter.statusBarButton)
        .onChange(value => {
          plugin.settings.teleprompter.statusBarButton = value;
          plugin.saveSettings();
          plugin.updateStatusBarButton();
        })
    );
}
