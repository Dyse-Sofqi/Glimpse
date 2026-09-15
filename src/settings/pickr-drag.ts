// pickr 拖拽修复 —— Obsidian 环境拦截 document 级 mousemove（拖拽期间鼠标事件被
// 截获/重定向），而 pickr 内部完全靠 document mousemove 驱动拖拽，导致色板/色相/透明度的
// 圈圈只能点击、无法拖拽。这里改监听 pointer 事件（不受 mousemove 拦截影响），
// 直接调用 pickr 组件内部的 _tapstart/_tapmove/_tapstop 驱动拖拽，绕开事件拦截。
//
// 关键：圈圈（.pcr-picker）与交互面（.pcr-palette / .pcr-slider）在 DOM 里是**兄弟节点**
// （模板中同属 .pcr-color-palette / .pcr-color-chooser / .pcr-color-opacity），
// 所以监听器必须同时挂在两者上 —— 只挂在面上时，按住圈圈拖动收不到 pointerdown，
// 表现为「点圈圈拖不动，点圈圈之外才能拖」。pickr 自身也是这么绑的
// （pickr.js 的 `_.on([...palette, ...picker, ...], ['mousedown','touchstart'], ...)`）。
//
// 依赖 fork 内部结构（getRoot/_components/_recalc），结构不符时静默回退为仅点击。
import Pickr from "@simonwep/pickr";

/** 一个可拖拽区域：交互面 + 其兄弟圈圈 + 对应的 pickr 内部组件 */
type DragSurface = {
  /** 承接拖拽的交互面（.pcr-palette / .pcr-hue / .pcr-opacity） */
  surface?: HTMLElement;
  /** 面上浮动的圈圈（.pcr-picker） */
  picker?: HTMLElement;
  /** pickr 内部组件，提供 _tapmove / _tapstop（内部用闭包而非 this，可安全解构） */
  component?: {
    _tapmove?: (e: { clientX: number; clientY: number; touches: null }) => void;
    _tapstop?: () => void;
  };
};

export function patchPickrDrag(pickr: Pickr): void {
  try {
    const p = pickr as any;
    const root = p.getRoot();
    const comps = p._components;

    const surfaces: DragSurface[] = [
      { surface: root.palette?.palette, picker: root.palette?.picker, component: comps.palette },
      { surface: root.hue?.slider, picker: root.hue?.picker, component: comps.hue },
      { surface: root.opacity?.slider, picker: root.opacity?.picker, component: comps.opacity },
    ];

    for (const { surface, picker, component } of surfaces) {
      const tapmove = component?._tapmove;
      if (!surface || typeof tapmove !== "function") continue;
      const tapstop = component?._tapstop;

      // 面与圈圈都要挂：点谁都得能起拖
      const targets = picker && picker !== surface ? [surface, picker] : [surface];
      for (const target of targets) target.setCssProps({ touchAction: "none" });

      let dragging = false;
      let pid = -1;

      const onDown = (e: PointerEvent) => {
        dragging = true;
        pid = e.pointerId;
        p._recalc = true;
        // 捕获在「实际被按下的元素」上，后续 pointermove 才会回到它并冒泡到同一批监听器
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 已被其他元素捕获则放弃，指针停留在该区域上仍能拖 */
        }
      };

      const onMove = (e: PointerEvent) => {
        if (!dragging || e.pointerId !== pid) return;
        tapmove({ clientX: e.clientX, clientY: e.clientY, touches: null });
      };

      const onEnd = (e: PointerEvent) => {
        if (!dragging || e.pointerId !== pid) return;
        dragging = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (typeof tapstop === "function") tapstop();
      };

      for (const target of targets) {
        target.addEventListener("pointerdown", onDown);
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onEnd);
        target.addEventListener("pointercancel", onEnd);
      }
    }
  } catch {
    /* 内部结构不符：静默回退，仅点击可用 */
  }
}
