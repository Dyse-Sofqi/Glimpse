import { EditorView } from "@codemirror/view";
import {
  ItemView,
  MarkdownView,
  Notice,
  setIcon,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import type GlimpsePlugin from "./main";
import { copyText } from "./settings/export";

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

/** 一次索引渲染的来源文档（活动视图 / 提词器锚定文档） */
interface IndexSource {
  file: TFile | null;
  view: MarkdownView | null;
  docName: string;
  headings: HeadingNode[];
  orphanMatches: MatchEntry[];
  totalMatches: number;
}

/** Parse all markdown headings from doc text (与 CM Text/纯字符串两路来源通用)。 */
function parseHeadings(fullText: string): HeadingNode[] {
  const headings: HeadingNode[] = [];
  const re = /^(#{1,6})\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullText)) !== null) {
    const line = fullText.slice(0, m.index).split("\n").length - 1; // 0-based
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
      line,
      text: m[2].trim(),
      matches: [],
      ancestry,
    });
  }
  return headings;
}

/** Scan ==highlight== matches from plain text（与提词器 scanMatches 同规则；line 为 1 基）。 */
function scanHighlightMatches(text: string): MatchEntry[] {
  const items: MatchEntry[] = [];
  const re = /==[^=]+?==/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    items.push({
      line: text.slice(0, m.index).split("\n").length, // 1-based
      text: m[0].replace(/^==|==$/g, "").trim(),
    });
  }
  return items;
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
  private lastActiveMdView: MarkdownView | null = null;
  private lastRenderedHeadings: HeadingNode[] = [];
  private highlightLine = -1; // 当前选中卡片对应的行（0 基，光标联动/键盘/提词器共用），-1 = 未选中
  private lastPollCursorLine = -2; // 轮询最近一次见到的光标行（-2 = 未初始化）；仅光标真正移动才触发联动
  private indexCards: { el: HTMLElement; m: MatchEntry; src: IndexSource }[] = []; // 当前渲染的卡片序列（键盘导航）
  private kbIndex = -1; // 键盘导航当前位置，-1 = 未定位
  private renderingAnchored = false; // 当前渲染来源为提词器锚定文档（无活动视图可联动光标）
  private renderedPath: string | null = null; // 面板当前显示的文档路径（叶子变更重渲染判定）

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

    this.panelsEl = contentEl.createDiv({ cls: "glimpse-index-panels" });

    this.app.workspace.onLayoutReady(() => {
      void this.renderIndexPanel();
    });

    // re-render only when the content source actually changes
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        // 焦点切到本标签页（如点击卡片）→ 内容源未变，跳过重渲染防冲选中态
        if (this.app.workspace.activeLeaf === this.leaf) return;
        // 回到索引当前已显示的同一文档（如提词器双击回焦编辑器）→ 跳过，保留选中态
        if (view && view.file?.path === this.renderedPath) return;
        // 焦点到非 markdown 叶子 → 索引继续显示当前文档，无需重渲染
        if (!view) return;
        // 切到不同的 markdown 视图 → 重渲染
        this.lastActiveMdView = view;
        this.lastRenderedHeadings = [];
        this.highlightLine = -1;
        this.lastPollCursorLine = -2;
        void this.renderIndexPanel();
      })
    );

    // 新文档在活动叶子打开（新建 / 资源管理器点击当前标签页）不触发 active-leaf-change，
    // 仅触发 file-open —— 缺失该监听是「首次打开文档索引不刷新」的根因；
    // 且 file-open 在视图加载完成后触发，无 active-leaf-change 先于 view.file 就绪的竞态
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || !(file instanceof TFile)) return;
        if (file.extension !== "md") return; // 非 markdown 文件 → 索引继续显示当前文档
        if (file.path === this.renderedPath) return; // 同一文档 → 保留选中态
        this.lastActiveMdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        this.lastRenderedHeadings = [];
        this.highlightLine = -1;
        this.lastPollCursorLine = -2;
        void this.renderIndexPanel();
      })
    );

    // 光标行轮询 → 联动高亮对应卡片（index 面板重渲染后也由 renderIndexPanel 补一次）
    this.registerInterval(window.setInterval(() => this.pollCursorLine(), 150));

    // 键盘导航：焦点在本标签页时 ↑/↓ 切换上/下一项高亮卡片（不滚动面板）
    this.registerDomEvent(window, "keydown", (e) => {
      if (this.app.workspace.activeLeaf !== this.leaf) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (!this.indexCards.length) return;
      e.preventDefault();
      const base = this.resolveKbBase();
      const next = base < 0 ? 0 : e.key === "ArrowDown" ? base + 1 : base - 1;
      this.selectCard(Math.max(0, Math.min(next, this.indexCards.length - 1)));
    });
  }

  /** 光标行变化时：高亮光标所在行对应的索引卡片并滚到屏幕中央 */
  private pollCursorLine() {
    if (this.renderingAnchored) return; // 锚定文档非活动视图，无法按活动光标联动
    const view = this.app.workspace.getActiveViewOfType(MarkdownView) ?? this.lastActiveMdView;
    if (!view) return;
    const line = view.editor.getCursor("head").line;
    // 仅光标真正移动才联动覆盖；光标静止时保留键盘/提词器滚动同步主动选中的卡片
    if (line === this.lastPollCursorLine) return;
    if (this.lastPollCursorLine === -2 && this.highlightLine >= 0) {
      // 首次轮询前已有主动选中（提词器滚动同步等）→ 只记录光标，不覆盖选中
      this.lastPollCursorLine = line;
      return;
    }
    this.lastPollCursorLine = line;
    this.highlightLine = line;
    this.applyCursorHighlight(line);
  }

  private applyCursorHighlight(line: number) {
    const panels = this.panelsEl;
    if (!panels) return;
    panels.querySelectorAll(".glimpse-index-card.active").forEach(el => el.removeClass("active"));
    // data-line 为 1 基行号，光标行 0 基 +1 对齐；一行多个高亮段 → 全部选中
    const cards = panels.querySelectorAll<HTMLElement>(`.glimpse-index-card[data-line="${line + 1}"]`);
    if (!cards.length) return;
    cards.forEach(c => c.addClass("active"));
    cards[0].scrollIntoView({ block: "center" });
  }

  onPaneShow() {
    this.lastRenderedHeadings = [];
    void this.renderIndexPanel();
  }

  /** 来源解析 + 渲染：当前活动文档优先；检索不到高亮则回退提词器锚定文档 */
  async renderIndexPanel() {
    let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.lastActiveMdView = activeView;
    } else if (this.lastActiveMdView) {
      activeView = this.lastActiveMdView;
    } else {
      const leaves = this.app.workspace.getLeavesOfType("markdown");
      if (leaves.length) activeView = leaves[0].view as MarkdownView;
    }

    let src: IndexSource | null = activeView ? await this.collectFromView(activeView) : null;

    // 当前页检索不到高亮 → 回退到提词器锚定的文档
    this.renderingAnchored = false;
    if (!src || src.totalMatches === 0) {
      const anchored = await this.collectAnchoredDoc(activeView?.file?.path ?? null);
      if (anchored) {
        src = anchored;
        this.renderingAnchored = true;
      }
    }

    if (!src) {
      this.renderedPath = null;
      this.panelsEl.empty();
      this.panelsEl.createEl("p", { text: "打开一个文档以查看高亮索引", cls: "glimpse-index-empty" });
      return;
    }

    this.renderSource(src);
  }

  /** 从活动 Markdown 视图收集索引数据（读 CM 编辑器实时内容；CM 内容未就绪时回退读盘）。
      file-open 触发时 CM 编辑器内容可能尚未加载（doc 为空），首扫会误报 0 匹配；
      回退 cachedRead 保证首次打开即统计正确（切走再切回能正常正是因视图已加载） */
  private async collectFromView(view: MarkdownView): Promise<IndexSource> {
    const cm = (view.editor as any)?.cm as EditorView | undefined;
    const live = cm?.state?.doc?.toString() ?? "";
    const text = live || (view.file ? await this.plugin.app.vault.cachedRead(view.file) : "");
    return this.buildIndexSource(view.file, view, text);
  }

  /** 按路径收集索引数据（优先已打开视图的实时内容，否则读盘） */
  private async collectDocByPath(path: string): Promise<IndexSource | null> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    let view: MarkdownView | null = null;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) {
        view = leaf.view;
        break;
      }
    }
    if (view) return await this.collectFromView(view);
    const text = await this.plugin.app.vault.cachedRead(file);
    return this.buildIndexSource(file, null, text);
  }

  /** 从提词器锚定文档收集索引数据 */
  private async collectAnchoredDoc(excludePath: string | null): Promise<IndexSource | null> {
    const path = this.anchoredDocPath();
    if (!path || path === excludePath) return null;
    return this.collectDocByPath(path);
  }

  /** 提词器锚定文档路径：最近聚焦窗口优先，其次任一已绑定窗口 */
  private anchoredDocPath(): string | null {
    const mgr = this.plugin.teleprompterManager; // 防御：极端时序下可能尚未初始化
    if (!mgr) return null;
    const last = mgr.lastFocused;
    if (last?.state.boundDoc) return last.state.boundDoc;
    for (const w of mgr.all) {
      if (w.state.boundDoc) return w.state.boundDoc;
    }
    return null;
  }

  private buildIndexSource(file: TFile | null, view: MarkdownView | null, text: string): IndexSource {
    const headings = parseHeadings(text);
    const orphanMatches: MatchEntry[] = [];
    for (const m of scanHighlightMatches(text)) {
      const heading = findHeadingFor(headings, m.line);
      if (heading) heading.matches.push(m);
      else orphanMatches.push(m);
    }
    const matchesInHeadings = headings.reduce((sum, h) => sum + h.matches.length, 0);
    const totalMatches = matchesInHeadings + orphanMatches.length;
    return {
      file,
      view,
      docName: (view as any)?.title ?? file?.basename ?? "",
      headings,
      orphanMatches,
      totalMatches,
    };
  }

  /** 渲染索引 —— flat，祖先横幅在首个共享祖先子树的标题前 */
  private renderSource(src: IndexSource) {
    const panelsEl = this.panelsEl;
    const activeHeadings = src.headings.filter(h => h.matches.length > 0);

    // keep previous results if new scan finds nothing
    if (!src.totalMatches && this.lastRenderedHeadings.length) return;
    this.lastRenderedHeadings = activeHeadings;
    this.renderedPath = src.file?.path ?? null;

    this.indexCards = []; // 卡片序列随渲染重建，键盘导航位置重置
    this.kbIndex = -1;

    panelsEl.empty();

    // doc title — centered, from MarkdownView title or filename
    const docTitleEl = panelsEl.createDiv({ cls: "glimpse-index-doc-title" });
    docTitleEl.createSpan({ text: src.docName });

    const section = panelsEl.createDiv({ cls: "glimpse-index-section" });
    const header = section.createDiv({ cls: "glimpse-index-header" });
    header.createSpan({ text: `高亮文本 (${src.totalMatches})`, cls: "glimpse-index-name" });

    const listEl = section.createDiv({ cls: "glimpse-index-tree" });

    // orphan matches first — no heading above them
    if (src.orphanMatches.length > 0) {
      const orphanEl = listEl.createDiv({ cls: "glimpse-index-group" });
      const orphanHeaderEl = orphanEl.createDiv({ cls: "glimpse-index-group-header" });
      const orphanIconEl = orphanHeaderEl.createSpan({ cls: "glimpse-index-heading-icon" });
      setIcon(orphanIconEl, "heading-1");
      orphanHeaderEl.createSpan({ text: src.docName, cls: "glimpse-index-heading-name" });
      orphanHeaderEl.createSpan({ text: String(src.orphanMatches.length), cls: "glimpse-index-group-count" });
      for (const m of src.orphanMatches) {
        this.renderMatchCard(orphanEl, m, src);
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
        this.renderMatchCard(groupEl, m, src);
      }
    }

    // 重渲染后补一次光标联动（新卡片无 active 类，恢复选中态；锚定文档无活动光标可联动则跳过）
    if (!this.renderingAnchored && this.highlightLine >= 0) this.applyCursorHighlight(this.highlightLine);
  }

  private renderMatchCard(container: HTMLElement, m: MatchEntry, src: IndexSource) {
    const card = container.createDiv({ cls: "glimpse-index-card" });
    card.dataset.line = String(m.line); // 1 基行号，供光标联动选中
    this.indexCards.push({ el: card, m, src }); // 供键盘导航按 DOM 顺序遍历
    const cardContent = card.createDiv({ cls: "glimpse-index-card-content" });
    cardContent.createSpan({ text: m.text, cls: "glimpse-index-text" });
    // 右键复制（与提词器一致）：抑制原生菜单，复制卡片文本
    cardContent.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      await copyText(m.text);
      new Notice("已复制");
    });
    cardContent.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const idx = this.indexCards.findIndex(x => x.el === card);
      if (idx >= 0) this.selectCard(idx);
      else this.activateCard(m, src);
    });
  }

  /** 提词器高亮模式双击联动：定位并选中指定文档/行的卡片（跨渲染源，必要时切渲染源）。
      仅选中卡片，不回喂提词器（来源即提词器，避免 showMatch 清空其 matches 造成跳转竞态） */
  async revealMatch(path: string, line: number) {
    let idx = this.indexCards.findIndex(c => c.src.file?.path === path && c.m.line === line);
    if (idx >= 0) {
      this.selectCard(idx, false);
      return;
    }
    // 当前渲染源不是该文档 → 切到该文档渲染后再选中
    const src = await this.collectDocByPath(path);
    if (!src) return;
    const activePath = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ?? null;
    this.renderingAnchored = activePath !== path; // 非活动视图文档 → 关光标联动，防轮询覆盖选中
    this.renderSource(src);
    idx = this.indexCards.findIndex(c => c.src.file?.path === path && c.m.line === line);
    if (idx >= 0) this.selectCard(idx, false);
  }

  /** 键盘导航基准：kbIndex 无效时取当前已选中（.active）卡片，保证从选中项起算 */
  private resolveKbBase(): number {
    if (this.kbIndex >= 0 && this.kbIndex < this.indexCards.length) return this.kbIndex;
    const activeIdx = this.indexCards.findIndex(c => c.el.hasClass("active"));
    return activeIdx;
  }

  /** 选中卡片：置选中态 + 居中滚动 + 同步光标/提词器（点击/键盘/提词器联动共用）。
      notifyTp=false 时跳过提词器回喂（来源即提词器，防止 showMatch 清空其 matches 造成跳转竞态） */
  private selectCard(index: number, notifyTp = true) {
    const c = this.indexCards[index];
    if (!c) return;
    this.kbIndex = index;
    // 选中态 + 滚到屏幕中央（本面板滚动容器）
    this.panelsEl?.querySelectorAll(".glimpse-index-card.active").forEach(el => el.removeClass("active"));
    c.el.addClass("active");
    c.el.scrollIntoView({ block: "center" });
    // 光标行预置去重，联动轮询不再重复滚动；同步编辑器光标 + 提词器
    this.highlightLine = c.m.line - 1;
    if (notifyTp) this.activateCard(c.m, c.src);
  }

  /** 激活卡片：编辑器光标跳到匹配行（锚定文档无视图则跳过）+ 绑定提词器 */
  private activateCard(m: MatchEntry, src: IndexSource) {
    if (src.view) {
      src.view.editor.setCursor(m.line - 1, 0);
      src.view.editor.scrollIntoView({ from: { line: m.line - 1, ch: 0 }, to: { line: m.line - 1, ch: 0 } }, true);
    }
    // 提词器：绑定卡片文档并切换高亮模式（步骤 2）
    if (src.file) this.plugin.teleprompterManager.handleCardClick(src.file.path, m.text);
  }
}
