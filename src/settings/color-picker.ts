// 设置页取色入口的统一封装。
//
// 设置页里共有三处取色需求（持久高亮的背景色、提词器字体颜色、渐变颜色停靠点），
// 彼此只差在「是否有透明度通道、弹层往哪边展开、要不要清除按钮、取色后写到哪」。
// 因此收敛成一个工厂：调用方只给容器与回调，不接触 Pickr 实例与它的内部类名。
//
// 颜色状态由本模块自己维护，**不读 Pickr 的 getSelectedColor()** —— 它返回的是内部
// `_lastColor`，语义为「最后一次 applyColor 的值」，而 `setColor(hex, silent)` 走的是
// `setHSVA(..., silent)`，静默分支不会调用 applyColor，_lastColor 因此不更新；
// 更糟的是 `setColor("")` 解析不出颜色时直接 return false，什么都不改。
// 结果就是「编辑一个没设颜色的高亮器，色板仍停在默认色，直接保存会把默认色写进去」。
import Pickr from "@simonwep/pickr";
import { patchPickrDrag } from "./pickr-drag";

/** 弹层相对触发按钮的展开方位，取值沿用 Pickr 的定义 */
export type ColorPickerPlacement = Pickr.Position;

export interface ColorPickerConfig {
  /** 承载色板的容器，Pickr 会把触发按钮与弹层挂进来 */
  container: HTMLElement;
  /** 初始颜色，HEXA 形式（如 "#42188038"）；缺省或 null 表示「未设置颜色」 */
  initial?: string | null;
  /** 是否提供透明度通道；透明度另有独立设置项时应留空 */
  withAlpha?: boolean;
  /** 弹层展开方位；留空则交给 Pickr 自行决定 */
  placement?: ColorPickerPlacement;
  /** 触发按钮的无障碍标签 */
  label?: string;
  /** 取色回调，参数为 HEXA 字符串；调色过程中连续触发 */
  onChange?: (hexa: string) => void;
  /** 颜色被清空（或「取消」回滚到未设置）时回调 */
  onClear?: () => void;
}

export interface ColorPickerHandle {
  /** 当前颜色（HEXA）；未设置颜色时为 null */
  getColor(): string | null;
  /** 静默改写颜色，不触发 onChange / onClear；传 null / 空串表示清空 */
  setColor(hexa: string | null): void;
  /** 销毁实例并摘除其挂载的 DOM */
  destroy(): void;
}

/**
 * 创建色板。调用方需自行在设置页重建或关闭时释放，建议经
 * `SettingTab.registerDisposable(handle.destroy)` 登记。
 */
export function createColorPicker(config: ColorPickerConfig): ColorPickerHandle {
  const initial = config.initial || null;

  // Pickr 默认（useAsButton: false）会用自己生成的按钮替换掉传入的元素，
  // 所以这里只需一个一次性占位节点，真正的触发按钮是替换后的 .pcr-button。
  const placeholder = config.container.createEl("button");

  const pickr = new Pickr({
    el: placeholder,
    container: config.container,
    theme: "nano",
    defaultRepresentation: "HEXA",
    // 传 null 让 Pickr 走 setColor(null) → _clearColor()，色块直接呈「未设置」外观；
    // 类型声明里 default 只写了 string，而 null 是 pickr.js 自己支持的合法入参。
    default: (initial ?? null) as unknown as string,
    comparison: false,
    ...(config.placement ? { position: config.placement } : {}),
    components: {
      preview: true,
      opacity: !!config.withAlpha,
      hue: true,
      interaction: {
        hex: true,
        rgba: false,
        hsla: false,
        hsva: false,
        cmyk: false,
        input: true,
        cancel: true,
        save: true,
        clear: !!config.onClear,
      },
    },
  });

  // Obsidian 拦截 document 级 mousemove，而 Pickr 的拖拽完全靠它驱动，
  // 需改用 pointer 事件桥接，否则色板只能点、不能拖。
  patchPickrDrag(pickr);

  const trigger = config.container.querySelector<HTMLElement>(".pcr-button");
  if (trigger) {
    trigger.addClass("glimpse-color-picker");
    if (config.label) trigger.ariaLabel = config.label;
  }

  /** 当前颜色（null = 未设置） */
  let current: string | null = initial;
  /** 打开弹层前的颜色快照，「取消」时回滚到它 */
  let beforeOpen: string | null = initial;

  const commit = (hexa: string | null) => {
    current = hexa;
    if (hexa) config.onChange?.(hexa);
    else config.onClear?.();
  };

  pickr
    .on("show", () => {
      beforeOpen = current;
    })
    .on("change", (color: Pickr.HSVaColor) => {
      const hexa = color?.toHEXA().toString();
      if (hexa) commit(hexa);
    })
    .on("cancel", (instance: Pickr) => {
      commit(beforeOpen); // 回滚到打开弹层前的颜色
      instance.hide();
    })
    .on("save", (_color: Pickr.HSVaColor, instance: Pickr) => instance.hide())
    .on("clear", (instance: Pickr) => {
      commit(null);
      instance.hide();
    });

  let destroyed = false;
  return {
    getColor: () => current,
    setColor: (hexa) => {
      const next = hexa || null;
      // 先同步 Pickr 外观（silent：不派发 change，避免回灌 onChange），再落定自身状态
      pickr.setColor(next, true);
      current = next;
      beforeOpen = next;
    },
    // 幂等：同一实例可能同时被局部清单与 SettingTab 的销毁清单持有
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      pickr.destroyAndRemove();
    },
  };
}
