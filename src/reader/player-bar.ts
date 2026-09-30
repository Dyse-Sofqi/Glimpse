/**
 * 朗读播放条：注入到 MarkdownView 顶部的控制条。
 *
 * 刻意不用 Obsidian 的 ItemView —— 播放条是「当前笔记的附属控件」，
 * 用视图会让它在标签切换时脱离上下文。直接挂在 view.contentEl 顶部最直观。
 */
import { MarkdownView, setIcon } from "obsidian";
import type { ReaderController, ReaderProgress } from "./controller";

export class ReaderPlayerBar {
  private barEl: HTMLElement | null = null;
  private playButtonEl: HTMLElement | null = null;
  private stopButtonEl: HTMLElement | null = null;
  private counterEl: HTMLElement | null = null;
  private fillEl: HTMLElement | null = null;
  private messageEl: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly controller: ReaderController) {}

  /** 挂到指定笔记视图顶部；重复调用会先卸载旧的 */
  mount(view: MarkdownView): void {
    this.unmount();

    const bar = document.createElement("div");
    bar.className = "glimpse-reader-bar";

    const play = document.createElement("button");
    play.className = "clickable-icon glimpse-reader-bar-button";
    play.setAttribute("aria-label", "播放 / 暂停");
    setIcon(play, "pause");
    play.addEventListener("click", () => void this.controller.togglePlayPause());

    const counter = document.createElement("span");
    counter.className = "glimpse-reader-bar-counter";
    counter.textContent = "0 / 0";

    const track = document.createElement("div");
    track.className = "glimpse-reader-bar-track";
    const fill = document.createElement("div");
    fill.className = "glimpse-reader-bar-fill";
    track.append(fill);

    const message = document.createElement("span");
    message.className = "glimpse-reader-bar-message";

    const stop = document.createElement("button");
    stop.className = "clickable-icon glimpse-reader-bar-button";
    stop.setAttribute("aria-label", "停止朗读");
    setIcon(stop, "square");
    stop.addEventListener("click", () => this.controller.stop());

    bar.append(play, counter, track, message, stop);
    view.contentEl.insertBefore(bar, view.contentEl.firstChild);

    this.barEl = bar;
    this.playButtonEl = play;
    this.stopButtonEl = stop;
    this.counterEl = counter;
    this.fillEl = fill;
    this.messageEl = message;

    this.unsubscribe = this.controller.subscribe(progress => this.render(progress));
    this.render(this.controller.getProgress());
  }

  unmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.barEl?.remove();
    this.barEl = null;
    this.playButtonEl = null;
    this.stopButtonEl = null;
    this.counterEl = null;
    this.fillEl = null;
    this.messageEl = null;
  }

  /** 播放条是否已挂载 */
  isMounted(): boolean {
    return this.barEl !== null;
  }

  private render(progress: ReaderProgress): void {
    const { state, index, total, ratio, message } = progress;

    if (this.counterEl) {
      this.counterEl.textContent = total > 0 ? `${Math.max(index, 0)} / ${total}` : "— / —";
    }

    // 段内进度用细条表示，整体不显示百分比（分段长度不均，百分比意义不大）
    if (this.fillEl) {
      const percent = total > 0 ? ((Math.max(index - 1, 0) + ratio) / total) * 100 : 0;
      this.fillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    if (this.playButtonEl) {
      setIcon(this.playButtonEl, state === "playing" ? "pause" : "play");
      this.playButtonEl.toggleClass("is-disabled", state === "idle" && total === 0);
    }

    if (this.messageEl) {
      this.messageEl.textContent =
        message ??
        (state === "preparing"
          ? "正在准备语音…"
          : state === "paused"
            ? "已暂停"
            : "");
    }

    this.barEl?.toggleClass("is-error", state === "error");
    this.barEl?.toggleClass("is-busy", state === "preparing");
  }
}
