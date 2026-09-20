/**
 * 侧边栏音乐面板：双面板结构 —— 歌单面板（默认显示）与歌词面板，底栏提供「歌单/歌词」切换入口。
 * 歌单面板内含三个标签页（本地歌曲 / 在线歌曲 / 推荐歌单），共享顶部搜索框与分类下拉：
 * - 本地歌曲：音频文件夹歌单（搜索 + 按专辑筛选）
 * - 在线歌曲：四平台实时搜索（按关键词相关度排序），行内试听 / 下载
 * - 推荐歌单：四源推荐歌单胶囊切换，点歌单查看歌曲并逐首下载
 * 通过 MusicManager 的公开 API 交互，仅订阅状态，无运行时循环依赖。
 */
import { ItemView, Menu, Modal, Notice, setIcon, TFile, type WorkspaceLeaf } from "obsidian";
import { MUSIC_VIEW_TYPE, MUSIC_SOURCES, SOURCE_LABELS, SPEED_OPTIONS, type MusicSource, type PlayMode } from "./shared";
import type { MusicManager, MusicSong, MusicState } from "./manager";
import type { LyricsLine } from "./lrc";
import { WORD_SPLIT_REGEX } from "./lrc";
import { blobOf } from "./shared";
import { basenameNoExt, isWindowsAbsolutePath, writeSidecarLrc } from "./songScanner";
import { buildSongFilename, formatDuration, songSimilarityScore } from "./downloadUtils";
import { formatBytes } from "./tagSize";
import { searchCandidates, downloadSong, fetchRecommendedPlaylists, fetchPlaylistSongs, fetchNeteaseAccountPlaylists, fetchNeteaseCloudIndex, localSongExists, previewAudio, fetchSongLyrics, type DownloadSong, type RecommendedPlaylist, type PlaylistSource, type NeteaseCloudIndex } from "./downloadManager";
import { resolveAudioSourceByPath, type AudioSource } from "./tags";
import TagEditorModal from "./tagEditorModal";

/** setIcon 只在图标变化时执行。状态栏/悬浮按钮的图标随每次状态推送（播放中 ~4 次/秒）重设，
 *  若每次都重建 svg：按压按钮的瞬间（mousedown→mouseup 之间）恰逢推送，正被按住的 svg 节点
 *  被移出 DOM，浏览器不再为该次按压派发 click——表现为「按钮有时按不动/弹窗弹不出来」 */
const lastIcons = new WeakMap<HTMLElement, string>();
function setIconIfChanged(el: HTMLElement, icon: string) {
  if (lastIcons.get(el) === icon) return;
  lastIcons.set(el, icon);
  setIcon(el, icon);
}
import TagViewerModal from "./tagViewerModal";

/** 面板视图模式：歌单（默认）/ 歌词 */
type ViewMode = "songs" | "lyrics";
/** 歌单面板标签页：本地歌曲（默认）/ 在线歌曲 / 推荐歌单 */
type ListTab = "account" | "online" | "local";

/** 实时在线搜索防抖时长（毫秒） */
const ONLINE_SEARCH_DEBOUNCE_MS = 300;

/** 无封面时的占位：灰底方形 + 音符图标 */
function renderCoverPlaceholder(el: HTMLElement): void {
  el.empty();
  el.addClass("gm-download-item-cover-placeholder");
  setIcon(el, "music");
}

export default class MusicView extends ItemView {
  private plugin: MusicManager;
  private lyricsEl: HTMLElement | null = null;
  private playPauseBtn: HTMLElement | null = null;
  private lyricsPanel: HTMLElement | null = null;
  /** 当前显示的面板（默认歌单） */
  private viewMode: ViewMode = "songs";

  private statusBar: HTMLElement | null = null;
  /** 歌单/歌词切换按钮：歌单面板与歌词面板的标题栏各一个，状态同步渲染 */
  private viewToggleBtns: HTMLElement[] = [];
  private statusBarTitle: HTMLElement | null = null;
  private statusBarTime: HTMLElement | null = null;
  private statusBarPlay: HTMLElement | null = null;
  /** 底栏上一首/下一首（与播放键同组，同一样式类） */
  private statusBarPrev: HTMLElement | null = null;
  private statusBarNext: HTMLElement | null = null;
  private statusBarMode: HTMLElement | null = null;
  private statusBarSpeed: HTMLElement | null = null;
  private statusBarVolume: HTMLElement | null = null;
  /** 第二行可拖动进度条（联动播放进度；拖动中不回写 value） */
  private seekSlider: HTMLInputElement | null = null;
  private scrubbing = false;

  /** 歌单面板（常驻，与歌词面板二选一显示） */
  private songPane: HTMLElement | null = null;
  /** 歌词面板标题栏的歌词行数计数 */
  private lyricsCountEl: HTMLElement | null = null;
  /** 标签页内容区（本地列表 / 在线结果 / 推荐歌单共用滚动容器） */
  private tabContent: HTMLElement | null = null;
  private songListSearchEl: HTMLInputElement | null = null;
  private categorySelectEl: HTMLSelectElement | null = null;
  private tabButtons = new Map<ListTab, HTMLElement>();
  /** 当前标签页（默认本地歌曲） */
  private listTab: ListTab = "local";
  /** 本地列表的专辑类型筛选；在线/推荐标签的平台筛选共用 onlineSourceFilter */
  private songListTypeFilter: string = "all";
  private onlineSourceFilter: string = "all";
  private songListCountEl: HTMLElement | null = null;
  private songCoverUrls = new Map<string, string>(); // song.path → 音频封面 blob URL

  private statusBarVolumeIcon: HTMLElement | null = null;
  /** 底栏「定位当前歌曲」按钮 */
  private statusBarLocate: HTMLElement | null = null;
  private volumePopup: HTMLElement | null = null;
  private volumeOutsideClickHandler: ((e: MouseEvent) => void) | null = null;

  /** 侧边栏歌词增量渲染：记录上次渲染的歌词数组引用与当前行索引，判断是否需要重建 DOM */
  private lastLyricsRef: LyricsLine[] | null = null;
  private lastCurrentIndex: number = -1;
  /** 上次渲染时的 karaoke 开关：播放中切换开关需强制重建（实时 karaoke 切换） */
  private lastKaraoke: boolean = false;
  /** 当前高亮行的元素（karaoke 逐字高亮更新用） */
  private currentHighlightedEls: HTMLElement[] = [];
  /** 歌词偏移微调滑块（歌词面板标题栏，每首歌独立） */
  private lyricOffsetWrap: HTMLElement | null = null;
  private lyricOffsetSlider: HTMLInputElement | null = null;
  private lyricOffsetValue: HTMLElement | null = null;

  // --- 在线搜索 / 试听 / 下载 / 推荐歌单（原下载弹窗逻辑并入） ---
  private downloading = false;
  /** 标签页内容区上方的进度条 */
  private tabProgressWrap: HTMLElement | null = null;
  private tabProgressFill: HTMLElement | null = null;
  private tabProgressText: HTMLElement | null = null;
  /** 试听：当前试听的行 key（`${source}:${id}`），""=无试听。
   *  试听音频走主播放器（manager.playPreview，底栏可控）；此 key 仅用于行按钮图标复位 */
  private previewKey = "";
  /** 在线搜索防抖定时器 */
  private onlineDebounceTimer: number | null = null;
  /** 在线搜索代际令牌：新搜索使在途旧搜索结果作废 */
  private searchSeq = 0;
  /** 推荐歌单代际令牌：切换来源/刷新使在途旧歌单请求作废 */
  private playlistSeq = 0;
  /** 当前展示的推荐歌单来源（胶囊切换） */
  private currentOnlineSource: PlaylistSource = "netease";
  /** 已加载的推荐歌单（按来源缓存） */
  private playlists: RecommendedPlaylist[] = [];
  private playlistCache: Partial<Record<PlaylistSource, RecommendedPlaylist[]>> = {};
  /** 歌单歌曲缓存（key=`${source}:${id}`） */
  private playlistSongsCache: Record<string, DownloadSong[]> = {};
  /** 推荐歌单标签页当前打开的歌单（null = 歌单卡片首屏） */
  private currentPlaylist: RecommendedPlaylist | null = null;
  /** 在线搜索渐进渲染去重：已渲染的行 key */
  private pendingSeen = new Set<string>();
  /** 在线搜索增量有序结果（按相关度） */
  private pendingResults: DownloadSong[] = [];
  /** 在线搜索当前关键词 */
  private pendingKeyword = "";

  constructor(leaf: WorkspaceLeaf, plugin: MusicManager) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return MUSIC_VIEW_TYPE; }
  getDisplayText(): string { return "Glimpse 音乐"; }
  getIcon(): string { return "music"; }

  async onOpen() {
    // 默认标签：同步过网易云账号歌单 → 账号歌单；否则本地歌单
    this.listTab = this.plugin.getSettings().neteasePlaylistSynced ? "account" : "local";
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    // 移除 Obsidian 默认 view-content 类：其 padding（底部 max(safe-area, 32px)）与
    // overflow:auto 会触发默认样式（旧版渲染引擎不支持 :has()，覆盖规则整条失效），
    // 布局改由 gm-panel-container 全权负责（高度 = 视口高 - view-header 高）
    // 先移除 Obsidian 默认 view-content 类（其默认 padding-bottom 为悬浮的应用状态栏预留空间），
    // 是否保留由「底部状态栏适配」设置决定（见 applyStatusBarAdapt）
    container.removeClass("view-content");
    container.addClass("gm-panel-container");
    // view-content 类的切换挂载点 = 面板容器本身（padding 留白须位于 gm-statusbar 之下才有效）
    // 宿主（leaf-content）也纳入布局控制：flex 列 + 容器 flex:1，
    // 容器精确填满 view-header 之外的剩余空间，不依赖主题的 --header-height 变量
    this.containerEl.addClass("gm-view-host");
    this.paneContainer = container;

    // 歌单面板（默认显示）
    this.songPane = container.createDiv({ cls: "gm-song-pane" });
    this.buildSongPane(this.songPane);

    // 歌词面板（默认隐藏；标题栏布局与歌单面板一致）
    this.lyricsPanel = container.createDiv({ cls: "gm-lyrics-panel gm-panel-hidden" });
    const lyricsHeader = this.lyricsPanel.createDiv({ cls: "gm-song-pane-header" });
    const lyricsTitleWrap = lyricsHeader.createDiv({ cls: "gm-song-pane-title-wrap" });
    lyricsTitleWrap.createSpan({ text: "歌词" });
    this.lyricsCountEl = lyricsTitleWrap.createSpan({ cls: "gm-song-pane-count", text: "" });
    // 歌词偏移微调滑块（每首歌独立，负值=提前；持久化在 data.json 的 lyricOffsets）
    this.lyricOffsetWrap = lyricsHeader.createDiv({ cls: "gm-lyric-offset" });
    this.lyricOffsetSlider = this.lyricOffsetWrap.createEl("input", {
      cls: "gm-lyric-offset-slider",
      attr: { type: "range", min: "-2000", max: "2000", step: "100" },
    }) as HTMLInputElement;
    this.lyricOffsetValue = this.lyricOffsetWrap.createSpan({ cls: "gm-lyric-offset-value" });
    this.lyricOffsetSlider.addEventListener("input", () => {
      const v = parseInt(this.lyricOffsetSlider!.value, 10);
      const path = this.plugin.getState()?.filePath ?? "";
      this.plugin.setLyricOffset(path, v);
      this.lyricOffsetValue?.setText(this.formatOffset(v));
    });
    // 换歌词按钮：对当前歌曲重新在线搜索并替换（已打开候选区时点击 = 收起）
    this.lyricReplaceBtn = lyricsHeader.createSpan({ cls: "gm-lyric-replace-btn clickable-icon" });
    setIcon(this.lyricReplaceBtn, "refresh-cw");
    this.lyricReplaceBtn.setAttribute("title", "换歌词（在线搜索替换）");
    this.lyricReplaceBtn.addClass("is-disabled");
    this.lyricReplaceBtn.addEventListener("click", () => {
      const state = this.plugin.getState();
      if (!state?.filePath) return;
      if (this.lyricCandidatesEl) {
        this.clearLyricCandidates();
        return;
      }
      void this.searchOnlineLyrics(state.filePath, true);
    });
    this.addViewToggleBtn(lyricsHeader);
    // 在线歌词候选区容器（头部下方、歌词列表上方，独立于歌词滚动区：
    // 播放中换行触发的全量重绘不会清掉候选列表）
    this.lyricCandidatesWrap = this.lyricsPanel.createDiv({ cls: "gm-lyric-candidates-wrap" });
    this.lyricsEl = this.lyricsPanel.createDiv({ cls: "gm-panel-content" });
    this.renderEmpty();
    this.setupLyricsScrollWatch();

    // 浮动播放/暂停按钮（两面板共享，浮于面板右下角）
    this.playPauseBtn = container.createDiv({ cls: "gm-panel-play-btn gm-panel-play-hidden" });
    this.playPauseBtn.addEventListener("click", () => this.plugin.toggleActivePlayer());
    this.updatePlayPauseIcon(false);

    this.createStatusBar(container);
    this.setViewMode("songs");
    // 面板打开时已有播放会话（如暂停中）：立即按当前状态渲染一次，否则定位/上一首/下一首
    // 会保持初始置灰态直到下一次状态推送（暂停时没有 timeupdate，不会自动纠正）
    this.renderStatusBar(this.plugin.getState());

    this.plugin.onLyricsStateChange(this._onStateChange);
    this.plugin.onSongListChange(this._onSongListChange);
  }

  async onClose() {
    // 清理宿主标记类，避免同 leaf 之后打开的其他视图被 flex 布局影响
    this.containerEl.removeClass("gm-view-host");
    if (this.onlineDebounceTimer !== null) window.clearTimeout(this.onlineDebounceTimer);
    this.stopPreview();
    this.closeVolumePopup();
    for (const url of this.songCoverUrls.values()) URL.revokeObjectURL(url);
    this.songCoverUrls.clear();
    this.plugin.removeLyricsStateListener(this._onStateChange);
    this.plugin.removeSongListListener(this._onSongListChange);
    await super.onClose();
  }

  private _onStateChange = (state: MusicState | null) => {
    // 封面浮层的试听图标与播放位同步：续播切换到队列下一首时 stop 标记自动转移；
    // 播放位被本地歌曲占用（选歌/切歌）→ 复位。state=null 是停止流程自身的推送，不复位
    if (state?.filePath?.startsWith("preview:")) {
      const key = state.filePath.slice("preview:".length);
      if (key !== this.previewKey) {
        this.stopPreview();
        this.previewKey = key;
        const coverPlay = this.tabContent?.querySelector<HTMLElement>(`[data-dl-key="${CSS.escape(key)}"] .gm-download-item-cover-play`);
        if (coverPlay) {
          this.setCoverPlayIcon(coverPlay, "square", "停止试听");
          coverPlay.addClass("gm-download-item-cover-play-active");
        }
      }
    } else if (this.previewKey && state) {
      this.stopPreview();
    }
    this.renderLyrics(state);
    this.renderStatusBar(state);
    // 歌词标题栏行数计数
    this.lyricsCountEl?.setText(state?.lyrics.length ? `(${state.lyrics.length})` : "");
    // 歌单面板可见时：当前歌曲行跟随切换（增量改 class / 封面图标，不重建列表）。
    // 账号标签下同样需要——已下载到本地的行也走本地播放链路，封面浮层要跟着播放态走
    if (this.viewMode === "songs" && (this.listTab === "local" || this.listTab === "account")) {
      this.updateActiveSongRow(state);
    }
    // 歌词面板可见且当前歌曲无歌词：自动在线搜索候选
    this.maybeAutoSearchLyrics(state);
  };

  private _onSongListChange = () => {
    this.localIndex = null; // 本地歌单变化：重建「已下载」索引
    // 本地标签可见时：刷新分类选项与列表（保留搜索词与筛选）
    if (this.listTab === "local") {
      this.renderCategorySelect();
      this.renderLocalList();
      return;
    }
    // 账号歌单钻入视图：本地/云盘状态随下载或上传变化，重渲染行（保持滚动位置）
    if (this.listTab === "account" && this.currentPlaylist && this.tabContent) {
      const pl = this.currentPlaylist;
      const cached = this.playlistSongsCache[`${pl.source}:${pl.id}`] ?? [];
      const scroll = this.tabContent.scrollTop;
      this.renderPlaylistSongs(cached, pl, () => void this.openPlaylist(pl, true),
        () => void this.confirmSyncAccountPlaylist(pl), true);
      if (this.tabContent) this.tabContent.scrollTop = scroll;
    }
  };

  private updatePlayPauseIcon(isPlaying: boolean) {
    if (!this.playPauseBtn) return;
    // 图标 span 只建一次：empty() 重建会在按压瞬间移除正按住的 svg，导致 click 丢失
    let icon = this.playPauseBtn.querySelector<HTMLElement>(".gm-panel-play-icon");
    if (!icon) icon = this.playPauseBtn.createSpan({ cls: "gm-panel-play-icon" });
    setIconIfChanged(icon, isPlaying ? "pause" : "play");
  }

  // --- 面板切换 ---

  /** 切换显示歌单/歌词面板（底栏切换按钮与歌单页话筒图标共用） */
  private setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    this.songPane?.toggleClass("gm-panel-hidden", mode !== "songs");
    this.lyricsPanel?.toggleClass("gm-panel-hidden", mode !== "lyrics");
    this.renderViewToggleIcon();
    if (mode === "lyrics") {
      // 重新进入歌词面板 = 交还跟随控制权：重置「用户浏览中」暂停标记，
      // 否则从歌单面板切回来时会被旧的暂停状态挡住居中
      this.lyricsUserScrolled = false;
      if (this.plugin.getSettings().autoScroll) {
        // 切到歌词面板时强制居中当前高亮行（隐藏期间滚动逻辑被跳过）
        this.keepCurrentLineVisible(true);
      }
      // 暂停中的歌不再发 timeupdate：切到歌词面板时补一次空歌词自动搜索检查
      this.maybeAutoSearchLyrics(this.plugin.getState());
    }
  }

 /** 面板标题栏的切换按钮工厂：lucide 图标 + 当前面板文字，点击互切 */
  private addViewToggleBtn(parent: HTMLElement) {
    const btn = parent.createSpan({ cls: "gm-statusbar-view-btn clickable-icon" });
    btn.addEventListener("click", () => {
      this.setViewMode(this.viewMode === "songs" ? "lyrics" : "songs");
    });
    this.viewToggleBtns.push(btn);
    this.renderViewToggleIcon();
    return btn;
  }

  /** 切换按钮随当前面板变化：lucide 图标 + 面板文字（歌单/歌词），两个标题栏按钮状态同步 */
  private renderViewToggleIcon() {
    for (const btn of this.viewToggleBtns) {
      btn.empty();
      const iconEl = btn.createSpan({ cls: "gm-statusbar-view-btn-icon" });
      setIcon(iconEl, this.viewMode === "songs" ? "list-music" : "mic-vocal");
      btn.createSpan({
        cls: "gm-statusbar-view-btn-text",
        text: this.viewMode === "songs" ? "歌单" : "歌词",
      });
      btn.setAttribute(
        "title",
        this.viewMode === "songs"
          ? "当前显示：歌曲列表（点击切换到歌词）"
          : "当前显示：歌词（点击切换到歌曲列表）",
      );
    }
  }

  // --- 状态栏（两行：第一行 切换按钮 + 歌名；第二行 播放控制 + 进度条 + 倍速 + 音量） ---

  private createStatusBar(container: HTMLElement) {
    this.statusBar = container.createDiv({ cls: "gm-statusbar" });

    // 第一行：定位按钮 + 歌名（可选中复制）——切换按钮已上移至歌单/歌词面板标题栏
    const row1 = this.statusBar.createDiv({ cls: "gm-statusbar-row1" });
    this.statusBarLocate = row1.createSpan({ cls: "gm-statusbar-locate-btn clickable-icon" });
    setIcon(this.statusBarLocate, "locate-fixed");
    this.statusBarLocate.setAttribute("title", "定位当前歌曲");
    this.statusBarLocate.addClass("is-disabled");
    this.statusBarLocate.addEventListener("click", () => this.locateActiveSong());
    const info = row1.createDiv({ cls: "gm-statusbar-info" });
    this.statusBarTitle = info.createSpan({ cls: "gm-statusbar-song", text: "Glimpse 音乐" });

    // 第二行：播放控制
    const row2 = this.statusBar.createDiv({ cls: "gm-statusbar-row2" });

    // 播放模式（三种循环模式轮流切换，仅图标变化；激活态强调色已按定版移除）
    this.statusBarMode = row2.createSpan({ cls: "gm-statusbar-mode-btn clickable-icon" });
    this.statusBarMode.addEventListener("click", () => {
      this.plugin.cyclePlayMode();
      this.renderModeIcon();
    });

    // 播放控制组：上一首 / 播放暂停 / 下一首（同一 clickable-icon 样式，组内间距由
    // .gm-statusbar-controls 统一，视觉上成组）
    const controls = row2.createDiv({ cls: "gm-statusbar-controls" });
    this.statusBarPrev = controls.createSpan({ cls: "gm-statusbar-btn clickable-icon" });
    this.statusBarPrev.setAttribute("title", "上一首");
    this.statusBarPrev.addClass("is-disabled");
    setIconIfChanged(this.statusBarPrev, "skip-back");
    this.statusBarPrev.addEventListener("click", () => this.plugin.stepSong(-1));

    this.statusBarPlay = controls.createSpan({ cls: "gm-statusbar-btn clickable-icon" });
    this.statusBarPlay.setAttribute("title", "播放/暂停");
    setIconIfChanged(this.statusBarPlay, "play");
    this.statusBarPlay.addEventListener("click", () => this.plugin.toggleActivePlayer());

    this.statusBarNext = controls.createSpan({ cls: "gm-statusbar-btn clickable-icon" });
    this.statusBarNext.setAttribute("title", "下一首");
    this.statusBarNext.addClass("is-disabled");
    setIconIfChanged(this.statusBarNext, "skip-forward");
    this.statusBarNext.addEventListener("click", () => this.plugin.stepSong(1));

    // 可拖动进度条（联动播放进度）
    this.seekSlider = row2.createEl("input", {
      cls: "gm-seek-slider",
      attr: { type: "range", min: "0", max: "0", step: "1", value: "0" },
    }) as HTMLInputElement;
    this.seekSlider.disabled = true; // 无歌/时长未知时禁用
    this.seekSlider.addEventListener("pointerdown", () => {
      this.scrubbing = true;
    });
    this.seekSlider.addEventListener("input", () => {
      // 拖动即时跳转（不强制播放，与点击歌词行为一致）
      const t = Number(this.seekSlider?.value ?? 0);
      this.updateSeekSliderFill(t);
      this.plugin.seekActivePlayer(t);
      if (this.statusBarTime) this.statusBarTime.setText(this.formatTime(t));
    });
    const endScrub = () => {
      this.scrubbing = false;
    };
    this.seekSlider.addEventListener("change", endScrub);
    this.seekSlider.addEventListener("pointerup", endScrub);
    this.seekSlider.addEventListener("pointercancel", endScrub);

    // 时间
    this.statusBarTime = row2.createDiv({ cls: "gm-statusbar-time" });

    // 倍速（弹列表选择）
    this.statusBarSpeed = row2.createSpan({ cls: "gm-statusbar-speed-btn" });
    this.statusBarSpeed.setAttribute("title", "选择播放倍速");
    this.statusBarSpeed.setText(`${this.plugin.getPlaybackRate()}x`);
    this.statusBarSpeed.addEventListener("click", (e) => {
      this.showSpeedMenu(e);
    });

    // 音量按钮 + 浮动滑条弹窗
    this.statusBarVolumeIcon = row2.createSpan({ cls: "gm-statusbar-volume-icon clickable-icon" });
    this.renderVolumeIcon();
    this.statusBarVolumeIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.volumePopup) {
        this.closeVolumePopup();
      } else {
        this.openVolumePopup();
      }
    });

    this.renderViewToggleIcon();
    this.renderModeIcon();
    this.updateSeekSliderFill(0);
  }

  /** 倍速弹列表选择（Obsidian Menu，与原生菜单风格一致） */
  private showSpeedMenu(e: MouseEvent) {
    const menu = new Menu();
    const current = this.plugin.getPlaybackRate();
    for (const rate of SPEED_OPTIONS) {
      menu.addItem((item) => {
        item.setTitle(`${rate}x`)
          // 旧版 obsidian.d.ts 无 setChecked：选中项用 ✓ 图标标注
          .setIcon(rate === current ? "check" : "")
          .onClick(() => {
            this.plugin.setPlaybackRate(rate);
            this.renderSpeedLabel();
          });
      });
    }
    menu.showAtMouseEvent(e);
  }

  /** 更新进度条已播放部分填充色（accent 到轨道色的线性渐变） */
  private updateSeekSliderFill(currentSec: number, durationSec?: number) {
    if (!this.seekSlider) return;
    const dur = durationSec ?? (Number(this.seekSlider.max) || 0);
    const pct = dur > 0 ? Math.min(100, Math.max(0, (currentSec / dur) * 100)) : 0;
    this.seekSlider.style.background
      = `linear-gradient(to right, var(--text-accent) ${pct}%, var(--background-modifier-border) ${pct}%)`;
  }

  private renderModeIcon() {
    if (!this.statusBarMode) return;
    const mode = this.plugin.getPlayMode();
    const icon = mode === "single" ? "repeat-1" : mode === "shuffle" ? "shuffle" : "repeat";
    setIconIfChanged(this.statusBarMode, icon);
    const titles: Record<PlayMode, string> = {
      off: "播放模式：关闭",
      single: "播放模式：单曲循环",
      sequential: "播放模式：顺序播放",
      shuffle: "播放模式：乱序播放",
    };
    this.statusBarMode.setAttribute("title", titles[mode]);
  }

  private renderSpeedLabel() {
    if (!this.statusBarSpeed) return;
    this.statusBarSpeed.setText(`${this.plugin.getPlaybackRate()}x`);
  }

  private renderVolumeIcon() {
    if (!this.statusBarVolumeIcon) return;
    const vol = this.plugin.getVolume();
    const icon = vol === 0 ? "volume-x" : vol < 50 ? "volume-1" : "volume-2";
    setIconIfChanged(this.statusBarVolumeIcon, icon);
    this.statusBarVolumeIcon.setAttribute("title", `音量 ${vol}%`);
  }

  /** 音量浮动弹窗：水平滑条 + 百分比，定位在音量按钮上方居中 */
  private openVolumePopup() {
    if (!this.statusBarVolumeIcon) return;
    this.closeVolumePopup();
    const popup = document.body.createDiv({ cls: "gm-volume-popup" });
    this.volumePopup = popup;
    // 防止弹窗内部交互关闭弹窗
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());
    popup.addEventListener("click", (e) => e.stopPropagation());
    const vol = this.plugin.getVolume();
    const slider = popup.createEl("input", {
      cls: "gm-volume-popup-slider",
      attr: { type: "range", min: "0", max: "100", step: "1", value: String(vol) },
    }) as HTMLInputElement;
    const label = popup.createDiv({ cls: "gm-volume-popup-label", text: `${vol}%` });
    const applyFill = (v: number) => {
      slider.style.background
        = `linear-gradient(to right, var(--text-accent) ${v}%, var(--background-modifier-border) ${v}%)`;
    };
    applyFill(vol);
    // 定位到音量按钮上方水平居中（左右钳制在视口内）
    const iconRect = this.statusBarVolumeIcon.getBoundingClientRect();
    const popupWidth = 170;
    const left = Math.min(
      Math.max(iconRect.left + iconRect.width / 2 - popupWidth / 2, 8),
      window.innerWidth - popupWidth - 8,
    );
    popup.style.left = `${left}px`;
    popup.style.top = `${iconRect.top - 6}px`;
    // 上移一屏的位移由 .gm-volume-popup 类承担（静态样式不进 JS）
    slider.addEventListener("input", () => {
      const val = Number(slider.value);
      this.plugin.setVolume(val);
      this.renderVolumeIcon();
      label.setText(`${val}%`);
      applyFill(val);
    });
    // 点击外部关闭（pointerdown 先于 click；音量按钮自身不算「外部」，否则按钮按压会
    // 先经 pointerdown 关闭弹窗、再由 click 重开，切换语义失效）
    this.volumeOutsideClickHandler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!this.volumePopup?.contains(t) && !this.statusBarVolumeIcon?.contains(t)) {
        this.closeVolumePopup();
      }
    };
    document.addEventListener("pointerdown", this.volumeOutsideClickHandler);
  }

  private closeVolumePopup() {
    if (this.volumePopup) { this.volumePopup.remove(); this.volumePopup = null; }
    if (this.volumeOutsideClickHandler) {
      document.removeEventListener("pointerdown", this.volumeOutsideClickHandler);
      this.volumeOutsideClickHandler = null;
    }
  }

  /** 定位当前歌曲：切到本地歌单、展开所在分组并居中滚动到当前行 */
  private locateActiveSong() {
    const state = this.plugin.getState();
    if (!state?.filePath || !this.tabContent) return;
    if (this.viewMode !== "songs") this.setViewMode("songs");
    if (this.listTab !== "local") this.setListTab("local");
    // 手风琴下当前歌曲可能藏在其所在分组的折叠区里：先展开再定位
    if (this.plugin.getSongGroups().length > 0) {
      this.expandedGroup = this.plugin.getSongGroup(state.filePath) ?? MusicView.UNGROUPED_KEY;
      this.renderLocalList();
    }
    requestAnimationFrame(() => {
      const active = this.tabContent?.querySelector(".gm-download-item-active") as HTMLElement | null;
      if (!active || !this.tabContent) return;
      const listRect = this.tabContent.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      const target = this.tabContent.scrollTop + (rect.top - listRect.top)
        - (this.tabContent.clientHeight - rect.height) / 2;
      this.tabContent.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    });
  }

  private renderStatusBar(state: MusicState | null) {
    if (!this.statusBarTitle) return;
    this.renderModeIcon();
    this.renderSpeedLabel();
    this.renderVolumeIcon();
    // 无播放会话时定位/上一首/下一首置灰
    this.statusBarLocate?.toggleClass("is-disabled", !state);
    this.statusBarPrev?.toggleClass("is-disabled", !state);
    this.statusBarNext?.toggleClass("is-disabled", !state);

    // 空态（无状态）：进度条禁用归零
    if (!state) {
      this.statusBarTitle.setText("Glimpse 音乐");
      if (this.statusBarTime) this.statusBarTime.setText("");
      setIconIfChanged(this.statusBarPlay!, "play");
      if (this.seekSlider) {
        this.seekSlider.disabled = true;
        this.seekSlider.value = "0";
        this.updateSeekSliderFill(0);
      }
      return;
    }
    const title = state.title || "未知歌曲";
    const actor = state.actor || "未知艺术家";
    this.statusBarTitle.setText(`${title} - ${actor}`);
    setIconIfChanged(this.statusBarPlay!, state.isPlaying ? "pause" : "play");
    this.statusBarPlay!.setAttribute("title", state.isPlaying ? "暂停" : "播放");

    // 进度条 + 时间联动（拖动中不回写，避免跳变）
    const dur = state.duration && isFinite(state.duration) ? state.duration : 0;
    if (this.seekSlider) {
      this.seekSlider.disabled = !(dur > 0);
      if (dur > 0) this.seekSlider.max = String(Math.floor(dur));
      if (!this.scrubbing) {
        const cur = Math.min(Math.floor(state.currentTime), Math.floor(dur));
        this.seekSlider.value = String(Math.max(0, cur));
        this.updateSeekSliderFill(cur, dur);
      }
    }
    if (this.statusBarTime) {
      if (dur) {
        this.statusBarTime.setText(`${this.formatTime(state.currentTime)} / ${this.formatTime(dur)}`);
      } else {
        this.statusBarTime.setText(this.formatTime(state.currentTime));
      }
    }
  }

  private formatTime(sec: number): string {
    if (!sec || !isFinite(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
  }

  // --- 歌词渲染（歌词面板） ---

  private renderEmpty() {
    if (!this.lyricsEl) return;
    this.clearLyricCandidates(); // empty() 不再覆盖候选区容器，需显式收起
    this.lyricsEl.empty();
    const empty = this.lyricsEl.createDiv({ cls: "gm-panel-empty" });
    const isPreview = !!this.plugin.getState()?.filePath?.startsWith("preview:");
    empty.createDiv({
      text: isPreview
        ? "试听歌曲暂无歌词：点击下方按钮在线搜索，选中后临时挂载显示（仅本次试听有效，不写入文件）。"
        : "暂无歌词。点击底栏按钮切回歌曲列表选歌播放；已下载的歌曲会自动内嵌歌词。",
    });
    // 手动触发在线搜索（自动搜索失败/已关闭候选区时可重试）；点击时取当前歌曲状态，避免切歌后写错目标
    const searchBtn = empty.createEl("button", {
      text: isPreview ? "在线搜索歌词（临时挂载）" : "在线搜索歌词",
      cls: "gm-lyric-search-btn",
    });
    searchBtn.addEventListener("click", () => {
      this.autoSearchPath = null; // 手动搜索不受每首一次限制
      this.maybeAutoSearchLyrics(this.plugin.getState());
    });
    this.playPauseBtn?.addClass("gm-panel-play-hidden");
  }

  /**
   * 侧边栏歌词增量渲染：仅在歌词数组引用变化（换歌/重渲染）或当前行索引变化时全量重建，
   * 其余 timeupdate 只刷新播放图标 + karaoke 逐字高亮，避免每 250ms 重建整表 DOM。
   * 歌词面板隐藏时仍更新 DOM（切回即见），但跳过滚动跟随。
   */
  private renderLyrics(state: MusicState | null) {
    if (!this.lyricsEl) return;

    // 切歌后收起残留的歌词候选区（属于上一首歌的搜索结果）
    if (this.lyricCandidatesEl && this.lyricCandidatesForPath !== (state?.filePath ?? null)) {
      this.clearLyricCandidates();
    }
    // 换歌词按钮随播放会话启停（无歌曲时置灰）
    this.lyricReplaceBtn?.toggleClass("is-disabled", !state?.filePath);

    if (!state || state.lyrics.length === 0) {
      // 空态：仅当此前非空时才清空重建（避免重复 empty）
      if (this.lastLyricsRef !== null || this.lastCurrentIndex !== -1) {
        this.lastLyricsRef = null;
        this.lastCurrentIndex = -1;
        this.lastKaraoke = false;
        this.currentHighlightedEls = [];
        this.renderEmpty();
        this.updatePlayPauseIcon(false);
      }
      this.updateLyricOffsetSlider();
      return;
    }

    const lyricsChanged = state.lyrics !== this.lastLyricsRef;
    const indexChanged = state.currentIndex !== this.lastCurrentIndex;
    const karaokeChanged = state.karaoke !== this.lastKaraoke;
    this.lastLyricsRef = state.lyrics;
    this.lastCurrentIndex = state.currentIndex;
    this.lastKaraoke = state.karaoke;
    // 换歌/换逐字模式：内容整体换新，重置「用户浏览中」暂停（新歌仍从当前行开始跟随）
    if (lyricsChanged || karaokeChanged) this.lyricsUserScrolled = false;

    if (lyricsChanged || indexChanged || karaokeChanged) {
      this.renderLyricsFull(state);
    } else {
      this.updatePlayPauseIcon(state.isPlaying);
      // 同句内逐字高亮随时间推进（仅当前高亮行的 span）
      if (state.karaoke) this.updateKaraokeWords(state);
    }
    // 每 timeupdate 实时跟随：当前行脱离可视区则拉回居中（仅歌词面板可见时）
    if (this.viewMode === "lyrics" && this.plugin.getSettings().autoScroll) {
      this.keepCurrentLineVisible(false);
    }
    this.updateLyricOffsetSlider();
  }

  /** 歌词偏移滑块随当前歌曲同步（换歌/空态时更新位置与可用性；拖动中的 input 事件
   *  已先经 setLyricOffset 更新存储值，此处回写不会与拖动打架） */
  private updateLyricOffsetSlider() {
    if (!this.lyricOffsetSlider) return;
    const state = this.plugin.getState();
    const path = state?.filePath ?? "";
    // 试听（preview: 合成路径）不提供偏移微调：没有可持久化的真实文件
    const hasSong = !!path && !path.startsWith("preview:");
    this.lyricOffsetSlider.disabled = !hasSong;
    if (hasSong) {
      const v = this.plugin.getLyricOffset(path);
      this.lyricOffsetSlider.value = String(v);
      this.lyricOffsetValue?.setText(this.formatOffset(v));
    } else {
      this.lyricOffsetValue?.setText("—");
    }
  }

  /** 偏移毫秒显示：正数带 + 号 */
  private formatOffset(ms: number): string {
    return `${ms > 0 ? "+" : ""}${ms}ms`;
  }

  /** 全量重建侧边栏歌词列表（仅换歌或换行时调用） */
  private renderLyricsFull(state: MusicState) {
    // 用户浏览中（自动跟随已暂停）：先记锚点再重建——empty() 会把视口弹到列表顶部，
    // 不记录的话每换一行就把正在往上看歌词的用户颠簸一次（见 restoreLyricsAnchor）
    const anchor = this.lyricsUserScrolled ? this.captureLyricsAnchor() : null;
    this.lyricsEl!.empty();
    this.currentHighlightedEls = [];
    this.updatePlayPauseIcon(state.isPlaying);
    this.playPauseBtn?.removeClass("gm-panel-play-hidden");

    // 对唱/合唱：同一时间戳的所有行视为当前行
    const curLine = state.lyrics[state.currentIndex];
    const curTs = curLine?.timestamp;

    state.lyrics.forEach((line, index) => {
      const isCurrent = curTs !== undefined
        ? line.timestamp === curTs
        : index === state.currentIndex;
      const isPast = curTs !== undefined
        ? (line.timestamp ?? -1) < curTs
        : index < state.currentIndex;
      let cls = "gm-panel-line";
      if (isCurrent) cls += " gm-panel-highlighted";
      else if (isPast) cls += " gm-panel-past";
      else cls += " gm-panel-future";

      const lineEl = this.lyricsEl!.createDiv({ cls, attr: { "data-time": String(line.timestamp || 0) } });
      const textEl = lineEl.createSpan({ cls: "gm-panel-text" });

      if (state.karaoke && isCurrent && line.text.trim()) {
        // 字 span 统一用基础类，激活与否完全交给 updateKaraokeWords 按时间统一处理
        if (line.words && line.words.length > 0) {
          // 精确逐字时间戳（增强 LRC <mm:ss.xx>）
          line.words.forEach((word) => {
            textEl.createSpan({
              cls: "gm-panel-word",
              text: word.text,
              attr: { "data-time": String(Math.round(word.timestamp)) },
            });
          });
        } else {
          // 回退：按行时长均分逐字时间戳
          const words = line.text.match(WORD_SPLIT_REGEX);
          if (words && words.length > 0) {
            const start = line.timestamp || 0;
            const end = index + 1 < state.lyrics.length
              ? (state.lyrics[index + 1].timestamp || start + 3000)
              : start + 3000;
            const perWord = (end - start) / words.length;
            words.forEach((w, j) => {
              textEl.createSpan({
                cls: "gm-panel-word",
                text: w,
                attr: { "data-time": String(Math.round(start + j * perWord)) },
              });
            });
          } else {
            textEl.setText(line.text);
          }
        }
        if (line.annotation) textEl.createDiv({ cls: "gm-panel-annotation", text: line.annotation });
      } else {
        textEl.setText(line.text);
        if (line.annotation) textEl.createDiv({ cls: "gm-panel-annotation", text: line.annotation });
      }

      if (isCurrent) this.currentHighlightedEls.push(lineEl);

      lineEl.addEventListener("click", () => {
        if (line.timestamp !== undefined) this.plugin.seekActivePlayer(line.timestamp / 1000);
      });
    });

    if (anchor) {
      // 用户浏览中：按锚点恢复视口，不拉回当前行
      this.restoreLyricsAnchor(anchor);
    } else if (this.viewMode === "lyrics" && this.plugin.getSettings().autoScroll) {
      // 换行后强制居中当前高亮行（仅歌词面板可见时；实时跟随的兜底，见 keepCurrentLineVisible）
      this.keepCurrentLineVisible(true);
    }
    // 全量重建后按当前时间应用逐字高亮（字 span 统一基础类，激活态统一在此计算）
    if (state.karaoke) this.updateKaraokeWords(state);
  }

  /** 保证当前高亮行在可视区内：force=强制居中（换行/切面板时）；否则仅当脱离可视区时拉回。
   *  用户手动滚离当前行后暂停跟随（lyricsUserScrolled）：往上翻看歌词时不再被拽回；
   *  滚到当前行重新完整进入可视区即自动恢复（每拍 timeupdate 都会检查，无需额外操作） */
  private keepCurrentLineVisible(force = false) {
    const panel = this.lyricsEl;
    const line = this.currentHighlightedEls[0] ?? null;
    if (!panel || !line) return;
    const panelRect = panel.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const outOfView = lineRect.top < panelRect.top || lineRect.bottom > panelRect.bottom;
    if (this.lyricsUserScrolled) {
      if (!outOfView) this.lyricsUserScrolled = false; // 滚回当前行：交还控制权，恢复自动跟随
      else return; // 浏览中：不拉回
    }
    if (force || outOfView) {
      const target = panel.scrollTop + (lineRect.top - panelRect.top) - (panel.clientHeight - line.clientHeight) / 2;
      panel.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }
  }

  /** 「用户浏览中」标记：手动滚离当前行置 true，滚回当前行完整可见处置 false
   *  （见 keepCurrentLineVisible）。识别口径见 setupLyricsScrollWatch */
  private lyricsUserScrolled = false;

  /** 监听歌词区手动滚动：wheel/触摸立即标记；pointerdown 落在面板自身（而非歌词行）
   *  上是滚动条拖拽，也标记。不用 scroll 事件兜底——程序自身的平滑滚动同样触发 scroll，
   *  会把「自动拉回」误判成用户接管，下一句换行就走锚点分支不居中了 */
  private setupLyricsScrollWatch() {
    const panel = this.lyricsEl;
    if (!panel) return;
    const markUserScroll = () => { this.lyricsUserScrolled = true; };
    panel.addEventListener("wheel", markUserScroll, { passive: true });
    panel.addEventListener("touchmove", markUserScroll, { passive: true });
    panel.addEventListener("pointerdown", (e) => {
      // 滚动条不属于任何子节点：指针落在面板自身即拖滚动条；落在歌词行上是点按跳转，不算
      if (e.target === panel) markUserScroll();
    });
  }

  /** 记录 rebuild 前视口顶部的歌词行（按 index + 视口内偏移）；
   *  index 在 rebuild 前后稳定（同一份 lyrics 数组，行序不变） */
  private captureLyricsAnchor(): { index: number; offset: number } | null {
    const panel = this.lyricsEl;
    if (!panel) return null;
    const panelTop = panel.getBoundingClientRect().top;
    const lines = panel.querySelectorAll<HTMLElement>(".gm-panel-line");
    for (let i = 0; i < lines.length; i++) {
      const r = lines[i].getBoundingClientRect();
      if (r.bottom > panelTop) return { index: i, offset: r.top - panelTop };
    }
    return null;
  }

  /** rebuild 后按锚点行恢复视口（瞬时赋值，不用 smooth）：当前行换字号导致行高变化
   *  也不影响——按锚点行的实测新位置回推，与上方发生过什么无关 */
  private restoreLyricsAnchor(anchor: { index: number; offset: number }) {
    const panel = this.lyricsEl;
    if (!panel) return;
    const el = panel.querySelectorAll<HTMLElement>(".gm-panel-line")[anchor.index];
    if (!el) return;
    const delta = el.getBoundingClientRect().top - (panel.getBoundingClientRect().top + anchor.offset);
    panel.scrollTop += delta;
  }

  /** karaoke 逐字高亮增量更新：只改当前高亮行的 span class，不重建整表。
   *  字时间戳与歌词偏移同时生效（负值=提前），与换行判定同一口径 */
  private updateKaraokeWords(state: MusicState) {
    const timeMs = Math.round(state.currentTime * 1000);
    const off = this.plugin.getLyricOffset(state.filePath);
    for (const lineEl of this.currentHighlightedEls) {
      const words = lineEl.querySelectorAll(".gm-panel-word, .gm-panel-word-active") as NodeListOf<HTMLElement>;
      words.forEach((word) => {
        const t = parseInt(word.dataset.time || "0", 10);
        word.toggleClass("gm-panel-word-active", !isNaN(t) && t + off <= timeMs);
      });
    }
  }

  // --- 在线歌词搜索（歌词面板空态自动/手动触发；点击候选保存为侧车 .lrc 并显示） ---

  /** 歌词面板的在线歌词候选区（空歌词时自动展示；换歌词按钮手动触发；点击导入并保存为侧车 .lrc） */
  private lyricCandidatesEl: HTMLElement | null = null;
  /** 候选区容器（歌词面板头部下方，独立于歌词列表滚动区） */
  private lyricCandidatesWrap: HTMLElement | null = null;
  /** 候选区对应的声音路径：切歌后残留的候选区据此收起 */
  private lyricCandidatesForPath: string | null = null;
  /** 换歌词按钮 */
  private lyricReplaceBtn: HTMLElement | null = null;
  /** 已自动搜索过歌词的歌曲路径（每首歌仅自动搜一次，可手动重搜） */
  private autoSearchPath: string | null = null;
  /** 在线歌词搜索进行中标志（防重复触发） */
  private lyricSearchRunning = false;
  /** 网易云账号歌单缓存（null=未加载；失败也置 null 以便重试） */
  private accountPlaylists: RecommendedPlaylist[] | null = null;
  /** 账号歌单拉取代际令牌 */
  private accountSeq = 0;
  /** 云盘已存歌曲索引（会话缓存；null=未加载） */
  private cloudIndex: NeteaseCloudIndex | null = null;
  private cloudIdsSeq = 0;
  /** 本地歌单索引（文件名 + 歌名|歌手 → 本地曲目）：账号歌单行判定「已下载」并取回本地曲目播放用 */
  private localIndex: { byFile: Map<string, MusicSong>; byTitle: Map<string, MusicSong> } | null = null;

  /** 自动搜索歌词：歌词面板可见 + 当前歌曲无歌词 + 该歌未搜过时触发（手动搜索重置 autoSearchPath 后走同一入口） */
  private maybeAutoSearchLyrics(state: MusicState | null) {
    if (this.viewMode !== "lyrics" || this.lyricSearchRunning) return;
    if (!state || !state.filePath || state.lyrics.length > 0) return;
    if (this.autoSearchPath === state.filePath) return; // 每首歌仅自动搜一次
    this.autoSearchPath = state.filePath;
    void this.searchOnlineLyrics(state.filePath, false, true); // 自动匹配：直接应用第一份有歌词的候选
  }

  /** 四平台搜索当前歌曲的歌词候选并渲染列表（复用标签编辑弹窗的候选样式）。
   *  replace=true 为「换歌词」模式：已有歌词也展示候选（覆盖侧车 .lrc）；
   *  autoApply=true 为自动匹配模式：按相关度顺序自动应用第一份有歌词的候选 */
  private async searchOnlineLyrics(audioPath: string, replace = false, autoApply = false) {
    if (this.lyricSearchRunning) return;
    this.lyricSearchRunning = true;
    try {
      const state = this.plugin.getState();
      const title = state?.title && state.title !== "未知歌曲" ? state.title : basenameNoExt(audioPath);
      const actor = state?.actor && state.actor !== "未知艺术家" ? state.actor : "";
      const query = [title, actor].filter(Boolean).join(" ").trim();
      if (!query) return;
      this.renderLyricSearchStatus(autoApply ? "正在自动匹配在线歌词…" : "正在在线搜索歌词…");
      this.lyricCandidatesForPath = audioPath;
      const candidates = await searchCandidates(query, this.plugin.getSettings().downloadSources);
      // 搜索期间已切歌则丢弃结果；非替换模式已有歌词也丢弃（自动搜索仅补空）
      const now = this.plugin.getState();
      if (now?.filePath !== audioPath || (!replace && now.lyrics.length > 0)) return;
      // 自动匹配：按相关度顺序取第一份有歌词的候选直接应用；全部无歌词 → 退回手动候选列表
      if (autoApply && candidates.length > 0) {
        for (const s of candidates) {
          const lrc = await fetchSongLyrics(s).catch(() => null);
          if (this.plugin.getState()?.filePath !== audioPath) return; // 期间已切歌
          if (lrc && await this.applyLyricToTarget(audioPath, s, lrc)) return;
        }
      }
      this.renderLyricCandidates(audioPath, candidates);
    } catch (e) {
      new Notice(`搜索歌词失败：${e instanceof Error ? e.message : String(e)}`, 5000);
    } finally {
      this.lyricSearchRunning = false;
    }
  }

  /** 将歌词应用到目标：试听（preview: 路径）挂内存临时显示；本地歌写入侧车 .lrc 并重读。返回是否成功 */
  private async applyLyricToTarget(audioPath: string, song: DownloadSong, lrc: string): Promise<boolean> {
    if (audioPath.startsWith("preview:")) {
      if (!this.plugin.applyPreviewLyrics(lrc)) {
        new Notice("试听已结束，临时歌词未应用", 4000);
        return false;
      }
      new Notice("已挂载临时歌词（仅本次试听有效，不写入文件）", 4000);
      this.clearLyricCandidates();
      return true;
    }
    const ok = await writeSidecarLrc(this.plugin.app, audioPath, lrc);
    if (!ok) {
      new Notice("保存 .lrc 失败（文件不可写）", 5000);
      return false;
    }
    new Notice(`已自动保存歌词到 ${basenameNoExt(audioPath)}.lrc`, 3000);
    this.clearLyricCandidates();
    // 重读歌词：readLyrics 侧车优先，立即按当前播放位置对齐显示
    this.plugin.reloadCurrentLyrics();
    return true;
  }

  /** 在歌词面板空态下方插入/替换候选区容器 */
  private lyricSearchBox(): HTMLElement | null {
    if (!this.lyricCandidatesWrap) return null;
    this.lyricCandidatesEl?.remove();
    const box = this.lyricCandidatesWrap.createDiv({ cls: "gm-tag-lyric-candidates" });
    this.lyricCandidatesEl = box;
    return box;
  }

  private renderLyricSearchStatus(text: string) {
    const box = this.lyricSearchBox();
    if (!box) return;
    box.createDiv({ cls: "gm-songs-empty", text });
  }

  /** 渲染多平台歌词候选列表（样式与标签编辑弹窗一致）：来源胶囊 + 歌名/歌手 + 时长 */
  private renderLyricCandidates(audioPath: string, songs: DownloadSong[]) {
    const box = this.lyricSearchBox();
    if (!box) return;
    this.lyricCandidatesForPath = audioPath;
    const titleRow = box.createDiv({ cls: "gm-tag-lyric-candidates-title" });
    titleRow.createSpan({
      cls: "gm-tag-lyric-candidates-title-text",
      text: audioPath.startsWith("preview:")
        ? "选择在线歌词（点击临时挂载到试听，不写入文件）："
        : "选择在线歌词（点击保存为 .lrc 并显示）：",
    });
    const closeBtn = titleRow.createEl("button", { cls: "gm-tag-lyric-candidates-close", text: "✕" });
    closeBtn.setAttribute("title", "关闭");
    closeBtn.addEventListener("click", () => this.clearLyricCandidates());
    if (songs.length === 0) {
      box.createDiv({ cls: "gm-songs-empty", text: "未找到匹配的歌曲，可稍后重试" });
      return;
    }
    for (const s of songs) {
      const row = box.createDiv({ cls: "gm-tag-lyric-candidate" });
      row.createSpan({ cls: `gm-tag-lyric-source gm-tag-lyric-source-${s.source}`, text: SOURCE_LABELS[s.source] ?? s.source });
      const meta = row.createSpan({ cls: "gm-tag-lyric-candidate-meta" });
      meta.setText(`${s.name} - ${s.artist || "未知艺术家"}${s.duration ? ` · ${formatDuration(s.duration)}` : ""}`);
      row.addEventListener("click", () => void this.importLyricToSidecar(audioPath, s, row));
    }
  }

  /** 导入所选候选：拉取歌词 → 应用到目标（试听挂内存临时显示 / 本地歌写侧车 .lrc）→ 立即显示 */
  private async importLyricToSidecar(audioPath: string, song: DownloadSong, row: HTMLElement) {
    row.addClass("gm-tag-lyric-candidate-loading");
    try {
      const lrc = await fetchSongLyrics(song);
      if (!lrc) {
        new Notice(`该歌曲无歌词（${SOURCE_LABELS[song.source] ?? song.source}）`, 4000);
        return;
      }
      await this.applyLyricToTarget(audioPath, song, lrc);
    } catch (e) {
      new Notice(`获取歌词失败：${e instanceof Error ? e.message : String(e)}`, 5000);
    } finally {
      row.removeClass("gm-tag-lyric-candidate-loading");
    }
  }

  /** 收起歌词候选区 */
  private clearLyricCandidates() {
    this.lyricCandidatesEl?.remove();
    this.lyricCandidatesEl = null;
    this.lyricCandidatesForPath = null;
  }

  // --- 歌单面板（默认显示；本地歌曲 / 在线歌曲 / 推荐歌单 三标签页） ---

  /** 构建歌单面板骨架：标题行 + 搜索行（搜索框 + 分类）+ 标签行 + 进度条 + 内容区 */
  private buildSongPane(pane: HTMLElement) {
    const header = pane.createDiv({ cls: "gm-song-pane-header" });
    const titleWrap = header.createDiv({ cls: "gm-song-pane-title-wrap" });
    titleWrap.createSpan({ text: "歌曲列表" });
    this.songListCountEl = titleWrap.createSpan({ cls: "gm-song-pane-count", text: "" });
    // 歌单/歌词切换按钮（自底栏上移；与歌词面板标题栏共用状态渲染）
    this.addViewToggleBtn(header);

    // 搜索行：搜索框（三标签页共用）+ 分类（按标签页自适应：本地=专辑类型，在线/推荐=平台）
    const searchRow = pane.createDiv({ cls: "gm-song-pane-search-row" });
    const searchWrap = searchRow.createDiv({ cls: "gm-song-pane-search" });
    this.songListSearchEl = searchWrap.createEl("input", {
      cls: "gm-song-pane-search-input",
      attr: { type: "text", placeholder: "搜索本地歌曲..." },
    });
    this.songListSearchEl.addEventListener("input", () => this.onSearchInput());
    this.categorySelectEl = searchRow.createEl("select", { cls: "gm-song-pane-filter-select gm-song-pane-category" }) as HTMLSelectElement;
    this.categorySelectEl.addEventListener("change", () => this.onCategoryChange());

    // 标签行：本地歌曲 / 在线歌曲 / 推荐歌单（分段式选择器，图标 + 文字，默认激活第一个）
    const tabs = pane.createDiv({ cls: "gm-song-tabs" });
    const tabDefs: Array<[ListTab, string, string, string]> = [
      ["account", "cloud", "账号歌单", "网易云账号歌单（登录后可同步到本地）"],
      ["online", "globe", "在线歌单", "搜索在线歌曲与歌单（无关键词时展示推荐歌单）"],
      ["local", "folder-music", "本地歌单", "本地音频文件夹歌单"],
    ];
    for (const [tab, icon, label, tip] of tabDefs) {
      const btn = tabs.createDiv({ cls: "gm-song-tab" });
      btn.setAttribute("title", tip);
      const iconEl = btn.createSpan({ cls: "gm-song-tab-icon" });
      setIcon(iconEl, icon);
      btn.createSpan({ text: label });
      btn.addEventListener("click", () => this.setListTab(tab));
      this.tabButtons.set(tab, btn);
    }

    // 标签页进度条（在线搜索/试听/下载进度；默认隐藏）
    this.tabProgressWrap = pane.createDiv({ cls: "gm-download-progress gm-download-progress-hidden" });
    const track = this.tabProgressWrap.createDiv({ cls: "gm-download-progress-track" });
    this.tabProgressFill = track.createDiv({ cls: "gm-download-progress-fill" });
    this.tabProgressText = this.tabProgressWrap.createDiv({ cls: "gm-download-progress-text" });

    // 标签页内容区（滚动容器，本地/在线/推荐共用）
    this.tabContent = pane.createDiv({ cls: "gm-tab-content" });

    // 初始渲染默认标签（本地歌曲）：激活态/搜索占位/分类选项/内容区一次到位，
    // 也覆盖「首扫早于 onOpen 完成」时 onSongListChange 错过初次刷新的场景
    this.setListTab(this.listTab);

    // 底部状态栏适配（buildSongPane 已记录 paneContainer；按设置决定是否保留 view-content 类）
    this.applyStatusBarAdapt();
  }

  /** 面板容器（gm-panel-container）引用：底部状态栏适配的 view-content 类挂载点 */
  private paneContainer: HTMLElement | null = null;

  /** 底部状态栏适配：开启时在面板容器（gm-panel-container）上保留 view-content 默认类，
   *  其底部 padding（max(safe-area, 32px)）为悬浮的应用状态栏预留空间，gm-statusbar 不被遮挡；
   *  关闭时移除该类，面板贴边铺满。切换即时生效 */
  public applyStatusBarAdapt() {
    this.paneContainer?.toggleClass("view-content", this.plugin.getSettings().statusBarAdapt);
  }

  /** 切换标签页（初始渲染也走这里）：更新激活态、搜索框占位、分类选项并重渲染内容区；
   *  点击当前标签等效刷新列表 */
  private setListTab(tab: ListTab) {
    this.listTab = tab;
    for (const [t, btn] of this.tabButtons) {
      btn.toggleClass("gm-song-tab-active", t === tab);
    }
    if (this.songListSearchEl) {
      this.songListSearchEl.placeholder
        = tab === "local" ? "搜索本地歌曲..."
        : tab === "account" ? "搜索账号歌单…"
        : "搜索在线歌曲与歌单（网易云 / QQ / 酷狗 / 酷我）...";
    }
    this.renderCategorySelect();
    this.renderTabContent();
  }

  /** 供命令「打开在线歌曲搜索」调用：确保歌单面板可见并切到在线标签 */
  public showOnlineTab() {
    this.setViewMode("songs");
    this.setListTab("online");
  }

  /** 搜索框输入按标签页分发 */
  private onSearchInput() {
    if (this.listTab === "local") {
      this.renderLocalList();
    } else if (this.listTab === "online") {
      this.renderOnlineView();
    } else {
      this.renderAccountPlaylistsView(); // 账号歌单：即时按关键词筛选歌单卡片/歌内歌曲
    }
  }

  /** 分类下拉按标签页自适应：本地=专辑类型，在线/推荐=平台 */
  private renderCategorySelect() {
    const sel = this.categorySelectEl;
    if (!sel) return;
    sel.empty();
    if (this.listTab === "account") {
      // 账号歌单全部来自网易云，平台筛选无意义：隐藏下拉
      sel.hide();
      return;
    }
    sel.show();
    if (this.listTab === "local") {
      const songsAll = this.plugin.getSongList();
      const types = Array.from(new Set(
        songsAll.map((s) => s.type).filter((t) => t && t.trim()),
      )).sort((a, b) => a.localeCompare(b));
      const hasUncategorized = songsAll.some((s) => !s.type || !s.type.trim());
      if (!types.includes(this.songListTypeFilter) && this.songListTypeFilter !== "未分类") this.songListTypeFilter = "all";
      sel.createEl("option", { value: "all", text: "全部分类" });
      if (hasUncategorized) sel.createEl("option", { value: "未分类", text: "未分类" });
      types.forEach((t) => sel.createEl("option", { value: t, text: t }));
      sel.value = this.songListTypeFilter;
      // 无类型可筛时弱化显示
      sel.toggleClass("gm-song-pane-category-empty", types.length === 0 && !hasUncategorized);
    } else {
      if (this.onlineSourceFilter !== "all" && !MUSIC_SOURCES.includes(this.onlineSourceFilter as MusicSource)) this.onlineSourceFilter = "all";
      sel.createEl("option", { value: "all", text: "全部平台" });
      for (const src of MUSIC_SOURCES) {
        sel.createEl("option", { value: src, text: SOURCE_LABELS[src] });
      }
      sel.value = this.onlineSourceFilter;
      sel.removeClass("gm-song-pane-category-empty");
    }
  }

  /** 分类下拉变更按标签页分发 */
  private onCategoryChange() {
    const value = this.categorySelectEl?.value ?? "all";
    if (this.listTab === "local") {
      this.songListTypeFilter = value;
      this.renderLocalList();
    } else {
      this.onlineSourceFilter = value;
      this.renderTabContent();
    }
  }

  /** 渲染当前标签页内容（tabContent 三标签共用：先清空再分发，避免上一个标签的内容残留） */
  private renderTabContent() {
    if (!this.tabContent) return;
    this.tabContent.empty();
    if (this.listTab === "local") {
      this.renderLocalList();
    } else if (this.listTab === "online") {
      this.renderOnlineView();
    } else {
      this.renderAccountPlaylistsView();
    }
  }

  /** 标签页内容区状态提示文字 */
  private renderTabStatus(text: string) {
    if (!this.tabContent) return;
    this.tabContent.empty();
    this.tabContent.createDiv({ cls: "gm-songs-empty", text });
  }

  /** 更新标题行计数 */
  private updateCount(countText: string) {
    this.songListCountEl?.setText(countText);
  }

  /** 标签页进度条：percent 0-100 为字节进度，null 为阶段进行中（不定宽滑动动画） */
  private renderTabProgress(percent: number | null, label: string): void {
    if (!this.tabProgressWrap || !this.tabProgressFill) return;
    this.tabProgressWrap.removeClass("gm-download-progress-hidden");
    if (percent === null) {
      this.tabProgressFill.addClass("gm-download-progress-indeterminate");
      // 清掉百分比内联宽度，交回不定宽滑动动画（null = 移除该内联属性）
      this.tabProgressFill.setCssProps({ width: null });
      this.tabProgressText?.setText(label);
    } else {
      this.tabProgressFill.removeClass("gm-download-progress-indeterminate");
      this.tabProgressFill.style.width = `${percent}%`;
      this.tabProgressText?.setText(`${label} ${percent}%`);
    }
  }

  private hideTabProgress(): void {
    this.tabProgressWrap?.addClass("gm-download-progress-hidden");
  }

  // --- 标签页：本地歌曲 ---

  /** 渲染本地歌曲列表（按搜索词 + 专辑类型筛选） */
  private renderLocalList() {
    if (!this.tabContent) return;
    this.tabContent.empty();

    const allSongs = this.plugin.getSongList();
    const state = this.plugin.getState();

    // 按搜索词 + 类型筛选
    const query = this.songListSearchEl?.value?.toLowerCase().trim() || "";
    const typeFilter = this.songListTypeFilter;
    const songs = allSongs.filter((s) => {
      const matchQuery = !query
        || s.title.toLowerCase().includes(query)
        || s.actor.toLowerCase().includes(query);
      const matchType = typeFilter === "all"
        || (typeFilter === "未分类" && (!s.type || !s.type.trim()))
        || s.type === typeFilter;
      return matchQuery && matchType;
    });
    // 计数：无筛选时显示总数，有筛选时显示「筛选后 / 总数」
    this.updateCount(songs.length === allSongs.length ? `(${songs.length})` : `(${songs.length} / ${allSongs.length})`);

    if (songs.length === 0) {
      const hint = query ? "没有匹配的歌曲" : typeFilter !== "all" ? "该类型下暂无歌曲" : "暂无歌曲，请先在设置 → 音乐中指定音频文件夹";
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: hint });
      return;
    }

    const groups = this.plugin.getSongGroups();
    const filtered = !!query || typeFilter !== "all";
    // 拖拽排序仅在未筛选时启用：筛选视图只渲染命中的行，按 DOM 顺序写回会丢掉
    // 未渲染歌曲的相对顺序（与分组拖拽把手「筛选时隐藏」同一考虑）
    this.songDragEnabled = !filtered;
    // 云盘标识：索引未加载时后台拉取，完成后重渲染本地列表（保持滚动位置）
    if (this.cloudIndex === null && (this.plugin.getSettings().platformCookies?.netease ?? "").trim()) {
      const scroll = this.tabContent.scrollTop;
      void this.ensureCloudIds().then(() => {
        if (this.listTab === "local" && this.tabContent) {
          this.renderLocalList();
          this.tabContent.scrollTop = scroll;
        }
      });
    }
    if (groups.length === 0) {
      // 未使用分组：保持原扁平列表
      for (const song of songs) {
        this.createSongRow(this.tabContent, song, state);
      }
      return;
    }
    // 自定义分组：按组名桶分（组序 = songGroups.order），未指派的进「未分组」
    const buckets = new Map<string, MusicSong[]>();
    const ungrouped: MusicSong[] = [];
    for (const song of songs) {
      const g = this.plugin.getSongGroup(song.path);
      if (g && groups.includes(g)) {
        const list = buckets.get(g);
        if (list) list.push(song);
        else buckets.set(g, [song]);
      } else {
        ungrouped.push(song);
      }
    }
    for (const g of groups) {
      const list = buckets.get(g) ?? [];
      if (filtered && list.length === 0) continue; // 搜索/筛选中隐藏空组，避免噪音
      this.renderSongGroupSection(g, list, state, filtered);
    }
    if (ungrouped.length > 0) {
      this.renderSongGroupSection(null, ungrouped, state, filtered);
    }
  }

  /** 构建单首本地歌曲行（扁平与分组布局共用）：与账号歌单行同构（封面 + 歌名/歌手·专辑 +
   *  元数据胶囊 + 行内按钮区）。播放入口有两个：封面浮层按钮（悬停淡入，单击播放/暂停）
   *  与整行双击播放（单击留给滚动/浏览，避免误触） */
  private createSongRow(parent: HTMLElement, song: MusicSong, state: MusicState | null) {
    const isActive = state?.filePath === song.path;
    const item = parent.createDiv({ cls: `gm-download-item gm-download-item-playable${isActive ? " gm-download-item-active" : ""}` });
    item.setAttribute("data-path", song.path); // 供 updateActiveSongRow 增量切换高亮
    item.setAttribute("title", "双击播放（按住可拖动排序）");

    // 封面：音频内嵌封面优先，frontmatter 风格 banner 兜底
    const bannerUrl = this.getAudioCoverUrl(song) || this.resolveBannerUrl(song.banner, song.path);
    const coverEl = item.createDiv({ cls: "gm-download-item-cover" });
    if (bannerUrl) {
      const img = coverEl.createEl("img", { cls: "gm-download-item-cover-img" });
      img.addEventListener("error", () => {
        img.remove();
        renderCoverPlaceholder(coverEl);
      });
      img.src = bannerUrl;
    } else {
      renderCoverPlaceholder(coverEl);
    }
    // 封面播放/停止浮层（行尾播放按钮已并入此处）：行悬停时淡入，单击即播放/暂停。
    // 当前播放行按播放态切图标（播放中=pause、暂停中=play），其余行恒为 play
    const coverPlay = coverEl.createDiv({ cls: "gm-download-item-cover-play" });
    this.renderCoverPlayIcon(coverPlay, isActive && !!state?.isPlaying);
    coverPlay.addEventListener("click", (e) => {
      e.stopPropagation();
      // 当前歌曲：切换播放/暂停（暂停中点即续播）；其他歌曲：起播并切到歌词面板
      if (this.plugin.getState()?.filePath === song.path) {
        this.plugin.toggleActivePlayer();
        return;
      }
      void this.plugin.playSong(song);
      this.setViewMode("lyrics");
    });

    // 信息：歌名 / 歌手 · 专辑 / 元数据胶囊行（格式 + 云盘标识）
    const info = item.createDiv({ cls: "gm-download-item-info" });
    info.createDiv({ cls: "gm-download-item-name", text: song.title });
    info.createDiv({
      cls: "gm-download-item-artist",
      text: song.type ? `${song.actor} · ${song.type}` : song.actor,
    });
    const ext = (song.path.split(".").pop() ?? "").toLowerCase();
    const inCloud = this.localSongInCloud(song);
    if ((ext && ext !== "mp3") || inCloud || song.duration || song.size) {
      const metaEl = info.createDiv({ cls: "gm-download-item-meta" });
      if (ext && ext !== "mp3") {
        metaEl.createSpan({ cls: "gm-download-item-pill gm-download-item-pill-ext", text: ext.toUpperCase() });
      }
      if (song.duration) {
        metaEl.createSpan({ cls: "gm-download-item-pill", text: formatDuration(song.duration) });
      }
      if (song.size) {
        metaEl.createSpan({ cls: "gm-download-item-pill", text: formatBytes(song.size) });
      }
      if (inCloud) {
        const cloudPill = metaEl.createSpan({
          cls: "gm-download-item-pill gm-download-item-pill-cloud",
          attr: { title: "已在网易云云盘" },
        });
        setIcon(cloudPill, "cloud");
        cloudPill.createSpan({ text: "云盘" });
      }
    }

    // 行内按钮区（与账号歌单行同款）：分组 / 标签 / 搜索
    const grpBtn = item.createDiv({ cls: "gm-download-item-btn" });
    setIcon(grpBtn, "folder-input");
    grpBtn.setAttribute("title", "分组");
    grpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showSongGroupMenu(song, e);
    });

    const editable = /\.(mp3|m4a)$/i.test(song.path);
    const tagBtn = item.createDiv({ cls: "gm-download-item-btn" });
    setIcon(tagBtn, editable ? "pencil" : "eye");
    tagBtn.setAttribute("title", editable ? "编辑标签" : "查看标签");
    tagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const src = this.resolveSongSource(song.path);
      if (!src) return;
      if (editable) new TagEditorModal(this.plugin.app, this.plugin, src).open();
      else new TagViewerModal(this.plugin.app, src).open();
    });

    const searchBtn = item.createDiv({ cls: "gm-download-item-btn gm-download-item-search-btn" });
    setIcon(searchBtn, "search");
    searchBtn.setAttribute("title", `在在线歌单中搜索「${song.title}」`);
    searchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.searchOnlineByTitle(song.title);
    });

    // 播放入口已移到封面浮层（见上）：行尾不再单设播放按钮，
    // 也不再显示「已下载 ✓」——本地歌单里的歌本就是下载好的，这个标识多余
    // 行整体双击播放；行内按钮与封面播放浮层已各自处理单击，双击事件需显式挡掉
    // （dblclick 与 click 是独立事件，子元素的 stopPropagation 拦不住它冒泡到行）
    item.addEventListener("dblclick", async (e) => {
      e.stopPropagation();
      if (this.suppressRowClick) return; // 刚拖完：浏览器补发的双击不当作播放意图
      if ((e.target as HTMLElement).closest(".gm-download-item-btn, .gm-download-item-cover-play")) return;
      await this.plugin.playSong(song);
      // 主动选歌后切到歌词面板（底栏按钮可切回）
      this.setViewMode("lyrics");
    });

    this.setupSongRowDrag(item);
  }

  /** 拖拽排序仅在未筛选的列表里启用（见 renderLocalList） */
  private songDragEnabled = false;
  /** 拖拽后抑制行上的双击（拖完松手浏览器可能补发 click/dblclick，会误触播放） */
  private suppressRowClick = false;

  /** 歌曲行拖拽排序：按住行上下拖动，实时在「同一容器内」换位（分组视图即同组内换位，
   *  不跨组——跨组等于改分组归属，属另一个操作），松手按 DOM 顺序写回整体歌序。
   *  move/up 挂 window（与组头拖拽同一套做法：拖动中被移动的节点不做 pointer capture 更稳） */
  private setupSongRowDrag(item: HTMLElement) {
    item.addEventListener("pointerdown", (down) => {
      if (down.button !== 0 || !this.songDragEnabled) return;
      // 行内按钮 / 封面播放浮层自带单击行为，从它们起手不进入拖拽
      if ((down.target as HTMLElement).closest(".gm-download-item-btn, .gm-download-item-cover-play")) return;
      const list = this.tabContent;
      const parent = item.parentElement;
      if (!list || !parent) return;
      const startY = down.clientY;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        // 阈值 5px（组头把手用 4px）：整行都可起手，稍大一点避免单击/双击时误触发排序
        if (!moved) {
          if (Math.abs(ev.clientY - startY) < 5) return;
          moved = true;
          item.addClass("is-dragging");
        }
        ev.preventDefault();
        // 接近列表上下边缘时自动滚动，长歌单可以把歌拖到当前视野之外
        const listRect = list.getBoundingClientRect();
        if (ev.clientY < listRect.top + 28) list.scrollTop -= 10;
        else if (ev.clientY > listRect.bottom - 28) list.scrollTop += 10;
        // 指针越过同容器内某行中线就插到它前面，否则落到容器末尾
        const rows = Array.from(parent.children)
          .filter((c): c is HTMLElement => c !== item && c.classList.contains("gm-download-item"));
        for (const row of rows) {
          const r = row.getBoundingClientRect();
          if (ev.clientY < r.top + r.height / 2) {
            parent.insertBefore(item, row);
            return;
          }
        }
        parent.appendChild(item);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        item.removeClass("is-dragging");
        if (!moved) return; // 原地松手视为误触：不写回，双击照常生效
        // 拖拽后浏览器补发的 click/dblclick 不应触发播放；click 在 pointerup 后同步派发，
        // 超时自清避免吞掉下一次正常双击
        this.suppressRowClick = true;
        setTimeout(() => { this.suppressRowClick = false; }, 0);
        // 未筛选时 DOM 含全部歌曲行 → 整体顺序即当前排列；写回后 songList 同步重排
        const paths = Array.from(list.querySelectorAll<HTMLElement>(".gm-download-item[data-path]"))
          .map((row) => row.dataset.path ?? "")
          .filter((p) => p);
        this.plugin.setSongOrder(paths);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }

  /** 封面播放/停止浮层的图标与提示：只改图标不重建元素——浮层上挂着点击监听，
   *  重建会让按压瞬间的 click 丢失 */
  private setCoverPlayIcon(el: HTMLElement, icon: string, title: string) {
    setIconIfChanged(el, icon);
    el.setAttribute("title", title);
  }

  /** 封面浮层的「本地播放态」：播放中显示暂停图标（点击暂停），否则播放图标。
   *  本地歌单行与账号歌单里已下载到本地的行共用（两者都走本地播放链路） */
  private renderCoverPlayIcon(el: HTMLElement, playing: boolean) {
    this.setCoverPlayIcon(el, playing ? "pause" : "play", playing ? "暂停" : "播放（含歌词）");
  }

  // --- 本地歌单自定义分组 ---

  /** 未分组区块的手风琴键（组名由用户输入可能撞车，用不可输入的哨兵串） */
  private static readonly UNGROUPED_KEY = "\u0000ungrouped";

  /** 手风琴展开状态：至多一组展开（存键，未分组用 UNGROUPED_KEY），null = 全部折叠（默认）。
   *  搜索/专辑筛选中强制全部展开，否则折叠组会让搜索结果看起来为空 */
  private expandedGroup: string | null = null;

  /** 渲染一个分组区块：组头（拖拽把手/手风琴折叠/管理）+ 歌曲行；name=null 为未分组（无管理菜单） */
  private renderSongGroupSection(name: string | null, songs: MusicSong[], state: MusicState | null, filtered: boolean) {
    if (!this.tabContent) return;
    const key = name ?? MusicView.UNGROUPED_KEY;
    const collapsed = !filtered && this.expandedGroup !== key;
    const section = this.tabContent.createDiv({ cls: `gm-songs-group${collapsed ? " is-collapsed" : ""}` });
    section.setAttribute("data-group-key", key);
    const header = section.createDiv({ cls: "gm-songs-group-header" });
    if (!filtered) {
      // 拖拽把手：按住上下拖动调整分组顺序（筛选视图中隐藏，避免部分列表写出错误顺序）
      const grip = header.createSpan({ cls: "gm-songs-group-grip" });
      setIcon(grip, "grip-vertical");
      grip.setAttribute("title", "拖动调整分组顺序");
      this.setupGroupDrag(grip, section);
    }
    const chevron = header.createSpan({ cls: "gm-songs-group-chevron" });
    setIcon(chevron, "chevron-down");
    header.createSpan({ cls: "gm-songs-group-name", text: name ?? "未分组" });
    header.createSpan({ cls: "gm-songs-group-count", text: `(${songs.length})` });
    if (name !== null) {
      const more = header.createSpan({ cls: "gm-songs-group-more clickable-icon" });
      setIcon(more, "ellipsis-vertical");
      more.setAttribute("title", "分组操作");
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showGroupManageMenu(name, e);
      });
    }
    header.addEventListener("click", () => {
      // 拖拽结束后的 click 不再切换手风琴（拖完松手原生会补发一次 click）
      if (this.suppressGroupAccordion) {
        this.suppressGroupAccordion = false;
        return;
      }
      // 手风琴：点击展开当前组并折叠其他组；再点当前组折叠
      this.expandedGroup = this.expandedGroup === key ? null : key;
      this.renderLocalList();
    });
    header.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (name !== null) this.showGroupManageMenu(name, e);
    });
    if (!collapsed) {
      for (const song of songs) this.createSongRow(section, song, state);
    }
  }

  /** 拖拽后抑制下一次组头 click（拖完松手浏览器补发 click，会误触手风琴切换） */
  private suppressGroupAccordion = false;

  /** 组头拖拽把手：按住上下拖动实时交换区块顺序，松手按 DOM 顺序持久化组序。
   *  move/up 挂 window（不依赖 setPointerCapture——把手节点拖动中被移动 DOM，
   *  捕获在某些环境不可靠；window 级监听任何情况下不丢事件） */
  private setupGroupDrag(grip: HTMLElement, section: HTMLElement) {
    grip.addEventListener("pointerdown", (down) => {
      if (down.button !== 0 || !this.tabContent) return;
      down.preventDefault();
      down.stopPropagation();
      const list = this.tabContent;
      const startY = down.clientY;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientY - startY) < 4) return;
        if (!moved) section.addClass("is-dragging");
        moved = true;
        // 接近列表上下边缘时自动滚动，长歌单可以把组拖到当前视野之外的目标位
        const listRect = list.getBoundingClientRect();
        if (ev.clientY < listRect.top + 28) list.scrollTop -= 10;
        else if (ev.clientY > listRect.bottom - 28) list.scrollTop += 10;
        // 指针越过哪个组头中线就插到它前面（未分组区块固定在末尾，不参与排序）
        const siblings = Array.from(list.querySelectorAll<HTMLElement>(".gm-songs-group"))
          .filter((s) => s !== section && s.dataset.groupKey !== MusicView.UNGROUPED_KEY);
        for (const sib of siblings) {
          const r = sib.getBoundingClientRect();
          if (ev.clientY < r.top + r.height / 2) {
            list.insertBefore(section, sib);
            return;
          }
        }
        const ungrouped = list.querySelector(`[data-group-key="${CSS.escape(MusicView.UNGROUPED_KEY)}"]`);
        if (ungrouped) list.insertBefore(section, ungrouped);
        else list.appendChild(section);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        section.removeClass("is-dragging");
        if (!moved) return; // 原地松手视为误触：不重排，click 照常触发手风琴
        // 拖拽后浏览器补发的 click 不应切换手风琴；click 在 pointerup 后同步派发，
        // 若因重渲染目标失效则不会派发——超时自清避免吞掉下一次正常点击
        this.suppressGroupAccordion = true;
        setTimeout(() => { this.suppressGroupAccordion = false; }, 0);
        const order = Array.from(list.querySelectorAll<HTMLElement>(".gm-songs-group"))
          .map((s) => s.dataset.groupKey ?? "")
          .filter((k) => k && k !== MusicView.UNGROUPED_KEY);
        this.plugin.reorderSongGroups(order);
        this.renderLocalList();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }

  /** 歌曲行的分组菜单：已有组勾选切换 + 新建分组 + 移出分组（操作后自动展开目标组） */
  private showSongGroupMenu(song: MusicSong, e: MouseEvent) {
    const menu = new Menu();
    const groups = this.plugin.getSongGroups();
    const current = this.plugin.getSongGroup(song.path);
    for (const g of groups) {
      menu.addItem((mi) => mi
        .setTitle(g)
        .setIcon(current === g ? "check" : "folder")
        .onClick(() => {
          if (current === g) return;
          this.plugin.setSongGroup(song.path, g);
          this.expandedGroup = g;
          this.renderLocalList();
        }));
    }
    if (groups.length) menu.addSeparator();
    menu.addItem((mi) => mi.setTitle("新建分组…").setIcon("folder-plus").onClick(() => {
      this.promptGroupName("新建分组", "", (raw) => {
        if (!this.plugin.createSongGroup(raw)) {
          new Notice("分组名称为空或已存在");
          return false;
        }
        this.plugin.setSongGroup(song.path, raw.trim());
        this.expandedGroup = raw.trim();
        this.renderLocalList();
        return true;
      });
    }));
    if (current) {
      menu.addItem((mi) => mi.setTitle("移出分组").setIcon("folder-minus").onClick(() => {
        this.plugin.setSongGroup(song.path, null);
        this.expandedGroup = MusicView.UNGROUPED_KEY;
        this.renderLocalList();
      }));
    }
    menu.showAtMouseEvent(e);
  }

  /** 组头管理菜单：重命名 / 删除（删除只解散分组，歌曲回未分组） */
  private showGroupManageMenu(name: string, e: MouseEvent) {
    const menu = new Menu();
    menu.addItem((mi) => mi.setTitle("重命名分组").setIcon("pencil").onClick(() => {
      this.promptGroupName("重命名分组", name, (raw) => {
        if (!this.plugin.renameSongGroup(name, raw)) {
          new Notice("分组名称为空或已存在");
          return false;
        }
        const newName = raw.trim();
        if (this.expandedGroup === name) this.expandedGroup = newName;
        this.renderLocalList();
        return true;
      });
    }));
    menu.addItem((mi) => mi.setTitle("删除分组").setIcon("trash-2").onClick(() => {
      this.plugin.deleteSongGroup(name);
      if (this.expandedGroup === name) this.expandedGroup = null;
      this.renderLocalList();
    }));
    menu.showAtMouseEvent(e);
  }

  /** 分组名输入弹窗：Enter/确定提交，onSubmit 返回 false 保持弹窗开启（调用方负责提示） */
  private promptGroupName(title: string, initial: string, onSubmit: (raw: string) => boolean) {
    const modal = new Modal(this.plugin.app);
    modal.contentEl.addClass("gm-group-modal");
    modal.contentEl.createDiv({ cls: "gm-group-modal-title", text: title });
    const input = modal.contentEl.createEl("input", {
      cls: "gm-group-modal-input",
      attr: { type: "text", placeholder: "分组名称" },
    });
    input.value = initial;
    const btns = modal.contentEl.createDiv({ cls: "gm-group-modal-btns" });
    const ok = btns.createEl("button", { text: "确定", cls: "mod-cta" });
    btns.createEl("button", { text: "取消" }).addEventListener("click", () => modal.close());
    const submit = () => {
      if (onSubmit(input.value)) modal.close();
    };
    ok.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    modal.onOpen = () => {
      input.focus();
      input.select();
    };
    modal.open();
  }

  /** 歌单面板当前歌曲行跟随：本地标签=高亮 class + 封面播放/暂停图标；账号标签=已下载行的封面图标。
   *  只在「切歌或播放态翻转」时重设图标（setIcon 会重建 svg，高频状态推送下没必要每次全表重设） */
  private lastActiveRowPath: string | null = null;
  private lastActiveIsPlaying = false;

  private updateActiveSongRow(state: MusicState | null) {
    if (!this.tabContent) return;
    const activePath = state?.filePath ?? null;
    const isPlaying = !!state?.isPlaying;
    const changed = activePath !== this.lastActiveRowPath;
    const playStateChanged = isPlaying !== this.lastActiveIsPlaying;
    const iconDirty = changed || playStateChanged;
    // 本地歌单行：高亮跟随 + 封面播放/暂停图标
    this.tabContent.querySelectorAll<HTMLElement>(".gm-download-item[data-path]").forEach((row) => {
      const isActiveRow = row.dataset.path === activePath;
      row.toggleClass("gm-download-item-active", isActiveRow);
      if (!iconDirty) return;
      const coverPlay = row.querySelector<HTMLElement>(".gm-download-item-cover-play");
      if (coverPlay) this.renderCoverPlayIcon(coverPlay, isActiveRow && isPlaying);
    });
    // 账号歌单行：已下载到本地的行也走本地播放链路，封面浮层同样跟随（试听态由 previewKey 链路管）
    if (iconDirty) {
      this.tabContent.querySelectorAll<HTMLElement>(".gm-download-item[data-local-path]").forEach((row) => {
        const key = row.dataset.dlKey ?? "";
        if (this.previewKey && key === this.previewKey) return;
        const coverPlay = row.querySelector<HTMLElement>(".gm-download-item-cover-play");
        if (coverPlay) this.renderCoverPlayIcon(coverPlay, row.dataset.localPath === activePath && isPlaying);
      });
    }
    this.lastActiveRowPath = activePath;
    this.lastActiveIsPlaying = isPlaying;
    // 仅本地标签、且仅切歌时滚动定位到当前行（若不在可视区），避免每次 timeupdate 打断浏览
    if (changed && this.listTab === "local") {
      const active = this.tabContent.querySelector(".gm-download-item-active") as HTMLElement | null;
      if (active) {
        const listRect = this.tabContent.getBoundingClientRect();
        const rect = active.getBoundingClientRect();
        if (rect.top < listRect.top || rect.bottom > listRect.bottom) {
          const target = active.offsetTop - this.tabContent.clientHeight / 2 + active.clientHeight / 2;
          this.tabContent.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
        }
      }
    }
  }

  // --- 标签页：在线歌曲（四平台实时搜索，相关度排序，行内试听/下载） ---

  /** 用当前输入值实时搜索；代际令牌保证只有最新输入的结果生效 */
  private async doOnlineSearch(): Promise<void> {
    const keyword = (this.songListSearchEl?.value ?? "").trim();
    if (!keyword) {
      this.searchSeq++;
      this.pendingKeyword = "";
      this.pendingResults = [];
      this.pendingSeen.clear();
      this.updateCount("");
      this.renderTabStatus("输入歌名 / 歌手开始搜索");
      return;
    }
    const mySeq = ++this.searchSeq;
    this.pendingKeyword = keyword;
    this.pendingResults = [];
    this.pendingSeen.clear();
    this.renderTabStatus("搜索中…");
    let networkError = false;
    await searchCandidates(
      keyword,
      this.plugin.getSettings().downloadSources,
      (partial) => {
        if (mySeq !== this.searchSeq) return;
        if (this.listTab !== "online") return;
        if ((this.songListSearchEl?.value ?? "").trim() !== keyword) return;
        this.appendOnlineRows(partial);
      },
      (netErr) => { networkError = netErr; },
    );
    if (mySeq !== this.searchSeq) return;
    if (this.listTab !== "online") return;
    if ((this.songListSearchEl?.value ?? "").trim() !== keyword) return;
    // 增量渲染已按相关度有序插入；空结果区分「网络错误」与「确实无结果」
    if (this.pendingResults.length === 0) {
      this.updateCount("");
      this.renderTabStatus(networkError ? "网络错误，请检查网络后重试" : "未找到匹配的歌曲");
      return;
    }
    // 分类平台筛选激活时：增量 DOM 插入的锚点按全量序号计算会错位，统一按筛选全量渲染
    if (this.onlineSourceFilter !== "all") {
      this.renderOnlineResults();
    } else {
      this.updateCount(`(${this.pendingResults.length})`);
    }
  }

  /** 在线视图：有缓存结果则复用，否则按需触发搜索 */
  private renderOnlineView() {
    const keyword = (this.songListSearchEl?.value ?? "").trim();
    if (!keyword) {
      // 无关键词：推荐歌单首屏（原「推荐歌单」标签内容并入在线歌单标签）
      this.pendingKeyword = "";
      this.updateCount("");
      this.tabContent?.empty(); // 清掉上一视图残留（如账号歌单/本地列表）
      void this.loadRecommendedPlaylists(this.currentOnlineSource);
      return;
    }
    // 同关键词已有结果（或正在流式到达）→ 直接渲染缓存，不重复请求
    if (this.pendingKeyword === keyword && (this.pendingResults.length > 0 || this.searchSeq > 0)) {
      this.renderOnlineResults();
      return;
    }
    // 新关键词：防抖后搜索（同时后台补齐四源推荐歌单缓存，供「匹配的在线歌单」小节过滤）
    if (this.onlineDebounceTimer !== null) window.clearTimeout(this.onlineDebounceTimer);
    this.onlineDebounceTimer = window.setTimeout(() => {
      this.onlineDebounceTimer = null;
      void this.doOnlineSearch();
    }, ONLINE_SEARCH_DEBOUNCE_MS);
    void this.ensureRecommendations();
  }

  /** 渲染在线结果列表（按分类平台筛选）+ 底部「匹配的在线歌单」小节 */
  private renderOnlineResults() {
    if (!this.tabContent) return;
    this.tabContent.empty();
    const shown = this.onlineSourceFilter === "all"
      ? this.pendingResults
      : this.pendingResults.filter((s) => s.source === this.onlineSourceFilter);
    this.updateCount(`(${shown.length})`);
    if (shown.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "未找到匹配的歌曲" });
    } else {
      for (const song of shown) this.renderOnlineRow(song);
    }
    this.appendOnlinePlaylistMatches();
  }

  /** 关键词搜索视图底部的「匹配的在线歌单」小节：已缓存的推荐歌单按名称过滤 */
  private appendOnlinePlaylistMatches(): void {
    if (!this.tabContent) return;
    const keyword = (this.songListSearchEl?.value ?? "").trim().toLowerCase();
    if (!keyword) return;
    const matches = Object.values(this.playlistCache)
      .flat()
      .filter((p) => (this.onlineSourceFilter === "all" || p.source === this.onlineSourceFilter)
        && p.name.toLowerCase().includes(keyword))
      .slice(0, 24);
    const head = this.tabContent.createDiv({ cls: "gm-online-matches-header" });
    head.setText(`匹配的在线歌单 (${matches.length})`);
    if (matches.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "没有匹配的在线歌单" });
      return;
    }
    for (const p of matches) this.renderPlaylistCard(p);
  }

  /** 确保四源推荐歌单已加载（关键词搜索的「匹配的在线歌单」小节的数据源）；只拉缺失的源 */
  private async ensureRecommendations(): Promise<void> {
    const missing = MUSIC_SOURCES.filter((s) => !this.playlistCache[s]);
    if (missing.length === 0) return;
    await Promise.all(missing.map(async (src) => {
      try {
        const list = await fetchRecommendedPlaylists(src);
        if (!this.playlistCache[src]) this.playlistCache[src] = list;
      } catch { /* 单源失败不影响其他源 */ }
    }));
    // 拉完后仍处于在线关键词搜索视图 → 重渲染补上「匹配的在线歌单」小节
    if (this.listTab === "online" && (this.songListSearchEl?.value ?? "").trim()) this.renderOnlineResults();
  }

  /** 搜索渐进渲染：新到达的结果按相关度增量插入有序位置（首个到达时清掉「搜索中…」占位） */
  private appendOnlineRows(songs: DownloadSong[]): void {
    if (!this.tabContent) return;
    const keyword = this.pendingKeyword;
    const fresh = songs.filter((s) => !this.pendingSeen.has(`${s.source}:${s.id}`));
    if (fresh.length === 0) return;
    const wasEmpty = this.pendingSeen.size === 0;
    for (const s of fresh) this.pendingSeen.add(`${s.source}:${s.id}`);
    if (wasEmpty) this.renderOnlineResults(); // 清掉「搜索中…」占位并渲染首个结果
    for (const s of fresh) {
      this.pendingResults.push(s);
      // 分类筛选中的平台不渲染（pendingResults 仍保留，切筛选时全量重渲染）
      if (this.onlineSourceFilter !== "all" && s.source !== this.onlineSourceFilter) continue;
      // 按相关度增量插入有序位置（分高前 → 同分标题短 → 字典序）
      const score = songSimilarityScore(keyword, s.name, s.artist);
      let idx = this.pendingResults.length - 1; // 自己是最后一个
      for (let i = 0; i < this.pendingResults.length - 1; i++) {
        const cur = this.pendingResults[i];
        const cs = songSimilarityScore(keyword, cur.name, cur.artist);
        const better = cs < score
          || (cs === score && (s.name.length < cur.name.length || (s.name.length === cur.name.length && s.name.localeCompare(cur.name) < 0)));
        if (better) { idx = i; break; }
      }
      // pendingResults 已在尾部 push，需移动到有序位置
      const inserted = this.pendingResults.splice(this.pendingResults.length - 1, 1)[0];
      this.pendingResults.splice(idx, 0, inserted);
      // 分类平台筛选激活时不做增量 DOM 插入（锚点按全量序号计算会错位），搜索结束统一按筛选渲染
      if (this.onlineSourceFilter !== "all") continue;
      const row = this.renderOnlineRow(inserted);
      // DOM 插入到对应有序位置（以可见行的 data-dl-key 为锚）
      const visibleRows = Array.from(this.tabContent.querySelectorAll<HTMLElement>(".gm-download-item"));
      if (idx === 0 || visibleRows.length === 0) {
        this.tabContent.insertBefore(row, this.tabContent.firstChild);
      } else {
        const anchor = visibleRows[Math.min(idx, visibleRows.length) - 1];
        anchor.after(row);
      }
    }
  }

  /** 渲染单行在线结果（封面 + 歌名/艺术家/专辑 + 元数据胶囊 + 来源标签 + 封面播放浮层 + 下载按钮）。
   *  opts（账号歌单）：localDownloaded=本地歌单已有（下载按钮呈完成态 ✓，与云盘状态互不竞争）；
   *  cloud=yes 已在云盘（元数据胶囊行末尾的「云盘」胶囊）/ no 未在；搜索按钮在账号视图中常驻。
   *  悬停效果与播放入口与本地歌单行一致（封面浮层单击播放/停止，行尾不再单设播放按钮） */
  private renderOnlineRow(
    song: DownloadSong,
    opts?: { localDownloaded?: boolean; cloud?: "yes" | "no" },
  ): HTMLElement {
    const row = this.tabContent!.createDiv({ cls: "gm-download-item gm-download-item-playable" });
    row.setAttribute("data-dl-key", `${song.source}:${song.id}`);

    // 封面缩略图（无封面用占位符：灰底 + 音乐图标）
    const coverEl = row.createDiv({ cls: "gm-download-item-cover" });
    if (song.coverUrl) {
      const img = coverEl.createEl("img", { cls: "gm-download-item-cover-img" });
      img.addEventListener("error", () => {
        img.remove();
        renderCoverPlaceholder(coverEl);
      });
      img.src = song.coverUrl;
    } else {
      renderCoverPlaceholder(coverEl);
    }

    // 封面播放/停止浮层（原行尾播放按钮并入此处）：本地歌单已有 → 播放本地文件
    // （本地文件 + 歌词/侧车，播放中点击暂停/续播）；否则试听（拉取标准档音频经底栏播放，再点停止）
    const localSong = opts?.localDownloaded ? this.findLocalSong(song) : null;
    const key = `${song.source}:${song.id}`;
    const st = this.plugin.getState();
    const previewing = !localSong && this.previewKey === key && st?.filePath === `preview:${key}`;
    const coverPlay = coverEl.createDiv({ cls: "gm-download-item-cover-play" });
    if (localSong) {
      // 标记本地路径：播放态变化时 updateActiveSongRow 按它切换浮层图标
      row.setAttribute("data-local-path", localSong.path);
      this.renderCoverPlayIcon(coverPlay, st?.filePath === localSong.path && !!st.isPlaying);
    } else if (previewing) {
      this.setCoverPlayIcon(coverPlay, "square", "停止试听");
      coverPlay.addClass("gm-download-item-cover-play-active");
    } else {
      this.setCoverPlayIcon(coverPlay, "play", "试听（拉取标准档音频，不写入库）");
    }
    coverPlay.addEventListener("click", (e) => {
      e.stopPropagation();
      if (localSong) {
        // 当前正是这首歌 → 播放/暂停切换；否则起播并切到歌词面板
        if (this.plugin.getState()?.filePath === localSong.path) this.plugin.toggleActivePlayer();
        else {
          void this.plugin.playSong(localSong);
          this.setViewMode("lyrics");
        }
        return;
      }
      void this.togglePreview(song, coverPlay);
    });

    const info = row.createDiv({ cls: "gm-download-item-info" });
    info.createDiv({ cls: "gm-download-item-name", text: song.name });
    const artistLine = song.artist || "未知艺术家";
    info.createDiv({
      cls: "gm-download-item-artist",
      text: song.album ? `${artistLine} · ${song.album}` : artistLine,
    });
    // 元数据胶囊行：格式（非 mp3 才标注）+ VIP 标签 + 时长 + 大小 + 码率（缺项跳过）
    const metaEl = info.createDiv({ cls: "gm-download-item-meta" });
    if (song.ext && song.ext !== "mp3") {
      const extLabel = song.ext === "m4a" ? "M4A" : song.ext === "flac" ? "FLAC" : song.ext;
      metaEl.createSpan({ cls: "gm-download-item-pill gm-download-item-pill-ext", text: extLabel });
    }
    if (song.vip) {
      metaEl.createSpan({ cls: "gm-download-item-pill gm-download-item-pill-vip", text: "VIP" });
    }
    const durationStr = formatDuration(song.duration);
    if (durationStr) metaEl.createSpan({ cls: "gm-download-item-pill", text: durationStr });
    if (song.size) metaEl.createSpan({ cls: "gm-download-item-pill", text: formatBytes(song.size) });
    if (song.bitrate) metaEl.createSpan({ cls: "gm-download-item-pill", text: `${song.bitrate}kbps` });
    // 云盘标识（账号歌单）：放在元数据胶囊行末尾
    if (opts?.cloud === "yes") {
      const cloudPill = metaEl.createSpan({
        cls: "gm-download-item-pill gm-download-item-pill-cloud",
        attr: { title: "已在网易云云盘" },
      });
      setIcon(cloudPill, "cloud");
      cloudPill.createSpan({ text: "云盘" });
    }

    // 来源标签：账号歌单视图不标（来源固定网易云，仅歌单标题栏保留标识）
    if (opts === undefined) {
      row.createDiv({
        cls: "gm-download-item-tag",
        text: SOURCE_LABELS[song.source] ?? song.source,
      });
    }
    // 搜索按钮（账号歌单行常驻）：跳到在线歌单标签按歌名搜索——无论是否已在云盘都保留
    if (opts !== undefined) {
      const searchBtn = row.createDiv({ cls: "gm-download-item-btn gm-download-item-search-btn" });
      setIcon(searchBtn, "search");
      searchBtn.setAttribute("title", `在在线歌单中搜索「${song.name}」`);
      searchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.searchOnlineByTitle(song.name);
      });
    }

    const dlBtn = row.createDiv({ cls: "gm-download-item-btn" });
    if (opts?.localDownloaded) {
      // 本地歌单已有：下载按钮呈完成态（绿 ✓，不可点）——与下载成功后的按钮状态一致
      setIcon(dlBtn, "check");
      dlBtn.addClass("gm-download-item-btn-done");
      dlBtn.setAttribute("title", "已下载到本地歌单");
    } else {
      setIcon(dlBtn, "download");
      dlBtn.setAttribute("title", "下载到音频文件夹");
      dlBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.downloadOne(song, dlBtn);
      });
    }
    return row;
  }

  /** 试听：点击封面浮层拉取标准档音频 → **经主播放器（底栏）播放**，再点或切行停止；
   *  播放中该行封面浮层图标变 stop（强调色底）。
   *  本地歌曲开始播放时自动停试听（_onStateChange 接管守卫） */
  private async togglePreview(song: DownloadSong, coverPlay: HTMLElement): Promise<void> {
    const key = `${song.source}:${song.id}`;
    const previewPath = `preview:${key}`;
    // 正在试听这首歌且播放器已就绪（播放中/暂停/播完）→ 停止（销毁底栏播放器；行浮层立即复位）。
    // 仅拉取中（播放器尚未建立）的重复点击直接忽略——取消重发只会让试听「永远差一次」
    if (this.previewKey === key) {
      if (this.plugin.getState()?.filePath === previewPath) {
        this.plugin.stopAllPlayback();
        this.stopPreview();
      }
      return;
    }
    // 试听接管播放位：先等本地播放完全停止（期间发出的空状态推送时 previewKey 尚未设置，
    // 接管守卫不会误清 key），再标记当前试听行
    await this.plugin.stopAllPlayback();
    if (this.previewKey) this.stopPreview(); // 复位其他试听行 / 取消在途拉取
    this.previewKey = key;
    this.setCoverPlayIcon(coverPlay, "square", "停止试听");
    coverPlay.addClass("gm-download-item-cover-play-active");
    this.renderTabProgress(null, `正在试听 ${song.name}…`);
    // 试听队列：从歌单曲目列表/在线搜索结果发起的试听，播完按播放模式在列表内续播，
    // 加载失败（VIP 受限/版权）也按播放模式自动跳下一首
    let queue: DownloadSong[] | undefined;
    let queueIndex: number | undefined;
    if (this.currentPlaylist) {
      const list = this.playlistSongsCache[`${this.currentPlaylist.source}:${this.currentPlaylist.id}`];
      if (list && list.length > 0) {
        queue = list;
        queueIndex = list.findIndex((s) => s.source === song.source && s.id === song.id);
      }
    } else if (this.listTab === "online" && this.pendingResults.length > 0) {
      queue = this.pendingResults;
      queueIndex = this.pendingResults.findIndex((s) => s.source === song.source && s.id === song.id);
    }
    try {
      const res = await previewAudio(song, this.plugin.getSettings().platformCookies, (percent, label) => {
        this.renderTabProgress(percent, label);
      }, this.plugin.getSettings().neteaseCacheFolder);
      if (this.previewKey !== key) {
        // key 被流程清除/接管：仅当播放位已被其他内容实际占用（正在播别的歌）才放弃，
        // 否则用已到手的字节继续试听（用户点击试听的意图未变，不让中途状态推送吞掉播放）
        const cur = this.plugin.getState();
        if (cur?.isPlaying && cur.filePath !== previewPath) return;
      }
      if (!res.ok || !res.data) {
        // 队列内自动跳下一首（与续播的失败跳过一致，failCount 衔接续播的失败计数）；无队列维持提示+停止
        if (queue && queue.length > 0) {
          if (1 >= queue.length) {
            new Notice(`「${song.name}」无法加载，且队列中没有其他可试听的歌曲`, 6000);
            this.stopPreview();
            return;
          }
          this.plugin.setPreviewQueue(queue, Math.max(0, queueIndex ?? 0));
          new Notice(`「${song.name}」无法加载，已自动跳过`, 4000);
          const idx = this.plugin.nextPreviewIndexAfter(Math.max(0, queueIndex ?? 0), queue);
          await this.plugin.continuePreview(queue[idx], idx);
          return;
        }
        new Notice(res.message, 6000);
        this.stopPreview();
        return;
      }
      // 命中缓存：立即播放，进度条提示「已从缓存」后快速隐藏
      if (res.fromCache) {
        this.renderTabProgress(100, "已从缓存加载");
      }
      const mime = res.ext === "m4a" ? "audio/mp4" : res.ext === "flac" ? "audio/flac" : "audio/mpeg";
      const blobUrl = URL.createObjectURL(blobOf(res.data, mime));
      // 经主播放器播放：底栏播放/暂停/进度/音量与歌词面板全部适用；blob 生命周期移交播放器
      await this.plugin.playPreview(song.name, song.artist, blobUrl, key, queue, queueIndex);
      this.hideTabProgress();
    } catch (e) {
      new Notice(`试听出错：${e instanceof Error ? e.message : String(e)}`, 6000);
      this.stopPreview();
    }
  }

  /** 复位试听行按钮图标并清除 key（音频的停止/销毁由播放器侧负责） */
  private stopPreview(): void {
    if (this.previewKey) {
      const coverPlay = this.tabContent?.querySelector<HTMLElement>(`[data-dl-key="${CSS.escape(this.previewKey)}"] .gm-download-item-cover-play`);
      if (coverPlay) {
        this.setCoverPlayIcon(coverPlay, "play", "试听（拉取标准档音频，不写入库）");
        coverPlay.removeClass("gm-download-item-cover-play-active");
      }
      this.previewKey = "";
    }
    this.hideTabProgress();
  }

  /** 下载单首：按来源分发（QQ 用设置里粘贴的 Cookie）。成功后不切页，按钮标 ✓ 可继续下下一首 */
  private async downloadOne(song: DownloadSong, btn: HTMLElement): Promise<void> {
    if (this.downloading) return;
    this.downloading = true;
    btn.setAttribute("disabled", "true");
    btn.addClass("gm-download-item-btn-loading");
    // 全局下载中：所有行下载按钮禁用（视觉 + 功能，防误点其他行）
    this.tabContent?.addClass("gm-download-downloading");
    try {
      const { ok, message } = await downloadSong(
        this.plugin,
        song,
        this.plugin.getSettings().platformCookies,
        (percent, label) => this.renderTabProgress(percent, label),
      );
      new Notice(message, ok ? 4000 : 7000);
      if (ok) {
        // 成功：按钮标 ✓（保留列表，继续点下一首）
        btn.empty();
        setIcon(btn, "check");
        btn.addClass("gm-download-item-btn-done");
        btn.removeClass("gm-download-item-btn-loading");
      } else {
        // 失败：恢复按钮，可就地重试
        btn.removeAttribute("disabled");
        btn.removeClass("gm-download-item-btn-loading");
      }
    } catch (e) {
      new Notice(`下载出错：${e instanceof Error ? e.message : String(e)}`, 7000);
      btn.removeAttribute("disabled");
      btn.removeClass("gm-download-item-btn-loading");
    }
    this.hideTabProgress();
    this.tabContent?.removeClass("gm-download-downloading");
    this.downloading = false;
  }

  // --- 标签页：账号歌单（网易云登录歌单 + 同步到本地） ---

  /** 账号歌单视图：未登录提示 / 歌单卡片首屏 / 歌单歌曲（currentPlaylist 非空）；搜索词过滤歌单名 */
  private renderAccountPlaylistsView() {
    if (!this.tabContent) return;
    this.tabContent.empty(); // 三标签共用容器：先清空，避免残留上一个标签的列表
    if (this.currentPlaylist) {
      // 歌单内曲目（复用在线歌单的钻入视图，带「同步到本地」入口）
      const pl = this.currentPlaylist;
      const cached = this.playlistSongsCache[`${pl.source}:${pl.id}`] ?? [];
      const onSync = () => void this.confirmSyncAccountPlaylist(pl);
      this.renderPlaylistSongs(cached, pl, () => void this.openPlaylist(pl, true), onSync, true);
      return;
    }
    const cookie = (this.plugin.getSettings().platformCookies?.netease ?? "").trim();
    if (!cookie) {
      this.updateCount("");
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "未登录网易云：到 设置 → 音乐 → 网易云音乐 粘贴登录 Cookie 后，即可浏览与同步账号歌单" });
      return;
    }
    const keyword = (this.songListSearchEl?.value ?? "").trim().toLowerCase();
    const lists = this.accountPlaylists;
    if (!lists) {
      this.updateCount("");
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "正在加载账号歌单…" });
      void this.loadAccountPlaylists(cookie);
      return;
    }
    const shown = keyword ? lists.filter((p) => p.name.toLowerCase().includes(keyword)) : lists;
    this.updateCount(`(${shown.length})`);
    if (lists.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "账号下没有歌单" });
      return;
    }
    if (shown.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "没有匹配的歌单" });
      return;
    }
    for (const p of shown) this.renderPlaylistCard(p);
  }

  /** 拉取网易云账号歌单列表（代际令牌防竞态；失败置空以便下次进入重试） */
  private async loadAccountPlaylists(cookie: string): Promise<void> {
    const mySeq = ++this.accountSeq;
    try {
      const lists = await fetchNeteaseAccountPlaylists(cookie);
      if (mySeq !== this.accountSeq || this.listTab !== "account") return;
      this.accountPlaylists = lists;
      this.renderAccountPlaylistsView();
    } catch (e) {
      if (mySeq !== this.accountSeq || this.listTab !== "account") return;
      this.accountPlaylists = null; // 失败不缓存，切一次标签/输入搜索即可重试
      this.updateCount("");
      this.tabContent?.empty();
      this.tabContent?.createDiv({ cls: "gm-songs-empty", text: `加载账号歌单失败：${e instanceof Error ? e.message : String(e)}` });
    }
  }

  /** 同步确认弹窗：说明下载规模后执行（曲目未加载时先拉取数量） */
  private confirmSyncAccountPlaylist(playlist: RecommendedPlaylist): void {
    const folder = (this.plugin.getSettings().audioFolder || "").trim();
    if (!folder) {
      new Notice("请先在 设置 → 音乐 → 音频文件夹 指定保存位置");
      return;
    }
    const cacheKey = `${playlist.source}:${playlist.id}`;
    const cached = this.playlistSongsCache[cacheKey];
    const run = (songs: DownloadSong[]) => this.confirmModal(
      "同步歌单到本地",
      `将把歌单「${playlist.name}」的 ${songs.length} 首歌曲下载到音频文件夹（已存在的自动跳过，含内嵌歌词/封面）。`,
      () => void this.syncAccountPlaylist(playlist, songs),
    );
    if (cached) {
      run(cached);
      return;
    }
    void (async () => {
      this.renderTabProgress(null, `正在读取歌单「${playlist.name}」…`);
      const songs = await fetchPlaylistSongs(playlist.source, playlist.id);
      this.playlistSongsCache[cacheKey] = songs;
      this.hideTabProgress();
      if (this.currentPlaylist?.id !== playlist.id && this.accountPlaylists?.some((p) => p.id === playlist.id) !== true) return;
      run(songs);
    })();
  }

  /** 同步网易云歌单到本地：批量下载全部曲目（按文件名跳过已存在），完成置「已同步」标记并刷新歌单 */
  private async syncAccountPlaylist(playlist: RecommendedPlaylist, songs: DownloadSong[]): Promise<void> {
    if (this.downloading) {
      new Notice("已有下载任务进行中，请稍后再试");
      return;
    }
    if (songs.length === 0) {
      new Notice("歌单没有可下载的歌曲");
      return;
    }
    const cookies = this.plugin.getSettings().platformCookies;
    this.downloading = true;
    let added = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        this.renderTabProgress(null, `同步 ${playlist.name} ${i + 1}/${songs.length}：${song.name}`);
        if (await localSongExists(this.plugin, song)) {
          skipped++;
          continue;
        }
        const res = await downloadSong(this.plugin, song, cookies, (percent, label) => {
          this.renderTabProgress(percent, `同步 ${playlist.name} ${i + 1}/${songs.length} ${label || song.name}`);
        });
        if (res.ok) added++;
        else failed++;
      }
      new Notice(`「${playlist.name}」同步完成：新增 ${added} 首，跳过 ${skipped} 首${failed ? `，失败 ${failed} 首` : ""}`, 6000);
      void this.plugin.scanLyricSongs();
      // 同步过账号歌单：记住标记，音乐侧边栏此后默认打开「账号歌单」标签
      if (!this.plugin.getSettings().neteasePlaylistSynced) {
        await this.plugin.markAccountPlaylistsSynced();
      }
    } finally {
      this.downloading = false;
      this.hideTabProgress();
    }
  }

  /** 通用确认弹窗（确定/取消） */
  private confirmModal(title: string, text: string, onOk: () => void): void {
    const modal = new Modal(this.plugin.app);
    modal.contentEl.createDiv({ cls: "gm-group-modal-title", text: title });
    modal.contentEl.createDiv({ cls: "gm-group-modal-text", text });
    const btns = modal.contentEl.createDiv({ cls: "gm-group-modal-btns" });
    btns.createEl("button", { text: "取消" }).addEventListener("click", () => modal.close());
    const ok = btns.createEl("button", { text: "确定", cls: "mod-cta" });
    ok.addEventListener("click", () => {
      modal.close();
      onOk();
    });
    modal.open();
  }

  /** 加载推荐歌单首屏（多源，全免登录）；命中缓存直接渲染，force=true 强制刷新。
   *  有关键词时不渲染卡片（关键词视图是搜索结果 + 匹配歌单），只填充缓存 */
  private async loadRecommendedPlaylists(source: PlaylistSource = this.currentOnlineSource, force = false): Promise<void> {
    this.currentOnlineSource = source;
    this.currentPlaylist = null;
    this.searchSeq++; // 作废在途搜索结果，避免迟到搜索覆盖歌单视图
    if (this.listTab !== "online") return;
    const hasKeyword = !!(this.songListSearchEl?.value ?? "").trim();
    if (!force && this.playlistCache[source]) {
      this.playlists = this.playlistCache[source] as RecommendedPlaylist[];
      if (!hasKeyword) this.renderPlaylistCards();
      return;
    }
    const mySeq = ++this.playlistSeq; // 歌单代际令牌：切换来源/刷新使在途旧请求作废
    if (!hasKeyword) this.renderTabStatus("加载推荐歌单…");
    const list = await fetchRecommendedPlaylists(source);
    if (mySeq !== this.playlistSeq || this.currentOnlineSource !== source || this.listTab !== "online") return;
    this.playlistCache[source] = list;
    this.playlists = list;
    if (!hasKeyword) this.renderPlaylistCards();
  }

  /** 渲染推荐歌单卡片首屏：来源胶囊（点击切换）+ 刷新按钮 + 卡片列表（按分类平台 + 关键词筛选） */
  private renderPlaylistCards(): void {
    if (!this.tabContent) return;
    this.tabContent.empty();
    const query = (this.songListSearchEl?.value ?? "").trim().toLowerCase();
    const sourceFilter = this.onlineSourceFilter;

    const shown = this.playlists.filter((p) =>
      (sourceFilter === "all" || p.source === sourceFilter)
      && (!query || p.name.toLowerCase().includes(query)));
    const total = this.playlists.filter((p) => sourceFilter === "all" || p.source === sourceFilter).length;
    this.updateCount(shown.length === total ? `(${shown.length})` : `(${shown.length} / ${total})`);

    // 来源胶囊行：点击切换当前平台（选中态高亮）
    const sources = this.tabContent.createDiv({ cls: "gm-song-pane-sources" });
    for (const key of MUSIC_SOURCES) {
      const tag = sources.createSpan({
        cls: `gm-download-item-tag gm-download-playlist-source${key === this.currentOnlineSource ? " gm-download-item-tag-active" : ""}`,
        text: SOURCE_LABELS[key],
      });
      tag.addEventListener("click", () => {
        if (key !== this.currentOnlineSource) void this.loadRecommendedPlaylists(key);
      });
    }
    if (this.playlists.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: "暂无推荐歌单（接口可能变更），可切到「在线歌曲」直接搜索" });
      return;
    }
    if (shown.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: query ? "没有匹配的歌单" : "该平台下暂无歌单" });
      return;
    }
    for (const p of shown) this.renderPlaylistCard(p);
  }

  /** 渲染单个歌单卡片（推荐歌单与账号歌单共用） */
  private renderPlaylistCard(p: RecommendedPlaylist): void {
    if (!this.tabContent) return;
    const card = this.tabContent.createDiv({ cls: "gm-download-playlist-card" });
    const coverEl = card.createDiv({ cls: "gm-download-playlist-cover" });
    if (p.coverUrl) {
      const img = coverEl.createEl("img", { cls: "gm-download-playlist-cover-img" });
      img.addEventListener("error", () => {
        img.remove();
        renderCoverPlaceholder(coverEl);
      });
      img.src = p.coverUrl;
    } else {
      renderCoverPlaceholder(coverEl);
    }
    const info = card.createDiv({ cls: "gm-download-playlist-info" });
    info.createDiv({ cls: "gm-download-playlist-name", text: p.name });
    const meta: string[] = [];
    if (p.trackCount) meta.push(`${p.trackCount} 首`);
    // 推荐歌单有播放次数；账号歌单没有（playCount=0）不显示
    if (p.playCount) meta.push(`${this.formatPlayCount(p.playCount)} 次播放`);
    if (p.creator) meta.push(p.creator);
    // 酷狗歌单接口硬限返回前 10 首，卡片明确标注避免「N 首却只 10 首」的误导
    if (p.source === "kugou") meta.push("限前10首");
    info.createDiv({ cls: "gm-download-playlist-meta", text: meta.join(" · ") });
    card.addEventListener("click", () => void this.openPlaylist(p));
  }

  /** 打开某歌单：加载并渲染其歌曲（复用在线结果行）；命中缓存直接渲染；force=true 强制重拉刷新。
   *  账号歌单标签下提供「同步到本地」入口 */
  private async openPlaylist(playlist: RecommendedPlaylist, force = false): Promise<void> {
    this.currentPlaylist = playlist;
    this.searchSeq++; // 作废在途搜索结果
    if (this.listTab !== "online" && this.listTab !== "account") return;
    if (!this.tabContent) return;
    this.tabContent.empty();
    this.appendPlaylistHeader(playlist);
    const cacheKey = `${playlist.source}:${playlist.id}`;
    const onRefresh = () => void this.openPlaylist(playlist, true);
    const onSync = this.listTab === "account" ? () => void this.confirmSyncAccountPlaylist(playlist) : undefined;
    const cloud = this.listTab === "account";
    if (!force) {
      const cached = this.playlistSongsCache[cacheKey];
      if (cached) {
        this.renderPlaylistSongs(cached, playlist, onRefresh, onSync, cloud);
        return;
      }
    }
    this.tabContent.createDiv({ cls: "gm-songs-empty", text: `加载歌单「${playlist.name}」…` });
    const songs = await fetchPlaylistSongs(playlist.source, playlist.id);
    this.playlistSongsCache[cacheKey] = songs;
    if (this.currentPlaylist?.id !== playlist.id || (this.listTab !== "online" && this.listTab !== "account")) return;
    this.renderPlaylistSongs(songs, playlist, onRefresh, onSync, cloud);
  }

  /** 歌单视图顶部：返回按钮 + 歌单名 + 实际歌曲数 + 同步/刷新按钮 + 来源胶囊 */
  private appendPlaylistHeader(playlist: RecommendedPlaylist, count?: number, onRefresh?: () => void, onSync?: () => void): void {
    if (!this.tabContent) return;
    const head = this.tabContent.createDiv({ cls: "gm-download-playlist-head" });
    const back = head.createDiv({ cls: "gm-download-playlist-back clickable-icon" });
    setIcon(back, "arrow-left");
    back.setAttribute("title", "返回歌单列表");
    back.addEventListener("click", () => this.goBackToPlaylistCards());
    head.createDiv({ cls: "gm-download-playlist-head-title", text: playlist.name });
    if (count !== undefined) head.createSpan({ cls: "gm-download-item-tag", text: `共 ${count} 首` });
    if (onSync) {
      const sync = head.createDiv({ cls: "gm-download-playlist-refresh clickable-icon" });
      setIcon(sync, "cloud-download");
      sync.setAttribute("title", "同步整个歌单到本地（跳过已存在）");
      sync.addEventListener("click", () => onSync());
    }
    if (onRefresh) {
      const refresh = head.createDiv({ cls: "gm-download-playlist-refresh clickable-icon" });
      setIcon(refresh, "refresh-cw");
      refresh.setAttribute("title", "刷新歌单歌曲");
      refresh.addEventListener("click", () => onRefresh());
    }
    head.createSpan({ cls: "gm-download-item-tag", text: SOURCE_LABELS[playlist.source] ?? playlist.source });
  }

  /** 渲染歌单内歌曲（复用在线结果行；按搜索词筛选）。cloud=true（账号歌单）：行内标注/上传云盘 */
  private renderPlaylistSongs(
    songs: DownloadSong[],
    playlist: RecommendedPlaylist,
    onRefresh: () => void,
    onSync?: () => void,
    cloud?: boolean,
  ): void {
    if (!this.tabContent) return;
    this.tabContent.empty();
    this.appendPlaylistHeader(playlist, songs.length, onRefresh, onSync);
    // 云盘状态集合未加载：后台拉取，完成后带着滚动位置重渲染本视图
    if (cloud && this.cloudIndex === null) {
      const scroll = this.tabContent.scrollTop;
      void this.ensureCloudIds().then(() => {
        if (this.listTab === "account" && this.currentPlaylist && this.tabContent) {
          this.renderPlaylistSongs(songs, playlist, onRefresh, onSync, cloud);
          this.tabContent.scrollTop = scroll;
        }
      });
    }
    const query = (this.songListSearchEl?.value ?? "").trim().toLowerCase();
    const shown = songs.filter((s) =>
      !query
      || s.name.toLowerCase().includes(query)
      || s.artist.toLowerCase().includes(query));
    if (shown.length === 0) {
      this.tabContent.createDiv({ cls: "gm-songs-empty", text: query ? "没有匹配的歌曲" : "歌单暂无歌曲" });
      return;
    }
    for (const song of shown) {
      this.renderOnlineRow(song, cloud
        ? { localDownloaded: this.isLocalDownloaded(song), cloud: this.cloudStateOf(song) }
        : undefined);
    }
  }

  /** 账号歌单行的云盘状态：ID / 文件名 / 歌名+歌手 三路命中（网易云按音频内容判重，
   *  同一音频可能以别的文件名或新 ID 存在，靠名称兜底识别） */
  private cloudStateOf(song: DownloadSong): "yes" | "no" {
    const idx = this.cloudIndex;
    if (idx) {
      const id = song.neteaseId ? String(song.neteaseId) : song.id;
      if (idx.ids.has(id)) return "yes";
      for (const ext of ["mp3", "flac", "m4a"]) {
        if (idx.fileNames.has(buildSongFilename(song.artist, song.name, ext).toLowerCase())) return "yes";
      }
      if (idx.titles.has(`${song.name.toLowerCase()}|${song.artist.toLowerCase()}`)) return "yes";
    }
    return "no";
  }

  /** 取回该在线曲目对应的本地曲目（已下载）：文件名（下载命名规则）优先，其次歌名+歌手（标签） */
  private findLocalSong(song: DownloadSong): MusicSong | null {
    if (!this.localIndex) {
      const byFile = new Map<string, MusicSong>();
      const byTitle = new Map<string, MusicSong>();
      for (const s of this.plugin.getSongList()) {
        const base = s.path.split(/[\\/]/).pop() ?? "";
        if (base && !byFile.has(base.toLowerCase())) byFile.set(base.toLowerCase(), s);
        const key = `${s.title}|${s.actor}`.toLowerCase();
        if (!byTitle.has(key)) byTitle.set(key, s);
      }
      this.localIndex = { byFile, byTitle };
    }
    for (const ext of ["mp3", "flac", "m4a"]) {
      const hit = this.localIndex.byFile.get(buildSongFilename(song.artist, song.name, ext).toLowerCase());
      if (hit) return hit;
    }
    return this.localIndex.byTitle.get(`${song.name}|${song.artist}`.toLowerCase()) ?? null;
  }

  /** 本地歌单是否已有该曲 */
  private isLocalDownloaded(song: DownloadSong): boolean {
    return this.findLocalSong(song) !== null;
  }

  /** 拉取网易云云盘已存歌曲索引（会话缓存；代际令牌防竞态；失败按空集处理可重试上传） */
  private async ensureCloudIds(): Promise<void> {
    const cookie = (this.plugin.getSettings().platformCookies?.netease ?? "").trim();
    if (!cookie) return;
    const mySeq = ++this.cloudIdsSeq;
    try {
      const idx = await fetchNeteaseCloudIndex(cookie);
      if (mySeq !== this.cloudIdsSeq) return;
      this.cloudIndex = idx;
    } catch {
      if (mySeq !== this.cloudIdsSeq) return;
      this.cloudIndex = { ids: new Set(), fileNames: new Set(), titles: new Set() };
    }
  }

  /** 本地曲目是否已在网易云云盘：文件名（下载命名规则）或 歌名|歌手（标签）命中云盘索引 */
  private localSongInCloud(song: MusicSong): boolean {
    const idx = this.cloudIndex;
    if (!idx) return false;
    const base = (song.path.split(/[\\/]/).pop() ?? "").toLowerCase();
    if (base && idx.fileNames.has(base)) return true;
    return idx.titles.has(`${song.title}|${song.actor}`.toLowerCase());
  }

  /** 跳到在线歌单标签并按标题搜索（账号歌单行与本地歌单行的搜索按钮共用） */
  private searchOnlineByTitle(title: string): void {
    if (this.songListSearchEl) this.songListSearchEl.value = title;
    this.setListTab("online"); // setListTab → renderOnlineView：有关键词 → 防抖后搜索
  }

  /** 切回歌单卡片首屏：账号歌单回账号列表；在线歌单按关键词回落（无词 → 推荐歌单卡片） */
  private goBackToPlaylistCards(): void {
    this.currentPlaylist = null;
    if (this.listTab === "account") this.renderAccountPlaylistsView();
    else this.renderOnlineView();
  }

  /** 播放次数友好格式化：≥1 亿 → x.x亿；≥1 万 → x.x万；否则原样 */
  private formatPlayCount(n: number): string {
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
    return String(n);
  }

  /** 构造歌曲的 AudioSource：库外盘符绝对路径 → external，否则 vault 内 TFile；找不到返回 null */
  private resolveSongSource(path: string): AudioSource | null {
    return resolveAudioSourceByPath(this.plugin.app, path);
  }

  /** 取某歌曲的音频封面 blob URL（缓存于 songCoverUrls，面板重建/关闭时统一 revoke） */
  private getAudioCoverUrl(song: MusicSong): string {
    const audioCover = this.plugin.getAudioCover(song);
    if (!audioCover) return "";
    let url = this.songCoverUrls.get(song.path) ?? "";
    if (!url) {
      url = URL.createObjectURL(blobOf(audioCover.data, audioCover.mime));
      this.songCoverUrls.set(song.path, url);
    }
    return url;
  }

  private resolveBannerUrl(banner: string, songPath?: string): string {
    if (!banner) return "";
    if (banner.startsWith("http://") || banner.startsWith("https://")) return banner;
    if (isWindowsAbsolutePath(banner)) return banner;

    // Strip Obsidian embed syntax ![[file.jpg]]
    const embedMatch = banner.match(/!\[\[(.+?)\]\]/);
    const rawPath = embedMatch ? embedMatch[1] : banner;

    // 1. getFirstLinkpathDest — resolves relative to context path
    const contextPath = songPath || this.plugin.app.workspace.getActiveFile()?.path || "";
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(rawPath, contextPath);
    if (file instanceof TFile) {
      return this.plugin.app.vault.getResourcePath(file);
    }

    // 2. If just a filename, search entire vault for matching file
    if (!rawPath.includes("/")) {
      const allFiles = this.plugin.app.vault.getFiles();
      const match = allFiles.find((f) => f.name === rawPath);
      if (match) {
        return this.plugin.app.vault.getResourcePath(match);
      }
    }

    return banner;
  }
}
