// 提词器 — 桌面歌词式浮动窗口（详见 docs/adr/0001-teleprompter-floating-overlay.md）
import { ButtonComponent, Component, EditorPosition, MarkdownRenderer, MarkdownView, Notice, Platform, TFile } from "obsidian";
import GlimpsePlugin from "./main";

const TP_SNAP_EDGE = 24; // px，贴近视口边缘的吸附距离
const TP_SNAP_CENTER = 10; // px，贴近视口中心线的吸附距离
const TP_MIN_WIDTH = 240; // 窗口最小宽度
const TP_FONT_SIZES = [32, 40, 50, 64, 80]; // 字体大小循环档位

export type TeleprompterMode = "line" | "highlight";

// 窗口状态 —— 步骤 4 持久化到 data.json
export interface TeleprompterWindowState {
  id: string;
  x: number;
  y: number;
  width: number;
  widthLocked: boolean;
  locked: boolean;
  fontPx: number;
  mode: TeleprompterMode;
  boundDoc: string | null;
}

// 高亮提取模式的匹配项（line 为 0 基行号，text 为去除 == 后的展示文本）
interface TpMatch {
  line: number;
  text: string;
}

/** 扫描 ==...== 匹配（与高亮索引同一规则） */
function scanMatches(text: string): TpMatch[] {
  const items: TpMatch[] = [];
  const re = /==[^=]+?==/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    items.push({
      line: text.slice(0, m.index).split("\n").length - 1,
      text: m[0].replace(/^==|==$/g, "").trim(),
    });
  }
  return items;
}

export class TeleprompterWindow extends Component {
  readonly id: string;
  readonly plugin: GlimpsePlugin;
  private manager: TeleprompterManager;
  state: TeleprompterWindowState;

  rootEl!: HTMLElement;
  toolbarEl!: HTMLElement;
  contentEl!: HTMLElement;
  private resizeEl!: HTMLElement;
  private guideXEl!: HTMLElement;
  private guideYEl!: HTMLElement;
  private bindBtnEl!: ButtonComponent;
  private modeBtnEl!: ButtonComponent;
  private prevBtnEl!: ButtonComponent;
  private nextBtnEl!: ButtonComponent;
  private fontBtnEl!: ButtonComponent;
  private widthLockBtnEl!: ButtonComponent;
  private lockBtnEl!: ButtonComponent;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private ready = false; // 构造完成标志，构造期间不触发持久化

  // 内容状态（不持久化）
  private currentLine = -1; // 行模式：当前行号（0 基）
  private currentIndex = -1; // 高亮模式：匹配列表索引
  private matches: TpMatch[] = []; // 高亮模式匹配缓存
  private matchDoc: string | null = null; // 匹配缓存对应的文档
  private lastText = ""; // 上一个非空内容（空内容占位回退）
  private selectionOverride = false; // 选中提取模式正在覆盖内容
  private renderSeq = 0; // 渲染序号：防异步渲染竞态（旧渲染不覆盖新内容）

  constructor(plugin: GlimpsePlugin, manager: TeleprompterManager, state: TeleprompterWindowState) {
    super();
    this.plugin = plugin;
    this.manager = manager;
    this.state = state;
    // 恢复旧状态时钳制宽度（data.json 可能残留超视口宽度）
    this.state.width = this.clampWidth(state.width);
    this.id = state.id;
    this.buildDOM();
    this.place(state.x, state.y);
    this.setFontPx(state.fontPx);
    this.setWidthLocked(state.widthLocked);
    this.setLocked(state.locked);
    this.updateBindBtn();
    this.updateModeBtn();
    this.applySettings();
    this.ready = true;
    this.refreshLine(); // 打开即提取当前行，不依赖光标移动事件
    // 切换文档/叶子时刷新绑定按钮文本与行内容
    this.registerEvent(
      this.plugin.app.workspace.on("active-leaf-change", () => {
        this.updateBindBtn();
        this.refreshLine();
      })
    );
  }

  /** 状态变更后持久化到 data.json（构造期间跳过） */
  private persist() {
    if (this.ready) this.manager.persist();
  }

  /** 套用设置：字体透明度 / 背景透明度（CSS 变量驱动） */
  applySettings() {
    const tp = this.plugin.settings.teleprompter;
    this.rootEl.style.setProperty("--tp-font-opacity", String(tp.fontOpacity / 100));
    this.rootEl.style.setProperty("--tp-bg-opacity", String(tp.bgOpacity / 100));
    // 背景色取自主题（body 计算色）→ 拆成 rgb 分量，供 rgba() 使用
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
    if (m && m.length >= 3) {
      this.rootEl.style.setProperty("--tp-bg-rgb", `${m[0]}, ${m[1]}, ${m[2]}`);
    }
  }

  private buildDOM() {
    const root = (this.rootEl = document.createElement("div"));
    root.addClass("glimpse-teleprompter");
    root.style.width = this.state.width + "px";
    document.body.appendChild(root);

    // 工具栏（9 个按钮）
    const toolbar = (this.toolbarEl = root.createDiv("glimpse-tp-toolbar"));
    const addBtn = (
      icon: string,
      tooltip: string,
      onClick: (btnEl: HTMLButtonElement) => void,
      interactive = false
    ): ButtonComponent => {
      const btn = new ButtonComponent(toolbar);
      btn.setClass("glimpse-tp-btn");
      btn.buttonEl.addClass("clickable-icon");
      if (interactive) btn.buttonEl.addClass("is-interactive");
      btn.setIcon(icon).setTooltip(tooltip).onClick(() => onClick(btn.buttonEl));
      return btn;
    };

    // 文档绑定 —— 文本按钮，显示当前/已绑定文档文件名，点击锁定该文档
    this.bindBtnEl = new ButtonComponent(toolbar);
    this.bindBtnEl.setClass("glimpse-tp-btn");
    this.bindBtnEl.buttonEl.addClass("clickable-icon");
    this.bindBtnEl.buttonEl.addClass("glimpse-tp-bind");
    this.bindBtnEl.buttonEl.addClass("is-interactive");
    this.bindBtnEl.setButtonText("—");
    this.bindBtnEl.onClick(() => this.toggleBinding());
    this.modeBtnEl = addBtn("shuffle", "模式切换（行提取）", () =>
      this.setMode(this.state.mode === "line" ? "highlight" : "line")
    );
    this.prevBtnEl = addBtn("chevron-up", "上一项", () => this.prevItem(), true);
    this.nextBtnEl = addBtn("chevron-down", "下一项", () => this.nextItem(), true);
    this.fontBtnEl = addBtn("font", `字体大小 ${this.state.fontPx}px`, () => {
      const sizes = TP_FONT_SIZES;
      const next = sizes[(sizes.indexOf(this.state.fontPx) + 1 + sizes.length) % sizes.length] ?? sizes[0];
      this.setFontPx(next);
    });
    this.widthLockBtnEl = addBtn("unlock", "宽度锁定", () =>
      this.setWidthLocked(!this.state.widthLocked)
    );
    // 0.14.8 类型定义缺 App.setting，运行时存在
    addBtn("settings", "设置", () => (this.plugin.app as any).setting.open());
    this.lockBtnEl = addBtn("crosshair", "穿透锁定", () => {
      this.setLocked(!this.state.locked);
    }, true);
    addBtn("x", "关闭", () => this.close());

    // 内容区 —— MarkdownRenderer 渲染；挂 markdown-rendered 类复用主题/自定义 CSS 样式，
    // 字体大小单独由提词器 fontPx 控制（em 相对单位随基数缩放）
    this.contentEl = root.createDiv("glimpse-tp-content markdown-rendered markdown-preview-view");
    this.contentEl.setText("Glimpse 提词器");

    // 右缘宽度拖拽把手
    this.resizeEl = root.createDiv("glimpse-tp-resize");
    this.resizeEl.addEventListener("mousedown", e => this.startResize(e));

    // 视口中心吸附辅助线（全屏竖/横线，仅拖拽贴近中心线时显示）
    this.guideXEl = document.body.createDiv("glimpse-tp-guide glimpse-tp-guide-x");
    this.guideXEl.style.display = "none";
    this.guideYEl = document.body.createDiv("glimpse-tp-guide glimpse-tp-guide-y");
    this.guideYEl.style.display = "none";

    // 滚轮 = 上一项/下一项（穿透锁定时事件穿透到编辑器，天然失效）
    root.addEventListener(
      "wheel",
      e => {
        e.preventDefault();
        if (e.deltaY > 0) this.nextItem();
        else this.prevItem();
      },
      { passive: false }
    );

    // 拖拽 —— 整个窗口均可拖动（按钮 / 缩放手柄除外）
    root.addEventListener("mousedown", e => {
      const t = e.target as HTMLElement;
      if (t.closest(".glimpse-tp-btn")) return; // 按钮（含交互按钮）
      if (t.closest(".glimpse-tp-resize")) return; // 宽度缩放手柄
      this.startDrag(e);
    });
  }

  /** 将窗口放到指定位置并做视口内边界校正 */
  place(x: number, y: number) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = this.rootEl.offsetWidth, h = this.rootEl.offsetHeight;
    x = Math.min(Math.max(x, 0), Math.max(vw - w, 0));
    y = Math.min(Math.max(y, 0), Math.max(vh - h, 0));
    this.state.x = x;
    this.state.y = y;
    this.rootEl.style.left = x + "px";
    this.rootEl.style.top = y + "px";
  }

  /** 移到最前（重新 append 到 body，同 z-index 下后置者在上） */
  focus() {
    document.body.appendChild(this.rootEl);
    this.manager.lastFocused = this;
    this.updateBindBtn();
    this.refreshLine();
  }

  close() {
    this.destroy();
    this.manager.remove(this);
    this.manager.persist();
  }

  /** 插件卸载时清理 DOM */
  destroy() {
    this.rootEl?.detach();
    this.guideXEl?.detach();
    this.guideYEl?.detach();
    this.unload();
  }

  /** 宽度钳制：不低于最小宽度，不超视口宽（长文本换行而非撑破屏幕） */
  private clampWidth(w: number) {
    const vw = window.innerWidth;
    return Math.min(Math.max(w, TP_MIN_WIDTH), Math.max(vw, TP_MIN_WIDTH));
  }

  /** 测量内容与工具栏的自然宽度（最宽行）。
      不能在容器上直接量 scrollWidth —— block 子元素（MarkdownRenderer 的 <p> 等）填满容器，
      量到的是容器自身宽度，再加内边距会逐次膨胀。改为克隆到隐藏 nowrap 测量容器，
      由 max-content 折叠出单行自然宽度（nowrap 亦消除 CJK 折行机会） */
  private measureNaturalWidth(): number {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;left:-99999px;top:0;visibility:hidden;white-space:nowrap;width:max-content;";
    probe.style.fontSize = getComputedStyle(this.contentEl).fontSize;
    for (const el of [this.contentEl, this.toolbarEl]) {
      for (const child of Array.from(el.children)) {
        probe.appendChild(child.cloneNode(true));
      }
    }
    document.body.appendChild(probe);
    const w = probe.scrollWidth;
    probe.detach();
    return w;
  }

  /** 宽度自适应：max(内容自然宽, 工具栏) + 内容 padding + 根 border + 缓冲；宽度锁定时跳过。
      宽度变化时保持窗口水平中心稳定（重新 place），避免换行/换项时文字左右跳动 */
  autoFitWidth() {
    if (this.state.widthLocked) return;
    const ccs = getComputedStyle(this.contentEl);
    const padX = parseFloat(ccs.paddingLeft) + parseFloat(ccs.paddingRight);
    const rcs = getComputedStyle(this.rootEl);
    const borderX = parseFloat(rcs.borderLeftWidth) + parseFloat(rcs.borderRightWidth);
    // +4 缓冲：吸收亚像素/字体度量误差，避免最宽行末尾溢出一个字符触发换行
    const w = this.clampWidth(
      Math.max(this.measureNaturalWidth() + padX + borderX + 4, TP_MIN_WIDTH)
    );
    const oldW = this.rootEl.offsetWidth;
    this.state.width = w;
    this.rootEl.style.width = w + "px";
    if (oldW > 0 && w !== oldW) {
      const dx = (oldW - w) / 2;
      this.place(Math.round(this.state.x + dx), this.state.y);
    }
  }

  setFontPx(fontPx: number) {
    this.state.fontPx = fontPx;
    this.contentEl.style.fontSize = fontPx + "px";
    this.fontBtnEl?.setTooltip(`字体大小 ${fontPx}px`);
    if (!this.state.widthLocked) this.autoFitWidth();
    this.persist();
  }

  setWidthLocked(locked: boolean) {
    this.state.widthLocked = locked;
    this.widthLockBtnEl?.buttonEl.toggleClass("is-active", locked);
    this.widthLockBtnEl?.setIcon(locked ? "lock" : "unlock");
    this.widthLockBtnEl?.setTooltip(locked ? "解锁宽度" : "宽度锁定");
    if (!locked) this.autoFitWidth();
    this.persist();
  }

  /** 穿透锁定：整窗 pointer-events 穿透，仅保留交互按钮；不显示背景 */
  setLocked(locked: boolean) {
    this.state.locked = locked;
    this.rootEl.toggleClass("is-locked", locked);
    this.lockBtnEl?.buttonEl.toggleClass("is-active", locked);
    this.lockBtnEl?.setTooltip(locked ? "解除穿透" : "穿透锁定");
    this.persist();
  }

  // ---------- 文档绑定 ----------

  /** 绑定当前活动文档；已绑定时解除（回到跟随） */
  toggleBinding() {
    const file = this.plugin.app.workspace.getActiveFile();
    if (!file) {
      new Notice("没有活动文档");
      return;
    }
    this.state.boundDoc = this.state.boundDoc === file.path ? null : file.path;
    this.updateBindBtn();
    this.matches = [];
    this.matchDoc = null; // 绑定源变更，清空匹配缓存
    if (this.state.mode === "line") this.refreshLine();
    this.persist();
  }

  private updateBindBtn() {
    const btn = this.bindBtnEl;
    if (!btn) return;
    const active = this.plugin.app.workspace.getActiveFile();
    const bound = this.state.boundDoc;
    if (bound) {
      // 已绑定：显示绑定文档文件名，提示点击解除
      const f = this.plugin.app.vault.getAbstractFileByPath(bound);
      btn.setButtonText(f instanceof TFile ? f.basename : active?.basename ?? "");
      btn.setTooltip(`已锁定：${bound}（点击解除）`);
      btn.buttonEl.toggleClass("is-active", true);
    } else {
      // 未绑定：动态显示活动文档文件名，点击锁定
      btn.setButtonText(active ? active.basename : "未打开");
      btn.setTooltip(active ? `锁定当前文档（${active.path}）` : "没有活动文档");
      btn.buttonEl.toggleClass("is-active", false);
    }
  }

  private updateModeBtn() {
    this.modeBtnEl?.buttonEl.toggleClass("is-active", this.state.mode === "highlight");
    this.modeBtnEl?.setTooltip(`模式切换（${this.state.mode === "line" ? "行提取" : "高亮提取"}）`);
  }

  /** 行模式：提取当前活动（或绑定）文档光标所在行 */
  private refreshLine() {
    if (this.state.mode !== "line") return;
    const src = this.resolveDoc();
    const line = src?.view ? src.view.editor.getCursor().line : Math.max(this.currentLine, 0);
    this.showLine(line, src?.view ? src.view.editor.getLine(line) : undefined);
  }

  /** 来源文档解析：绑定文档 > 活动文档 */
  private resolveDoc(): { file: TFile; view: MarkdownView | null } | null {
    const path = this.state.boundDoc ?? this.plugin.app.workspace.getActiveFile()?.path ?? null;
    if (!path) return null;
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    let view: MarkdownView | null = null;
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) {
        view = leaf.view;
        break;
      }
    }
    return { file, view };
  }

  /** 高亮模式匹配列表（打开中用编辑器实时内容，否则读盘；切换文档时重扫） */
  private async ensureMatches(): Promise<TpMatch[]> {
    const src = this.resolveDoc();
    if (!src) {
      this.matches = [];
      this.matchDoc = null;
      return this.matches;
    }
    if (this.matchDoc === src.file.path && this.matches.length) return this.matches;
    const text = src.view ? src.view.editor.getValue() : await this.plugin.app.vault.cachedRead(src.file);
    this.matches = scanMatches(text);
    this.matchDoc = src.file.path;
    return this.matches;
  }

  // ---------- 内容提取 ----------

  /** 光标移动（manager 转发）：行模式跟随光标；选中非空时临时覆盖为选中文本 */
  onCursorMove(_cursor: EditorPosition, view: MarkdownView) {
    const bound = this.state.boundDoc;
    if (bound) {
      if (view.file?.path !== bound) return;
    } else {
      // 未绑定：仅跟随活动文档（路径比对比对象恒等更稳）
      const active = this.plugin.app.workspace.getActiveFile();
      if (!active || view.file?.path !== active.path) return;
    }

    const ed = view.editor;
    // 选中提取模式（默认开启，步骤 3 接入设置开关）
    const extractEnabled = this.plugin.settings.teleprompter?.selectionExtractEnabled !== false;
    if (extractEnabled && ed.somethingSelected()) {
      this.selectionOverride = true;
      this.renderContent(ed.getSelection());
      return;
    }
    if (this.selectionOverride) {
      this.selectionOverride = false; // 取消选中，恢复原模式内容
    }
    if (this.state.mode === "line") {
      const line = ed.getCursor().line;
      this.showLine(line, ed.getLine(line));
    }
  }

  /** 高亮索引卡片点击：绑定卡片文档并切换高亮模式（ADRs/0001 推论） */
  async showMatch(path: string, matchText: string) {
    this.state.boundDoc = path;
    this.updateBindBtn();
    this.state.mode = "highlight";
    this.updateModeBtn();
    await this.ensureMatches();
    const idx = this.matches.findIndex(m => m.text === matchText);
    this.showMatchIndex(idx >= 0 ? idx : 0);
    this.persist();
  }

  async setMode(mode: TeleprompterMode) {
    this.state.mode = mode;
    this.updateModeBtn();
    if (mode === "highlight") {
      await this.ensureMatches();
      // 初始定位：光标行起第一个匹配，无则第一个
      if (this.matches.length && (this.currentIndex < 0 || this.currentIndex >= this.matches.length)) {
        const near = this.matches.findIndex(m => m.line >= Math.max(this.currentLine, 0));
        this.showMatchIndex(near >= 0 ? near : 0);
      }
    } else {
      this.refreshLine();
    }
    this.persist();
  }

  private async showLine(line: number, text?: string) {
    this.currentLine = Math.max(line, 0);
    if (text === undefined) {
      const src = this.resolveDoc();
      if (src?.view) {
        text = src.view.editor.getLine(this.currentLine);
      } else if (src) {
        const t = await this.plugin.app.vault.cachedRead(src.file);
        text = t.split("\n")[this.currentLine] ?? "";
      } else {
        text = "";
      }
    }
    this.renderContent(text);
  }

  private showMatchIndex(index: number) {
    this.currentIndex = Math.min(Math.max(index, 0), Math.max(this.matches.length - 1, 0));
    this.renderContent(this.matches[this.currentIndex]?.text ?? "");
  }

  prevItem() {
    if (this.state.mode === "line") this.showLine(this.currentLine - 1);
    else this.showMatchIndex(this.currentIndex - 1);
  }

  nextItem() {
    if (this.state.mode === "line") this.showLine(this.currentLine + 1);
    else this.showMatchIndex(this.currentIndex + 1);
  }

  // ---------- 渲染 ----------

  /** 渲染内容；空文本回退显示上一个非空内容（占位半透明，字体透明度减半） */
  private renderContent(text: string) {
    if (!text || !text.trim()) {
      this.contentEl.toggleClass("is-placeholder", true);
      if (this.lastText) this.renderMarkdown(this.lastText);
      else this.contentEl.empty();
      return;
    }
    this.contentEl.toggleClass("is-placeholder", false);
    this.lastText = text;
    this.renderMarkdown(text);
  }

  /** 渲染内容；异步渲染防竞态，失败/同步抛错一律回退纯文本，完成后按内容适配宽度 */
  private renderMarkdown(text: string) {
    const seq = ++this.renderSeq;
    this.contentEl.empty();
    const done = () => {
      if (seq !== this.renderSeq) return;
      if (!this.state.widthLocked) this.autoFitWidth();
    };
    const fallback = () => {
      if (seq !== this.renderSeq) return;
      this.contentEl.setText(text);
      done();
    };
    try {
      Promise.resolve(MarkdownRenderer.renderMarkdown(text, this.contentEl, this.state.boundDoc ?? "", this))
        .then(done)
        .catch(fallback);
    } catch {
      fallback();
    }
  }

  private startDrag(e: MouseEvent) {
    if (this.state.locked) return;
    const startX = e.clientX;
    const startY = e.clientY;
    this.isDragging = false;
    const move = (ev: MouseEvent) => {
      // 移动超过阈值才真正开始拖动 —— 保护内容区链接的点击
      if (!this.isDragging) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        this.isDragging = true;
        this.dragOffsetX = startX - this.rootEl.offsetLeft;
        this.dragOffsetY = startY - this.rootEl.offsetTop;
        this.rootEl.addClass("is-dragging");
      }
      this.dragMove(ev);
    };
    const up = () => {
      const wasDragging = this.isDragging;
      this.isDragging = false;
      this.rootEl.removeClass("is-dragging");
      this.hideGuides();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      // 拖动过则抑制随后的 click，避免误触内容区链接
      if (wasDragging) {
        const suppress = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        window.addEventListener("click", suppress, { capture: true, once: true });
      }
      this.persist();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  /** 拖拽移动：边缘吸附 + 视口中心线吸附（带辅助线） */
  private dragMove(e: MouseEvent) {
    let x = e.clientX - this.dragOffsetX;
    let y = e.clientY - this.dragOffsetY;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = this.rootEl.offsetWidth, h = this.rootEl.offsetHeight;

    // 视口边缘吸附
    if (x <= TP_SNAP_EDGE) x = 0;
    else if (vw - (x + w) <= TP_SNAP_EDGE) x = vw - w;
    if (y <= TP_SNAP_EDGE) y = 0;
    else if (vh - (y + h) <= TP_SNAP_EDGE) y = vh - h;

    // 视口中心线吸附 + 辅助线
    const cx = x + w / 2, cy = y + h / 2;
    if (Math.abs(cx - vw / 2) <= TP_SNAP_CENTER) {
      x = (vw - w) / 2;
      this.guideXEl.style.display = "block";
    } else {
      this.guideXEl.style.display = "none";
    }
    if (Math.abs(cy - vh / 2) <= TP_SNAP_CENTER) {
      y = (vh - h) / 2;
      this.guideYEl.style.display = "block";
    } else {
      this.guideYEl.style.display = "none";
    }

    this.place(x, y);
  }

  private hideGuides() {
    this.guideXEl.style.display = "none";
    this.guideYEl.style.display = "none";
  }

  /** 右缘拖宽：仅未锁定时可用 */
  private startResize(e: MouseEvent) {
    if (this.state.widthLocked || this.state.locked) return;
    e.preventDefault();
    this.rootEl.addClass("is-resizing");
    const move = (ev: MouseEvent) => {
      const vw = window.innerWidth;
      const w = this.clampWidth(Math.min(
        Math.max(ev.clientX - this.rootEl.offsetLeft, TP_MIN_WIDTH),
        Math.max(vw - this.rootEl.offsetLeft, TP_MIN_WIDTH)
      ));
      this.state.width = w;
      this.rootEl.style.width = w + "px";
    };
    const up = () => {
      this.rootEl.removeClass("is-resizing");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      // 手动拖宽后自动锁定宽度，防止下次内容变化自动重排
      this.setWidthLocked(true);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
}

export class TeleprompterManager {
  readonly plugin: GlimpsePlugin;
  private windows: TeleprompterWindow[] = [];
  lastFocused: TeleprompterWindow | null = null;
  private nextId = 1;

  constructor(plugin: GlimpsePlugin) {
    this.plugin = plugin;
    // 恢复上次会话的窗口状态（桌面端；移动端无此功能）
    if (Platform.isDesktop) {
      const saved = plugin.settings.teleprompter.windows ?? [];
      let maxId = 0;
      for (const st of saved) {
        this.windows.push(new TeleprompterWindow(plugin, this, st));
        const n = parseInt(st.id.replace(/^tp-/, ""), 10);
        if (!isNaN(n) && n >= maxId) maxId = n;
      }
      this.nextId = maxId + 1;
      // 规范化：清掉非法/重复状态，保持与已恢复窗口一致
      plugin.settings.teleprompter.windows = this.windows.map(w => w.state);
    }
    // 光标/选中移动 → 转发各窗口（仅桌面端有命令入口，事件本身无害）
    // 0.14.8 类型定义缺 cursor-move 事件名，运行时存在
    plugin.registerEvent(
      (plugin.app.workspace.on as any)("cursor-move", (cursor: EditorPosition, view: MarkdownView) => {
        for (const w of this.windows) w.onCursorMove(cursor, view);
      })
    );
  }

  /** 持久化所有窗口状态到 data.json */
  persist() {
    this.plugin.settings.teleprompter.windows = this.windows.map(w => w.state);
    this.plugin.saveSettings();
  }

  get all(): readonly TeleprompterWindow[] {
    return this.windows;
  }

  /** 打开提词器命令：已有窗口则聚焦最近活跃的，否则新建 */
  openOrFocus(): TeleprompterWindow {
    const existing =
      (this.lastFocused && this.windows.includes(this.lastFocused) && this.lastFocused) ||
      this.windows[this.windows.length - 1] ||
      null;
    if (existing) {
      existing.focus();
      return existing;
    }
    return this.createWindow();
  }

  /** 高亮索引卡片点击入口：绑定 + 切高亮模式 + 定位匹配 */
  handleCardClick(path: string, matchText: string) {
    const win =
      (this.lastFocused && this.windows.includes(this.lastFocused) && this.lastFocused) ||
      this.windows[this.windows.length - 1] ||
      this.createWindow();
    win.showMatch(path, matchText);
    win.focus();
  }

  /** 设置变更后套用到所有实例 */
  applySettingsToAll() {
    this.windows.forEach(w => w.applySettings());
  }

  createWindow(): TeleprompterWindow {
    const win = new TeleprompterWindow(this.plugin, this, {
      id: "tp-" + this.nextId++,
      x: Math.max((window.innerWidth - TP_MIN_WIDTH) / 2, 0),
      y: 24,
      width: TP_MIN_WIDTH,
      widthLocked: false,
      locked: false,
      fontPx: 50,
      mode: "line",
      boundDoc: null,
    });
    this.windows.push(win);
    win.focus();
    return win;
  }

  remove(win: TeleprompterWindow) {
    this.windows.remove(win);
    if (this.lastFocused === win) this.lastFocused = null;
  }

  /** 关闭全部并清除持久化（「关闭所有提词器」命令）；插件卸载时仅销毁 DOM，保留状态 */
  closeAll(persistState = true) {
    [...this.windows].forEach(w => w.destroy());
    this.windows = [];
    this.lastFocused = null;
    if (persistState) this.persist();
  }

  onunload() {
    this.closeAll(false);
  }
}
