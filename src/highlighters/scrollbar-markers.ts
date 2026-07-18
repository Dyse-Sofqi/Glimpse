import { Extension, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// StateEffect —— 接收匹配位置比例数组，驱动滚动条标记渲染
export const setMatchPositions = StateEffect.define<number[]>();

// StateField —— 存储最新的匹配位置比例，供 ViewPlugin 读取
export const matchPositionsField = StateField.define<number[]>({
  create: () => [],
  update(positions, tr) {
    for (const e of tr.effects) {
      if (e.is(setMatchPositions)) return e.value;
    }
    // 文档变更时清空，避免残留
    if (tr.docChanged) return [];
    return positions;
  },
});

// 滚动条标记视图：在滚动条上叠加 canvas，绘制匹配位置矩形
class ScrollbarMarkerView {
  view: EditorView;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;

  constructor(view: EditorView) {
    this.view = view;

    // 创建 canvas 并追加到编辑器 DOM 中
    this.canvas = document.createElement("canvas");
    this.canvas.className = "glimpse-scrollbar-markers";
    view.dom.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");
    this.render();
  }

  update(update: ViewUpdate) {
    // 文档/选区/视口/高度变化 → 重绘
    if (update.docChanged || update.selectionSet || update.viewportChanged || update.heightChanged) {
      this.render();
      return;
    }
    // matchPositionsField 变化 → 重绘
    if (update.startState.field(matchPositionsField) !== update.state.field(matchPositionsField)) {
      this.render();
    }
  }

  render() {
    const positions = this.view.state.field(matchPositionsField);
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!ctx) return;

    // 基于 scrollDOM（滚动容器）计算尺寸
    const scroller = this.view.scrollDOM;
    const clientHeight = scroller.clientHeight;
    const scrollHeight = scroller.scrollHeight;
    if (clientHeight <= 0 || scrollHeight <= 0) return;

    const dpr = devicePixelRatio;
    const width = 8; // 滚动条标记宽度（CSS 像素）

    canvas.style.width = `${width}px`;
    canvas.style.height = `${clientHeight}px`;
    canvas.width = width * dpr;
    canvas.height = clientHeight * dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!positions.length) return;

    // 读取 Obsidian 主题强调色
    const accentColor = getComputedStyle(document.body)
      .getPropertyValue("--interactive-accent")
      .trim() || "#5b5bd6";

    // 估算每行文本在滚动条上占用的像素高度
    const lineHeightEstimate = scrollHeight / this.view.state.doc.lines;

    for (const ratio of positions) {
      const y = ratio * clientHeight;
      // 每个标记至少 3px，按行高比例缩放
      const markerH = Math.max(3, (lineHeightEstimate / scrollHeight) * clientHeight * dpr);

      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(0, y * dpr, canvas.width, markerH);
      ctx.globalAlpha = 1;
    }
  }

  destroy() {
    this.canvas.remove();
  }
}

// 注册 StateField + ViewPlugin 作为 CM6 扩展
export function scrollbarMarkersExtension(): Extension {
  return [
    matchPositionsField,
    ViewPlugin.fromClass(ScrollbarMarkerView),
  ];
}
