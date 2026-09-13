import { ButtonComponent, DropdownComponent, Notice, Platform, Setting, setIcon, SliderComponent, ToggleComponent } from "obsidian";
import Pickr from "@simonwep/pickr";
import GlimpsePlugin from "../../main";
import {
  buildGradientImage,
  DEFAULT_BG_OPACITY,
  DEFAULT_FONT_OPACITY,
  DEFAULT_GRADIENT_ANGLE,
  DEFAULT_GRADIENT_STOPS,
  DEFAULT_SHADOW_BLUR,
  DEFAULT_SHADOW_OFFSET_X,
  DEFAULT_SHADOW_OFFSET_Y,
  DEFAULT_SHADOW_OPACITY,
  GradientScope,
  GradientType,
} from "../settings";
import { FontPickerModal } from "../font-picker-modal";
import { patchPickrDrag } from "../pickr-drag";
import type { SettingTab } from "../ui";

// 提词器设置 —— 桌面端专用（ADRs/0001），移动端显示占位说明
export function render(containerEl: HTMLElement, plugin: GlimpsePlugin, tab: SettingTab) {
  if (!Platform.isDesktop) {
    containerEl.createEl("p", { text: "提词器仅桌面端可用。" });
    return;
  }
  // 清理上次渲染残留的字体颜色/渐变停靠点选择器（tab 重建/切换时）
  if (tab.fontColorPickr) {
    tab.fontColorPickr.destroyAndRemove();
    tab.fontColorPickr = undefined;
  }
  tab.gradientPickrs.forEach(p => p.destroyAndRemove());
  tab.gradientPickrs = [];

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

  // 文字阴影 —— 可折叠分组：隐藏背景时的字幕投影参数（开关 + 偏移/模糊/不透明度）
  // setHeading：Obsidian 原生分组标题样式，与普通设置项区分
  const shadowHeader = new Setting(containerEl)
    .setName("文字阴影")
    .setDesc("隐藏背景时正文文字的投影效果（字幕感）")
    .setClass("glimpse-collapse-header")
    .setHeading();
  const chevronEl = shadowHeader.controlEl.createSpan("glimpse-collapse-chevron");
  setIcon(chevronEl, "chevron-down");
  const shadowBody = containerEl.createDiv("glimpse-collapse-body");
  const toggleShadowCollapse = () => {
    const collapsed = shadowBody.hasClass("is-collapsed");
    shadowBody.toggleClass("is-collapsed", !collapsed);
    chevronEl.toggleClass("is-collapsed", !collapsed);
  };
  shadowHeader.settingEl.addEventListener("click", toggleShadowCollapse);

  new Setting(shadowBody)
    .setName("启用文字阴影")
    .setDesc("隐藏背景时为正文文字添加投影，浮在文档上更易读")
    .addToggle(toggle =>
      toggle.setValue(plugin.settings.teleprompter.shadowEnabled).onChange(value => {
        plugin.settings.teleprompter.shadowEnabled = value;
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
      })
    );

  const addShadowSlider = (
    name: string,
    desc: string,
    min: number,
    max: number,
    get: () => number,
    set: (value: number) => void,
    resetValue: number
  ) => {
    let slider: SliderComponent;
    new Setting(shadowBody)
      .setName(name)
      .setDesc(desc)
      .addSlider(s => {
        slider = s;
        s.setLimits(min, max, 1).setValue(get()).setDynamicTooltip().onChange(value => {
          set(value);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        });
      })
      .addButton(button =>
        button.setIcon("rotate-ccw").setTooltip("重置为初始值").onClick(() => {
          set(resetValue);
          slider.setValue(resetValue);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
        })
      );
  };

  const tpSettings = () => plugin.settings.teleprompter;
  addShadowSlider(
    "水平偏移",
    "阴影水平偏移量（px），负值向左",
    -20, 20,
    () => tpSettings().shadowOffsetX,
    v => { tpSettings().shadowOffsetX = v; },
    DEFAULT_SHADOW_OFFSET_X
  );
  addShadowSlider(
    "垂直偏移",
    "阴影垂直偏移量（px），负值向上",
    -20, 20,
    () => tpSettings().shadowOffsetY,
    v => { tpSettings().shadowOffsetY = v; },
    DEFAULT_SHADOW_OFFSET_Y
  );
  addShadowSlider(
    "模糊半径",
    "阴影模糊半径（px），0 为实心边缘",
    0, 40,
    () => tpSettings().shadowBlur,
    v => { tpSettings().shadowBlur = v; },
    DEFAULT_SHADOW_BLUR
  );
  addShadowSlider(
    "阴影不透明度",
    "阴影不透明度（百分比），颜色固定为黑色",
    0, 100,
    () => tpSettings().shadowOpacity,
    v => { tpSettings().shadowOpacity = v; },
    DEFAULT_SHADOW_OPACITY
  );

  // 文字渐变 —— 可折叠分组：开启后覆盖「字体颜色」，背景裁切到文字
  const gradientHeader = new Setting(containerEl)
    .setName("文字渐变")
    .setDesc("为正文文字应用渐变色（开启后覆盖「字体颜色」）")
    .setClass("glimpse-collapse-header")
    .setHeading();
  const gradientChevron = gradientHeader.controlEl.createSpan("glimpse-collapse-chevron");
  setIcon(gradientChevron, "chevron-down");
  const gradientBody = containerEl.createDiv("glimpse-collapse-body");
  const toggleGradientCollapse = () => {
    const collapsed = gradientBody.hasClass("is-collapsed");
    gradientBody.toggleClass("is-collapsed", !collapsed);
    gradientChevron.toggleClass("is-collapsed", !collapsed);
  };
  gradientHeader.settingEl.addEventListener("click", toggleGradientCollapse);

  // 预览：与提词器正文同参数渲染（背景裁切到文字；逐字模式每字独立裁切）
  const gradientPreview = gradientBody.createDiv("glimpse-gradient-preview");
  const updateGradientPreview = () => {
    const tp = plugin.settings.teleprompter;
    const image = buildGradientImage(tp.gradientType, tp.gradientAngle, tp.gradientStops);
    const on = tp.gradientEnabled && !!image;
    const charMode = on && tp.gradientScope === "char";
    gradientPreview.toggleClass("is-on", on);
    gradientPreview.toggleClass("is-gradient-char", charMode);
    if (on) {
      gradientPreview.style.setProperty("--tp-gradient", image);
      // 逐字模式重建字符 span（文本固定，简单重建即可）
      gradientPreview.setText("无意识是像语言一样被结构的。");
      if (charMode) {
        const frag = document.createDocumentFragment();
        for (const seg of Array.from(gradientPreview.textContent ?? "")) {
          if (/^\s+$/.test(seg)) frag.append(seg);
          else {
            const span = document.createElement("span");
            span.addClass("glimpse-grad-char");
            span.setText(seg);
            frag.append(span);
          }
        }
        gradientPreview.empty();
        gradientPreview.append(frag);
      }
    } else {
      gradientPreview.style.removeProperty("--tp-gradient");
    }
  };

  new Setting(gradientBody)
    .setName("启用文字渐变")
    .setDesc("为正文文字应用渐变色；开启后覆盖「字体颜色」设置")
    .addToggle(toggle =>
      toggle.setValue(plugin.settings.teleprompter.gradientEnabled).onChange(value => {
        plugin.settings.teleprompter.gradientEnabled = value;
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
        updateGradientPreview();
      })
    );

  // 渐变类型：线性（带角度）/ 径向（圆形，角度不适用）
  let angleSetting: Setting;
  new Setting(gradientBody)
    .setName("渐变类型")
    .setDesc("线性沿指定方向过渡；径向从中心向外过渡")
    .addDropdown(dropdown =>
      dropdown
        .addOption("linear", "线性渐变")
        .addOption("radial", "径向渐变")
        .setValue(plugin.settings.teleprompter.gradientType)
          .onChange(v => {
            plugin.settings.teleprompter.gradientType = v as GradientType;
            plugin.saveSettings();
            plugin.teleprompterManager.applySettingsToAll();
            angleSetting.settingEl.style.display = v === "radial" ? "none" : "";
            updateGradientPreview();
          })
    );

  // 渐变范围：整体 = 内容区铺一条渐变（多行时各行颜色不同）；逐字 = 每字独立走一遍渐变
  new Setting(gradientBody)
    .setName("渐变范围")
    .setDesc("整体：整个内容区铺一条渐变；逐字：每个字独立走一遍渐变（多行更整齐）")
    .addDropdown(dropdown =>
      dropdown
        .addOption("block", "整体渐变")
        .addOption("char", "逐字渐变")
        .setValue(plugin.settings.teleprompter.gradientScope)
        .onChange(v => {
          plugin.settings.teleprompter.gradientScope = v as GradientScope;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
          updateGradientPreview();
        })
    );

  let angleSlider: SliderComponent;
  angleSetting = new Setting(gradientBody)
    .setName("渐变角度")
    .setDesc("线性渐变方向（度）：90 从左到右，180 从上到下")
    .addSlider(slider => {
      angleSlider = slider;
      slider
        .setLimits(0, 360, 1)
        .setValue(plugin.settings.teleprompter.gradientAngle)
        .setDynamicTooltip()
        .onChange(value => {
          plugin.settings.teleprompter.gradientAngle = value;
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
          updateGradientPreview();
        });
    })
    .addButton(button =>
      button.setIcon("rotate-ccw").setTooltip("重置为初始值").onClick(() => {
        plugin.settings.teleprompter.gradientAngle = DEFAULT_GRADIENT_ANGLE;
        angleSlider.setValue(DEFAULT_GRADIENT_ANGLE);
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
        updateGradientPreview();
      })
    );
  if (plugin.settings.teleprompter.gradientType === "radial") {
    angleSetting.settingEl.style.display = "none";
  }

  // 颜色停靠点：每行 = 位置滑条 + 颜色色板 + 删除；按位置排序渲染
  new Setting(gradientBody)
    .setName("颜色停靠点")
    .setDesc("渐变经过的颜色及其位置（%），至少保留两个")
    .addButton(button =>
      button.setIcon("plus").setTooltip("添加停靠点").onClick(() => {
        plugin.settings.teleprompter.gradientStops.push({ color: "#808080", pos: 50 });
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
        renderStops();
        updateGradientPreview();
      })
    )
    .addButton(button =>
      button.setIcon("rotate-ccw").setTooltip("重置为初始值").onClick(() => {
        plugin.settings.teleprompter.gradientStops = DEFAULT_GRADIENT_STOPS.map(s => ({ ...s }));
        plugin.saveSettings();
        plugin.teleprompterManager.applySettingsToAll();
        renderStops();
        updateGradientPreview();
      })
    );
  const stopsContainer = gradientBody.createDiv("glimpse-gradient-stops");
  const renderStops = () => {
    stopsContainer.empty();
    tab.gradientPickrs.forEach(p => p.destroyAndRemove());
    tab.gradientPickrs = [];
    const stops = plugin.settings.teleprompter.gradientStops;
    stops.forEach((stop, index) => {
      const row = new Setting(stopsContainer)
        .setName(`停靠点 ${index + 1}`)
        .addSlider(slider =>
          slider
            .setLimits(0, 100, 1)
            .setValue(stop.pos)
            .setDynamicTooltip()
            .onChange(value => {
              stop.pos = value;
              plugin.saveSettings();
              plugin.teleprompterManager.applySettingsToAll();
              updateGradientPreview();
            })
        );
      // 色板挂在滑条与删除键之间（createDiv 追加到 controlEl 末尾，故先建色板后建删除键）
      const colorWrapper = row.controlEl.createDiv("color-wrapper");
      row.addButton(button =>
        button.setIcon("trash").setTooltip("删除停靠点").onClick(() => {
          if (stops.length <= 2) {
            new Notice("至少保留两个颜色停靠点");
            return;
          }
          stops.splice(index, 1);
          plugin.saveSettings();
          plugin.teleprompterManager.applySettingsToAll();
          renderStops();
          updateGradientPreview();
        })
      );
      const colorButton = new ButtonComponent(colorWrapper);
      colorButton.setClass("highlightr-color-picker").then(() => {
        const pickr = new Pickr({
          el: colorButton.buttonEl,
          container: colorWrapper,
          theme: "nano",
          position: "left-start",
          defaultRepresentation: "HEXA",
          default: stop.color,
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
              clear: false,
              cancel: true,
              save: true,
            },
          },
        });
        patchPickrDrag(pickr);
        tab.gradientPickrs.push(pickr);
        pickr
          .on("cancel", (instance: Pickr) => instance.hide())
          .on("change", (color: Pickr.HSVaColor) => {
            const hex = (color?.toHEXA().toString() || "").slice(0, 7);
            if (!hex) return;
            stop.color = hex;
            plugin.saveSettings();
            plugin.teleprompterManager.applySettingsToAll();
            updateGradientPreview();
          })
          .on("save", (_c: Pickr.HSVaColor, instance: Pickr) => instance.hide());
      });
    });
  };
  renderStops();
  updateGradientPreview();

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
