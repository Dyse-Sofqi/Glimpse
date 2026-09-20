/**
 * 虚拟音频播放器（裸音频文件）：不依赖任何笔记，直接挂载播放器播放音频。
 * 歌词来源：音频同目录同名 .lrc 侧车文件优先，其次内嵌歌词（USLT / Vorbis / ©lyr / OGG comment），
 * 无则空态。由 MusicManager 管理生命周期，状态经 manager 推给侧边栏。
 */
import { Notice, type App, TFile } from "obsidian";
import { AudioPlayer } from "./audioPlayer";
import type { MusicManager } from "./manager";
import { parseLyrics, type LyricsLine } from "./lrc";
import { extractEmbeddedLyrics, pickEmbeddedLyrics } from "./bytes/id3";
import { extractFlacLyrics } from "./bytes/vorbis";
import { extractMp4Lyrics } from "./bytes/mp4";
import { extractOggLyrics } from "./bytes/ogg";
import { detectAudioContainer, sidecarLrcPath, type AudioContainer } from "./songScanner";
import type { AudioSource } from "./tags";
import { blobOf } from "./shared";

export interface VirtualPlayerState {
  filePath: string;
  lyrics: LyricsLine[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  karaoke: boolean;
  title?: string;
  actor?: string;
  duration?: number;
}

export class VirtualAudioPlayer {
  public path: string;
  public player?: AudioPlayer;
  private plugin: MusicManager;
  private app: App;
  private audioSource: AudioSource;
  private lyricsLines: LyricsLine[] = [];
  /** 歌词宿主元素（挂在 body 下，供侧边栏读取；本身不可见） */
  private hostEl: HTMLElement;
  private audioBlobUrl = "";
  private title = "";
  private actor = "";
  private destroyed = false;
  /** 上次读取歌词时的快照：音频/侧车 mtime 最大值（外部改动检测用） */
  private lastLoadedMtime = 0;
  /** 上次读取时侧车 .lrc 是否存在（删除/新建侧车也要触发重读） */
  private lastHadLrc = false;
  /** 当前高亮行索引（timeupdate 时二分定位，供侧边栏滚动/高亮） */
  private currentHL = -1;
  /** 播放中的 rAF 帧循环 id */
  private rafId = 0;

  constructor(plugin: MusicManager, path: string, audioSource: AudioSource) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.path = path;
    this.audioSource = audioSource;
    // 宿主隐藏由 .gm-audio-host 类负责（审核规则不允许 JS 里赋静态内联样式）
    this.hostEl = document.body.createDiv({ cls: "gm-audio-host" });
  }

  /** 初始化：读歌词（侧车 .lrc 优先，回退内嵌）→ 挂载播放器 → emitState */
  async init() {
    const lyrics = await this.readLyrics();
    this.lastLoadedMtime = lyrics.mtimeMs;
    this.lastHadLrc = lyrics.lrcExisted;
    if (lyrics.text) {
      this.lyricsLines = parseLyrics(lyrics.text);
    }
    const playerEl = this.hostEl.createDiv({ cls: "gm-player-host" });
    const src = await this.resolvePlayableUrl();
    if (src) {
      this.player = new AudioPlayer(playerEl, src, {
        timeupdate: (t: number) => {
          this.updateHighlight(t);
          this.plugin.onPlaybackProgress(this);
          this.plugin.emitState(this.buildState());
        },
        onPlay: () => {
          this.startFrameLoop();
          this.plugin.onPlayerPlay(this);
        },
        onPause: () => {
          this.stopFrameLoop();
          this.plugin.onPlayerPause(this);
        },
        onended: () => this.plugin.handleSongEnded(this),
        onError: () => {
          if (this.destroyed) return;
          // 试听（preview: 路径）：失败由管理器按播放模式跳队列下一首，不弹通用提示
          if (this.path.startsWith("preview:")) {
            this.onAudioError?.();
            return;
          }
          new Notice("音频播放失败（文件可能已损坏或格式不支持）", 5000);
        },
      });
      this.player.setRate(this.plugin.getPlaybackRate());
      this.player.setVolume(this.plugin.getVolume() / 100);
    }
    this.plugin.emitState(this.buildState());
  }

  /**
   * 读歌词：同目录同名 .lrc 侧车文件优先（用户手动放置/编辑的歌词），其次音频内嵌歌词。
   * 返回歌词文本 + 变更检测快照（mtime 取音频/侧车两者最大值 + 侧车存在性）。
   */
  private async readLyrics(): Promise<{ text: string | null; mtimeMs: number; lrcExisted: boolean }> {
    const audioMtime = await this.statAudioMtime();
    // ① 侧车 .lrc
    const lrc = await this.readSidecarLrc(sidecarLrcPath(this.path));
    if (lrc.existed && lrc.text && lrc.text.trim()) {
      return { text: lrc.text, mtimeMs: Math.max(audioMtime, lrc.mtime), lrcExisted: true };
    }
    // ② 音频内嵌歌词
    const text = await this.readEmbeddedLyrics();
    return { text, mtimeMs: audioMtime, lrcExisted: lrc.existed };
  }

  /** 音频文件 mtime（vault 走 TFile 缓存，库外走 fs.stat）；失败返回 0 */
  private async statAudioMtime(): Promise<number> {
    try {
      if (this.audioSource.type === "vault" && this.audioSource.file) {
        return this.audioSource.file.stat.mtime;
      }
      if (this.audioSource.type === "external" && this.audioSource.path) {
        const fs = (window as any).require("fs");
        const st = await fs.promises.stat(this.audioSource.path);
        return st.mtimeMs;
      }
    } catch { /* 读取失败按 0 处理 */ }
    return 0;
  }

  /** 读同目录同名 .lrc 侧车歌词（vault 内查 TFile，库外走 fs）；不存在或读取失败返回 existed=false */
  private async readSidecarLrc(lrcPath: string): Promise<{ existed: boolean; mtime: number; text: string | null }> {
    try {
      if (this.audioSource.type === "vault") {
        const file = this.app.vault.getAbstractFileByPath(lrcPath);
        if (file instanceof TFile) {
          return { existed: true, mtime: file.stat.mtime, text: await this.app.vault.read(file) };
        }
        return { existed: false, mtime: 0, text: null };
      }
      if (this.audioSource.type === "external" && this.audioSource.path) {
        const fs = (window as any).require("fs");
        const st = await fs.promises.stat(lrcPath);
        return { existed: true, mtime: st.mtimeMs, text: await fs.promises.readFile(lrcPath, "utf-8") };
      }
    } catch { /* 无侧车或读取失败 → 回退内嵌 */ }
    return { existed: false, mtime: 0, text: null };
  }

  /** 读音频内嵌歌词（USLT / Vorbis / ©lyr / OGG comment）；无则 null */
  private async readEmbeddedLyrics(): Promise<string | null> {
    try {
      let buf: ArrayBuffer | Uint8Array | null = null;
      if (this.audioSource.type === "vault" && this.audioSource.file) {
        buf = await this.app.vault.readBinary(this.audioSource.file);
      } else if (this.audioSource.type === "external" && this.audioSource.path) {
        const fs = (window as any).require("fs");
        buf = await fs.promises.readFile(this.audioSource.path);
      }
      if (!buf) return null;
      const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const id3Lyrics = pickEmbeddedLyrics(extractEmbeddedLyrics(b));
      if (id3Lyrics) return id3Lyrics;
      // FLAC / M4A / OGG：ID3 读不到，按容器逐一解析内嵌歌词
      const flacLyrics = extractFlacLyrics(b);
      if (flacLyrics) return flacLyrics;
      const m4aLyrics = extractMp4Lyrics(b);
      if (m4aLyrics) return m4aLyrics;
      return extractOggLyrics(b);
    } catch {
      return null;
    }
  }

  /** 生成可播放 URL。blob 来源（在线试听）直接移交 URL（销毁时由 onunload revoke）；
   *  其余检测真实容器：M4A 伪 mp3 用 audio/mp4 并提示，避免「有歌名但进度不动」。 */
  private async resolvePlayableUrl(): Promise<string> {
    if (this.audioSource.type === "blob") {
      this.audioBlobUrl = this.audioSource.url ?? "";
      return this.audioSource.url ?? "";
    }
    if (this.audioSource.type === "external" && this.audioSource.path) {
      const fs = (window as any).require("fs");
      const buf: Buffer = await fs.promises.readFile(this.audioSource.path);
      const mime = this.pickAudioMime(new Uint8Array(buf));
      if (mime !== "audio/mpeg") {
        this.notifyWrongContainer(mime);
      }
      this.audioBlobUrl = URL.createObjectURL(blobOf(new Uint8Array(buf), mime));
      return this.audioBlobUrl;
    }
    if (this.audioSource.type === "vault" && this.audioSource.file) {
      // vault 内文件：读字节检测真实容器，M4A 伪 mp3 需 Blob（audio/mp4），否则用资源路径
      try {
        const bin = await this.app.vault.readBinary(this.audioSource.file);
        const mime = this.pickAudioMime(new Uint8Array(bin));
        if (mime !== "audio/mpeg") {
          this.notifyWrongContainer(mime);
          this.audioBlobUrl = URL.createObjectURL(blobOf(new Uint8Array(bin), mime));
          return this.audioBlobUrl;
        }
      } catch { /* 读失败回退资源路径 */ }
      return this.app.vault.getResourcePath(this.audioSource.file);
    }
    return "";
  }

  private notifyWrongContainer(mime: string) {
    new Notice(`该文件实为 ${mime === "audio/mp4" ? "M4A/AAC" : mime.split("/")[1].toUpperCase()} 格式，已按实际格式播放`, 6000);
  }

  /** 按文件头魔数选 MIME：标准 MPEG 帧/ID3 → audio/mpeg；M4A → audio/mp4；FLAC/OGG 对应；未知按扩展名兜底 mp3 */
  private pickAudioMime(bytes: Uint8Array): string {
    const container: AudioContainer = detectAudioContainer(bytes);
    switch (container) {
      case "m4a": return "audio/mp4";
      case "flac": return "audio/flac";
      case "ogg": return "audio/ogg";
      default: return "audio/mpeg";
    }
  }

  /** 设置展示用元数据（来自歌单富化后的标签），供状态栏显示 */
  public setMetadata(title: string, actor: string) {
    this.title = title;
    this.actor = actor;
  }

  /** 歌词来源变化后重读（侧车 .lrc / 内嵌）并刷新侧边栏/状态栏（按当前播放位置对齐新歌词） */
  public async reloadLyrics() {
    const lyrics = await this.readLyrics();
    this.lastLoadedMtime = lyrics.mtimeMs;
    this.lastHadLrc = lyrics.lrcExisted;
    this.lyricsLines = lyrics.text ? parseLyrics(lyrics.text) : [];
    this.currentHL = -1;
    const t = this.player?.getTimeStamp() ?? 0;
    this.updateHighlight(t);
    this.plugin.emitState(this.buildState());
  }

  /** 外部改动检测：音频/侧车 .lrc 的 mtime 或侧车存在性变化才全量重读（避免每次重扫都读音频文件） */
  public async reloadLyricsIfChanged(): Promise<boolean> {
    const audioMtime = await this.statAudioMtime();
    const lrc = await this.readSidecarLrc(sidecarLrcPath(this.path));
    const mtime = Math.max(audioMtime, lrc.mtime);
    if (mtime <= this.lastLoadedMtime && lrc.existed === this.lastHadLrc) return false;
    await this.reloadLyrics();
    return true;
  }

  /** 播放中按当前时间二分定位歌词行，供侧边栏当前行滚动/高亮。
   *  比较时间减去歌词偏移（负值=提前）：偏移只影响「何时切行」，不改动歌词数据本身 */
  private updateHighlight(sec: number) {
    const timeMs = Math.round(sec * 1000) - this.plugin.getLyricOffset(this.path);
    let lo = 0;
    let hi = this.lyricsLines.length - 1;
    let result = -1;
    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      const t = this.lyricsLines[mid].timestamp ?? 0;
      if (t <= timeMs) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    this.currentHL = result;
  }

  /**
   * 播放中的 rAF 帧循环：timeupdate 事件约 250ms 才触发一次，换行高亮最坏滞后一个事件周期，
   * 体感即「歌词慢一拍」。帧循环直接读 audio.currentTime，行切换在时间戳越界后的下一帧
   * （~16ms）内推送。窗口隐藏时 rAF 暂停，由 timeupdate 管线兜底（后台无人观看）。
   */
  private startFrameLoop() {
    this.stopFrameLoop();
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      if (!this.player || this.player.paused()) return;
      const prev = this.currentHL;
      this.updateHighlight(this.player.getTimeStamp());
      if (this.currentHL !== prev) {
        this.plugin.emitState(this.buildState());
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopFrameLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** 歌词偏移变更后重定位高亮并推送状态（滑块拖动时调用，暂停时同样生效） */
  refreshHighlight() {
    this.updateHighlight(this.player?.getTimeStamp() ?? 0);
    this.plugin.emitState(this.buildState());
  }

  buildState(): VirtualPlayerState {
    return {
      filePath: this.path,
      lyrics: this.lyricsLines,
      currentIndex: this.currentHL,
      isPlaying: this.player ? !this.player.paused() : false,
      currentTime: this.player?.getTimeStamp() || 0,
      karaoke: this.plugin.getKaraokeEnabled(),
      title: this.title || undefined,
      actor: this.actor || undefined,
      duration: this.player?.getDuration() || 0,
    };
  }

  /** 内存态歌词（试听临时歌词用）：不写文件，仅当前播放器会话内有效，按当前播放位置对齐 */
  setLyrics(text: string) {
    this.lyricsLines = parseLyrics(text);
    this.currentHL = -1;
    this.updateHighlight(this.player?.getTimeStamp() ?? 0);
  }

  /** 音频加载/解码失败回调（试听队列按播放模式跳下一首用；本地歌词歌仅弹通用提示） */
  public onAudioError?: () => void;

  /** 侧边栏点击歌词行跳转 */
  seek(time: number) {
    this.player?.seek(time);
  }

  toggle() {
    if (!this.player) return;
    if (this.player.paused()) void this.player.play();
    else this.player.pause();
  }

  async onunload() {
    this.destroyed = true;
    this.stopFrameLoop();
    this.player?.destroy();
    this.player = undefined;
    if (this.audioBlobUrl) {
      URL.revokeObjectURL(this.audioBlobUrl);
      this.audioBlobUrl = "";
    }
    this.hostEl.remove();
  }
}
