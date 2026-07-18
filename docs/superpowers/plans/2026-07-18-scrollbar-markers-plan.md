# Scrollbar Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw narrow colored rectangles on editor scrollbar track showing selection match locations.

**Architecture:** New `StateField` stores match-line ratios. New `ViewPlugin` reads field, renders onto `<canvas>` overlay positioned above scrollbar. `selection.ts` collects match line numbers during search, dispatches ratios via `StateEffect`.

**Tech Stack:** CodeMirror 6 (`StateField`, `StateEffect`, `ViewPlugin`), Canvas 2D.

## Global Constraints

- Match positions stored as ratios `[0, 1]` (offset / doc length)
- Canvas overlay `pointer-events: none` — no scroll interference
- Color read from `--interactive-accent` CSS var (theme color), alpha ~0.6
- Marker width 8px, height = `max(3px, (lineHeight / docHeight) * canvasHeight)`
- No settings toggle — always on when selection highlighter active
- No click interaction on markers

---

### Task 1: Create scrollbar-markers.ts

**Files:**
- Create: `src/highlighters/scrollbar-markers.ts`
- Test: n/a (no test framework for this plugin)

**Interfaces:**
- Produces: `matchPositionsField` (StateField&lt;number[]&gt;), `setMatchPositions` (StateEffect&lt;number[]&gt;), `scrollbarMarkersExtension` (Extension)

- [ ] **Step 1: Create file with StateField + StateEffect**

```typescript
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
```

- [ ] **Step 2: Add ScrollbarMarkerView ViewPlugin class**

```typescript
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
    const totalDocHeight = this.view.state.doc.length;
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
```

- [ ] **Step 3: Export extension**

```typescript
export function scrollbarMarkersExtension(): Extension {
  return [
    matchPositionsField,
    ViewPlugin.fromClass(ScrollbarMarkerView),
  ];
}
```

---

### Task 2: Add CSS style

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add scrollbar markers class after minimap section**

After line 54 (`/* #endregion minimap */`), insert:

```css
/* #region scrollbar markers */

.glimpse-scrollbar-markers {
  position: absolute;
  right: 0;
  top: 0;
  width: 8px;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}

/* #endregion scrollbar markers */
```

---

### Task 3: Modify selection.ts to dispatch match positions

**Files:**
- Modify: `src/highlighters/selection.ts`

- [ ] **Step 1: Add import**

Add at top of file:

```typescript
import { setMatchPositions } from "./scrollbar-markers";
```

- [ ] **Step 2: Add matchLines property to class**

After `delayedGetDeco` declaration:

```typescript
matchLines: Set<number> = new Set();
```

- [ ] **Step 3: Track match line numbers in getDeco()**

In `getDeco()` loop, after each `matchDeco.range(from, to)` or `mainMatchDeco.range(from, to)`, add the containing line number. Find these lines (around lines 106-117):

```typescript
// After pushing mainMatchDeco:
this.matchLines.add(state.doc.lineAt(from).number);

// After pushing matchDeco:
this.matchLines.add(state.doc.lineAt(from).number);
```

Specifically, change the two deco.push sections within the while loop:

```typescript
// old:
deco.push(mainMatchDeco.range(from, to));
// new:
deco.push(mainMatchDeco.range(from, to));
this.matchLines.add(state.doc.lineAt(from).number);

// old:
deco.push(matchDeco.range(from, to));
// new:
deco.push(matchDeco.range(from, to));
this.matchLines.add(state.doc.lineAt(from).number);
```

- [ ] **Step 4: Update delayedGetDeco to dispatch ratios**

Replace existing `delayedGetDeco` debounce setup (the `this.updateDebouncer` method or wherever `this.delayedGetDeco` is assigned) to dispatch match positions after computing decorations:

Find `delayedGetDeco` assignment (around lines 74-83):

Before:
```typescript
this.delayedGetDeco = debounce(
  (view: EditorView) => {
    this.decorations = this.getDeco(view);
    view.update([]);
  },
  this.highlightDelay,
  true
);
```

After:
```typescript
this.delayedGetDeco = debounce(
  (view: EditorView) => {
    this.decorations = this.getDeco(view);
    view.update([]);

    const doc = view.state.doc;
    const docLength = doc.length;
    let ratios: number[];
    if (this.matchLines.size > 0 && docLength > 0) {
      ratios = [...this.matchLines].map(ln => doc.line(ln).from / docLength);
    } else {
      ratios = [];
    }
    this.matchLines.clear();
    view.dispatch({ effects: setMatchPositions.of(ratios) });
  },
  this.highlightDelay,
  true
);
```

---

### Task 4: Register extension in main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add import**

After line 6 (`import { minimapExtension } from "./highlighters/minimap";`):

```typescript
import { scrollbarMarkersExtension } from "./highlighters/scrollbar-markers";
```

- [ ] **Step 2: Register extension in onload()**

In `onload()`, after `this.updateMinimap();` (line 26), before `this.updateStaticHighlighter();`:

```typescript
this.extensions.push(scrollbarMarkersExtension());
```

Final `onload()` sequence:

```typescript
async onload() {
  await this.loadSettings();
  this.settingsTab = new SettingTab(this.app, this);
  this.addSettingTab(this.settingsTab);
  this.staticHighlighter = staticHighlighterExtension(this);
  this.extensions = [];
  this.updateSelectionHighlighter();
  this.updateMinimap();
  this.extensions.push(scrollbarMarkersExtension());
  this.updateStaticHighlighter();
  this.updateStyles();
  this.registerEditorExtension(this.extensions);
  this.initCSS();
}
```

---

### Self-Review Checklist

- [ ] Spec coverage: StateField + StateEffect ✓ (Task 1), ViewPlugin canvas rendering ✓ (Task 1), selection.ts integration ✓ (Task 3), main.ts registration ✓ (Task 4), CSS ✓ (Task 2)
- [ ] No placeholders — all code is inline
- [ ] Type consistency: `setMatchPositions` defined in Task 1, used in Task 3. `matchPositionsField` defined in Task 1, used in Task 1's ViewPlugin. `scrollbarMarkersExtension` export in Task 1, imported in Task 4.
- [ ] `scrollbarMarkersExtension` — ~~no~~ `Extension` type returned, need import
