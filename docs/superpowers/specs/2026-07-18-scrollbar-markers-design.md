# Scrollbar Markers for Selection Matches

## Purpose

When user selects text in editor, draw narrow colored rectangles on scrollbar track
showing where all matching occurrences are located. Only for selection highlighter
matches (not static highlights).

## Data Flow

```
User selects text
  → selection.ts getDeco() runs SearchCursor
  → finds all match positions (line numbers)
  → writes line ratios into StateField
  → scrollbar-markers.ts ViewPlugin reads StateField
  → renders colored blocks on scrollbar-overlay canvas
```

## StateField: `matchPositionsField`

Location: `src/highlighters/scrollbar-markers.ts`

```typescript
export const matchPositionsField = StateField.define<number[]>({
  create: () => [],
  update(positions, tr) {
    // Only consume from effects, never persist across non-relevant changes
    for (const e of tr.effects) {
      if (e.is(setMatchPositions)) return e.value;
    }
    // Clear on doc changes (text changes invalidate match positions)
    if (tr.docChanged) return [];
    return positions;
  },
});

export const setMatchPositions = StateEffect.define<number[]>();
```

Each `number` is a ratio `(lineStart / docHeight)` in [0, 1] — position of each match
line's start relative to total document height.

## ViewPlugin: `ScrollbarMarkerView`

Location: `src/highlighters/scrollbar-markers.ts`

- `constructor()`: creates `<canvas>` element positioned over scrollbar track
- `update()`: reads `matchPositionsField`, re-renders markers
- `render()`: clears canvas, draws filled rectangles at each ratio
- `destroy()`: removes canvas

### Canvas positioning

Overlay on `view.scrollDOM`. Positioned absolute:
- `right: 0; top: 0; width: 8px; height: 100%; pointer-events: none; z-index: 3`
- Won't interfere with scrollbar interaction
- Width narrow (8px) — visual cue only

### Rendering each marker

```
for each ratio in positions:
  y = ratio * canvasHeight
  fillRect(0, y, canvasWidth, max(3, markerHeight))
```

- `markerHeight = (lineHeight / docHeight) * canvasHeight`, minimum 3px
- Color: `--interactive-accent` CSS variable (theme accent color), alpha ~0.6
- No text, no hover, no interaction

### Clearing

When selection empty OR `positions.length === 0`: clear canvas entirely.

## Integration: selection.ts

Add to `matchHighlighter` class:

```typescript
// New class property:
matchLines: Set<number> = new Set();
```

Inside `getDeco()` loop, when adding each `matchDeco` or `mainMatchDeco`:

```typescript
this.matchLines.add(state.doc.lineAt(from).number);
```

`delayedGetDeco` becomes:

```typescript
this.delayedGetDeco = debounce(
  (view: EditorView) => {
    this.decorations = this.getDeco(view);
    view.update([]);
    
    // Dispatch match line positions for scrollbar markers
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

When `getDeco()` returns early (`Decoration.none`), `this.matchLines` stays empty,
so empty array dispatches — clearing markers. The `update()` method's existing
`setTimeout` path (150ms) immediately clears markers on selection loss for
responsiveness.

No extra per-match computation during search — just `Set.add()`.

## Settings

No new settings needed. Feature always on when selection highlighter is active.
Respects `minSelectionLength`, `maxMatches`, `highlightDelay` — all inherited from
selection highlighter config (markers only appear when matches exist).

## CSS

Add to `styles.css`:

```css
.glimpse-scrollbar-markers {
  position: absolute;
  right: 0;
  top: 0;
  width: 8px;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}
  z-index: 3;
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/highlighters/scrollbar-markers.ts` | New — StateField + ViewPlugin |
| `src/highlighters/selection.ts` | Add match-line tracking, dispatch StateEffect |
| `src/main.ts` | Register `scrollbarMarkersExtension` |
| `styles.css` | Add `.glimpse-scrollbar-markers` style |

## Scenarios

**No selection**: markers cleared immediately (empty dispatch in `update()`'s
setTimeout path).

**Multi-line selection**: highlighter returns `Decoration.none` (existing behavior).
Markers cleared.

**Very long document**: markers scale by ratio — always fits scrollbar height.

**Theme change**: marker re-reads `--interactive-accent` on each render via
`getComputedStyle`. No extra work needed.

## Future Possibilities

- Click-to-jump on markers (user explicitly declined for now)
- Static highlighter scrollbar marks (not requested)
