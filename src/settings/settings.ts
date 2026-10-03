import { StaticHighlightOptions } from "../highlighters/static";
import { SelectionHighlightOptions } from "../highlighters/selection";
import type { TeleprompterWindowState } from "../teleprompter";
import type { MusicSettings } from "../music/settings-types";
import { DEFAULT_MUSIC_SETTINGS } from "../music/settings-types";
import type { ReaderSettings } from "../reader/settings-types";
import { DEFAULT_READER_SETTINGS } from "../reader/settings-types";
import type { RegexReplaceSettings } from "../regex-replace/types";
import { DEFAULT_REGEX_REPLACE_SETTINGS } from "../regex-replace/types";

interface SearchConfig {
  value: string;
  type: string;
  range: { from: number; to: number };
}
export type markTypes = "line" | "match" | "group" | "start" | "end";

export type SettingValue = number | string | boolean;
export interface CSSSettings {
  [key: string]: SettingValue;
}

export interface SearchQuery {
  query: string;
  class: string;
  color: string | null;
  regex: boolean;
  mark?: markTypes[];
  css?: string;
  enabled?: boolean;
  group?: string;
  /** 备注该表达式匹配什么内容，仅用于设置页展示，不参与匹配 */
  desc?: string;
}
export interface SearchQueries {
  [key: string]: SearchQuery;
}

export type HighlighterOptions = SelectionHighlightOptions | StaticHighlightOptions;

export interface GlimpseSettings {
  selectionHighlighter: SelectionHighlightOptions;
  staticHighlighter: StaticHighlightOptions;
  highlightIndex: HighlightIndexSettings;
  teleprompter: TeleprompterSettings;
  /** 音乐模块（侧边栏歌词面板/歌单/多平台下载），持久化在 data.json 的 music 字段 */
  music: MusicSettings;
  /** 朗读模块（分段 + 本机 GPT-SoVITS），持久化在 data.json 的 reader 字段 */
  reader: ReaderSettings;
  /** 正则替换（查找/替换/预览 Modal），持久化在 data.json 的 regexReplace 字段 */
  regexReplace: RegexReplaceSettings;
}

export interface HighlightIndexSettings {
  autoOpenRightLeaf: boolean;
}

// 提词器设置 —— UI 接入在步骤 3；windows 持久化在步骤 4
// 不透明度初始值（百分比）—— 设置界面重置按钮恢复到此值
export const DEFAULT_FONT_OPACITY = 100;
export const DEFAULT_BG_OPACITY = 80;

// 正文字体/字重/颜色初始值 —— 取自当前实际使用配置
export const DEFAULT_FONT_FAMILY =
  "Smiley Sans, Source Han Serif SC VF, Source Han Sans SC VF";
export const DEFAULT_FONT_WEIGHT: number | null = null;
export const DEFAULT_FONT_COLOR = "#B00000";

// 文字阴影初始值（隐藏背景时的字幕投影）——
// 右偏 2px / 下偏 2px / 模糊 2px / 不透明度 40%，设置界面重置按钮恢复到此值
export const DEFAULT_SHADOW_ENABLED = true;
export const DEFAULT_SHADOW_OFFSET_X = 2;
export const DEFAULT_SHADOW_OFFSET_Y = 2;
export const DEFAULT_SHADOW_BLUR = 2;
export const DEFAULT_SHADOW_OPACITY = 40;

// 毛玻璃（backdrop-filter 模糊并提饱和窗口背后的内容）——
// 模糊 16px 与索引卡片观感接近；设置界面重置按钮恢复到此值
export const DEFAULT_GLASS_ENABLED = true;
export const DEFAULT_GLASS_BLUR = 16;

// 文字描边（正文字形轮廓描线，桌面歌词风格）——
// 默认开启、外侧描边、1px 白色（毛玻璃/半透明背景与深色主题上都清晰）；
// 颜色 null = 默认描边色（DEFAULT_STROKE_COLOR_VALUE），设置界面重置按钮恢复到此值。
// 描边方式：glyph = 字形描边（-webkit-text-stroke 沿字形，可见约一半线宽）；
// outer = 外侧描边（SVG feMorphology 膨胀滤镜，完整线宽外露，大线宽下斜角略方）
export type StrokeMode = "glyph" | "outer";
export const DEFAULT_STROKE_ENABLED = true;
export const DEFAULT_STROKE_MODE: StrokeMode = "outer";
export const DEFAULT_STROKE_COLOR: string | null = null;
export const DEFAULT_STROKE_COLOR_VALUE = "#FFFFFF";
export const DEFAULT_STROKE_WIDTH = 1;

// 文字渐变（覆盖「字体颜色」，背景裁切到文字）
export type GradientType = "linear" | "radial";
export type GradientScope = "block" | "char"; // block = 整个内容区一条渐变；char = 每字独立渐变
export interface GradientStop {
  color: string; // hex（不含 alpha）
  pos: number; // 停靠位置 0-100（%）
}
export const DEFAULT_GRADIENT_ENABLED = true;
export const DEFAULT_GRADIENT_TYPE: GradientType = "linear";
export const DEFAULT_GRADIENT_SCOPE: GradientScope = "char";
export const DEFAULT_GRADIENT_ANGLE = 160; // 线性渐变角度，180 = 从上到下
export const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { color: "#F2643C", pos: 0 },
  { color: "#C60C0C", pos: 100 },
];

/** 按停靠位置排序后拼出 CSS 渐变图片值；无停靠点返回空串 */
export function buildGradientImage(
  type: GradientType,
  angle: number,
  stops: GradientStop[]
): string {
  const valid = (stops || []).filter(s => s && s.color);
  if (valid.length === 0) return "";
  const parts = [...valid]
    .sort((a, b) => a.pos - b.pos)
    .map(s => `${s.color} ${s.pos}%`)
    .join(", ");
  return type === "radial"
    ? `radial-gradient(circle at center, ${parts})`
    : `linear-gradient(${angle}deg, ${parts})`;
}

export interface TeleprompterSettings {
  fontOpacity: number; // 0-100，默认 100
  bgOpacity: number; // 0-100，默认 80
  fontFamily: string; // 正文字体栈，逗号分隔；靠前且本机存在的字体优先生效，空串 = 跟随主题
  fontWeight: number | null; // 正文字重，null = 跟随主题
  fontColor: string | null; // 正文字体颜色（hex），null = 跟随主题
  glassEnabled: boolean; // 毛玻璃开关：backdrop-filter 模糊窗口背后的内容，默认开
  glassBlur: number; // 毛玻璃模糊半径（px），默认 16
  shadowEnabled: boolean; // 隐藏背景时文字阴影开关，默认开
  shadowOffsetX: number; // 阴影水平偏移（px，可负），默认 2
  shadowOffsetY: number; // 阴影垂直偏移（px，可负），默认 2
  shadowBlur: number; // 阴影模糊半径（px），默认 2
  shadowOpacity: number; // 阴影不透明度 0-100，默认 40
  strokeEnabled: boolean; // 文字描边开关（字形轮廓描线，始终生效），默认关
  strokeMode: StrokeMode; // glyph = 字形描边 | outer = 外侧描边（SVG 膨胀滤镜），默认 glyph
  strokeWidth: number; // 描边线宽（px），默认 3
  strokeColor: string | null; // 描边颜色（hex），null = 默认描边色（白）
  gradientEnabled: boolean; // 文字渐变开关，默认开（开启后覆盖 fontColor）
  gradientType: GradientType; // linear | radial，默认 linear
  gradientScope: GradientScope; // block = 整体一条渐变 | char = 每字独立渐变，默认 char
  gradientAngle: number; // 线性渐变角度 0-360，默认 160
  gradientStops: GradientStop[]; // 颜色停靠点（位置 %），默认橙红两停靠
  selectionExtractEnabled: boolean; // 选中提取模式，默认开
  statusBarButton: boolean; // 状态栏「打开提词器」按钮，默认开
  windows: TeleprompterWindowState[]; // 打开的提词器实例（含位置/样式状态）
  closed: TeleprompterWindowState[]; // 已关闭的实例状态（后进先出，重开时恢复）
}

export const DEFAULT_SETTINGS: GlimpseSettings = {
  selectionHighlighter: {
    highlightSelectedText: true,
    maxMatches: 1000,
    minSelectionLength: 2,
    maxSelectionLength: 30,
    highlightDelay: 200,
    minimapEnabled: false,
  },
  staticHighlighter: {
    queries: {},
    queryOrder: [],
    groups: [],
  },
  highlightIndex: {
    autoOpenRightLeaf: false,
  },
  teleprompter: {
    fontOpacity: DEFAULT_FONT_OPACITY,
    bgOpacity: DEFAULT_BG_OPACITY,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: DEFAULT_FONT_WEIGHT,
    fontColor: DEFAULT_FONT_COLOR,
    glassEnabled: DEFAULT_GLASS_ENABLED,
    glassBlur: DEFAULT_GLASS_BLUR,
    shadowEnabled: DEFAULT_SHADOW_ENABLED,
    shadowOffsetX: DEFAULT_SHADOW_OFFSET_X,
    shadowOffsetY: DEFAULT_SHADOW_OFFSET_Y,
    shadowBlur: DEFAULT_SHADOW_BLUR,
    shadowOpacity: DEFAULT_SHADOW_OPACITY,
    strokeEnabled: DEFAULT_STROKE_ENABLED,
    strokeMode: DEFAULT_STROKE_MODE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    strokeColor: DEFAULT_STROKE_COLOR,
    gradientEnabled: DEFAULT_GRADIENT_ENABLED,
    gradientType: DEFAULT_GRADIENT_TYPE,
    gradientScope: DEFAULT_GRADIENT_SCOPE,
    gradientAngle: DEFAULT_GRADIENT_ANGLE,
    gradientStops: DEFAULT_GRADIENT_STOPS.map(s => ({ ...s })),
    selectionExtractEnabled: true,
    statusBarButton: true,
    windows: [],
    closed: [],
  },
  music: { ...DEFAULT_MUSIC_SETTINGS, downloadSources: { ...DEFAULT_MUSIC_SETTINGS.downloadSources } },
  reader: {
    ...DEFAULT_READER_SETTINGS,
    filters: { ...DEFAULT_READER_SETTINGS.filters },
    segment: { ...DEFAULT_READER_SETTINGS.segment },
    tts: { ...DEFAULT_READER_SETTINGS.tts },
  },
  // history 数组单独展开 —— 不拷贝的话默认值数组会被各处共享引用
  regexReplace: { ...DEFAULT_REGEX_REPLACE_SETTINGS, history: [] },
};
