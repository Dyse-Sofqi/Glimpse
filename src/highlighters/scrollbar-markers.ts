import { Extension, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export const setMatchPositions = StateEffect.define<number[]>();

export const matchPositionsField = StateField.define<number[]>({
  create: () => [],
  update(positions, tr) {
    for (const e of tr.effects) {
      if (e.is(setMatchPositions)) return e.value;
    }
    if (tr.docChanged) return [];
    return positions;
  },
});

class ScrollbarMarkerView {
  view: EditorView;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;

  constructor(view: EditorView) {
    this.view = view;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "glimpse-scrollbar-markers";
    view.scrollDOM.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");
    this.render();
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged || update.heightChanged) {
      this.render();
      return;
    }
    if (update.startState.field(matchPositionsField) !== update.state.field(matchPositionsField)) {
      this.render();
    }
  }

  render() {
    const positions = this.view.state.field(matchPositionsField);
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!ctx) return;

    const scroller = this.view.scrollDOM;
    const clientHeight = scroller.clientHeight;
    const scrollHeight = scroller.scrollHeight;
    if (clientHeight <= 0 || scrollHeight <= 0) return;

    const dpr = devicePixelRatio;
    const width = 8;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${clientHeight}px`;
    canvas.width = width * dpr;
    canvas.height = clientHeight * dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!positions.length) return;

    // Read theme accent color
    const accentColor = getComputedStyle(document.body)
      .getPropertyValue("--interactive-accent")
      .trim() || "#5b5bd6";

    // Calculate marker height per match
    const lineHeightEstimate = scrollHeight / this.view.state.doc.lines;

    for (const ratio of positions) {
      const y = ratio * clientHeight;
      // Estimate one line's worth of scrollbar pixels
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

export function scrollbarMarkersExtension(): Extension {
  return [
    matchPositionsField,
    ViewPlugin.fromClass(ScrollbarMarkerView),
  ];
}
