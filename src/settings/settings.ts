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

export interface TeleprompterSettings {
  fontOpacity: number; // 0-100，默认 80
  bgOpacity: number; // 0-100，默认 90
  selectionExtractEnabled: boolean; // 选中提取模式，默认开
  statusBarButton: boolean; // 状态栏「打开提词器」按钮，默认开
  windows: TeleprompterWindowState[]; // 打开的提词器实例（含位置/样式状态）
}

export const DEFAULT_SETTINGS: GlimpseSettings = {
  selectionHighlighter: {
    highlightSelectedText: true,
    maxMatches: 1000,
    minSelectionLength: 2,
    highlightDelay: 200,
    minimapEnabled: false,
  },
  staticHighlighter: {
    queries: {},
    queryOrder: [],
    groups: [],
  },
  highlightIndex: {
    autoOpenRightLeaf: true,
  },
  teleprompter: {
    fontOpacity: DEFAULT_FONT_OPACITY,
    bgOpacity: DEFAULT_BG_OPACITY,
    selectionExtractEnabled: true,
    statusBarButton: true,
    windows: [],
  },
};

export function setAttributes(element: any, attributes: any) {
  for (const key in attributes) {
    element.setAttribute(key, attributes[key]);
  }
}
