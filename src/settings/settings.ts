import { StaticHighlightOptions } from "../highlighters/static";
import { SelectionHighlightOptions } from "../highlighters/selection";
import type { TeleprompterWindowState } from "../teleprompter";

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
}

export interface HighlightIndexSettings {
  autoOpenRightLeaf: boolean;
}

// 提词器设置 —— UI 接入在步骤 3；windows 持久化在步骤 4
// 不透明度初始值（百分比）—— 设置界面重置按钮恢复到此值
export const DEFAULT_FONT_OPACITY = 80;
export const DEFAULT_BG_OPACITY = 90;

// 文字阴影初始值（隐藏背景时的字幕投影）—— 依据截图效果校准：
// 右偏 2px / 下偏 3px / 模糊 6px / 不透明度 60%，设置界面重置按钮恢复到此值
export const DEFAULT_SHADOW_ENABLED = true;
export const DEFAULT_SHADOW_OFFSET_X = 2;
export const DEFAULT_SHADOW_OFFSET_Y = 3;
export const DEFAULT_SHADOW_BLUR = 6;
export const DEFAULT_SHADOW_OPACITY = 60;

// 文字渐变（覆盖「字体颜色」，背景裁切到文字）
export type GradientType = "linear" | "radial";
export type GradientScope = "block" | "char"; // block = 整个内容区一条渐变；char = 每字独立渐变
export interface GradientStop {
  color: string; // hex（不含 alpha）
  pos: number; // 停靠位置 0-100（%）
}
export const DEFAULT_GRADIENT_ENABLED = false;
export const DEFAULT_GRADIENT_TYPE: GradientType = "linear";
export const DEFAULT_GRADIENT_SCOPE: GradientScope = "block";
export const DEFAULT_GRADIENT_ANGLE = 90; // 线性渐变角度，90 = 从左到右
export const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { color: "#FF4D4F", pos: 0 },
  { color: "#B00020", pos: 100 },
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
  fontOpacity: number; // 0-100，默认 80
  bgOpacity: number; // 0-100，默认 90
  fontFamily: string; // 正文字体栈，逗号分隔；靠前且本机存在的字体优先生效，空串 = 跟随主题
  fontWeight: number | null; // 正文字重，null = 跟随主题
  fontColor: string | null; // 正文字体颜色（hex），null = 跟随主题
  shadowEnabled: boolean; // 隐藏背景时文字阴影开关，默认开
  shadowOffsetX: number; // 阴影水平偏移（px，可负），默认 2
  shadowOffsetY: number; // 阴影垂直偏移（px，可负），默认 3
  shadowBlur: number; // 阴影模糊半径（px），默认 6
  shadowOpacity: number; // 阴影不透明度 0-100，默认 60
  gradientEnabled: boolean; // 文字渐变开关，默认关（开启后覆盖 fontColor）
  gradientType: GradientType; // linear | radial，默认 linear
  gradientScope: GradientScope; // block = 整体一条渐变 | char = 每字独立渐变，默认 block
  gradientAngle: number; // 线性渐变角度 0-360，默认 90
  gradientStops: GradientStop[]; // 颜色停靠点（位置 %），默认红系两停靠
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
    fontFamily: "",
    fontWeight: null,
    fontColor: null,
    shadowEnabled: DEFAULT_SHADOW_ENABLED,
    shadowOffsetX: DEFAULT_SHADOW_OFFSET_X,
    shadowOffsetY: DEFAULT_SHADOW_OFFSET_Y,
    shadowBlur: DEFAULT_SHADOW_BLUR,
    shadowOpacity: DEFAULT_SHADOW_OPACITY,
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
};

export function setAttributes(element: any, attributes: any) {
  for (const key in attributes) {
    element.setAttribute(key, attributes[key]);
  }
}
