// 字体选择模态窗 —— 提词器正文字体设置
// 本机字体枚举：优先 queryLocalFonts()（Chromium 103+，Electron 默认授予 local-fonts 权限），
// 不可用时降级 canvas 测宽探测内置候选表。存储为逗号分隔字体栈（对齐原生 appearance.json 的
// textFontFamily 模式），应用时 CSS font-family 回退语义 —— 靠前且本机存在的字体优先生效。
import { App, ButtonComponent, Modal, Setting } from "obsidian";
import GlimpsePlugin from "../main";

/** 兜底候选字体表：queryLocalFonts 不可用时，逐项测宽探测本机是否安装 */
const FALLBACK_FONTS = [
  // Windows
  "Microsoft YaHei", "SimSun", "SimHei", "KaiTi", "FangSong", "DengXian",
  "Segoe UI", "Arial", "Arial Black", "Calibri", "Cambria", "Candara",
  "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Courier New",
  "Georgia", "Impact", "Lucida Console", "Lucida Sans Unicode",
  "Microsoft Sans Serif", "Palatino Linotype", "Tahoma", "Times New Roman",
  "Trebuchet MS", "Verdana", "Webdings",
  // macOS
  "-apple-system", "SF Pro Display", "SF Pro Text", "Helvetica Neue",
  "Helvetica", "Arial Unicode MS", "Apple SD Gothic Neo", "PingFang SC",
  "PingFang HK", "PingFang TC", "Hiragino Sans GB", "Hiragino Sans",
  "Hiragino Mincho ProN", "Hiragino Kaku Gothic ProN", "STHeiti", "STSong",
  "STKaiti", "STFangsong", "Songti SC", "Heiti SC", "Menlo", "Monaco",
  "Zapfino",
  // Linux
  "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono", "Liberation Sans",
  "Liberation Serif", "Liberation Mono", "Noto Sans", "Noto Serif",
  "Noto Sans Mono", "Noto Sans CJK SC", "Noto Sans CJK TC", "Noto Sans CJK JP",
  "Noto Serif CJK SC", "WenQuanYi Micro Hei", "WenQuanYi Zen Hei",
  "FreeSans", "FreeSerif",
  // 通用中文字体
  "Source Han Sans SC", "Source Han Serif SC", "LXGW WenKai", "MiSans",
  "HarmonyOS Sans SC", "OPPO Sans", "Alibaba PuHuiTi", "Source Han Sans CN",
];

/** 字体名 → CSS font-family 值（剥引号，包双引号） */
function cssFontValue(family: string): string {
  return `"${family.replace(/"/g, "").trim()}"`;
}

/** canvas 测宽探测某字体是否安装：候选字体宽度与 monospace 回退宽度不同即视为安装 */
function isFontInstalled(family: string): boolean {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return true;
    const probe = "mmmmmmmmmmlli";
    ctx.font = `16px ${cssFontValue(family)}, monospace`;
    const a = ctx.measureText(probe).width;
    ctx.font = "16px monospace";
    const b = ctx.measureText(probe).width;
    return Math.abs(a - b) > 1;
  } catch {
    return true;
  }
}

/** 枚举本机字体：queryLocalFonts → 失败降级候选表测宽过滤 */
async function getLocalFonts(): Promise<string[]> {
  const qlf = (window as any).queryLocalFonts as (() => Promise<any[]>) | undefined;
  if (window.isSecureContext && typeof qlf === "function") {
    try {
      const fonts = await qlf();
      const seen = new Set<string>();
      const list: string[] = [];
      for (const f of fonts) {
        const fam = String(f?.family ?? "").trim();
        if (fam && !seen.has(fam)) {
          seen.add(fam);
          list.push(fam);
        }
      }
      if (list.length) return list;
    } catch {
      // 权限/安全上下文拦截 → 降级
    }
  }
  const detected = FALLBACK_FONTS.filter(isFontInstalled);
  // 探测全部落空（环境异常）时不空手：整表兜底，交给 CSS 回退
  return detected.length ? detected : FALLBACK_FONTS;
}

export class FontPickerModal extends Modal {
  plugin: GlimpsePlugin;
  /** 确认回调：传出逗号分隔字体栈（空串 = 跟随主题） */
  onConfirm: (stack: string) => void = () => {};

  private selected: string[] = []; // 有序，靠前优先
  private available: string[] = [];
  private dragIdx: number | null = null;

  private selectedEl!: HTMLElement;
  private availableEl!: HTMLElement;
  private searchEl!: HTMLInputElement;
  private customInputEl!: HTMLInputElement;

  constructor(app: App, plugin: GlimpsePlugin) {
    super(app);
    this.plugin = plugin;
    const saved = (plugin.settings.teleprompter.fontFamily || "").trim();
    this.selected = saved ? saved.split(",").map(s => s.trim()).filter(Boolean) : [];
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("glimpse-font-modal");
    contentEl.addClass("glimpse-font-modal-content");

    contentEl.createEl("h2", { text: "选择字体" });
    contentEl.createEl("p", {
      cls: "glimpse-font-modal-desc",
      text: "勾选本机字体，可拖拽调整优先级：列表靠前且本机已安装的字体优先生效，未安装的自动顺延到下一项。留空则跟随主题默认字体。",
    });

    // ── 已选字体（拖拽排序）──
    this.selectedEl = contentEl.createDiv({ cls: "glimpse-font-selected" });

    // ── 可用字体（搜索 + 列表）──
    const availableEl = contentEl.createDiv({ cls: "glimpse-font-available" });
    this.searchEl = availableEl.createEl("input", {
      cls: "glimpse-font-search",
      attr: { type: "text", placeholder: "搜索本机字体…" },
    });
    this.searchEl.addEventListener("input", () => this.renderAvailable());
    this.availableEl = availableEl.createDiv({ cls: "glimpse-font-available-list" });
    this.availableEl.setText("正在读取本机字体…");
    // 初始渲染已选列表（从当前设置回读）；可用列表待字体枚举完成
    this.renderSelected();

    // ── 自定义字体 ──
    new Setting(contentEl)
      .setName("添加自定义字体")
      .setDesc("输入字体名称加入列表（可不在本机安装，未安装时自动回退）")
      .addText(text => {
        this.customInputEl = text.inputEl;
        text.setPlaceholder("如 MyCustom Font");
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter") this.addCustom();
        });
      })
      .addButton(btn =>
        btn.setButtonText("添加").onClick(() => this.addCustom())
      );

    // ── 底部操作 ──
    const actions = contentEl.createDiv({ cls: "glimpse-font-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("确定").setCta().onClick(() => this.confirm());

    void this.loadFonts();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async loadFonts() {
    this.available = await getLocalFonts();
    if (this.available.length === 0) {
      this.availableEl.setText("未检测到本机字体，可用「添加自定义字体」手动输入。");
      return;
    }
    this.renderAvailable();
  }

  private renderAll() {
    this.renderSelected();
    this.renderAvailable();
  }

  /** 已选字体列表：顶部「默认（跟随主题）」项 + 可拖拽排序、可移除项 */
  private renderSelected() {
    this.selectedEl.empty();
    this.selectedEl.createEl("div", {
      cls: "glimpse-font-section-title",
      text: "已选字体（拖拽调整顺序，越靠前越优先）",
    });

    // 「默认（跟随主题）」项：选中即清空堆栈
    const defaultRow = this.selectedEl.createDiv({
      cls: "glimpse-font-sel-row glimpse-font-default" + (this.selected.length === 0 ? " is-active" : ""),
    });
    defaultRow.createDiv({ cls: "glimpse-font-default-icon", text: this.selected.length === 0 ? "●" : "○" });
    defaultRow.createDiv({ cls: "glimpse-font-name", text: "默认（跟随主题）" });
    defaultRow.addEventListener("click", () => {
      this.selected = [];
      this.renderAll();
    });

    this.selected.forEach((name, idx) => {
      const row = this.selectedEl.createDiv({
        cls: "glimpse-font-sel-row",
        attr: { draggable: "true" },
      });
      row.createDiv({ cls: "glimpse-font-handle", text: "⠿" });
      const nameEl = row.createDiv({ cls: "glimpse-font-name", text: name });
      nameEl.style.fontFamily = cssFontValue(name);
      const removeBtn = row.createEl("button", {
        cls: "glimpse-font-remove",
        text: "✕",
        attr: { "aria-label": "移除" },
      });
      removeBtn.addEventListener("click", e => {
        e.stopPropagation();
        this.selected.splice(idx, 1);
        this.renderAll();
      });

      this.bindRowDrag(row, idx);
    });
  }

  /** 原生 HTML5 DnD：拖拽行调整优先级顺序 */
  private bindRowDrag(row: HTMLElement, idx: number) {
    row.addEventListener("dragstart", e => {
      this.dragIdx = idx;
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      row.addClass("is-dragging");
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      row.addClass("is-drag-over");
    });
    row.addEventListener("dragleave", () => row.removeClass("is-drag-over"));
    row.addEventListener("drop", e => {
      e.preventDefault();
      row.removeClass("is-drag-over");
      if (this.dragIdx === null || this.dragIdx === idx) return;
      const [moved] = this.selected.splice(this.dragIdx, 1);
      this.selected.splice(idx, 0, moved);
      this.dragIdx = null;
      this.renderAll();
    });
    row.addEventListener("dragend", () => {
      this.dragIdx = null;
      (this.selectedEl as HTMLElement).querySelectorAll(".is-dragging, .is-drag-over").forEach(el =>
        (el as HTMLElement).removeClass("is-dragging", "is-drag-over")
      );
    });
  }

  /** 可用字体列表：搜索过滤 + 勾选切换 */
  private renderAvailable() {
    this.availableEl.empty();
    const q = this.searchEl.value.trim().toLowerCase();
    const list = q ? this.available.filter(n => n.toLowerCase().includes(q)) : this.available;
    if (list.length === 0) {
      this.availableEl.setText(q ? "无匹配字体" : "未检测到本机字体");
      return;
    }
    list.forEach(name => {
      const isSel = this.selected.includes(name);
      const row = this.availableEl.createDiv({
        cls: "glimpse-font-avail-row" + (isSel ? " is-selected" : ""),
      });
      row.createDiv({ cls: "glimpse-font-check", text: isSel ? "✓" : "" });
      const nameEl = row.createDiv({ cls: "glimpse-font-name", text: name });
      nameEl.style.fontFamily = cssFontValue(name);
      row.addEventListener("click", () => this.toggleAvailable(name));
    });
  }

  private toggleAvailable(name: string) {
    const i = this.selected.indexOf(name);
    if (i >= 0) this.selected.splice(i, 1);
    else this.selected.push(name);
    this.renderAll();
  }

  private addCustom() {
    const name = this.customInputEl.value.trim();
    if (!name) return;
    if (!this.selected.includes(name)) this.selected.push(name);
    this.customInputEl.value = "";
    this.renderAll();
  }

  private confirm() {
    this.onConfirm(this.selected.join(", "));
    this.close();
  }
}
