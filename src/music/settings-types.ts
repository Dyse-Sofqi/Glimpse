/**
 * 音乐模块设置接口与默认值（持久化在 Glimpse data.json 的 music 字段下）。
 */
import type { PlayMode } from "./shared";

/** 本地歌单自定义分组（存 data.json，无额外文件） */
export interface SongGroups {
  /** 组名（显示顺序；空组保留，供先建组后归曲） */
  order: string[];
  /** 音频路径 → 组名 */
  assign: Record<string, string>;
}

/** 歌词偏移默认值（毫秒，负值=歌词提前）：微小的提前量抵消音频输出等残余延迟，宁可提前不落后 */
export const DEFAULT_LYRIC_OFFSET = -150;

export interface MusicSettings {
  /** 逐字高亮（卡拉OK），默认关 */
  karaoke: boolean;
  /** 底部状态栏适配：开启时保留 Obsidian view-content 默认样式（底部为悬浮的应用状态栏预留安全区留白）；
   *  关闭（默认）时移除该默认样式，面板贴边铺满。用于适配状态栏固定悬浮的主题 */
  statusBarAdapt: boolean;
  /** 歌词自动滚动跟随播放进度，默认开 */
  autoScroll: boolean;
  /** 播放模式，默认 off */
  playMode: PlayMode;
  /** 播放倍速，持久化，重启不丢失 */
  playbackRate: number;
  /** 音量百分比 0-100，持久化，重启不丢失 */
  volume: number;
  /** 音频文件夹（歌单来源，同下载路径）：vault 内相对路径或库外 Windows 盘符绝对路径 */
  audioFolder: string;
  /** 多平台下载 Cookie：各平台登录 Cookie，仅存本地 data.json */
  platformCookies: Record<string, string>;
  /** 下载搜索启用的平台：勾选的控制搜索结果是否包含该平台 */
  downloadSources: Record<string, boolean>;
  /** 上次播放：歌曲路径 + 进度秒数。退出 Obsidian 时保存，下次启动恢复进度但不自动播放 */
  lastPlayed?: { path: string; time: number };
  /** 每首歌的歌词偏移（毫秒，负值=提前）：key=音频路径；未记录的歌用 DEFAULT_LYRIC_OFFSET */
  lyricOffsets?: Record<string, number>;
  /** 本地歌单自定义分组：组名有序列表 + 音频路径归组映射 */
  songGroups?: SongGroups;
  /** 本地歌单自定义排序（拖拽调整后的音频路径顺序）；未列出的歌按标题排在其后。
   *  顺序同时决定顺序播放模式的切歌顺序 */
  songOrder?: string[];
  /** 是否同步过网易云账号歌单：已同步则音乐侧边栏默认打开「账号歌单」标签 */
  neteasePlaylistSynced?: boolean;
  /** 网易云客户端缓存目录：试听与网易云下载优先读取客户端已缓存的音频（<歌曲ID>-<码率>.mp3/.flac） */
  neteaseCacheFolder: string;
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  karaoke: false,
  statusBarAdapt: false,
  autoScroll: true,
  playMode: "off",
  playbackRate: 1,
  volume: 75,
  audioFolder: "",
  neteaseCacheFolder: "",
  platformCookies: {},
  downloadSources: { netease: true, qq: true, kugou: true, kuwo: true },
};
