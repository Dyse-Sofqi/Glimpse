/**
 * 音乐模块管理器：歌单扫描与富化、播放控制（播放模式/倍速/音量）、
 * 播放状态分发（侧边栏订阅）。音乐功能的中枢。
 */
import { Notice, Platform, TFile, type App, type Plugin } from "obsidian";
import { MUSIC_VIEW_TYPE, PLAY_MODES, SPEED_OPTIONS, blobOf, type PlayMode } from "./shared";
import { isAudioFile, isWindowsAbsolutePath, buildAudioSong, sidecarLrcPath } from "./songScanner";
import { resolveAudioSourceByPath, readMp3TagHead, readM4aTagHead, readAudioHeadBytes, parseTagsForPlugin, parseM4aTags, type AudioSource, type Mp3Tags } from "./tags";
import { estimateMp3DurationFromHead } from "./mp3Duration";
import { previewAudio, type DownloadSong } from "./downloadManager";
import { VirtualAudioPlayer } from "./virtualPlayer";
import type { VirtualPlayerState } from "./virtualPlayer";
import { DEFAULT_LYRIC_OFFSET, type MusicSettings, type SongGroups } from "./settings-types";

/** 侧边栏展示用的歌单项 */
export interface MusicSong {
  path: string;
  title: string;
  actor: string;
  /** 分类（来自音频标签 album） */
  type: string;
  banner: string;
  /** 解析出的音频路径，作为标签缓存 key */
  audioPath?: string;
  /** 文件大小（字节；富化时探测，本地列表胶囊展示用） */
  size?: number;
  /** 时长（秒；按文件头估算，本地列表胶囊展示用） */
  duration?: number;
}

/** 侧边栏歌词面板的播放状态 */
export interface MusicState {
  filePath: string;
  lyrics: import("./lrc").LyricsLine[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  karaoke: boolean;
  title?: string;
  actor?: string;
  duration?: number;
}

/** 递归枚举库外目录下所有音频文件（Windows 盘符绝对路径的音频文件夹用） */
async function listExternalAudioFiles(root: string): Promise<string[]> {
  try {
    const fs = (window as any).require("fs");
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries: any[] = [];
      try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = dir.replace(/[\\/]+$/, "") + "/" + e.name;
        if (e.isDirectory()) await walk(full);
        else if (e.isFile() && isAudioFile(e.name)) out.push(full);
      }
    };
    await walk(root.replace(/[\\/]+$/, ""));
    return out;
  } catch {
    return [];
  }
}

export class MusicManager {
  app: App;
  private plugin: Plugin & { settings: any; saveSettings(): Promise<void> };
  private musicSettings: MusicSettings;

  private state: MusicState | null = null;
  private stateListeners: ((state: MusicState | null) => void)[] = [];
  private songList: MusicSong[] = [];
  private songListListeners: (() => void)[] = [];
  /** 当前虚拟播放器（裸音频，单音轨不变量） */
  private player: VirtualAudioPlayer | null = null;
  /** 音频标签缓存：key = 音频路径 */
  private audioTagCache = new Map<string, Mp3Tags | null>();

  private _playMode: PlayMode = "off";
  private _playbackRate = 1;
  private _volume = 75;
  /** 乱序播放的洗牌队列：整张歌单随机播完一遍后才重新洗牌，避免隔几首又重复同一首 */
  private shuffleQueue: MusicSong[] = [];
  /** 歌单重扫防抖定时器（vault 事件高频触发时合并） */
  private scanTimer: number | null = null;
  /** 试听队列：从歌单/搜索列表发起的试听按播放模式续播（null=无队列，播完自然停止） */
  private previewQueue: DownloadSong[] | null = null;
  private previewQueueIndex = -1;
  /** 试听连续失败计数（加载失败/播放失败跳过累计；成功播放归零；达队列长度即停止） */
  private previewFailCount = 0;
  /** 音量持久化防抖定时器（滑条拖动高频触发） */
  private saveVolumeTimer: number | null = null;
  /** 歌词偏移持久化防抖定时器（滑条拖动高频触发） */
  private saveOffsetTimer: number | null = null;
  /** 歌单富化代际令牌：新 scan 使在途旧富化循环失效，避免旧结果污染新列表 */
  private enrichSeq = 0;
  /** 切歌代际令牌：新的 playSong 使旧的在途加载立即失效 */
  private playSeq = 0;
  /** 播放进度持久化节流定时器（timeupdate 高频触发，5s 写一次） */
  private progressTimer: number | null = null;

  constructor(app: App, plugin: Plugin & { settings: any; saveSettings(): Promise<void> }, musicSettings: MusicSettings) {
    this.app = app;
    this.plugin = plugin;
    this.musicSettings = musicSettings;
    this._playMode = PLAY_MODES.includes(musicSettings.playMode) ? musicSettings.playMode : "sequential";
    this._playbackRate = musicSettings.playbackRate ?? 1;
    this._volume = musicSettings.volume ?? 75;
  }

  getSettings(): MusicSettings {
    return this.musicSettings;
  }

  /** 设置页更新音乐配置后调用：刷新运行时引用 */
  updateSettings(settings: MusicSettings) {
    this.musicSettings = settings;
  }

  getKaraokeEnabled(): boolean {
    return this.musicSettings.karaoke;
  }

  // --- 播放状态分发 ---

  onLyricsStateChange(callback: (state: MusicState | null) => void) {
    this.stateListeners.push(callback);
  }

  removeLyricsStateListener(callback: (state: MusicState | null) => void) {
    this.stateListeners = this.stateListeners.filter((cb) => cb !== callback);
  }

  getState(): MusicState | null {
    return this.state;
  }

  /** 播放器/扫描流程推送状态给侧边栏 */
  emitState(state: VirtualPlayerState | MusicState | null) {
    this.state = state;
    this.stateListeners.forEach((cb) => cb(state));
  }

  // --- 播放控制 ---

  onPlayerPlay(player: VirtualAudioPlayer) {
    if (this.player === player) this.emitState(player.buildState());
  }

  onPlayerPause(player: VirtualAudioPlayer) {
    if (this.player === player) {
      this.persistProgress(player);
      if (this.progressTimer !== null) {
        clearTimeout(this.progressTimer);
        this.progressTimer = null;
      }
      this.emitState(player.buildState());
    }
  }

  /** 播放进度上报（timeupdate ~4 次/秒）：节流 5s 持久化一次，避免高频写 data.json */
  onPlaybackProgress(player: VirtualAudioPlayer) {
    if (this.player !== player) return;
    if (this.progressTimer !== null) return;
    this.progressTimer = window.setTimeout(() => {
      this.progressTimer = null;
      if (this.player) this.persistProgress(this.player);
    }, 5000);
  }

  /** 保存当前播放进度到设置（lastPlayed），供下次启动恢复。试听（preview: 路径）不记录 */
  private persistProgress(player: VirtualAudioPlayer) {
    if (player.path.startsWith("preview:")) return;
    const audio = player.player;
    let time = audio?.getTimeStamp() || 0;
    const dur = audio?.getDuration() || 0;
    // 播到末尾自然停止时记 0：恢复后点播放从头开始，而不是停在曲尾「点了没反应」
    if (dur > 0 && time >= dur - 0.25) time = 0;
    void this.persistPartial({ lastPlayed: { path: player.path, time } });
  }

  toggleActivePlayer() {
    this.player?.toggle();
  }

  seekActivePlayer(time: number) {
    this.player?.seek(time);
  }

  getPlayMode(): PlayMode {
    return this._playMode;
  }

  cyclePlayMode() {
    const idx = PLAY_MODES.indexOf(this._playMode);
    this._playMode = PLAY_MODES[(idx + 1) % PLAY_MODES.length];
    this.shuffleQueue = []; // 模式变化时重置洗牌队列
    void this.persistPartial({ playMode: this._playMode });
    this.emitState(this.state);
  }

  getPlaybackRate(): number {
    return this._playbackRate;
  }

  cyclePlaybackRate() {
    const idx = SPEED_OPTIONS.indexOf(this._playbackRate);
    this.setPlaybackRate(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  }

  /** 直接设定倍速（底栏倍速弹列表选择用），持久化 */
  setPlaybackRate(rate: number) {
    this._playbackRate = rate;
    this.player?.player?.setRate(rate);
    this.emitState(this.state);
    void this.persistPartial({ playbackRate: rate });
  }

  getVolume(): number {
    return this._volume;
  }

  setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(100, vol));
    this.player?.player?.setVolume(this._volume / 100);
    this.emitState(this.state);
    // 音量持久化（防抖，避免滑条拖动高频写 data.json）
    if (this.saveVolumeTimer !== null) clearTimeout(this.saveVolumeTimer);
    this.saveVolumeTimer = window.setTimeout(() => {
      this.saveVolumeTimer = null;
      void this.persistPartial({ volume: this._volume });
    }, 300);
  }

  /** 只把音乐模块的可写项合并回插件设置并保存 */
  private async persistPartial(patch: Partial<MusicSettings>) {
    Object.assign(this.musicSettings, patch);
    await this.plugin.saveSettings();
  }

  /** 歌词偏移（毫秒，负值=歌词提前）：未微调过的歌用默认负偏移抵消残余延迟 */
  getLyricOffset(path: string): number {
    return this.musicSettings.lyricOffsets?.[path] ?? DEFAULT_LYRIC_OFFSET;
  }

  // --- 本地歌单自定义分组（存 data.json 的 music.songGroups，无额外文件） ---

  getSongGroups(): string[] {
    return this.musicSettings.songGroups?.order ?? [];
  }

  /** 歌曲所属分组；未归组返回 null */
  getSongGroup(path: string): string | null {
    return this.musicSettings.songGroups?.assign?.[path] ?? null;
  }

  /** 新建分组：空名/重名返回 false（由调用方提示） */
  createSongGroup(raw: string): boolean {
    const name = raw.trim();
    if (!name) return false;
    const sg = this.ensureSongGroups();
    if (sg.order.includes(name)) return false;
    sg.order.push(name);
    void this.persistPartial({ songGroups: sg });
    return true;
  }

  /** 歌曲指派到分组（组不存在则顺带创建）；group 为 null 移出分组 */
  setSongGroup(path: string, group: string | null) {
    if (!path) return;
    const sg = this.ensureSongGroups();
    if (group) {
      const name = group.trim();
      if (!name) return;
      if (!sg.order.includes(name)) sg.order.push(name);
      sg.assign[path] = name;
    } else {
      delete sg.assign[path];
    }
    void this.persistPartial({ songGroups: sg });
  }

  /** 重命名分组（连带更新成员归属）；新名空/重名/原组不存在返回 false */
  renameSongGroup(oldName: string, raw: string): boolean {
    const name = raw.trim();
    const sg = this.ensureSongGroups();
    if (!name || !sg.order.includes(oldName) || sg.order.includes(name)) return false;
    sg.order = sg.order.map((g) => (g === oldName ? name : g));
    for (const [p, g] of Object.entries(sg.assign)) {
      if (g === oldName) sg.assign[p] = name;
    }
    void this.persistPartial({ songGroups: sg });
    return true;
  }

  /** 拖拽排序：按给定顺序重写组序列；未涵盖的既有组追加到末尾防丢 */
  reorderSongGroups(order: string[]) {
    const sg = this.ensureSongGroups();
    const known = new Set(sg.order);
    const next = order.filter((g) => known.has(g));
    for (const g of sg.order) {
      if (!next.includes(g)) next.push(g);
    }
    sg.order = next;
    void this.persistPartial({ songGroups: sg });
  }

  // --- 本地歌单自定义排序（侧边栏拖拽调整歌曲顺序，存 data.json 的 music.songOrder） ---

  /** 本地歌单排序：自定义顺序（songOrder）优先，未列入的按标题排在其后。
   *  重扫与富化后的重排都走这里，拖拽调整过的顺序不会被覆盖 */
  private sortSongs(songs: MusicSong[]): MusicSong[] {
    const order = this.musicSettings.songOrder ?? [];
    if (order.length === 0) return songs.sort((a, b) => a.title.localeCompare(b.title));
    const rank = new Map(order.map((p, i) => [p, i]));
    return songs.sort((a, b) => {
      const ra = rank.get(a.path);
      const rb = rank.get(b.path);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1; // 自定义过的排在没自定义的前面
      if (rb !== undefined) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  /** 写回拖拽后的自定义顺序：只保留歌单里仍存在的路径（顺带清理已删除歌曲的残留），
   *  并立即按新顺序重排 songList（顺序播放模式的切歌顺序随之改变）。
   *  不派发 songList 变更——调用方（侧边栏）的 DOM 已经是新顺序，重渲染只会打断滚动 */
  setSongOrder(paths: string[]) {
    const known = new Set(this.songList.map((s) => s.path));
    const cleaned = paths.filter((p) => known.has(p));
    this.musicSettings.songOrder = cleaned;
    this.sortSongs(this.songList);
    void this.persistPartial({ songOrder: cleaned });
  }

  /** 同步网易云歌单到本地后标记（侧边栏默认打开账号歌单标签） */
  async markAccountPlaylistsSynced(): Promise<void> {
    await this.persistPartial({ neteasePlaylistSynced: true });
  }

  /** 试听临时歌词（内存态）：挂在当前试听播放器上显示，不写任何文件；无试听时返回 false */
  applyPreviewLyrics(text: string): boolean {
    if (!this.player || !this.player.path.startsWith("preview:")) return false;
    this.player.setLyrics(text);
    this.emitState(this.player.buildState());
    return true;
  }

  /** 试听接管播放位：用主播放器播放在线试听音频（Blob URL）——底栏播放/暂停/进度/音量、
   *  歌词面板全部适用；本地歌曲开始播放时本播放器照常被 playSong 销毁。
   *  blobUrl 生命周期移交播放器（销毁时 revoke）；key 用于合成 preview: 播放路径。
   *  queue/index 为试听队列（发起时的曲目列表与位置），播完按播放模式续播 */
  async playPreview(
    songName: string,
    artist: string,
    blobUrl: string,
    key: string,
    queue?: DownloadSong[],
    queueIndex?: number,
  ): Promise<void> {
    if (queue && queue.length > 0) {
      this.previewQueue = queue;
      this.previewQueueIndex = Math.max(0, Math.min(queueIndex ?? 0, queue.length - 1));
    }
    const mySeq = ++this.playSeq;
    await this.stopCurrentPlayer();
    if (mySeq !== this.playSeq) return;
    const player = new VirtualAudioPlayer(this, `preview:${key}`, { type: "blob", url: blobUrl });
    player.setMetadata(songName, artist);
    // 音频加载/解码失败（VIP 占位字节过不了解码等）：按播放模式跳队列下一首
    let errored = false;
    const mySeqCaptured = mySeq;
    player.onAudioError = () => {
      if (mySeqCaptured !== this.playSeq || this.player !== player) return;
      errored = true;
      this.previewFailCount++;
      const queue = this.previewQueue;
      if (queue && this.previewFailCount < queue.length) {
        new Notice(`「${songName}」无法播放，已自动跳过`, 4000);
        const idx = this.nextPreviewIndexAfter(this.previewQueueIndex, queue);
        void this.continuePreview(queue[idx], idx);
        return;
      }
      new Notice("试听音频无法播放", 5000);
      this.previewQueue = null;
      this.emitState(null);
    };
    this.player = player;
    await player.init();
    if (mySeq !== this.playSeq) return;
    const audio = this.player.player;
    if (!audio) return;
    // 播放启动偶发未生效（play() 已决议但 paused 仍为真，或启动后被意外暂停）：
    // 分两段短暂等待复查，未出声自动重试拉起；仍失败提示用底栏播放键恢复
    let started = await audio.play();
    for (const delay of [150, 400]) {
      if (!started || errored) break;
      await new Promise((r) => window.setTimeout(r, delay));
      if (!audio.paused()) break; // 正常播放中
      started = await audio.play();
    }
    if (started) this.previewFailCount = 0; // 成功出声：连续失败计数归零
    if (!started && !errored) new Notice("试听已就绪：点击底栏播放键开始播放", 5000);
    this.emitState(player.buildState());
  }

  /** 试听播完的续播目标：单曲循环=本曲重播（试听缓存秒开）；顺序=队列下一首（循环）；
   *  乱序=队列内随机换一首；关闭=无（自然停止） */
  private getNextPreviewTrack(): { song: DownloadSong; index: number } | null {
    const queue = this.previewQueue;
    if (!queue || queue.length === 0) return null;
    const cur = Math.max(0, Math.min(this.previewQueueIndex, queue.length - 1));
    switch (this._playMode) {
      case "single":
        return { song: queue[cur], index: cur };
      case "shuffle": {
        if (queue.length === 1) return { song: queue[0], index: 0 };
        let idx = cur;
        while (idx === cur) idx = Math.floor(Math.random() * queue.length);
        return { song: queue[idx], index: idx };
      }
      case "sequential":
        return { song: queue[(cur + 1) % queue.length], index: (cur + 1) % queue.length };
      case "off":
      default:
        return null;
    }
  }

  /** 试听队列的上一首目标（底栏「上一首」手动切歌用，语义对齐 getNextPreviewTrack）：
   *  单曲循环=本曲；顺序=队列上一首（循环）；乱序=队列内随机换一首；关闭=无 */
  private getPrevPreviewTrack(): { song: DownloadSong; index: number } | null {
    const queue = this.previewQueue;
    if (!queue || queue.length === 0) return null;
    const cur = Math.max(0, Math.min(this.previewQueueIndex, queue.length - 1));
    switch (this._playMode) {
      case "single":
        return { song: queue[cur], index: cur };
      case "shuffle": {
        if (queue.length === 1) return { song: queue[0], index: 0 };
        let idx = cur;
        while (idx === cur) idx = Math.floor(Math.random() * queue.length);
        return { song: queue[idx], index: idx };
      }
      case "sequential": {
        const prev = (cur - 1 + queue.length) % queue.length;
        return { song: queue[prev], index: prev };
      }
      case "off":
      default:
        return null;
    }
  }

  /** 设置试听队列（首点失败跳过前由视图调用，建立失败跳过的队列上下文） */
  setPreviewQueue(queue: DownloadSong[], index: number): void {
    this.previewQueue = queue;
    this.previewQueueIndex = Math.max(0, Math.min(index, queue.length - 1));
    this.previewFailCount = 0;
  }

  /** 失败跳过时的推进：按播放模式从失败曲目走到下一首（单曲循环失败也跳下一首，避免反复重试坏歌） */
  nextPreviewIndexAfter(cur: number, queue: DownloadSong[]): number {
    if (queue.length === 0) return cur;
    switch (this._playMode) {
      case "shuffle": {
        if (queue.length === 1) return cur;
        let idx = cur;
        while (idx === cur) idx = Math.floor(Math.random() * queue.length);
        return idx;
      }
      case "single":
      case "sequential":
      default:
        return (cur + 1) % queue.length;
    }
  }

  /** 拉取并播放试听队列中的指定曲目（续播/首点失败跳过共用；字节命中试听缓存/客户端缓存即秒开）。
   *  加载失败（VIP 受限/版权等）自动按播放模式跳下一首；整队列都失败才停止 */
  async continuePreview(song: DownloadSong, index: number): Promise<void> {
    const queue = this.previewQueue;
    if (!queue || queue.length === 0) return;
    const key = `${song.source}:${song.id}`;
    const mySeq = ++this.playSeq;
    const res = await previewAudio(song, this.getSettings().platformCookies,
      undefined, this.getSettings().neteaseCacheFolder);
    if (mySeq !== this.playSeq) return; // 拉取期间已被新的播放打断
    if (!res.ok || !res.data) {
      this.previewFailCount++;
      if (this.previewFailCount >= queue.length) {
        new Notice(`试听队列中 ${this.previewFailCount} 首歌曲均无法加载，已停止`, 6000);
        this.previewQueue = null;
        this.emitState(null);
        return;
      }
      new Notice(`「${song.name}」无法加载，已自动跳过`, 4000);
      const idx = this.nextPreviewIndexAfter(index, queue);
      await this.continuePreview(queue[idx], idx);
      return;
    }
    const mime = res.ext === "m4a" ? "audio/mp4" : res.ext === "flac" ? "audio/flac" : "audio/mpeg";
    const blobUrl = URL.createObjectURL(blobOf(res.data, mime));
    await this.playPreview(song.name, song.artist, blobUrl, key, queue, index);
  }

  /** 删除分组：只解散分组，成员歌曲回到未分组 */
  deleteSongGroup(name: string) {
    const sg = this.ensureSongGroups();
    sg.order = sg.order.filter((g) => g !== name);
    for (const [p, g] of Object.entries(sg.assign)) {
      if (g === name) delete sg.assign[p];
    }
    void this.persistPartial({ songGroups: sg });
  }

  /** 惰性补齐 songGroups 结构（旧 data.json 无此字段 / 字段不完整） */
  private ensureSongGroups(): SongGroups {
    if (!this.musicSettings.songGroups) this.musicSettings.songGroups = { order: [], assign: {} };
    if (!this.musicSettings.songGroups.order) this.musicSettings.songGroups.order = [];
    if (!this.musicSettings.songGroups.assign) this.musicSettings.songGroups.assign = {};
    return this.musicSettings.songGroups;
  }

  /** 滑块微调当前歌的歌词偏移：即时重定位高亮（暂停时同样生效），防抖持久化 */
  setLyricOffset(path: string, ms: number) {
    if (!path) return;
    const clamped = Math.max(-2000, Math.min(2000, Math.round(ms)));
    if (!this.musicSettings.lyricOffsets) this.musicSettings.lyricOffsets = {};
    this.musicSettings.lyricOffsets[path] = clamped;
    this.player?.refreshHighlight();
    if (this.saveOffsetTimer !== null) clearTimeout(this.saveOffsetTimer);
    this.saveOffsetTimer = window.setTimeout(() => {
      this.saveOffsetTimer = null;
      void this.persistPartial({ lyricOffsets: this.musicSettings.lyricOffsets });
    }, 400);
  }

  /** 一首歌播完：按播放模式决定循环/切歌/自然停止 */
  handleSongEnded(player: VirtualAudioPlayer) {
    // 试听播完：按播放模式在试听队列内续播（单曲循环重播本曲/顺序下一首/乱序随机），关闭则自然停止
    if (player.path.startsWith("preview:")) {
      const next = this.getNextPreviewTrack();
      if (next) {
        void this.continuePreview(next.song, next.index);
        return;
      }
      this.previewQueue = null;
      this.emitState(player.buildState());
      return;
    }
    switch (this._playMode) {
      case "single":
        // 自然结束时音频已暂停：seek 后必须显式续播，否则单曲循环播完一遍就停
        player.player?.seek(0);
        void player.player?.play();
        break;
      case "sequential":
      case "shuffle": {
        const next = this.getNextSong(player.path);
        if (next && next.path !== player.path) {
          void this.playSong(next);
        } else {
          // 歌单仅 1 首：等效单曲循环（同样需要显式续播）
          player.player?.seek(0);
          void player.player?.play();
        }
        break;
      }
      case "off":
      default:
        break; // 仅兼容旧数据，正常不可达（切换已收敛为三种循环模式）
    }
  }

  /** 播放指定歌曲：销毁旧播放器 → 创建新虚拟播放器 → 自动播放 */
  async playSong(song: MusicSong) {
    const mySeq = ++this.playSeq;
    await this.stopCurrentPlayer();
    if (mySeq !== this.playSeq) return; // 已被更新的切歌取代

    const src = resolveAudioSourceByPath(this.app, song.path);
    if (!src) {
      new Notice(`找不到音频文件：${song.path}`, 4000);
      this.emitState(null);
      return;
    }
    const player = new VirtualAudioPlayer(this, song.path, src);
    player.setMetadata(song.title, song.actor);
    this.player = player;
    await player.init();
    if (mySeq !== this.playSeq) return;
    if (player.player && player.player.paused()) {
      // 富化标签可能晚于播放器就绪：以富化结果为准刷新标题
      this.syncPlayerMetadata(player, song);
      void player.player.play();
    }
    this.persistProgress(player); // 切歌立即记录新歌（进度 0），退出时恢复的总是当前选中歌曲
    this.emitState(player.buildState());
  }

  /** 启动时恢复上次播放：定位到上次进度但保持暂停（歌曲已不在歌单则跳过） */
  async restoreLastPlayed() {
    const last = this.musicSettings.lastPlayed;
    if (!last?.path) return;
    if (this.player) return; // 首扫完成前用户已手动播放，不打扰
    const song = this.songList.find((s) => s.path === last.path);
    if (!song) return;
    const mySeq = ++this.playSeq;
    await this.stopCurrentPlayer();
    if (mySeq !== this.playSeq) return; // 启动间隙用户已手动切歌
    const src = resolveAudioSourceByPath(this.app, song.path);
    if (!src) return;
    const player = new VirtualAudioPlayer(this, song.path, src);
    player.setMetadata(song.title, song.actor);
    this.player = player;
    await player.init();
    if (mySeq !== this.playSeq) return;
    this.syncPlayerMetadata(player, song);
    if (last.time > 0 && player.player) {
      // 元数据就绪后才能安全 seek；等待期间用户切歌则放弃
      await player.player.whenReady();
      if (mySeq !== this.playSeq) return;
      player.seek(last.time);
    }
    this.emitState(player.buildState());
    // 关闭前在放歌但重启后音乐标签页丢失（工作区重载未保存等）：静默补挂载
    void this.ensureViewLoaded();
  }

  /** 用富化后的歌单项元数据同步播放器标题/作者 */
  private syncPlayerMetadata(player: VirtualAudioPlayer, song: MusicSong) {
    player.setMetadata(song.title, song.actor);
  }

  /** 停止并销毁当前虚拟播放器 */
  private async stopCurrentPlayer() {
    if (this.player) {
      const old = this.player;
      this.player = null;
      await old.onunload();
    }
  }

  /** 停止所有播放（切换歌单来源等场景） */
  async stopAllPlayback() {
    this.playSeq++; // 使在途切歌立即失效
    this.previewQueue = null; // 试听队列一并作废
    this.previewFailCount = 0;
    await this.stopCurrentPlayer();
    this.emitState(null);
  }

  // --- 歌单管理 ---

  async scanLyricSongs(): Promise<void> {
    const songs: MusicSong[] = [];
    const audioFolder = (this.musicSettings.audioFolder || "").trim();
    if (audioFolder) {
      if (isWindowsAbsolutePath(audioFolder)) {
        // 库外盘符绝对路径：用 fs 递归枚举音频文件（仅桌面端）
        if (Platform.isDesktopApp) {
          const externalPaths = await listExternalAudioFiles(audioFolder);
          songs.push(...externalPaths.map((p) => buildAudioSong(p)));
        }
      } else {
        // 精确前缀匹配：folder + '/'，避免 folder='Music' 误收 'Music-2024/...' 等同前缀兄弟路径
        const audioPrefix = audioFolder.replace(/\/+$/, "") + "/";
        const allFiles = this.app.vault.getFiles();
        const audioSongs = allFiles
          .filter((f) => f.path.startsWith(audioPrefix) && isAudioFile(f.path))
          .map((f) => buildAudioSong(f.path));
        songs.push(...audioSongs);
      }
    }
    this.songList = this.sortSongs(songs);
    this.shuffleQueue = []; // 歌单变化时重置洗牌队列
    this.audioTagCache.clear(); // 重扫时清理标签缓存，反映外部改动的标签
    // 当前播放歌曲不在新歌单（切换来源/改文件夹甩出）→ 停止播放，避免残留。
    // 试听（preview: 合成路径）不参与歌单，扫描不应打断试听
    const currentPath = this.player?.path ?? null;
    const currentStillInList = currentPath
      ? currentPath.startsWith("preview:") || this.songList.some((s) => s.path === currentPath)
      : true;
    if (!currentStillInList) {
      await this.stopAllPlayback();
    }
    // 外部改动音频文件（vault 事件触发重扫）时，正在播放的歌曲检测 mtime 变化并重读内嵌歌词
    if (this.player) {
      void this.player.reloadLyricsIfChanged();
    }
    this.songListListeners.forEach((cb) => cb());
    this.enrichSongList(); // 异步富化，不阻塞
  }

  /** 异步富化歌单：音频标签优先覆盖 title/actor；结果缓存，供歌单封面使用。
   *  并发限制 6 路读文件头，避免大歌单串行 IO；完成后一次性通知。 */
  private async enrichSongList() {
    const mySeq = ++this.enrichSeq;
    const songs = this.songList;
    const CONCURRENCY = 6;
    let cursor = 0;
    const worker = async () => {
      while (cursor < songs.length) {
        if (mySeq !== this.enrichSeq) return; // 歌单已被更新，旧富化立即失效
        const song = songs[cursor++];
        await this.enrichOne(song);
      }
    };
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, songs.length) },
      () => worker(),
    );
    await Promise.all(workers);
    if (mySeq === this.enrichSeq) {
      // 富化后按标签标题优先重排（有标签标题用标签标题；无标签用文件名）；自定义顺序优先
      this.songList = this.sortSongs([...songs]);
      this.songListListeners.forEach((cb) => cb());
      // 标签编辑/重扫后同步正在播放的歌曲元数据，使状态栏标题/作者实时刷新
      this.syncPlayingMetadata();
    }
  }

  /** 富化单首歌：探测大小/时长 → 读 ID3 头部（M4A 走 moov 定位读）→ 缓存标签 → 覆盖 title/actor */
  private async enrichOne(song: MusicSong): Promise<void> {
    const key = song.audioPath ?? "";
    if (!key) return;
    const src = resolveAudioSourceByPath(this.app, key);
    if (!src) {
      song.audioPath = key; // 保持 key，避免重复尝试 resolve
      return;
    }
    // 大小/时长：与标签缓存解耦——重扫会重建歌单项对象，需每次补齐（本地列表胶囊展示用）
    await this.probeAudioMeta(song, src, key);
    if (this.audioTagCache.has(key)) return;
    // 按真实格式分派：m4a 走 moov 定位读 + 自研解析（readMp3TagHead/parseTagsForPlugin 只认 MP3 ID3）
    const isM4a = /\.m4a$/i.test(key);
    const head = isM4a ? await readM4aTagHead(this.app, src) : await readMp3TagHead(this.app, src);
    const tags = head ? (isM4a ? parseM4aTags(head) : parseTagsForPlugin(head)) : null;
    this.audioTagCache.set(key, tags);
    // 音频标签覆盖 title/artist/album
    if (tags?.title) song.title = tags.title;
    if (tags?.artist) song.actor = tags.artist;
    if (tags?.album) song.type = tags.album;
  }

  /** 探测文件大小与时长：大小取文件 stat；mp3 时长按文件头估算（Xing 帧数或 CBR 推算，不读全文件） */
  private async probeAudioMeta(song: MusicSong, src: AudioSource, key: string): Promise<void> {
    try {
      if (src.type === "vault" && src.file) {
        song.size = src.file.stat.size;
      } else if (src.type === "external" && src.path) {
        const fs = (window as any).require("fs");
        song.size = (await fs.promises.stat(src.path)).size;
      }
      if (song.size && /\.mp3$/i.test(key)) {
        const headBytes = await readAudioHeadBytes(this.app, src);
        if (headBytes) {
          const sec = estimateMp3DurationFromHead(headBytes, song.size);
          if (sec && sec > 0) song.duration = Math.round(sec);
        }
      }
    } catch { /* 探测失败不影响富化 */ }
  }

  /** 标签编辑/重扫后同步正在播放的歌曲元数据，使状态栏标题/作者实时刷新 */
  private syncPlayingMetadata() {
    if (!this.player) return;
    const song = this.songList.find((s) => s.path === this.player!.path);
    if (song) {
      this.player.setMetadata(song.title, song.actor);
      this.emitState(this.player.buildState());
    }
  }

  /** 取某歌曲的音频封面（无则 null） */
  public getAudioCover(song: MusicSong): { mime: string; data: Uint8Array } | null {
    if (!song.audioPath) return null;
    return this.audioTagCache.get(song.audioPath)?.cover ?? null;
  }

  /** 取音频标签缓存（无则 null） */
  public getAudioTags(song: MusicSong): Mp3Tags | null {
    return song.audioPath ? this.audioTagCache.get(song.audioPath) ?? null : null;
  }

  /** 供弹窗保存后刷新列表（清除该歌缓存 + 重新扫描）；编辑的是正在播放的歌曲时实时重读内嵌歌词 */
  public notifyTagsEdited(audioPath: string) {
    if (audioPath) this.audioTagCache.delete(audioPath);
    const state = this.getState();
    if (state && this.player && this.player.path === audioPath) {
      void this.player.reloadLyrics();
    }
    void this.scanLyricSongs();
  }

  /** 删除音频文件后调用：若删除的正是当前播放的歌曲则停止播放；随后重扫歌单 */
  public async handleAudioDeleted(audioPath: string): Promise<void> {
    if (this.player && this.player.path === audioPath) {
      await this.stopAllPlayback();
    }
    await this.scanLyricSongs();
  }

  public getSongList(): MusicSong[] {
    return this.songList;
  }

  public onSongListChange(callback: () => void) {
    this.songListListeners.push(callback);
  }

  public removeSongListListener(callback: () => void) {
    this.songListListeners = this.songListListeners.filter((cb) => cb !== callback);
  }

  /** 顺序播放的取歌范围：歌曲属于某个已建分组时限定在该分组内（按列表顺序），
   *  否则（未分组 / 没建任何分组 / 分组已不存在）为整张歌单。
   *  分组内的相对顺序 = songList 的当前顺序过滤出该组的歌，与侧边栏分组区块的展示顺序一致
   *  （自定义拖拽排序已作用在 songList 上，因此拖过的顺序在这里同样生效） */
  private sequentialScope(currentPath: string): MusicSong[] {
    const groups = this.getSongGroups();
    if (groups.length === 0) return this.songList;
    const group = this.getSongGroup(currentPath);
    if (!group || !groups.includes(group)) return this.songList;
    const inGroup = this.songList.filter((s) => this.getSongGroup(s.path) === group);
    return inGroup.length > 0 ? inGroup : this.songList;
  }

  public getNextSong(currentPath: string): MusicSong | null {
    if (this.songList.length === 0) return null;
    switch (this._playMode) {
      case "single":
        return this.songList.find((s) => s.path === currentPath) || this.songList[0];
      case "shuffle": {
        // 洗牌队列：整张歌单随机播完一遍后才重新洗牌
        if (this.shuffleQueue.length === 0) {
          this.buildShuffleQueue(currentPath);
        }
        return this.shuffleQueue.shift() ?? null;
      }
      case "sequential":
      case "off":
      default: {
        // 顺序播放：歌曲在某分组内时只在该分组里循环（末首回到首首），否则走整张歌单
        const scope = this.sequentialScope(currentPath);
        const idx = scope.findIndex((s) => s.path === currentPath);
        if (idx === -1) return scope[0];
        return scope[(idx + 1) % scope.length];
      }
    }
  }

  public getPrevSong(currentPath: string): MusicSong | null {
    if (this.songList.length === 0) return null;
    switch (this._playMode) {
      case "single":
        return this.songList.find((s) => s.path === currentPath) || this.songList[0];
      case "shuffle": {
        const idx = this.songList.findIndex((s) => s.path === currentPath);
        if (this.songList.length === 1) return this.songList[0];
        let rand = idx;
        while (rand === idx) {
          rand = Math.floor(Math.random() * this.songList.length);
        }
        return this.songList[rand];
      }
      default: {
        // 与 getNextSong 同一范围：分组内循环（首首的上一首 = 该组末首）
        const scope = this.sequentialScope(currentPath);
        const idx = scope.findIndex((s) => s.path === currentPath);
        if (idx === -1) return scope[scope.length - 1];
        return scope[(idx - 1 + scope.length) % scope.length];
      }
    }
  }

  /** 按方向切歌（底栏上一首/下一首按钮与快捷键共用；1=下一首，-1=上一首）。
   *  试听会话在试听队列内前后移动（与播完自动续播同一套队列语义，避免误切到本地歌单）；
   *  本地会话走本地歌单；无播放器/无可切目标时静默忽略 */
  stepSong(dir: 1 | -1): void {
    if (this.player?.path.startsWith("preview:")) {
      const next = dir === 1 ? this.getNextPreviewTrack() : this.getPrevPreviewTrack();
      if (next) void this.continuePreview(next.song, next.index);
      return;
    }
    const path = this.player?.path ?? "";
    const next = dir === 1 ? this.getNextSong(path) : this.getPrevSong(path);
    if (!next) return;
    void this.playSong(next);
  }

  /** 生成洗牌队列：整张歌单 Fisher-Yates 打乱，每首播一遍后才重复；队首避免是当前歌曲 */
  private buildShuffleQueue(excludePath?: string): void {
    const songs = [...this.songList];
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }
    if (excludePath && songs.length > 1 && songs[0]?.path === excludePath) {
      const [first] = songs.splice(0, 1);
      songs.push(first);
    }
    this.shuffleQueue = songs;
  }

  // --- 生命周期 ---

  registerVaultEvents() {
    // vault 事件防抖：新建/删除/改名高频触发时合并为一次重扫
    const plugin = this.plugin;
    plugin.registerEvent(this.app.vault.on("create", () => this.scheduleScan()));
    plugin.registerEvent(this.app.vault.on("delete", () => this.scheduleScan()));
    plugin.registerEvent(this.app.vault.on("rename", () => this.scheduleScan()));
    // 编辑侧车 .lrc（当前播放歌曲的）即时刷新歌词，不走全量重扫（避免每次保存笔记清空标签缓存）
    plugin.registerEvent(this.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile)) return;
      if (!/\.lrc$/i.test(file.path)) return;
      if (this.player && sidecarLrcPath(this.player.path) === file.path) {
        void this.player.reloadLyrics();
      }
    }));
  }

  /** 歌单重扫防抖：300ms 内多次事件只执行一次 */
  private scheduleScan() {
    if (this.scanTimer !== null) clearTimeout(this.scanTimer);
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      void this.scanLyricSongs();
    }, 300);
  }

  /** 重新读取当前歌曲歌词（侧车 .lrc 写入后调用，按当前播放位置对齐新歌词） */
  reloadCurrentLyrics() {
    void this.player?.reloadLyrics();
  }

  /** 打开侧边栏音乐面板 */
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(MUSIC_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const rightLeaf = this.app.workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({ type: MUSIC_VIEW_TYPE, active: true });
    }
  }

  /** 静默挂载音乐面板标签页：不展开侧栏、不抢占当前激活标签（区别于 activateView 的 reveal）。
   *  getRightLeaf(true) 新建一个标签，避免 setViewState 覆盖右栏已有其他插件视图 */
  async ensureViewLoaded() {
    const existing = this.app.workspace.getLeavesOfType(MUSIC_VIEW_TYPE);
    if (existing.length > 0) return;
    const rightLeaf = this.app.workspace.getRightLeaf(true);
    if (rightLeaf) {
      await rightLeaf.setViewState({ type: MUSIC_VIEW_TYPE });
    }
  }

  onunload() {
    if (this.scanTimer !== null) clearTimeout(this.scanTimer);
    if (this.saveVolumeTimer !== null) clearTimeout(this.saveVolumeTimer);
    if (this.saveOffsetTimer !== null) clearTimeout(this.saveOffsetTimer);
    if (this.progressTimer !== null) clearTimeout(this.progressTimer);
    // 退出前保存播放进度（恢复用）；随后停止播放：虚拟播放器宿主挂在 document.body 而非
    // Obsidian 视图，禁用插件不会自动触发卸载，需显式暂停播放器并移除 DOM，否则音频继续播放
    if (this.player) this.persistProgress(this.player);
    void this.stopCurrentPlayer();
    this.stateListeners = [];
    this.songListListeners = [];
    this.state = null;
  }
}

/** 供类型引用：AudioSource 的 vault 文件类型 */
export type { AudioSource };
