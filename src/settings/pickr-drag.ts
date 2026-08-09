// pickr 拖拽修复 —— Obsidian 环境拦截 document 级 mousemove（拖拽期间鼠标事件被
// 截获/重定向），而 pickr 内部完全靠 document mousemove 驱动拖拽，导致色板/色相/透明度的
// 圈圈只能点击、无法拖拽。这里改监听 pointer 事件（不受 mousemove 拦截影响），
// 直接调用 pickr 组件内部的 _tapstart/_tapmove/_tapstop 驱动拖拽，绕开事件拦截。
// 依赖 fork 内部结构（getRoot/_components/_recalc），结构不符时静默回退为仅点击。
import Pickr from "@simonwep/pickr";

export function patchPickrDrag(pickr: Pickr): void {
  try {
    const p = pickr as any;
    const root = p.getRoot();
    const comps = p._components;
    const surfaces: Array<[HTMLElement | undefined, any]> = [
      [root.palette?.palette, comps.palette], // SV 色板
      [root.hue?.slider, comps.hue], // 色相条
      [root.opacity?.slider, comps.opacity], // 透明度条
    ];
    for (const [surface, comp] of surfaces) {
      if (!surface || !comp || typeof comp._tapmove !== "function") continue;
      surface.style.setProperty("touch-action", "none");
      let dragging = false;
      let pid = -1;
      surface.addEventListener("pointerdown", (e: PointerEvent) => {
        dragging = true;
        pid = e.pointerId;
        p._recalc = true;
        try {
          surface.setPointerCapture(e.pointerId);
        } catch {
          /* 已被其他元素捕获则放弃，指针停留在色板上仍能拖 */
        }
      });
      surface.addEventListener("pointermove", (e: PointerEvent) => {
        if (!dragging || e.pointerId !== pid) return;
        comp._tapmove({ clientX: e.clientX, clientY: e.clientY, touches: null });
      });
      const end = (e: PointerEvent) => {
        if (!dragging || e.pointerId !== pid) return;
        dragging = false;
        try {
          surface.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (typeof comp._tapstop === "function") comp._tapstop();
      };
      surface.addEventListener("pointerup", end);
      surface.addEventListener("pointercancel", end);
    }
  } catch {
    /* 内部结构不符：静默回退，仅点击可用 */
  }
}
