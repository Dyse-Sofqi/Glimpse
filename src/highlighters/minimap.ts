import { combineConfig, Extension, Facet } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

/**
 * 缩略图的配置项。
 */
export type MinimapOptions = {
  enabled: boolean;
  width: number;
};

const defaultOptions: MinimapOptions = {
  enabled: true,
  width: 80,
};

export const minimapConfig = Facet.define<MinimapOptions, Required<MinimapOptions>>({
  combine(options: readonly MinimapOptions[]) {
    return combineConfig(options, defaultOptions, {
      enabled: (a, b) => a ?? b,
      width: (a, b) => a ?? b,
    });
  },
});

/**
 * 基于 Canvas 的缩略图，固定宽度 120px，字体/换行自适应编辑器。
 */
class MinimapView {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  indicator: HTMLElement;
  view: EditorView;
  isDragging = false;
  dragStartY = 0;
  dragStartScrollTop = 0;
  _onMouseMove: (e: MouseEvent) => void;
  _onMouseUp: () => void;
  resizeObserver: ResizeObserver | null = null;
  private _totalH = 0;

  constructor(view: EditorView) {
    this.view = view;
    this.container = document.createElement("div");
    this.container.className = "glimpse-minimap";
    this.container.addEventListener("wheel", this, { passive: false });

    this.canvas = document.createElement("canvas");
    this.canvas.className = "glimpse-minimap-canvas";
    this.container.appendChild(this.canvas);

    this.indicator = document.createElement("div");
    this.indicator.className = "glimpse-minimap-indicator";
    this.container.appendChild(this.indicator);

    this.ctx = this.canvas.getContext("2d");

    const opts = view.state.facet(minimapConfig);
    view.scrollDOM.style.marginRight = `${opts.width}px`;
    view.dom.appendChild(this.container);

    view.scrollDOM.addEventListener("scroll", this);
    this.indicator.addEventListener("mousedown", this);
    this.canvas.addEventListener("mousedown", this);

    this._onMouseMove = (e: MouseEvent) => { if (this.isDragging) this.onDragMove(e); };
    this._onMouseUp = () => { if (this.isDragging) this.onDragEnd(); };
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mouseup", this._onMouseUp);

    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(view.scrollDOM);
    this.resizeObserver.observe(view.dom);
    this.render();
  }

  handleEvent(e: Event) {
    if (e.type === "scroll") {
      this.render();
    } else if (e.type === "mousedown") {
      const me = e as MouseEvent;
      if (me.target === this.indicator) {
        this.onDragStart(me);
      } else if (me.target === this.canvas) {
        this.onCanvasClick(me);
      }
    } else if (e.type === "wheel") {
      const we = e as WheelEvent;
      this.view.scrollDOM.scrollTop += we.deltaY;
      we.preventDefault();
    }
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.heightChanged || update.configurationChanged || update.selectionSet) {
      this.render();
    } else if (update.viewportChanged) {
      // 滚动时即时重绘（含偏移映射），不额外更新指示器
    }
  }

  destroy() {
    this.view.scrollDOM.style.marginRight = "";
    this.view.scrollDOM.removeEventListener("scroll", this);
    this.indicator.removeEventListener("mousedown", this);
    this.canvas.removeEventListener("mousedown", this);
    this.container.removeEventListener("wheel", this);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
    this.resizeObserver?.disconnect();
    this.container.remove();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  渲染
  // ═══════════════════════════════════════════════════════════════════

  render() {
    const scroller = this.view.scrollDOM;
    const canvasHeight = scroller.clientHeight;
    if (canvasHeight <= 0) return;

    const dpr = devicePixelRatio;
    const mw = 120;
    const cw = mw * dpr;
    this.canvas.style.width = `${mw}px`;
    this.canvas.width = cw;
    this.canvas.style.height = `${canvasHeight}px`;
    this.canvas.height = canvasHeight * dpr;
    this.container.style.width = `${mw}px`;
    scroller.style.marginRight = `${mw}px`;

    const ctx = this.ctx;
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // ── 编辑器信息 ──
    const contentEl = this.view.dom.querySelector(".cm-content");
    const editorFontSize = contentEl ? parseFloat(getComputedStyle(contentEl).fontSize) : 16;
    ctx.font = `${editorFontSize}px "SF Mono", "Cascadia Code", "Consolas", "Monaco", monospace`;
    const edW0 = ctx.measureText("0").width;
    const sizer = this.view.dom.querySelector(".cm-sizer");
    const sizerWidth = sizer ? sizer.getBoundingClientRect().width : 700;
    const targetCPL = Math.max(20, Math.floor(sizerWidth / edW0));

    // ── 选字号：120px 恰好容纳 targetCPL 个半角字符 ──
    let fontSize = 9;
    let w0 = 0, wC = 0;
    for (; fontSize >= 3; fontSize--) {
      ctx.font = `${fontSize}px "SF Mono", "Cascadia Code", "Consolas", "Monaco", monospace`;
      w0 = ctx.measureText("0").width;
      wC = ctx.measureText("中").width;
      if (Math.floor(mw / w0) >= targetCPL) break;
    }
    // 换行阈值：editor 一行在 minimap 上的实际像素宽
    const wrapPx = w0 * targetCPL;

    // ── 背景 ──
    const isDark = document.body.hasClass("theme-dark");
    ctx.fillStyle = isDark ? "#1e1e1e" : "#fafafa";
    ctx.fillRect(0, 0, mw, canvasHeight);

    const doc = this.view.state.doc;
    const totalLines = doc.lines;
    if (totalLines === 0) return;

    const sel = this.view.state.selection.main;
    const cursorLine = this.view.state.doc.lineAt(sel.head);

    // ── 构建 visualLines ──
    const visualLines: string[] = [];
    let csr = -1, cer = -1, lastE = false;
    for (let i = 1; i <= totalLines; i++) {
      const ln = doc.line(i);
      const t = ln.text;
      if (!t) {
        if (lastE) continue; lastE = true;
        visualLines.push("");
      } else {
        lastE = false;
        let seg = "", sw = 0;
        for (const ch of t) {
          const cw1 = ch <= "ÿ" ? w0 : wC;
          if (seg && sw + cw1 > wrapPx) {
            visualLines.push(seg);
            seg = ch; sw = cw1;
          } else { seg += ch; sw += cw1; }
        }
        if (seg) visualLines.push(seg);
        if (ln.number === cursorLine.number) { if (csr < 0) csr = visualLines.length - 1; cer = visualLines.length - 1; }
      }
    }
    const vt = visualLines.length;
    if (vt === 0) return;

    const lh = Math.round(fontSize * 1.3), bh = Math.round(fontSize * 0.65);
    // ── 裁剪 + 测量 totalH ──
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, mw, canvasHeight); ctx.clip();

    let y = 0;
    for (let vi = 0; vi < vt; vi++) {
      y += visualLines[vi] ? lh : bh;
    }
    const totalH = y;
    this._totalH = totalH;

    // scroll ratio: editor → visual content
    const s = this.view.scrollDOM;
    const maxDoc = Math.max(0, s.scrollHeight - s.clientHeight);
    const edRatio = maxDoc > 0 ? s.scrollTop / maxDoc : 0;
    const maxMap = Math.max(0, totalH - canvasHeight);
    const offsetY = edRatio * maxMap;

    // 指示器
    const indH = Math.max((canvasHeight / totalH) * canvasHeight, 10);
    const indTop = (s.scrollTop / Math.max(1, s.scrollHeight)) * canvasHeight;
    this.indicator.style.height = `${indH}px`;
    this.indicator.style.top = `${indTop}px`;

    // 绘制循环
    const accent = getComputedStyle(document.body).getPropertyValue("--interactive-accent").trim() || (isDark ? "#6e8bff" : "#5b5bd6");
    const tc = isDark ? "#d4d4d4" : "#555";
    ctx.textBaseline = "top";

    y = -offsetY;
    for (let vi = 0; vi < vt; vi++) {
      const tv = visualLines[vi];
      const rh = tv ? lh : bh;
      if (vi >= csr && vi <= cer) { ctx.fillStyle = accent; ctx.globalAlpha = 0.5; ctx.fillRect(0, y, mw, Math.max(1, rh)); ctx.globalAlpha = 1; }
      if (tv) { ctx.fillStyle = tc; ctx.fillText(tv, 0, y); }
      y += rh;
    }
    ctx.restore();
    this.updateIndicator();
  }

  updateIndicator() {
    const s = this.view.scrollDOM;
    const sh = s.scrollHeight, ch = s.clientHeight, st = s.scrollTop;
    if (ch <= 0 || sh <= 0) return;
    this.indicator.style.height = `${Math.max((ch / sh) * ch, 10)}px`;
    this.indicator.style.top = `${(st / sh) * ch}px`;
  }

  onDragStart(e: MouseEvent) { this.isDragging = true; this.dragStartY = e.clientY - this.indicator.getBoundingClientRect().top; this.indicator.addClass("dragging"); e.preventDefault(); }
  onDragMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const cr = this.container.getBoundingClientRect();
    const ih = parseFloat(this.indicator.style.height) || 10;
    const mt = cr.height - ih;
    const ct = Math.max(0, Math.min(mt, e.clientY - cr.top - this.dragStartY));
    const r = mt > 0 ? ct / mt : 0;
    // 拖拽比例 → 可视内容偏移 → 编辑器滚动
    const ch = this.view.scrollDOM.clientHeight;
    const totalH = Math.max(ch, this._totalH);
    const maxMap = Math.max(0, totalH - ch);
    const offsetY = r * maxMap;
    const edRatio = maxMap > 0 ? offsetY / maxMap : 0;
    const s = this.view.scrollDOM;
    s.scrollTop = edRatio * Math.max(0, s.scrollHeight - s.clientHeight);
  }
  onDragEnd() { if (!this.isDragging) return; this.isDragging = false; this.indicator.removeClass("dragging"); }
  onCanvasClick(e: MouseEvent) { const rc = this.canvas.getBoundingClientRect(); const rat = Math.max(0, Math.min(1, (e.clientY - rc.top) / rc.height)); const s = this.view.scrollDOM; s.scrollTop = rat * (s.scrollHeight - s.clientHeight); }
}

export function minimapExtension(opts?: Partial<MinimapOptions>): Extension {
  return [minimapConfig.of({ ...defaultOptions, ...opts }), ViewPlugin.fromClass(MinimapView)];
}
