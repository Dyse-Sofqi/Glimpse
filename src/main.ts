import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  ButtonComponent,
  debounce,
  FileSystemAdapter,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
} from "obsidian";
import { highlightSelectionMatches, reconfigureSelectionHighlighter, SelectionHighlightOptions } from "./highlighters/selection";
import { buildStyles, reconfigureStaticHighlighter, staticHighlighterExtension } from "./highlighters/static";
import { minimapExtension } from "./highlighters/minimap";
import { scrollbarMarkersExtension } from "./highlighters/scrollbar-markers";
import { DEFAULT_SETTINGS, GlimpseSettings, HighlighterOptions } from "./settings/settings";
import { DEFAULT_MUSIC_SETTINGS } from "./music/settings-types";
import { DEFAULT_READER_SETTINGS, MIN_SPEED_FACTOR } from "./reader/settings-types";
import type { ReaderTtsProvider } from "./reader/settings-types";
import { buildSegments, buildLimitPlan } from "./reader/segmenter";
import { formatReport, runDiagnostics } from "./reader/diagnostics";
import { GptSoVitsEngine } from "./reader/tts/gpt-sovits";
import { Qwen3TtsEngine } from "./reader/tts/qwen3-tts";
import { QwenTtsServiceLauncher } from "./reader/tts/qwen-launcher";
import { WindowsSapiTtsEngine } from "./reader/tts/windows-tts";
import { RoutingTtsEngine } from "./reader/tts/router";
import type { TtsEngine } from "./reader/tts/types";
import { GptSoVitsServiceLauncher } from "./reader/tts/service-launcher";
import { createServiceRecordStore } from "./reader/tts/service-record";
import { isWindows } from "./reader/node-bridge";
import { ReaderController } from "./reader/controller";
import { ReaderPlayerBar } from "./reader/player-bar";
import { readerHighlightExtension } from "./reader/highlight";
import { generateAudioFileFromText } from "./reader/audio-export";
import { searchHighlightExtension } from "./regex-replace/highlight";
import { RegexReplaceModal } from "./regex-replace/replace-modal";
import { DEFAULT_REGEX_REPLACE_SETTINGS } from "./regex-replace/types";
import { SettingTab } from "./settings/ui";
import { HIGHLIGHT_INDEX_VIEW, HighlightIndexView } from "./highlight-index-view";
import { TeleprompterManager } from "./teleprompter";
import { MUSIC_VIEW_TYPE } from "./music/shared";
import { MusicManager } from "./music/manager";
import MusicView from "./music/musicView";

/**
 * 两个权重是否「名称成对」：去掉目录与扩展名后同名（大小写不敏感）。
 * 与「选择音色…」的配对规则一致 —— 只有同名才视为来自同一套模型，
 * 用于自动应用前的守卫（错配不报错、只会静默产出错音色）。
 */
function isWeightPair(gptWeights: string, sovitsWeights: string): boolean {
  const base = (value: string) =>
    (value.trim().split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "").toLowerCase();
  const gpt = base(gptWeights);
  const sovits = base(sovitsWeights);
  return gpt !== "" && gpt === sovits;
}

export default class GlimpsePlugin extends Plugin {
  settings!: GlimpseSettings;
  extensions!: Extension[];
  styles!: Extension;
  staticHighlighter!: Extension;
  selectionHighlighter!: Extension;
  minimapExtension!: Extension;
  settingsTab!: SettingTab;
  private cssSheets: CSSStyleSheet[] = [];
  teleprompterManager!: TeleprompterManager;
  music!: MusicManager;
  /**
   * 朗读模块的 TTS 引擎门面：常驻实例，按 settings.reader.provider 路由。
   * 不能直接换这个字段 —— SegmentQueue 构造时捕获了引擎引用，换字段不生效。
   */
  readerEngine!: RoutingTtsEngine;
  /** GPT-SoVITS 引擎（参考音频克隆；setWeights/requestShutdown 等专有能力从这里调） */
  readerGptEngine!: GptSoVitsEngine;
  /** Qwen3-TTS 引擎（VoiceDesign，音色为自然语言描述） */
  readerQwenEngine!: Qwen3TtsEngine;
  /** Windows 本地语音引擎（系统内置 SAPI5，零安装兜底；没有服务进程要管） */
  readerWindowsEngine!: WindowsSapiTtsEngine;
  /** GPT-SoVITS 服务启动器（检测优先，只杀自己启动的进程） */
  readerLauncher!: GptSoVitsServiceLauncher;
  /** Qwen3-TTS 推理服务启动器（生命周期模式与 GPT-SoVITS 启动器一致） */
  readerQwenLauncher!: QwenTtsServiceLauncher;
  /** 朗读流程编排（分段 → 合成 → 播放 → 高亮） */
  readerController!: ReaderController;
  /** 注入到笔记顶部的朗读播放条 */
  readerPlayerBar!: ReaderPlayerBar;
  private statusBarItem?: HTMLElement;

  async onload() {
    await this.loadSettings();
    // 音乐模块先于提词器创建：提词器歌词模式构造时订阅其播放状态
    // （歌单扫描/播放控制/状态分发中枢；设置页渲染 music-ui 前必须已创建）
    this.music = new MusicManager(this.app, this, this.settings.music);
    // 朗读提供方：无网络请求，构造即用；参数变更时由 refreshReaderEngine 同步。
    // 两个引擎与启动器都常驻 —— 切换 provider 只是改路由，进程与服务互不影响
    this.readerGptEngine = new GptSoVitsEngine({ ...this.settings.reader.tts });
    this.readerQwenEngine = new Qwen3TtsEngine({
      baseUrl: this.settings.reader.qwen.baseUrl,
      language: this.settings.reader.qwen.language,
      instruct: this.settings.reader.qwen.instruct,
      timeoutMs: this.settings.reader.qwen.timeoutMs,
    });
    this.readerWindowsEngine = new WindowsSapiTtsEngine({
      voiceName: this.settings.reader.windows.voiceName,
      speedFactor: this.settings.reader.windows.speedFactor,
      volume: this.settings.reader.windows.volume,
      timeoutMs: this.settings.reader.windows.timeoutMs,
      shellPath: this.settings.reader.windows.shellPath,
    });
    this.readerEngine = new RoutingTtsEngine(
      {
        "gpt-sovits": this.readerGptEngine,
        "qwen3-tts": this.readerQwenEngine,
        "windows-tts": this.readerWindowsEngine,
      },
      this.settings.reader.provider
    );
    this.readerLauncher = new GptSoVitsServiceLauncher(
      this.readerGptEngine,
      // 归属落盘：插件重载后 child 句柄会丢，但 PID 能认领回来，
      // 否则那个 python 进程就成了「在跑但没人负责停」的孤儿
      createServiceRecordStore(this.app, this.manifest.id),
      this.pluginFilePath("reader-service.log")
    );
    this.readerQwenLauncher = new QwenTtsServiceLauncher(
      this.readerQwenEngine,
      // 两个提供方各存一份归属，互不覆盖（可能同时各跑一个服务）
      createServiceRecordStore(this.app, this.manifest.id, "reader-qwen-service.json"),
      this.pluginFilePath("reader-qwen-service.log"),
      this.pluginFilePath("reader-qwen-server.py")
    );
    this.readerController = new ReaderController(this);
    this.readerPlayerBar = new ReaderPlayerBar(this.readerController);
    this.register(() => {
      this.readerPlayerBar.unmount();
      this.readerController.dispose();
      this.readerLauncher.dispose(this.settings.reader.stopServiceOnUnload);
      this.readerQwenLauncher.dispose(this.settings.reader.stopServiceOnUnload);
      this.readerEngine.dispose();
    });
    // 认领上次启动、可能仍在运行的服务（异步，不阻塞加载）
    void this.readerLauncher
      .adoptFromRecord(this.settings.reader.tts.baseUrl)
      .then(adopted => {
        if (adopted) {
          console.log(
            `Glimpse 朗读：已认领上次启动的 GPT-SoVITS 服务（PID ${this.readerLauncher.getOwnedPid()}）`
          );
        }
      })
      .catch(() => undefined);
    void this.readerQwenLauncher
      .adoptFromRecord(this.settings.reader.qwen.baseUrl)
      .then(adopted => {
        if (adopted) {
          console.log(
            `Glimpse 朗读：已认领上次启动的 Qwen3-TTS 服务（PID ${this.readerQwenLauncher.getOwnedPid()}）`
          );
        }
      })
      .catch(() => undefined);
    // 提词器先于视图注册初始化：高亮索引视图 onOpen（layout-ready 可能同步触发）
    // 会经 anchoredDocPath 读 teleprompterManager，晚初始化即 undefined 崩溃
    this.teleprompterManager = new TeleprompterManager(this);
    this.register(() => this.music.onunload());
    this.registerView(HIGHLIGHT_INDEX_VIEW, (leaf) => new HighlightIndexView(leaf, this));
    this.registerView(MUSIC_VIEW_TYPE, (leaf) => new MusicView(leaf, this.music));
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions = [];
    this.updateSelectionHighlighter();
    this.updateMinimap();
    this.extensions.push(scrollbarMarkersExtension());
    this.extensions.push(this.staticHighlighter);
    // 朗读段级高亮：CM6 装饰器，自动跟随换行/主题，无需 DOM 测量
    this.extensions.push(readerHighlightExtension());
    // 正则替换：Modal 打开期间的实时命中高亮（效果由 Modal 推入/清除）
    this.extensions.push(searchHighlightExtension());
    this.updateStyles();
    this.registerEditorExtension(this.extensions);
    this.initCSS();
    if (this.settings.highlightIndex.autoOpenRightLeaf) {
      this.app.workspace.onLayoutReady(() => this.openHighlightIndex());
    }

    this.addCommand({
      id: "open-highlight-index",
      name: "打开高亮索引",
      callback: () => this.openHighlightIndex(),
    });

    // 正则替换：命令 + 正文右键菜单
    this.addCommand({
      id: "open-regex-replace",
      name: "打开正则替换",
      editorCallback: (editor) => new RegexReplaceModal(this, editor).open(),
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) return;
        menu.addItem((item) =>
          item
            .setTitle("正则替换…")
            .setIcon("regex")
            .onClick(() => new RegexReplaceModal(this, editor).open())
        );
      })
    );
    // Ctrl+H 接管为正则替换面板。核心命令「替换」默认占着这个键，而 Obsidian
    // 对与现有命令冲突的插件默认热键不会分配（hotkeys 声明无效），所以要拿到这个键
    // 只能在 window 捕获阶段拦截并拦下传播。条件刻意收窄，其余场景一律让路：
    //   - 仅编辑器上下文（与核心「替换」的作用域一致）；
    //   - 恰好 Ctrl+H，无 Shift/Alt/Win 组合；
    //   - 输入法组词期间不抢；
    //   - 有其他 Modal（快速切换器、设置、确认框等）开着时不抢；
    //   - macOS 不抢 —— Cmd+H 是系统级「隐藏窗口」。
    this.registerDomEvent(
      window,
      "keydown",
      (event: KeyboardEvent) => {
        if (Platform.isMacOS) return;
        if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
        if (event.key !== "h" && event.key !== "H") return;
        if (event.isComposing) return;
        if (document.querySelector(".modal-container")) return;
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        event.preventDefault();
        event.stopPropagation();
        new RegexReplaceModal(this, view.editor).open();
      },
      { capture: true }
    );

    // 提词器 —— 桌面端专用（ADRs/0001）
    this.register(() => this.teleprompterManager.onunload());
    this.addCommand({
      id: "open-teleprompter",
      name: "打开提词器",
      callback: () => {
        if (!Platform.isDesktop) return;
        this.teleprompterManager.openOrFocus();
      },
    });
    this.addCommand({
      id: "close-all-teleprompters",
      name: "关闭所有提词器",
      callback: () => {
        if (!Platform.isDesktop) return;
        this.teleprompterManager.closeAll();
      },
    });

    // 音乐模块：ribbon 图标 + 命令（播放/切歌/歌单/下载）
    this.addRibbonIcon("music", "Glimpse 音乐面板", () => void this.music.activateView());
    this.addCommand({
      id: "open-music-panel",
      name: "打开音乐面板",
      callback: () => void this.music.activateView(),
    });
    this.addCommand({
      id: "music-toggle-play",
      name: "音乐：播放/暂停",
      callback: () => this.music.toggleActivePlayer(),
    });
    this.addCommand({
      id: "music-next-song",
      name: "音乐：下一首",
      callback: () => this.music.stepSong(1),
    });
    this.addCommand({
      id: "music-prev-song",
      name: "音乐：上一首",
      callback: () => this.music.stepSong(-1),
    });
    this.addCommand({
      id: "music-open-download",
      name: "音乐：打开在线歌曲搜索",
      callback: async () => {
        await this.music.activateView();
        const leaf = this.app.workspace.getLeavesOfType(MUSIC_VIEW_TYPE)[0];
        if (leaf?.view instanceof MusicView) leaf.view.showOnlineTab();
      },
    });

    // 朗读模块：环境诊断 + 分段预览（骨架阶段，播放与高亮在后续步骤接入）
    this.addCommand({
      id: "reader-diagnostics",
      name: "朗读：环境诊断",
      callback: () => void this.runReaderDiagnostics(),
    });
    this.addCommand({
      id: "reader-preview-segments",
      name: "朗读：预览分段（不发声）",
      checkCallback: checking => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (!checking) this.previewReaderSegments(view);
        return true;
      },
    });
    this.addCommand({
      id: "reader-start-service",
      name: "朗读：启动本地服务",
      callback: () => void this.startReaderService(),
    });
    this.addCommand({
      id: "reader-stop-service",
      name: "朗读：停止本地服务",
      callback: () => void this.stopReaderService(),
    });
    this.addCommand({
      id: "reader-service-log",
      name: "朗读：查看服务日志",
      callback: () => this.showReaderServiceLog(),
    });
    this.addCommand({
      id: "reader-force-stop-service",
      name: "朗读：强制停止服务（按端口）",
      callback: () => void this.forceStopReaderService(),
    });
    this.addCommand({
      id: "reader-apply-voice",
      name: "朗读：应用设置的音色",
      callback: () => void this.applyReaderVoice(),
    });
    this.addCommand({
      id: "reader-restart-service",
      name: "朗读：重启本地服务",
      callback: () => void this.restartReaderService(),
    });

    // 朗读入口：三种起点 + 播放控制
    const addReadCommand = (
      id: string,
      name: string,
      mode: "top" | "cursor" | "selection"
    ) => {
      this.addCommand({
        id,
        name,
        checkCallback: checking => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (!view) return false;
          if (!checking) this.beginReading(view, mode);
          return true;
        },
      });
    };
    addReadCommand("reader-read-from-top", "朗读：从头读", "top");
    addReadCommand("reader-read-from-cursor", "朗读：从光标读", "cursor");
    addReadCommand("reader-read-from-selection", "朗读：读选区", "selection");
    // 朗读导出：选中文本 → 单个音频文件（与朗读共用分段链与引擎）
    this.addCommand({
      id: "reader-generate-audio",
      name: "朗读：生成音频文件（选区）",
      checkCallback: checking => {
        if (!Platform.isDesktop) return false; // 写盘走 Node fs，移动端没有这条通路
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.editor.getSelection().trim()) return false;
        if (!checking) void this.generateAudioFromSelection(view);
        return true;
      },
    });
    // 正文右键菜单：朗读入口 + 选区导出（导出仅在有选区时出现，避免误触）
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) return;
        menu.addItem(item =>
          item
            .setTitle("朗读：从光标读")
            .setIcon("play")
            .onClick(() => this.beginReading(view, "cursor"))
        );
        if (!Platform.isDesktop) return;
        if (!editor.getSelection().trim()) return;
        menu.addItem(item =>
          item
            .setTitle("朗读：生成音频文件")
            .setIcon("file-audio")
            .onClick(() => void this.generateAudioFromSelection(view))
        );
      })
    );
    this.addCommand({
      id: "reader-toggle-play",
      name: "朗读：播放/暂停",
      callback: () => void this.readerController.togglePlayPause(),
    });
    this.addCommand({
      id: "reader-stop",
      name: "朗读：停止",
      callback: () => this.readerController.stop(),
    });

    // 音乐模块生命周期：vault 事件（重扫）+ 状态初始化（首扫后恢复上次播放进度，不自动播放）
    this.music.registerVaultEvents();
    void this.music.scanLyricSongs().then(() => this.music.restoreLastPlayed());

    // 状态栏「打开提词器」按钮（随设置显隐）
    this.updateStatusBarButton();
  }

  /** 状态栏「打开提词器」按钮：图标 presentation，右下角；设置关闭或移动端时移除 */
  updateStatusBarButton() {
    const show = this.settings.teleprompter.statusBarButton !== false && Platform.isDesktop;
    if (!show) {
      this.statusBarItem?.detach();
      this.statusBarItem = undefined;
      return;
    }
    if (this.statusBarItem) return;
    const item = (this.statusBarItem = this.addStatusBarItem());
    item.addClass("glimpse-tp-statusbar-btn");
    // 状态栏 flex-direction: row-reverse —— addStatusBarItem 追加到末尾会落在最左，
    // 移到首位即为右下角（时钟旁）
    const statusBar = document.querySelector(".status-bar");
    if (statusBar) statusBar.prepend(item);
    new ButtonComponent(item)
      .setClass("clickable-icon")
      .setIcon("lucide-presentation")
      .setTooltip("打开提词器")
      .onClick(() => {
        if (!Platform.isDesktop) return;
        this.teleprompterManager.openOrFocus();
      });
    this.register(() => item.detach());
  }

  openHighlightIndex() {
    const existing = this.app.workspace.getLeavesOfType(HIGHLIGHT_INDEX_VIEW);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const rightLeaf = this.app.workspace.getRightLeaf(false);
    if (rightLeaf) {
      rightLeaf.setViewState({ type: HIGHLIGHT_INDEX_VIEW, active: true });
      this.app.workspace.revealLeaf(rightLeaf);
    }
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // 提词器设置单独深层合并（浅合并下 windows[] 数组会被整体覆盖）
    this.settings.teleprompter = Object.assign({}, DEFAULT_SETTINGS.teleprompter, data?.teleprompter ?? {});
    // 音乐设置单独深层合并（浅合并下 platformCookies/downloadSources 对象会被整体覆盖）
    this.settings.music = Object.assign({}, DEFAULT_MUSIC_SETTINGS, data?.music ?? {});
    this.settings.music.downloadSources = Object.assign(
      {}, DEFAULT_MUSIC_SETTINGS.downloadSources, data?.music?.downloadSources ?? {},
    );
    // 朗读设置单独深层合并（浅合并下 filters/segment/tts 会被整体覆盖）
    this.settings.reader = Object.assign({}, DEFAULT_READER_SETTINGS, data?.reader ?? {});
    this.settings.reader.filters = Object.assign(
      {}, DEFAULT_READER_SETTINGS.filters, data?.reader?.filters ?? {},
    );
    this.settings.reader.segment = Object.assign(
      {}, DEFAULT_READER_SETTINGS.segment, data?.reader?.segment ?? {},
    );
    this.settings.reader.tts = Object.assign(
      {}, DEFAULT_READER_SETTINGS.tts, data?.reader?.tts ?? {},
    );
    this.settings.reader.qwen = Object.assign(
      {}, DEFAULT_READER_SETTINGS.qwen, data?.reader?.qwen ?? {},
    );
    this.settings.reader.windows = Object.assign(
      {}, DEFAULT_READER_SETTINGS.windows, data?.reader?.windows ?? {},
    );
    // 正则替换设置深层合并（history 数组随整体覆盖即可，默认本来就是空数组）
    this.settings.regexReplace = Object.assign(
      {}, DEFAULT_REGEX_REPLACE_SETTINGS, data?.regexReplace ?? {},
    );
    // 首段上限旧默认 25 → 新默认 15（配合「首段渐进」可无空档地降低首字延迟）。
    // 只在用户没动过这个值（仍等于旧默认）时迁移，避免覆盖他自己的调整
    if (this.settings.reader.segment.firstMaxChars === 25) {
      this.settings.reader.segment.firstMaxChars = 15;
      await this.saveSettings();
    }
    // 强制对齐项目默认值并写回磁盘，避免 data.json 残留旧值
    let changed = false;
    if (this.settings.selectionHighlighter.minSelectionLength !== DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength) {
      this.settings.selectionHighlighter.minSelectionLength = DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength;
      changed = true;
    }
    if (this.settings.selectionHighlighter.maxSelectionLength === undefined) {
      this.settings.selectionHighlighter.maxSelectionLength = DEFAULT_SETTINGS.selectionHighlighter.maxSelectionLength;
      changed = true;
    }
    if (this.settings.selectionHighlighter.maxMatches !== DEFAULT_SETTINGS.selectionHighlighter.maxMatches) {
      this.settings.selectionHighlighter.maxMatches = DEFAULT_SETTINGS.selectionHighlighter.maxMatches;
      changed = true;
    }
    if (this.settings.selectionHighlighter.highlightDelay < 200) {
      this.settings.selectionHighlighter.highlightDelay = 200;
      changed = true;
    }
    if (changed) await this.saveSettings();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** 注入用户自定义 CSS。审核要求禁止创建/挂载 <style> 元素；
     改用 CSSStyleSheet + document.adoptedStyleSheets（无样式元素，Chromium 全支持） */
  initCSS() {
    this.updateCustomCSS();
    this.register(() => {
      for (const s of this.cssSheets) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== s);
      }
    });
  }

  updateCustomCSS() {
    // 卸载旧注入的 stylesheet
    for (const s of this.cssSheets) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== s);
    }
    this.cssSheets = [];
    const css = Object.values(this.settings.staticHighlighter.queries)
      .map(q => q?.css)
      .filter((c): c is string => !!c)
      .join("\n");
    if (css) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets.push(sheet);
      this.cssSheets.push(sheet);
    }
    this.app.workspace.trigger("css-change");
  }

  updateStyles() {
    this.extensions.remove(this.styles);
    this.styles = buildStyles(this);
    this.extensions.push(this.styles);
    this.app.workspace.updateOptions();
  }

  updateStaticHighlighter() {
    this.extensions.remove(this.staticHighlighter);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.push(this.staticHighlighter);
    this.app.workspace.updateOptions();
    // Dispatch compartment reconfigure to already-open editors
    const options = this.settings.staticHighlighter;
    this.iterateCM6(view => {
      view.dispatch({
        effects: reconfigureStaticHighlighter(options),
      });
    });
  }

  updateSelectionHighlighter() {
    this.extensions.remove(this.selectionHighlighter);
    this.selectionHighlighter = highlightSelectionMatches(this.settings.selectionHighlighter)
    this.extensions.push(this.selectionHighlighter);
    this.updateMinimap();
    this.app.workspace.updateOptions();
  }

  updateMinimap() {
    this.extensions.remove(this.minimapExtension);
    if (this.settings.selectionHighlighter.minimapEnabled) {
      this.minimapExtension = minimapExtension({ enabled: true, width: 80 });
      this.extensions.push(this.minimapExtension);
    }
  }

  iterateCM6(callback: (editor: EditorView) => unknown) {
    this.app.workspace.iterateAllLeaves(leaf => {
      leaf?.view instanceof MarkdownView &&
        (leaf.view.editor as any)?.cm instanceof EditorView &&
        callback((leaf.view.editor as any).cm);
    });
  }

  /**
   * 把捕获到的服务日志打到控制台（按当前引擎取对应启动器的日志）。
   * 合成报错时服务只回一句「tts failed」，真正的 Python traceback 在它的 stdout 里，
   * 而这个 stdout 由启动器捕获 —— 不导出来就没法定位。
   */
  showReaderServiceLog() {
    const provider = this.settings.reader.provider;
    if (provider === "windows-tts") {
      // 这个引擎没有常驻服务，能看的只有「最近几次子进程的 stderr」
      const tail = this.readerWindowsEngine.getLogTail(40);
      console.group("=== 朗读服务日志（Windows 本地语音） ===");
      console.log("无需本地服务；下面是最近几次合成的 PowerShell 输出");
      if (tail.length === 0) console.log("（无输出：本次会话还没跑过合成，或合成全部成功）");
      else for (const line of tail) console.log(line);
      console.groupEnd();
      new Notice(
        tail.length === 0
          ? "Windows 本地语音没有常驻服务日志（本次会话尚未有失败输出）"
          : `已输出 ${tail.length} 行 PowerShell 输出到控制台`,
        6000
      );
      return;
    }
    const isQwen = provider === "qwen3-tts";
    const launcher = isQwen ? this.readerQwenLauncher : this.readerLauncher;
    const tail = launcher.getLogTail(80);
    console.group(`=== 朗读服务日志（${isQwen ? "Qwen3-TTS" : "GPT-SoVITS"}） ===`);
    console.log(`状态：${launcher.getState()}`);
    if (!isQwen) {
      console.log(`已加载模型：${JSON.stringify(this.readerLauncher.getLoadedModel())}`);
    }
    console.log(`检测到 CUDA 降级：${launcher.hasCudaDowngrade()}`);
    if (tail.length === 0) {
      console.log("（无日志：服务可能不是由本插件启动的，或尚未启动）");
    } else {
      for (const line of tail) console.log(line);
    }
    console.groupEnd();

    new Notice(
      tail.length === 0
        ? "没有捕获到服务日志（服务可能不是由本插件启动的）"
        : `已输出 ${tail.length} 行服务日志到控制台`,
      6000
    );
  }

  /** 当前朗读引擎的推理健康度上报（分发到激活提供方的启动器 / 引擎） */
  markReaderHealth(ok: boolean, reason?: string): void {
    if (this.settings.reader.provider === "windows-tts") {
      ok
        ? this.readerWindowsEngine.markHealthy()
        : this.readerWindowsEngine.markUnhealthy(reason ?? "原因未知");
      return;
    }
    if (this.settings.reader.provider === "qwen3-tts") {
      ok ? this.readerQwenLauncher.markHealthy() : this.readerQwenLauncher.markUnhealthy(reason ?? "原因未知");
    } else {
      ok ? this.readerLauncher.markHealthy() : this.readerLauncher.markUnhealthy(reason ?? "原因未知");
    }
  }

  /** 当前激活引擎的服务日志尾部（Windows 本地语音给的是最近几次 PowerShell 的 stderr） */
  readerLogTail(lineCount = 12): string[] {
    if (this.settings.reader.provider === "windows-tts") {
      return this.readerWindowsEngine.getLogTail(lineCount);
    }
    return this.settings.reader.provider === "qwen3-tts"
      ? this.readerQwenLauncher.getLogTail(lineCount)
      : this.readerLauncher.getLogTail(lineCount);
  }

  /**
   * 切换引擎后停掉**另外两套**引擎的服务 —— 模型同时常驻会叠加显存占用
   * （GPT-SoVITS 约 1–3 GB，Qwen3-TTS 约 4–5 GB），用户几乎不需要同时开。
   * 切到 Windows 本地语音（零依赖兜底）时同样停掉，把显存整个让出来。
   *
   * 底线：**只停由本插件启动的服务**。外部启动的不动（用户可能在为别的应用开着），
   * 但要提示一句，让「显存怎么还被占着」有迹可循。
   */
  async stopOtherReaderService(active: ReaderTtsProvider): Promise<void> {
    const entries: Array<{
      provider: ReaderTtsProvider;
      name: string;
      launcher: GptSoVitsServiceLauncher | QwenTtsServiceLauncher;
    }> = [
      { provider: "gpt-sovits", name: "GPT-SoVITS", launcher: this.readerLauncher },
      { provider: "qwen3-tts", name: "Qwen3-TTS", launcher: this.readerQwenLauncher },
    ];

    const stopped: string[] = [];
    const external: string[] = [];
    for (const entry of entries) {
      if (entry.provider === active) continue;
      const state = entry.launcher.getState();
      if (state === "owned" || state === "starting") {
        const result = await entry.launcher.stop();
        console.log(
          `Glimpse 朗读：切换引擎，${entry.name} 服务已停止 —— ${result.message}`
        );
        stopped.push(entry.name);
      } else if (state === "external") {
        external.push(entry.name);
      }
    }
    if (stopped.length > 0) {
      new Notice(`已停止 ${stopped.join(" / ")} 服务，为当前引擎释放显存`, 5000);
    }
    if (external.length > 0) {
      new Notice(
        `${external.join(" / ")} 服务是外部启动的，仍在运行（插件不会替你关闭外部服务）—— 显存仍被占用`,
        8000
      );
    }
  }

  /**
   * 确保当前引擎可用，供控制器在朗读前调用。
   * 两个服务型引擎走各自的启动器；Windows 本地语音没有服务要起，
   * 只把环境自检（PowerShell / 语音列表 / 配置的语音是否存在）的结果回给控制器 ——
   * 语音名填错这类问题必须在这里就说清楚，否则会拖到「第 1 段合成失败」。
   */
  async ensureReaderServiceRunning(
    onProgress?: (message: string) => void
  ): Promise<{ ok: boolean; message: string }> {
    const provider = this.settings.reader.provider;
    if (provider === "windows-tts") {
      const probe = await this.readerWindowsEngine.probe();
      return {
        ok: probe.ok,
        message: probe.ok ? "Windows 本地语音无需启动服务（系统内置）" : probe.message,
      };
    }
    if (provider === "qwen3-tts") {
      const qwen = this.settings.reader.qwen;
      const result = await this.readerQwenLauncher.ensureRunning({
        modelPath: qwen.modelPath,
        pythonPath: qwen.pythonPath,
        baseUrl: qwen.baseUrl,
        device: qwen.device,
        onProgress,
      });
      return { ok: result.ok, message: result.message };
    }
    const result = await this.readerLauncher.ensureRunning({
      installRoot: this.settings.reader.tts.installRoot,
      baseUrl: this.settings.reader.tts.baseUrl,
      onProgress,
    });
    return { ok: result.ok, message: result.message };
  }

  /**
   * 启动（或复用）本机 GPT-SoVITS 服务。
   * 检测优先：已有服务在跑就直接复用，不抢端口；只杀自己启动的进程。
   */
  async startReaderService(): Promise<boolean> {
    return this.startOrRestartReaderService(false);
  }

  /**
   * 重启本地服务：强制停止 + 重新启动。
   *
   * 用于服务进程处于坏状态时 —— 最典型的是「服务可达但推理全失败」
   * （旧版管道缺陷导致写日志报 Errno 22）。这种状态下重新启动即可恢复。
   */
  async restartReaderService(silent = false): Promise<boolean> {
    return this.startOrRestartReaderService(true, silent);
  }

  private async startOrRestartReaderService(force: boolean, silent = false): Promise<boolean> {
    if (this.settings.reader.provider === "windows-tts") {
      return this.checkWindowsTts(silent);
    }
    if (this.settings.reader.provider === "qwen3-tts") {
      return this.startOrRestartQwenService(force, silent);
    }
    // silent：进度交给播放条显示。Notice 浮在窗口右上角且层级最高，
    // 朗读开始时弹「正在准备服务…」会盖住顶部的播放条
    const notice = silent ? null : new Notice(force ? "正在重启本地语音服务…" : "正在准备本地语音服务…", 0);
    try {
      if (force) await this.readerLauncher.forceStop();

      const result = await this.readerLauncher.ensureRunning({
        installRoot: this.settings.reader.tts.installRoot,
        baseUrl: this.settings.reader.tts.baseUrl,
        onProgress: message => notice?.setMessage(message),
      });
      notice?.hide();
      const tail = result.logTail ?? this.readerLauncher.getLogTail();
      console.log(
        `朗读服务：${result.message}` + (tail.length > 0 ? `\n日志尾部：\n${tail.join("\n")}` : "")
      );

      if (!result.ok) {
        new Notice(
          tail.length > 0 ? `${result.message}\n（详细日志见控制台）` : result.message,
          15000
        );
        return false;
      }
      new Notice(result.message, result.started ? 8000 : 4000);

      // 只在「本次确实新启动了服务」且「两个权重都填齐」时才切换模型。
      // - 对已在运行的服务不动它的权重：可能是别的应用在用，也可能是用户在网页里调好的状态
      // - 只填一个权重不会报错，但会静默产出错误的音色（实测），宁可不切
      const { gptWeights, sovitsWeights } = this.settings.reader.tts;
      const hasGpt = gptWeights.trim() !== "";
      const hasSovits = sovitsWeights.trim() !== "";
      if (result.started && hasGpt && hasSovits) {
        const switched = await this.readerGptEngine.setWeights(gptWeights, sovitsWeights);
        if (!switched.ok) console.warn("朗读服务权重切换失败：", switched.message);
      } else if (hasGpt !== hasSovits) {
        new Notice(
          "「GPT 权重」与「SoVITS 权重」需要同时填写或同时留空。\n" +
            "只填一个不会报错，但会静默产出错误的音色，已跳过切换。",
          12000
        );
      }
      return true;
    } catch (error) {
      notice?.hide();
      const detail = error instanceof Error ? error.message : String(error);
      console.error("朗读服务启动异常", error);
      if (!silent) new Notice(`启动失败：${detail}`, 10000);
      return false;
    }
  }

  /**
   * Windows 本地语音分支：没有服务可起，只做一次配置自检。
   *
   * 与两个服务型引擎的差别就在这 —— 点「启动 / 复用」时它只是核对
   * PowerShell 能不能用、配置的语音名是否真的在系统里，
   * 因为这些问题拖到第一段合成才炸的话，报错信息对用户没有指引。
   */
  private async checkWindowsTts(silent: boolean): Promise<boolean> {
    const probe = await this.readerWindowsEngine.probe();
    if (!probe.ok) {
      if (!silent) new Notice(probe.message, 15000);
      return false;
    }
    if (!silent) new Notice(probe.message, 6000);
    return true;
  }

  /** Qwen3-TTS 分支：启动（或重启）本机推理服务 */
  private async startOrRestartQwenService(force: boolean, silent = false): Promise<boolean> {
    const notice = silent
      ? null
      : new Notice(force ? "正在重启 Qwen3-TTS 服务…" : "正在准备 Qwen3-TTS 服务…", 0);
    try {
      if (force) await this.readerQwenLauncher.forceStop();

      const qwen = this.settings.reader.qwen;
      const result = await this.readerQwenLauncher.ensureRunning({
        modelPath: qwen.modelPath,
        pythonPath: qwen.pythonPath,
        baseUrl: qwen.baseUrl,
        device: qwen.device,
        onProgress: message => notice?.setMessage(message),
      });
      notice?.hide();
      const tail = result.logTail ?? this.readerQwenLauncher.getLogTail();
      console.log(
        `Qwen3-TTS 服务：${result.message}` +
          (tail.length > 0 ? `\n日志尾部：\n${tail.join("\n")}` : "")
      );

      if (!result.ok) {
        new Notice(
          tail.length > 0 ? `${result.message}\n（详细日志见控制台）` : result.message,
          15000
        );
        return false;
      }
      new Notice(result.message, result.started ? 8000 : 4000);
      return true;
    } catch (error) {
      notice?.hide();
      const detail = error instanceof Error ? error.message : String(error);
      console.error("Qwen3-TTS 服务启动异常", error);
      if (!silent) new Notice(`启动失败：${detail}`, 10000);
      return false;
    }
  }

  async stopReaderService() {
    if (this.settings.reader.provider === "windows-tts") {
      new Notice("当前引擎是 Windows 本地语音，没有常驻服务需要停止", 6000);
      return;
    }
    const result =
      this.settings.reader.provider === "qwen3-tts"
        ? await this.readerQwenLauncher.stop()
        : await this.readerLauncher.stop();
    new Notice(result.message, 6000);
  }

  /**
   * 强制停止配置端口上的服务。
   *
   * 与「停止本地服务」的区别：**不做归属判断**。用于两种情况：
   * - 插件重载后丢了归属（旧实例的句柄没了，新实例不认那个进程）
   * - 服务是外部启动的，但现在确实想关掉
   *
   * 代价是会关掉该端口上的任何 GPT-SoVITS 服务，所以提示语要讲清楚。
   */
  async forceStopReaderService() {
    if (this.settings.reader.provider === "windows-tts") {
      new Notice(
        "当前引擎是 Windows 本地语音：它没有监听端口、也没有常驻进程，无需强制停止",
        8000
      );
      return;
    }
    const result =
      this.settings.reader.provider === "qwen3-tts"
        ? await this.readerQwenLauncher.forceStop()
        : await this.readerLauncher.forceStop();
    new Notice(result.message, 8000);
  }

  /**
   * 插件目录下某个文件的绝对路径（服务日志、Qwen 服务脚本、归属记录都放这里）。
   *
   * 子进程输出写到文件而不是管道 —— 管道读端由插件实例持有，
   * 插件一重载读端就关了，服务下次写日志会抛 `Errno 22` 并导致后续推理全失败
   * （实测两次故障都紧跟插件重载）。写文件同时让日志能跨重载保留。
   */
  pluginFilePath(fileName: string): string | null {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return null;
    // 本机 obsidian.d.ts 是 0.14.8，没有 Platform.isWin，所以用自己的判定
    const separator = isWindows() ? "\\" : "/";
    return [
      adapter.getBasePath(),
      this.app.vault.configDir,
      "plugins",
      this.manifest.id,
      fileName,
    ].join(separator);
  }

  /** 挂上播放条并开始朗读；失败时给出可读提示 */
  private beginReading(view: MarkdownView, mode: "top" | "cursor" | "selection") {
    this.readerPlayerBar.mount(view);
    const run =
      mode === "top"
        ? this.readerController.start(view)
        : mode === "cursor"
          ? this.readerController.startFromCursor(view)
          : this.readerController.startFromSelection(view);
    void run.catch(error => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("朗读失败", error);
      new Notice(`朗读失败：${detail}`, 10000);
    });
  }

  /**
   * 选中文本 → 音频文件（右键菜单与命令共用的入口）。
   *
   * 合成可能要跑很多段（长选区），进度挂在常驻 Notice 上；完成后报保存路径。
   * 与朗读共用同一条分段链与引擎 —— 声音、语速、过滤规则完全一致。
   */
  private async generateAudioFromSelection(view: MarkdownView): Promise<void> {
    const selection = view.editor.getSelection();
    if (!selection.trim()) {
      new Notice("没有选中内容");
      return;
    }
    const notice = new Notice("正在生成音频文件…", 0);
    try {
      const result = await generateAudioFileFromText(this, selection, message =>
        notice.setMessage(message)
      );
      notice.hide();
      if ("error" in result) {
        new Notice(`生成音频失败：${result.error}`, 15000);
        return;
      }
      new Notice(`音频已保存：${result.path}`, 20000);
    } catch (error) {
      notice.hide();
      const detail = error instanceof Error ? error.message : String(error);
      console.error("生成音频文件失败", error);
      new Notice(`生成音频失败：${detail}`, 15000);
    }
  }

  /**
   * 把设置里的音色热切换到运行中的服务。
   *
   * 为什么需要单独一个入口：改设置只改配置，不会作用到已经跑着的服务 ——
   * 否则用户选了音色却发现没变化。两个权重必须同时填齐：实测只填一个（或错配）
   * **不会报错**，而是静默产出错误的音色。
   *
   * `silent` 供「自动应用」用：成功不打扰，失败也只写控制台（用户没主动点按钮）。
   * 返回是否真的切换成功。
   */
  async applyReaderVoice(silent = false): Promise<boolean> {
    const notify = (message: string, timeout: number) => {
      if (!silent) new Notice(message, timeout);
    };
    if (this.settings.reader.provider === "windows-tts") {
      notify(
        "当前引擎是 Windows 本地语音：语音（音色）、语速、音量随每个分段请求生效，改完设置即生效，无需应用",
        10000
      );
      return false;
    }
    if (this.settings.reader.provider !== "gpt-sovits") {
      notify(
        "当前引擎是 Qwen3-TTS：音色由「音色描述」随每个合成请求生效，改完设置即生效，无需应用",
        10000
      );
      return false;
    }
    const { gptWeights, sovitsWeights } = this.settings.reader.tts;
    if (!gptWeights.trim() || !sovitsWeights.trim()) {
      notify(
        "「GPT 权重」与「SoVITS 权重」需要同时填写或同时留空。\n" +
          "只填一个不会报错，但会静默产出错误的音色。建议用「选择音色…」按配对选择。",
        12000
      );
      return false;
    }

    const probe = await this.readerEngine.probe();
    if (!probe.ok) {
      notify("服务未运行，音色会在下次启动服务时自动应用", 8000);
      return false;
    }

    const result = await this.readerGptEngine.setWeights(gptWeights, sovitsWeights);
    if (result.ok) {
      const shortName = gptWeights.split(/[\\/]/).pop() ?? gptWeights;
      if (silent) console.log(`朗读：权重改动已自动应用到服务（${shortName}）`);
      else new Notice(`音色已切换：${shortName}`, 6000);
      return true;
    }
    console.warn("朗读服务音色切换失败：", result.message);
    notify(result.message, 12000);
    return false;
  }

  /**
   * 权重文本改动后的**自动**热切换（静默）。
   *
   * 只在「两个权重都填齐 + 名称成对 + 服务正在跑」时才真的下发 ——
   * 手打路径的过程中会不断出现半成品组合，而错配不报错、只静默产出错音色，
   * 所以这里用「同名 .ckpt / .pth 才算同一套模型」这道守卫挡住中间态
   * （与「选择音色…」的配对规则一致）。名称不成对时仍可用「应用到服务」强制应用。
   */
  async autoApplyReaderVoice(): Promise<void> {
    if (this.settings.reader.provider !== "gpt-sovits") return;
    const { gptWeights, sovitsWeights } = this.settings.reader.tts;
    if (!isWeightPair(gptWeights, sovitsWeights)) return;
    await this.applyReaderVoice(true);
  }

  /**
   * 当前引擎的语速倍率。
   *
   * 三个引擎各存一份：GPT-SoVITS 与 Windows 本地语音都有语速（后者换算成 SAPI Rate），
   * Qwen3-TTS 的接口没有 speed 参数，固定按 1 计算。段内进度估算与首段爬坡都用它。
   */
  readerSpeedFactor(): number {
    const reader = this.settings.reader;
    const raw =
      reader.provider === "windows-tts"
        ? reader.windows.speedFactor
        : reader.provider === "gpt-sovits"
          ? reader.tts.speedFactor
          : 1;
    return Number.isFinite(raw) ? Math.max(MIN_SPEED_FACTOR, raw) : 1;
  }

  /**
   * 当前设置下的逐段长度上限（首段渐进爬坡表）；不需要爬坡时返回 undefined。
   *
   * GPT-SoVITS 与 Windows 本地语音都走爬坡：前者 RTF ≈ 0.52（合成比播放快一倍），
   * 后者实测 155 字 0.46 秒（固定开销约 0.4 秒），首段缩短后靠后续段递增加长
   * 就能无空档追上。Qwen3-TTS 的 RTF ≈ 2.8 > 1，合成跟不上播放，
   * 爬坡（乃至任何分段策略）都追不上，反而多付固定开销。
   *
   * 开启**流式首响**时同样跳过（仅 GPT-SoVITS 有流式）：段间无缝已由「段末预开下一段的流」保证
   * （见 playback.ts 的 maybePreopenNext），首响也不再取决于段长，
   * 此时爬坡只剩「开头多几个请求、每请求多付 1s 固定开销」的代价。
   */
  readerSegmentLimits(): number[] | undefined {
    const segment = this.settings.reader.segment;
    if (!segment.rampUp) return undefined;
    const provider = this.settings.reader.provider;
    if (provider === "qwen3-tts") return undefined;
    if (provider === "gpt-sovits" && this.settings.reader.tts.streamingMode !== 0) {
      return undefined;
    }
    return buildLimitPlan(
      segment.firstMaxChars,
      segment.maxChars,
      this.readerSpeedFactor()
    );
  }

  /** 设置页改动朗读参数后同步到引擎（三个引擎都按值持有配置，构造后需刷新） */
  refreshReaderEngine() {
    this.readerEngine.setActive(this.settings.reader.provider);
    this.readerGptEngine.updateOptions({ ...this.settings.reader.tts });
    const qwen = this.settings.reader.qwen;
    this.readerQwenEngine.updateOptions({
      baseUrl: qwen.baseUrl,
      language: qwen.language,
      instruct: qwen.instruct,
      timeoutMs: qwen.timeoutMs,
    });
    const windows = this.settings.reader.windows;
    this.readerWindowsEngine.updateOptions({
      voiceName: windows.voiceName,
      speedFactor: windows.speedFactor,
      volume: windows.volume,
      timeoutMs: windows.timeoutMs,
      shellPath: windows.shellPath,
    });
  }

  /** 环境诊断：把 P0 阶段的三个未验证假设做成长期可用的自检 */
  async runReaderDiagnostics() {
    const notice = new Notice("正在运行朗读环境诊断…", 0);
    try {
      const report = await runDiagnostics({
        engine: this.readerEngine,
        provider: this.settings.reader.provider,
        installRoot: this.settings.reader.tts.installRoot,
        refAudioPath: this.settings.reader.tts.refAudioPath,
        promptText: this.settings.reader.tts.promptText,
        includeSpeech: true,
      });
      console.group("=== Glimpse 朗读环境诊断 ===");
      for (const item of report.items) {
        console.log(`${item.ok ? "✅" : "❌"} ${item.name}\n    ${item.detail}`);
      }
      console.groupEnd();

      // 把自检结果同步到服务状态，设置页的状态行会据此显示「推理正常 / 推理失败」
      const synthesis = report.items.find(item => item.name === "语音合成自检");
      if (synthesis) {
        this.markReaderHealth(synthesis.ok, synthesis.ok ? undefined : synthesis.detail);
      }

      notice.hide();
      if (report.allOk) {
        new Notice("朗读环境诊断：全部通过（详情见控制台）", 6000);
      } else {
        const failed = report.items.filter(item => !item.ok).map(item => item.name);
        new Notice(
          `朗读环境诊断：${failed.length} 项有问题\n${failed.join("\n")}\n详情见控制台`,
          12000,
        );
      }
    } catch (error) {
      notice.hide();
      const detail = error instanceof Error ? error.message : String(error);
      console.error("朗读环境诊断失败", error);
      new Notice(`朗读环境诊断失败：${detail}`, 10000);
    }
  }

  /**
   * 分段预览：不发声，只验证「过滤 → 分段 → 映射回原文」这条链路。
   * 自检点：每段的 rawFrom/rawTo 回切原文后，首尾字符必须对得上；
   * 且 rawFrom 必须单调递增。这能在不接播放器的情况下抓住偏移错位。
   */
  previewReaderSegments(view: MarkdownView) {
    const raw = view.editor.getValue();
    const { readable, segments } = buildSegments(
      raw,
      this.settings.reader.filters,
      this.settings.reader.segment,
      this.readerSegmentLimits(),
    );

    const problems: string[] = [];
    let previousRawFrom = -1;
    for (const [index, segment] of segments.entries()) {
      if (segment.rawFrom < previousRawFrom) {
        problems.push(`第 ${index + 1} 段 rawFrom 非单调（${segment.rawFrom} < ${previousRawFrom}）`);
      }
      previousRawFrom = segment.rawFrom;
      const slice = raw.slice(segment.rawFrom, segment.rawTo);
      const head = segment.text[0];
      const tail = segment.text[segment.text.length - 1];
      if (head && !slice.includes(head)) {
        problems.push(`第 ${index + 1} 段首字符「${head}」不在原文区间内`);
      }
      if (tail && !slice.includes(tail)) {
        problems.push(`第 ${index + 1} 段末字符「${tail}」不在原文区间内`);
      }
    }

    const totalChars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    // 系数来自本机实测：音频 ≈ 0.216 s/字；合成 ≈ 1.0s + 0.12 s/字
    const estimatedAudio = totalChars * 0.216;
    const estimatedSynth = segments.length * 1.0 + totalChars * 0.12;

    console.group("=== Glimpse 朗读分段预览 ===");
    console.log(
      `原文 ${raw.length} 字符 → 过滤后 ${readable.text.length} 字符` +
        `（丢弃 ${raw.length - readable.text.length}）`,
    );
    console.log(`恒等映射：${readable.map.isIdentity ? "是（无过滤命中）" : "否"}`);
    console.log(
      `共 ${segments.length} 段；合计 ${totalChars} 字；` +
        `预估音频 ${estimatedAudio.toFixed(1)}s、合成 ${estimatedSynth.toFixed(1)}s`,
    );
    console.table(
      segments.slice(0, 20).map((segment, index) => ({
        段: index + 1,
        字数: segment.text.length,
        原文区间: `${segment.rawFrom}-${segment.rawTo}`,
        文本: segment.text.length > 40 ? `${segment.text.slice(0, 40)}…` : segment.text,
      })),
    );
    if (segments.length > 20) console.log(`（仅显示前 20 段，共 ${segments.length} 段）`);
    if (problems.length > 0) console.warn("映射自检发现问题：", problems);
    else console.log("映射自检：通过");
    console.groupEnd();

    const head = segments[0];
    new Notice(
      problems.length === 0
        ? `${segments.length} 段，合计 ${totalChars} 字\n` +
            `预估音频 ${estimatedAudio.toFixed(0)}s / 合成 ${estimatedSynth.toFixed(0)}s\n` +
            `首段：${head ? `${head.text.slice(0, 24)}…` : "（空）"}\n详情见控制台`
        : `映射自检发现 ${problems.length} 个问题，详见控制台`,
      10000,
    );
  }

  updateConfig = debounce(
    (type: string, config: HighlighterOptions) => {
      if (type !== "selection") return;
      this.iterateCM6(view => {
        view.dispatch({
          effects: reconfigureSelectionHighlighter(config as SelectionHighlightOptions),
        });
      });
    },
    1000,
    true
  );
}
