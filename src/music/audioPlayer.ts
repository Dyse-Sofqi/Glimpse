/**
 * 音频播放器（vanilla DOM，替代 LyricFlux 的 Svelte Player 组件）。
 * 包装一个带原生控制条的 <audio> 元素，暴露与播放状态同步所需的公开方法。
 */

export interface AudioPlayerCallbacks {
  /** timeupdate（当前时间，秒） */
  timeupdate: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onended: () => void;
  onError?: () => void;
}

export class AudioPlayer {
  private audio: HTMLAudioElement;
  private cb: AudioPlayerCallbacks;

  constructor(target: HTMLElement, src: string, cb: AudioPlayerCallbacks) {
    this.cb = cb;
    const wrapper = target.createDiv({ cls: "gm-player-wrapper" });
    this.audio = wrapper.createEl("audio", {
      attr: { controls: "controls", controlslist: "nodownload" },
    });
    this.audio.src = src;
    this.audio.addEventListener("timeupdate", () => this.cb.timeupdate(this.audio.currentTime));
    this.audio.addEventListener("play", () => this.cb.onPlay());
    this.audio.addEventListener("pause", () => this.cb.onPause());
    this.audio.addEventListener("ended", () => this.cb.onended());
    this.audio.addEventListener("error", () => this.cb.onError?.());
  }

  /** 仅跳转位置，不强制播放：暂停状态下点击歌词保持暂停 */
  seek(t: number) {
    this.audio.currentTime = t;
  }

  getTimeStamp(): number {
    return this.audio.currentTime || 0;
  }

  /** 开始播放；返回是否成功启动（被拒时 false，调用方可提示用户改用底栏播放键恢复） */
  play(): Promise<boolean> {
    if (!this.audio.paused) return Promise.resolve(true);
    return this.audio.play().then(() => true).catch(() => false);
  }

  paused(): boolean {
    return this.audio.paused;
  }

  pause(): void {
    if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  setRate(rate: number): void {
    this.audio.playbackRate = rate;
  }

  getRate(): number {
    return this.audio?.playbackRate || 1;
  }

  setVolume(vol: number) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, vol));
    }
  }

  getVolume(): number {
    return this.audio?.volume ?? 1;
  }

  isReady(): boolean {
    return this.audio.readyState >= 2; // HAVE_CURRENT_DATA
  }

  /** 等待元数据加载完成（readyState ≥ HAVE_METADATA，可安全 seek）；超时兜底返回避免坏文件挂起 */
  whenReady(timeoutMs = 3000): Promise<void> {
    if (this.audio.readyState >= 1) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const finish = () => {
        window.clearTimeout(timer);
        this.audio.removeEventListener("loadedmetadata", finish);
        resolve();
      };
      const timer = window.setTimeout(finish, timeoutMs);
      this.audio.addEventListener("loadedmetadata", finish, { once: true });
    });
  }

  /** 卸载：暂停并释放音频资源 */
  destroy() {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio.remove();
  }
}
