import { EditorView } from "@codemirror/view";
import { Text } from "@codemirror/state";
import { RegExpCursor } from "./highlighters/regexp-cursor";
import {
  ButtonComponent,
  ItemView,
  MarkdownView,
  Notice,
  setIcon,
  WorkspaceLeaf,
} from "obsidian";
import type GlimpsePlugin from "./main";

export const HIGHLIGHT_INDEX_VIEW = "glimpse-highlight-index";

interface MatchEntry {
  line: number;   // 1-based
  text: string;
}

interface HeadingNode {
  level: number;
  line: number;   // 0-based line index
  text: string;
  matches: MatchEntry[];
  ancestry: { text: string; level: number }[]; // chain of ancestor heading texts+levels, shallowest first
}

/** Parse all markdown headings from doc text. */
function parseHeadings(doc: Text): HeadingNode[] {
  const headings: HeadingNode[] = [];
  const fullText = doc.sliceString(0);
  const re = /^(#{1,6})\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullText)) !== null) {
    const line = doc.lineAt(m.index);
    const level = m[1].length;

    // build ancestry: collect ancestor texts from preceding higher-level headings
    const ancestry: { text: string; level: number }[] = [];
    for (let i = headings.length - 1; i >= 0; i--) {
      if (headings[i].level < level) {
        ancestry.push({ text: headings[i].text, level: headings[i].level });
        // now look for headings shallower than that one
        let target = headings[i].level;
        for (let j = i - 1; j >= 0 && target > 1; j--) {
          if (headings[j].level < target) {
            ancestry.push({ text: headings[j].text, level: headings[j].level });
            target = headings[j].level;
          }
        }
        break;
      }
    }
    ancestry.reverse();

    headings.push({
      level,
      line: line.number - 1, // 0-based
      text: m[2].trim(),
      matches: [],
      ancestry,
    });
  }
  return headings;
}

/** Find the nearest preceding heading for a match line (1-based). */
function findHeadingFor(headings: HeadingNode[], matchLine: number): HeadingNode | null {
  const matchLine0 = matchLine - 1; // convert to 0-based
  let best: HeadingNode | null = null;
  for (const h of headings) {
    if (h.line < matchLine0 && (!best || h.line > best.line)) {
      best = h;
    }
  }
  return best;
}

export class HighlightIndexView extends ItemView {
  plugin: GlimpsePlugin;
  panelsEl!: HTMLElement;
  activePanel = "index";
  private lastActiveMdView: MarkdownView | null = null;
  private lastRenderedHeadings: HeadingNode[] = [];
  private orphanMatches: MatchEntry[] = [];
  private indexBtnEl!: HTMLElement;
  private sourceBtnEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: GlimpsePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return HIGHLIGHT_INDEX_VIEW;
  }

  getDisplayText(): string {
    return "高亮索引";
  }

  getIcon(): string {
    return "flower";
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const btnContainer = contentEl.createDiv({ cls: "nav-buttons-container" });

    const indexBtn = new ButtonComponent(btnContainer);
    indexBtn.setIcon("sparkles").setTooltip("高亮索引").then(b => {
      b.buttonEl.addClass("clickable-icon");
      b.buttonEl.addClass("glimpse-tab-btn");
      this.indexBtnEl = b.buttonEl;
      b.buttonEl.addEventListener("click", () => { this.switchPanel("index"); });
    });

    const sourceBtn = new ButtonComponent(btnContainer);
    sourceBtn.setIcon("rotate-3d").setTooltip("追根溯源").then(b => {
      b.buttonEl.addClass("clickable-icon");
      b.buttonEl.addClass("glimpse-tab-btn");
      this.sourceBtnEl = b.buttonEl;
      b.buttonEl.addEventListener("click", () => { if (this.activePanel !== "source") this.switchPanel("source"); });
    });

    this.panelsEl = contentEl.createDiv({ cls: "glimpse-index-panels" });

    this.app.workspace.onLayoutReady(() => {
      this.switchPanel(this.activePanel);
    });

    // re-render when active leaf changes
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        if (this.activePanel !== "index") return;
        this.lastRenderedHeadings = [];
        this.orphanMatches = [];
        this.renderIndexPanel();
      })
    );
  }

  onPaneShow() {
    if (this.activePanel === "index") {
      this.lastRenderedHeadings = [];
      this.orphanMatches = [];
      this.renderIndexPanel();
    }
  }

  switchPanel(panel: string) {
    this.activePanel = panel;

    // update tab button active state
    this.indexBtnEl?.toggleClass("active", panel === "index");
    this.sourceBtnEl?.toggleClass("active", panel === "source");

    if (panel === "index") {
      this.lastRenderedHeadings = [];
      this.orphanMatches = [];
      this.renderIndexPanel();
    } else {
      this.panelsEl.empty();
    }
  }

  renderIndexPanel() {
    const panelsEl = this.panelsEl;

    let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.lastActiveMdView = activeView;
    } else if (this.lastActiveMdView) {
      activeView = this.lastActiveMdView;
    } else {
      const leaves = this.app.workspace.getLeavesOfType("markdown");
      if (leaves.length) activeView = leaves[0].view as MarkdownView;
    }
    if (!activeView) {
      panelsEl.empty();
      panelsEl.createEl("p", { text: "打开一个文档以查看高亮索引", cls: "glimpse-index-empty" });
      return;
    }

    const cm = (activeView.editor as any)?.cm as EditorView;
    if (!cm) return;

    // 1. parse all headings
    const headings = parseHeadings(cm.state.doc);

    // 2. scan ==highlight== matches
    const cursor = new RegExpCursor(cm.state.doc, "==[^=]+?==");
    const matches: MatchEntry[] = [];
    while (!cursor.next().done) {
      const { from, to } = cursor.value;
      const matchText = cm.state.doc.sliceString(from, to);
      const line = cm.state.doc.lineAt(from);
      const displayText = matchText.replace(/^==|==$/g, "").trim();
      matches.push({ line: line.number, text: displayText });
    }

    // 3. assign each match to nearest preceding heading
    for (const m of matches) {
      const heading = findHeadingFor(headings, m.line);
      if (heading) {
        heading.matches.push(m);
      } else {
        this.orphanMatches.push(m);
      }
    }
    const matchesInHeadings = headings.reduce((sum, h) => sum + h.matches.length, 0);
    this.orphanMatches = this.orphanMatches.filter(m =>
      headings.every(h => !h.matches.includes(m))
    );
    const totalMatches = matchesInHeadings + this.orphanMatches.length;

    // keep previous results if new scan finds nothing
    if (!totalMatches && this.lastRenderedHeadings.length) return;

    // 4. render — flat, ancestor banners before first heading in each shared-ancestry subtree
    panelsEl.empty();
    const activeHeadings = headings.filter(h => h.matches.length > 0);
    this.lastRenderedHeadings = activeHeadings;

    // doc title — centered, from MarkdownView title or filename
    const docName = (activeView as any).title ?? activeView.file?.basename ?? "";
    const docTitleEl = panelsEl.createDiv({ cls: "glimpse-index-doc-title" });
    docTitleEl.createSpan({ text: docName });

    const section = panelsEl.createDiv({ cls: "glimpse-index-section" });
    const header = section.createDiv({ cls: "glimpse-index-header" });
    header.createSpan({ text: `高亮文本 (${totalMatches})`, cls: "glimpse-index-name" });

    const listEl = section.createDiv({ cls: "glimpse-index-tree" });

    // orphan matches first — no heading above them
    if (this.orphanMatches.length > 0) {
      const orphanEl = listEl.createDiv({ cls: "glimpse-index-group" });
      const orphanHeaderEl = orphanEl.createDiv({ cls: "glimpse-index-group-header" });
      const orphanIconEl = orphanHeaderEl.createSpan({ cls: "glimpse-index-heading-icon" });
      setIcon(orphanIconEl, "heading-1");
      orphanHeaderEl.createSpan({ text: docName, cls: "glimpse-index-heading-name" });
      orphanHeaderEl.createSpan({ text: String(this.orphanMatches.length), cls: "glimpse-index-group-count" });
      for (const m of this.orphanMatches) {
        this.renderMatchCard(orphanEl, m, activeView);
      }
    }

    // flatten: each active heading rendered in document order; ancestor banner emitted
    // once when the ancestry path changes from the previous heading.
    // Skip ancestors that are themselves active headings — they already appear as group headers.
    const activeTextSet = new Set(activeHeadings.map(h => h.text));
    let lastAncestryKey = "";
    for (const h of activeHeadings) {
      const visibleAncestors = h.ancestry.filter(a => !activeTextSet.has(a.text));
      const ancestryKey = visibleAncestors.map(a => a.text).join("\x00");
      const ancestryChanged = ancestryKey !== lastAncestryKey;

      if (ancestryChanged && visibleAncestors.length > 0) {
        // shared ancestors rendered as heading rows — same style as direct headings
        for (const ancestor of visibleAncestors) {
          const ancestorRow = listEl.createDiv({ cls: "glimpse-index-group-header" });
          const iconEl = ancestorRow.createSpan({ cls: "glimpse-index-heading-icon" });
          setIcon(iconEl, `heading-${Math.min(ancestor.level, 6)}`);
          const nameEl = ancestorRow.createSpan({ cls: "glimpse-index-heading-name" });
          nameEl.style.color = `var(--h${ancestor.level}-color)`;
          nameEl.createSpan({ text: ancestor.text });
        }
        lastAncestryKey = ancestryKey;
      } else if (ancestryChanged) {
        lastAncestryKey = "";
      }

      const groupEl = listEl.createDiv({ cls: "glimpse-index-group" });
      const groupHeaderEl = groupEl.createDiv({ cls: "glimpse-index-group-header" });

      // heading level icon
      const iconName = h.level <= 6 ? `heading-${h.level}` : "heading";
      const iconEl = groupHeaderEl.createSpan({ cls: "glimpse-index-heading-icon" });
      setIcon(iconEl, iconName);

      // heading own name only (ancestors shown in banner above)
      const headingEl = groupHeaderEl.createSpan({ cls: "glimpse-index-heading-name" });
      headingEl.style.color = `var(--h${h.level}-color)`;
      headingEl.createSpan({ text: h.text });

      groupHeaderEl.createSpan({ text: String(h.matches.length), cls: "glimpse-index-group-count" });

      for (const m of h.matches) {
        this.renderMatchCard(groupEl, m, activeView);
      }
    }
  }

  private renderMatchCard(container: HTMLElement, m: MatchEntry, activeView: MarkdownView) {
    const card = container.createDiv({ cls: "glimpse-index-card" });
    const cardContent = card.createDiv({ cls: "glimpse-index-card-content" });
    cardContent.createSpan({ text: m.text, cls: "glimpse-index-text" });
    const copyBtn = card.createEl("button", { cls: "glimpse-index-copy clickable-icon" });
    setIcon(copyBtn, "clipboard-paste");
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const textarea = document.createElement("textarea");
      textarea.value = m.text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      new Notice("已复制");
    });
    cardContent.addEventListener("mousedown", (e) => {
      e.preventDefault();
      activeView.editor.setCursor(m.line - 1, 0);
      activeView.editor.scrollIntoView({ from: { line: m.line - 1, ch: 0 }, to: { line: m.line - 1, ch: 0 } }, true);
    });
  }
}
