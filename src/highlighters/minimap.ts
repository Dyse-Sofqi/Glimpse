import { combineConfig, Extension, Facet } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

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

  constructor(view: EditorView) {
    this.view = view;

    // Build DOM
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

    // Position: set scroller margin, append to editor
    const opts = view.state.facet(minimapConfig);
    view.scrollDOM.style.marginRight = `${opts.width}px`;
    view.dom.appendChild(this.container);

    // Events — handleEvent pattern keeps listener identity simple
    view.scrollDOM.addEventListener("scroll", this);
    this.indicator.addEventListener("mousedown", this);
    this.canvas.addEventListener("mousedown", this);

    this._onMouseMove = (e: MouseEvent) => { if (this.isDragging) this.onDragMove(e); };
    this._onMouseUp = () => { if (this.isDragging) this.onDragEnd(); };
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mouseup", this._onMouseUp);

    // Watch editor resize
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(view.scrollDOM);
    // Catch DOM mutations (e.g. Source Mode restructuring)
    this.resizeObserver.observe(view.dom);

    this.render();
  }

  handleEvent(e: Event) {
    if (e.type === "scroll") {
      this.updateIndicator();
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
      this.updateIndicator();
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

  // ── canvas rendering ──

  render() {
    const opts = this.view.state.facet(minimapConfig);
    const scroller = this.view.scrollDOM;
    const canvasHeight = scroller.clientHeight;
    if (canvasHeight <= 0) return;

    const dpr = devicePixelRatio;
    const cw = opts.width * dpr;
    const ch = canvasHeight * dpr;
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.canvas.style.width = `${opts.width}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.container.style.width = `${opts.width}px`;

    const ctx = this.ctx;
    if (!ctx) return;

    const isDark = document.body.hasClass("theme-dark");

    // Background
    ctx.fillStyle = isDark ? "#1e1e1e" : "#fafafa";
    ctx.fillRect(0, 0, cw, ch);

    const doc = this.view.state.doc;
    const totalLines = doc.lines;
    if (totalLines === 0) return;

    // Cursor line
    const sel = this.view.state.selection.main;
    const cursorLine = this.view.state.doc.lineAt(sel.head);

    // Collapse consecutive blank lines into one
    const visualLines: string[] = [];
    let cursorVisualIdx = -1;
    let lastEmpty = false;
    for (let i = 1; i <= totalLines; i++) {
      const line = doc.line(i);
      const text = line.text;
      if (!text) {
        if (lastEmpty) continue;
        lastEmpty = true;
        visualLines.push("");
      } else {
        lastEmpty = false;
        visualLines.push(text);
        if (line.number === cursorLine.number) cursorVisualIdx = visualLines.length - 1;
      }
    }

    const visualTotal = visualLines.length;
    if (visualTotal === 0) return;

    // Fixed line height in CSS pixels — consistent scale regardless of doc length
    const lineHeightPx = 3;
    const lineH = lineHeightPx * dpr;

    // Font size proportional to line height
    const vFont = lineH * 0.7;

    // Horizontal fit: size text to longest line (cap at 200)
    let maxLineLen = 0;
    for (const t of visualLines) {
      const len = Math.min(t.length, 200);
      if (len > maxLineLen) maxLineLen = len;
    }
    const hFont = maxLineLen > 0 ? cw / (maxLineLen * 0.6) : 8;
    const fontSize = Math.min(vFont, hFont, 8);

    ctx.font = `${fontSize}px "SF Mono", "Cascadia Code", "Consolas", "Monaco", monospace`;
    ctx.textBaseline = "top";

    // Clip safety
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.clip();

    const accentColor = getComputedStyle(document.body).getPropertyValue("--interactive-accent").trim() || (isDark ? "#6e8bff" : "#5b5bd6");
    const textColor = isDark ? "#d4d4d4" : "#555";

    for (let vi = 0; vi < visualTotal; vi++) {
      const text = visualLines[vi];
      const y = vi * lineH;

      if (vi === cursorVisualIdx) {
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, y, cw, Math.max(1, lineH));
        ctx.globalAlpha = 1;
      }

      if (text) {
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, y);
      }
    }

    ctx.restore();

    this.updateIndicator();
  }

  updateIndicator() {
    const scroller = this.view.scrollDOM;
    const scrollTop = scroller.scrollTop;
    const clientHeight = scroller.clientHeight;
    const scrollHeight = scroller.scrollHeight;
    if (clientHeight <= 0 || scrollHeight <= 0) return;

    const indicatorHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 10);
    const indicatorTop = (scrollTop / scrollHeight) * clientHeight;

    this.indicator.style.height = `${indicatorHeight}px`;
    this.indicator.style.top = `${indicatorTop}px`;
  }

  // ── drag-to-scroll ──

  onDragStart(e: MouseEvent) {
    this.isDragging = true;
    const indicatorRect = this.indicator.getBoundingClientRect();
    this.dragStartY = e.clientY - indicatorRect.top;
    this.indicator.addClass("dragging");
    e.preventDefault();
  }

  onDragMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const scroller = this.view.scrollDOM;
    const containerRect = this.container.getBoundingClientRect();
    const indicatorH = parseFloat(this.indicator.style.height) || 10;

    // indicator top edge in CSS pixels, maintaining click offset
    const indicatorTop = e.clientY - containerRect.top - this.dragStartY;
    const maxIndicatorTop = containerRect.height - indicatorH;
    const clampedTop = Math.max(0, Math.min(maxIndicatorTop, indicatorTop));
    const ratio = maxIndicatorTop > 0 ? clampedTop / maxIndicatorTop : 0;

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = ratio * maxScroll;
  }

  onDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.indicator.removeClass("dragging");
  }

  // ── click-to-jump ──

  onCanvasClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    const scroller = this.view.scrollDOM;
    scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight);
  }
}

export function minimapExtension(opts?: Partial<MinimapOptions>): Extension {
  const options = { ...defaultOptions, ...opts };
  return [
    minimapConfig.of(options),
    ViewPlugin.fromClass(MinimapView),
  ];
}
