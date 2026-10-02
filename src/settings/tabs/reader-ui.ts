import {
  DropdownComponent,
  MarkdownView,
  Notice,
  Setting,
  TextAreaComponent,
  TextComponent,
  debounce,
} from "obsidian";
import GlimpsePlugin from "../../main";
import type { SettingTab } from "../ui";
import { ReferenceAudioPickerModal } from "../../reader/reference-audio-modal";
import { VoicePickerModal } from "../../reader/voice-picker-modal";
import {
  createElementAudioPlayback,
  type AudioPlayback,
} from "../../reader/playback";
import { isWindows } from "../../reader/node-bridge";
import {
  applySegmentPreset,
  MAX_SPEED_FACTOR,
  MIN_SPEED_FACTOR,
  QWEN_LANGUAGES,
  READER_SEGMENT_PRESETS,
  ReaderFilterSettings,
  ReaderQwenSettings,
  ReaderSettings,
  ReaderTtsProvider,
  ReaderTtsSettings,
  segmentPresetId,
} from "../../reader/settings-types";
import {
  checkQwenPython,
  validateQwenModelPath,
} from "../../reader/tts/qwen-launcher";
import { prepareQwenEnvironment } from "../../reader/tts/qwen-setup";
import { scanAudioCandidates } from "../../reader/tts/audio-scanner";
import { windowsTtsRate } from "../../reader/tts/windows-tts";
import type { WindowsTtsVoice } from "../../reader/tts/windows-tts";
import {
  canPickDirectories,
  pickDirectoryWithNativeDialog,
  pickFileWithNativeDialog,
  startDirFor,
} from "../../reader/native-file-dialog";
import type { ServiceState } from "../../reader/tts/types";

const STATE_LABEL: Record<ServiceState, { text: string; cls: string }> = {
  stopped: { text: "未运行", cls: "is-stopped" },
  starting: { text: "启动中…", cls: "is-starting" },
  owned: { text: "运行中（由本插件启动）", cls: "is-running" },
  external: { text: "运行中（外部启动，本插件不会去停它）", cls: "is-running" },
};

/** 从路径里取文件名，用于展示当前音色 */
function fileNameOf(path: string | undefined): string {
  if (!path) return "";
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 状态行名前的彩色圆点（绿=正常/橙=启动中/红=推理失败/灰=停止） */
function statusDot(dotClass: string, label: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const dot = document.createElement("span");
  dot.className = `glimpse-reader-status-dot ${dotClass}`;
  fragment.append(dot, document.createTextNode(` ${label}`));
  return fragment;
}

/**
 * 正在播放的「试听」句柄。
 *
 * 放在模块作用域而不是闭包里：设置页每次改动都会整页重绘，
 * 闭包里的句柄会随重绘丢失，正在响的试听就成了没人管的声音。
 */
let activeAudition: AudioPlayback | null = null;

function stopActiveAudition(): void {
  const handle = activeAudition;
  activeAudition = null;
  if (!handle) return;
  handle.onEnded = undefined;
  try {
    handle.destroy();
  } catch {
    /* 已经销毁 */
  }
}

/** 音色预设：VoiceDesign 用自然语言描述定义音色，模板降低上手门槛 */
const QWEN_VOICE_PRESETS: ReadonlyArray<[string, string]> = [
  ["清晰温柔（年轻女声）", "年轻女性的声音，音色清亮温柔，咬字清晰，语速适中，适合朗读文章"],
  ["沉稳播音（中年男声）", "中年男性的声音，音色低沉浑厚，播音腔，吐字有力，语速平稳"],
  ["明亮少女", "少女的声音，音色明亮活泼，语速稍快，富有朝气"],
  ["知性平静（成熟女声）", "成熟女性的声音，音色温和知性，语速平缓，适合长时间聆听"],
  ["儒雅青年（年轻男声）", "年轻男性的声音，音色干净温和，带书卷气，语速适中"],
];

interface SectionContext {
  settings: () => ReaderSettings;
  refresh: () => void;
  saveSoon: () => void;
  saveTtsSoon: () => void;
  /**
   * 权重文本框改动后的「自动应用音色」触发（已做防抖）。
   * 放在 ctx 里是因为 GPT-SoVITS 分组是独立函数，拿不到 render() 的局部闭包。
   */
  autoApplyVoiceSoon: () => void;
  text: (
    name: string,
    desc: string,
    get: () => string,
    set: (value: string) => void,
    placeholder?: string,
    /** 整行铺开（描述在上、控件独占一行）：只有需要宽度的文本框才开 */
    stack?: boolean
  ) => void;
  /**
   * 路径字段：文本框 + 「浏览…」按钮（调系统原生对话框）。
   * mode = directory 选文件夹；executable 选 .exe。选完立即校验（afterPick）。
   */
  pathField: (
    name: string,
    desc: string,
    get: () => string,
    set: (value: string) => void,
    placeholder: string,
    mode: "directory" | "executable",
    afterPick?: (picked: string) => void
  ) => void;
  toggle: (
    name: string,
    desc: string,
    get: () => boolean,
    set: (value: boolean) => void
  ) => void;
}

/**
 * 朗读设置页。
 *
 * 顶部「TTS 引擎」下拉切换提供方；两套引擎的服务与音色配置相互独立、
 * 各占一组。共用部分（朗读 / 分段 / 内容过滤）在底部，对引擎无感。
 */
export function render(
  containerEl: HTMLElement,
  plugin: GlimpsePlugin,
  tab?: SettingTab
) {
  const settings = () => plugin.settings.reader;
  // 本页排版：默认保持 Obsidian 原生紧凑排布（按钮 / 下拉 / 滑条 / 开关都在右侧同行），
  // 只有「需要宽度的文本框」行显式标 gm-stack-row 整行铺开 —— 见 styles.css
  containerEl.addClass("glimpse-reader-settings");
  // 设置页重绘时上一轮的试听就没人管了，先停掉
  stopActiveAudition();
  // 启动/停止后重绘整页，让状态行反映最新状态
  const refresh = () => tab?.display();
  // 文本输入逐字符触发，落盘与引擎刷新都做防抖
  const saveSoon = debounce(() => void plugin.saveSettings(), 500, true);
  const saveTtsSoon = debounce(() => {
    void plugin.saveSettings();
    plugin.refreshReaderEngine();
  }, 500, true);
  /**
   * 权重改动后自动热切换（静默）。
   * 比落盘再晚一点：手打路径时会出现各种半成品组合，
   * 而只填一个或错配**不会报错、只会静默产出错音色**（见 autoApplyReaderVoice 的守卫）。
   */
  const autoApplyVoiceSoon = debounce(() => void plugin.autoApplyReaderVoice(), 900, true);

  const text = (
    name: string,
    desc: string,
    get: () => string,
    set: (value: string) => void,
    placeholder = "",
    /**
     * 是否整行铺开（描述在上、控件独占一行）。
     * 只给「需要宽度的文本」开：路径 / URL / 长文本 —— 短标量（超时毫秒、跳过短语）
     * 与按钮 / 下拉 / 滑条 / 开关保持 Obsidian 原生紧凑排布，见 styles.css 的 gm-stack-row。
     */
    stack = false
  ) => {
    const setting = new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addText(input => {
        input.setPlaceholder(placeholder).setValue(get());
        input.onChange(value => {
          set(value);
          saveTtsSoon();
        });
      });
    if (stack) setting.setClass("gm-stack-row");
  };

  const toggle = (
    name: string,
    desc: string,
    get: () => boolean,
    set: (value: boolean) => void
  ) => {
    new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle(item => {
        item.setValue(get()).onChange(value => {
          set(value);
          saveSoon();
        });
      });
  };

  const ctx: SectionContext = {
    settings,
    refresh,
    saveSoon,
    saveTtsSoon,
    autoApplyVoiceSoon,
    text,
    toggle,
    pathField: (name, desc, get, set, placeholder, mode, afterPick) => {
      let input!: TextComponent;
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        // 路径类字段一律整行铺开：路径很长，紧凑排布下只剩一百多像素看不全
        .setClass("gm-stack-row")
        .addText(textInput => {
          input = textInput;
          textInput.setPlaceholder(placeholder).setValue(get());
          textInput.onChange(value => {
            set(value);
            saveTtsSoon();
          });
        })
        .addButton(button =>
          button
            .setButtonText("浏览…")
            .setTooltip("打开系统对话框选择")
            .onClick(async () => {
              // 起始目录 = 当前值所在目录：文件夹字段打开的是其父目录，
              // 当前配置的那一项直接出现在列表里，再选一次只要点一下
              const startDir = startDirFor(get());
              const picked =
                mode === "directory"
                  ? await pickDirectoryWithNativeDialog({ title: name, defaultPath: startDir })
                  : await pickFileWithNativeDialog({
                      title: name,
                      filters: [{ name: "可执行文件", extensions: ["exe"] }],
                      defaultPath: startDir,
                    });
              if (!picked) {
                // 选目录没有 input[type=file] 兜底，环境不支持时要说清楚
                if (mode === "directory" && !canPickDirectories()) {
                  new Notice("当前环境打不开系统文件夹对话框，请手动填写路径", 8000);
                }
                return;
              }
              set(picked);
              input.setValue(picked);
              void plugin.saveSettings();
              plugin.refreshReaderEngine();
              afterPick?.(picked);
            })
        );
    },
  };

  new Setting(containerEl).setName("引擎").setHeading();

  new Setting(containerEl)
    .setName("TTS 引擎")
    .setDesc(
      "切换后立即生效。另外两套引擎中由本插件启动的服务会自动停止（释放显存，模型同时常驻太重）；" +
        "外部启动的服务不会被动，需自行关闭。各引擎的配置原样保留，随时可切回。" +
        "没装 GPT-SoVITS / Qwen3-TTS 时用「Windows 本地语音」——系统自带语音，零安装、离线可用"
    )
    .addDropdown(dropdown =>
      dropdown
        .addOptions({
          "gpt-sovits": "GPT-SoVITS —— 参考音频克隆（本机 api_v2.py）",
          "qwen3-tts": "Qwen3-TTS —— VoiceDesign，音色用文字描述（本机推理服务）",
          "windows-tts": "Windows 本地语音 —— 系统内置 SAPI，零安装兜底",
        })
        .setValue(settings().provider)
        .onChange(value => {
          const previous = settings().provider;
          const next = value as ReaderTtsProvider;
          settings().provider = next;
          void plugin.saveSettings();
          plugin.refreshReaderEngine();
          refresh();
          if (previous !== next) void plugin.stopOtherReaderService(next);
        })
    );

  if (settings().provider === "windows-tts") {
    renderWindowsTtsSections(containerEl, plugin, ctx);
  } else if (settings().provider === "qwen3-tts") {
    renderQwenSections(containerEl, plugin, ctx);
  } else {
    renderGptSoVitsSections(containerEl, plugin, ctx);
  }

  // 「生成音频文件」：与引擎无关的导出配置（选中文本右键 →「朗读：生成音频文件」）
  new Setting(containerEl).setName("生成音频文件").setHeading();
  ctx.pathField(
    "保存目录",
    "生成音频的保存位置；留空则保存到系统下载文件夹。保存的文件名 = 选区摘录 + 时间戳",
    () => settings().generateAudioPath,
    value => {
      settings().generateAudioPath = value;
    },
    "例如 D:\\Audio（留空用下载文件夹）",
    "directory"
  );

  new Setting(containerEl).setName("朗读").setHeading();

  new Setting(containerEl)
    .setName("预取深度")
    .setDesc("边播当前段边预取后几段。实测合成速度约为播放的两倍，2 段已足够")
    .addSlider(slider =>
      slider
        .setLimits(1, 4, 1)
        .setValue(settings().lookahead)
        .setDynamicTooltip()
        .onChange(value => {
          settings().lookahead = value;
          saveSoon();
        })
    );

  toggle(
    "自动滚动到当前段",
    "朗读时让编辑器跟随当前朗读位置",
    () => settings().autoScroll,
    value => {
      settings().autoScroll = value;
    }
  );

  toggle(
    "光标位置随朗读刷新",
    "朗读时把编辑器光标移到「正在读的那一行」行首（状态栏位置读数、提词器的行提取会随之更新）。" +
      "默认关闭：朗读期间光标会被持续接管，编辑与取词都会被打断",
    () => settings().cursorFollow,
    value => {
      settings().cursorFollow = value;
    }
  );

  toggle(
    "高亮按标点细分",
    "朗读时段内高亮按逗号/句号等标点逐句推进，更细更实时（自动滚动也更跟手）；" +
      "关闭则整段一起高亮。只影响显示，实际分段与合成请求不变",
    () => settings().highlightClauses,
    value => {
      settings().highlightClauses = value;
    }
  );

  toggle(
    "朗读时锁定编辑器",
    "朗读期间禁止编辑，避免文本变动导致位置失配",
    () => settings().lockEditor,
    value => {
      settings().lockEditor = value;
    }
  );

  toggle(
    "插件卸载时停止服务",
    "关闭（默认）时，热重载与退出 Obsidian 都不会停服务 —— 冷启动要 20–65 秒，每次重来代价太大。" +
      "归属会落盘，下次加载自动认领，仍可随时用「朗读：停止本地服务」关掉",
    () => settings().stopServiceOnUnload,
    value => {
      settings().stopServiceOnUnload = value;
    }
  );

  new Setting(containerEl).setName("分段").setHeading();

  new Setting(containerEl)
    .setName("单段上限")
    .setDesc("超过该字数强制断开。实测 150 字约 19 秒合成、30 秒音频，流水线仍跟得上")
    .addSlider(slider =>
      slider
        .setLimits(40, 300, 10)
        .setValue(settings().segment.maxChars)
        .setDynamicTooltip()
        .onChange(value => {
          settings().segment.maxChars = value;
          saveSoon();
        })
    );

  new Setting(containerEl)
    .setName("弱边界阈值")
    .setDesc("逗号/顿号等弱标点需累积到该字数才断开。实测 2 字时合成耗时已接近音频时长，切太碎不划算")
    .addSlider(slider =>
      slider
        .setLimits(10, 80, 2)
        .setValue(settings().segment.secondaryMinChars)
        .setDynamicTooltip()
        .onChange(value => {
          settings().segment.secondaryMinChars = value;
          saveSoon();
        })
    );

  new Setting(containerEl)
    .setName("分段预设")
    .setDesc(
      "「首段设短」与「段间无空档」是成对的取舍，这里给两套配好的组合，切换即同时设定首段上限；" +
        "想定制再拖下面的首段上限滑块即可（预设只决定靠什么保证无空档）"
    )
    .addDropdown(dropdown =>
      dropdown
        .addOptions(
          Object.fromEntries(READER_SEGMENT_PRESETS.map(preset => [preset.id, preset.label]))
        )
        .setValue(segmentPresetId(settings().segment))
        .onChange(value => {
          applySegmentPreset(settings().segment, value);
          saveSoon();
          refresh();
        })
    );

  new Setting(containerEl)
    .setName("首段上限")
    .setDesc(
      "首段单独设小，让播放尽快开始（这就决定了首字延迟）。每次请求有约 1 秒固定开销，" +
        "无法通过分段消除；实测 15 字 ≈ 2.8s 开始出声。默认由上面的预设设定（15 或 25 字），" +
        "手动改小必须配「低首字延迟」预设的爬坡，否则第一句读完后会有明显等待"
    )
    .addSlider(slider =>
      slider
        .setLimits(8, 80, 1)
        .setValue(settings().segment.firstMaxChars)
        .setDynamicTooltip()
        .onChange(value => {
          settings().segment.firstMaxChars = value;
          saveSoon();
        })
    );

  new Setting(containerEl)
    .setName("预览分段")
    .setDesc("不发声，只检查「过滤 → 分段 → 映射回原文」是否正确，并估算时长")
    .addButton(button =>
      button.setButtonText("预览当前笔记").onClick(() => {
        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) plugin.previewReaderSegments(view);
      })
    );

  new Setting(containerEl).setName("内容过滤").setHeading();

  const filters = () => settings().filters;
  const filterRows: Array<[string, string, keyof ReaderFilterSettings]> = [
    ["YAML frontmatter", "跳过文档开头的元数据区", "frontmatter"],
    ["围栏代码块", "跳过 ``` 包裹的整块内容", "fencedCode"],
    ["行内代码", "跳过 `反引号` 包裹的内容", "inlineCode"],
    ["表格", "跳过 Markdown 表格行", "tables"],
    ["标题记号", "去掉 # 记号，保留标题文字", "headingMarks"],
    ["引用记号", "去掉 > 记号，保留引用文字", "quoteMarks"],
    ["callout 标记", "去掉 [!note] 等类型标记与折叠符 +-，保留 callout 标题与正文", "calloutMarks"],
    ["列表记号", "去掉 - / * / 1. 与任务框，保留列表文字；每个列表项单独成段", "listMarks"],
    ["标签", "跳过 #标签", "tags"],
    ["链接与网址", "链接保留文字、去掉地址；裸网址整段跳过", "links"],
    ["图片嵌入", "跳过 ![]() 与 ![[ ]]", "imageEmbeds"],
    ["双链", "[[目标|别名]] 保留显示名", "wikiLinks"],
    ["emoji", "跳过表情符号", "emoji"],
    ["高亮记号", "去掉 == 记号，保留高亮文字", "highlightMarks"],
    ["星号", "去掉 * 强调记号", "asterisks"],
    ["下划线", "去掉 _ 强调记号", "underscores"],
    ["反斜杠转义", "去掉转义用的反斜杠，保留被转义字符", "backslashEscapes"],
  ];

  for (const [name, desc, field] of filterRows) {
    toggle(
      name,
      desc,
      () => filters()[field] as boolean,
      value => {
        (filters() as unknown as Record<string, boolean>)[field] = value;
      }
    );
  }

  text(
    "跳过含该短语的行",
    "留空即不启用。整行包含该短语时不朗读",
    () => filters().phraseLine,
    value => {
      filters().phraseLine = value;
      filters().phraseLineEnabled = value.trim() !== "";
    }
  );

  text(
    "跳过该前缀开头的行",
    "留空即不启用。整行以该前缀开头时不朗读",
    () => filters().prefixLine,
    value => {
      filters().prefixLine = value;
      filters().prefixLineEnabled = value.trim() !== "";
    }
  );
}

/**
 * GPT-SoVITS 提供方的配置组（服务 + 声音）。
 * 参数默认值有实测依据（见 docs/gpt-sovits-integration.md）：
 * - 语速上限 2.0：2.0x 时合成耗时/音频时长 ≈ 0.97，再高必然卡顿
 * - 输出格式 ogg：体积仅 wav 的 1/8.4，且无延迟代价（mp3 服务端不支持）
 */
function renderGptSoVitsSections(
  containerEl: HTMLElement,
  plugin: GlimpsePlugin,
  ctx: SectionContext
) {
  const { settings, refresh, saveSoon, saveTtsSoon, autoApplyVoiceSoon, text, toggle, pathField } = ctx;
  const tts = () => settings().tts as ReaderTtsSettings;

  new Setting(containerEl).setName("服务（GPT-SoVITS）").setHeading();

  // 服务状态：启动/停止是后台动作，没有这行用户只能去翻控制台。
  // 进程状态与推理健康度分开显示 —— 服务活着不代表能推理（实测存在这种坏状态）。
  const launcher = plugin.readerLauncher;
  const stateLabel = STATE_LABEL[launcher.getState()] ?? STATE_LABEL.stopped;
  const health = launcher.getHealth();
  const loaded = launcher.getLoadedModel();
  const isStopped = launcher.getState() === "stopped";

  const healthText = isStopped
    ? ""
    : health.state === "ok"
      ? "推理正常"
      : health.state === "broken"
        ? `⚠ 推理失败：${health.reason ?? "原因未知"}`
        : "推理状态未知（尚未合成过）";

  const dotClass = isStopped
    ? "is-stopped"
    : health.state === "broken"
      ? "is-broken"
      : health.state === "ok"
        ? "is-running"
        : "is-unknown";

  const descParts = [stateLabel.text];
  if (healthText) descParts.push(healthText);
  descParts.push(
    loaded.sovits ? `当前音色：${fileNameOf(loaded.sovits)}` : "尚未加载模型"
  );
  if (health.state === "broken") {
    descParts.push("→ 执行「朗读：重启本地服务」可尝试恢复");
  }

  new Setting(containerEl)
    .setName(statusDot(dotClass, "服务状态"))
    .setDesc(descParts.join("　·　"))
    .addButton(button => button.setButtonText("刷新").onClick(() => refresh()));

  text(
    "服务地址",
    "本机 GPT-SoVITS 的 api_v2.py 监听地址。注意：这不是 go-webui.bat 的网页端口",
    () => tts().baseUrl,
    value => {
      tts().baseUrl = value.trim();
    },
    "http://127.0.0.1:9880",
    true
  );

  pathField(
    "安装根目录",
    "含 runtime/python.exe 与 api_v2.py 的目录，可点「浏览…」选择；填入后环境诊断可额外验证内嵌 " +
      "Python，权重路径与参考音频路径都相对该目录解析",
    () => tts().installRoot,
    value => {
      tts().installRoot = value.trim();
    },
    "F:\\_Frame\\GPT-SoVITS-v2pro-20250604\\GPT-SoVITS-v2pro-20250604",
    "directory",
    picked => {
      // 选完顺手校验，双层目录这类问题当场暴露
      const outcome = plugin.readerLauncher.validateInstallRoot(picked);
      new Notice(
        outcome.ok ? outcome.note ?? "路径正确，可以直接启动服务" : outcome.message,
        outcome.ok ? 8000 : 20000
      );
    }
  );

  new Setting(containerEl)
    .setName("校验安装根目录")
    .setDesc(
      "检查该目录下是否存在 api_v2.py 与 runtime/python.exe。GPT-SoVITS 发行包解压后常是" +
        "同名双层目录，容易只填到外层，导致启动时报 ENOENT"
    )
    .addButton(button =>
      button.setButtonText("校验").onClick(() => {
        const outcome = plugin.readerLauncher.validateInstallRoot(tts().installRoot);
        if (outcome.ok) {
          new Notice(outcome.note ?? "路径正确，可以直接启动服务", 8000);
        } else {
          new Notice(outcome.message, 20000);
        }
      })
    );

  new Setting(containerEl)
    .setName("环境诊断")
    .setDesc("检查子进程能力、服务可达性、音频解码与浏览器语音。诊断语音一项会出声")
    .addButton(button =>
      button.setButtonText("运行诊断").onClick(() => void plugin.runReaderDiagnostics())
    );

  new Setting(containerEl)
    .setName("流式首响（实验）")
    .setDesc(
      "让服务端边合成边吐音频，媒体元素收到第一块就开声。实测本机首字节从 5.62s 降到 " +
        "0.69s（模式 2）/ 0.58s（模式 3）——设备越慢收益越明显，因为首响与算力基本无关。" +
        "代价：模式 2 总合成时长 +12%、模式 3 +41% 且体积 +63%（官方口径分别是「中等/较低质量」）；" +
        "流式段不做预取、失败会回退到常规合成（多花一次请求），输出固定 ogg"
    )
    .addDropdown(dropdown =>
      dropdown
        .addOptions({
          "0": "关闭（默认）",
          "2": "模式 2 —— 中等质量，首字节 ~0.7s",
          "3": "模式 3 —— 最快，首字节 ~0.6s（质量与体积代价最大）",
        })
        .setValue(String(tts().streamingMode))
        .onChange(value => {
          const mode = Number(value);
          tts().streamingMode = mode === 2 || mode === 3 ? mode : 0;
          saveTtsSoon();
        })
    );

  new Setting(containerEl)
    .setName("启动本地服务")
    .setDesc(
      "自动启动 api_v2.py（首次加载模型约需 20–65 秒）。已有服务在运行时直接复用，不会抢端口；" +
        "停止时也只关闭由本插件启动的进程"
    )
    .addButton(button =>
      button.setButtonText("启动 / 复用").onClick(async () => {
        await plugin.startReaderService();
        refresh();
      })
    )
    .addButton(button =>
      button.setButtonText("停止").onClick(async () => {
        await plugin.stopReaderService();
        refresh();
      })
    )
    .addButton(button =>
      button
        .setButtonText("强制停止")
        .setTooltip("不做归属判断，直接关掉该端口上的服务（用于插件重载后丢了归属的情况）")
        .onClick(async () => {
          await plugin.forceStopReaderService();
          refresh();
        })
    );

  new Setting(containerEl).setName("声音（GPT-SoVITS）").setHeading();

  let gptWeightsInput!: TextComponent;
  let sovitsWeightsInput!: TextComponent;

  new Setting(containerEl)
    .setName("音色")
    .setDesc(
      "按配对选择。GPT 权重与 SoVITS 权重必须来自同一套模型 —— 实测错配不会报错，" +
        "而是静默产出错误的音色，所以「选择音色…」一次同时填入下面两项，且选中即切到运行中的服务。" +
        "手动改下面两项时，只要名称成对（同名 .ckpt / .pth）同样会自动应用；" +
        "服务没在跑则等下次启动服务时应用。名称不成对、或想强制立即生效时，用「应用到服务」"
    )
    .addButton(button =>
      button.setButtonText("选择音色…").onClick(() => {
        new VoicePickerModal(
          plugin.app,
          tts().installRoot,
          tts().gptWeights,
          tts().sovitsWeights,
          (gptPath, sovitsPath) => {
            // null 表示「该项保持不变」—— 浏览单个 .ckpt 时不该清空已有的 SoVITS
            if (gptPath) {
              tts().gptWeights = gptPath;
              gptWeightsInput.setValue(gptPath);
            }
            if (sovitsPath) {
              tts().sovitsWeights = sovitsPath;
              sovitsWeightsInput.setValue(sovitsPath);
            }
            void plugin.saveSettings();
            plugin.refreshReaderEngine();
            // 两项都齐了才顺手热切换，否则 applyReaderVoice 只会弹一条「需要两项」的提示
            if (tts().gptWeights.trim() && tts().sovitsWeights.trim()) {
              void plugin.applyReaderVoice();
            }
          }
        ).open();
      })
    )
    .addButton(button =>
      button
        .setButtonText("应用到服务")
        .setTooltip("把上面两项立即切到运行中的服务（无需重启，几秒内生效）")
        .onClick(() => void plugin.applyReaderVoice())
    );

  new Setting(containerEl)
    .setName("GPT 权重")
    .setDesc("相对安装根目录的 .ckpt 路径")
    .setClass("gm-stack-row")
    .addText(input => {
      gptWeightsInput = input;
      input
        .setPlaceholder("GPT_weights_v2ProPlus/xxx.ckpt")
        .setValue(tts().gptWeights)
        .onChange(value => {
          tts().gptWeights = value.trim();
          saveTtsSoon();
          autoApplyVoiceSoon();
        });
    });

  new Setting(containerEl)
    .setName("SoVITS 权重")
    .setDesc("相对安装根目录的 .pth 路径，需与 GPT 权重来自同一套模型")
    .setClass("gm-stack-row")
    .addText(input => {
      sovitsWeightsInput = input;
      input
        .setPlaceholder("SoVITS_weights_v2ProPlus/xxx.pth")
        .setValue(tts().sovitsWeights)
        .onChange(value => {
          tts().sovitsWeights = value.trim();
          saveTtsSoon();
          autoApplyVoiceSoon();
        });
    });

  pathField(
    "参考音频目录",
    "把参考音频都放这个文件夹里，以后换音色只要在「选择」弹窗里点一下，不必每次重新翻路径；" +
      "留空则退回扫描 GPT-SoVITS 安装根目录（旧行为）。只影响候选列表与文件对话框的起始位置，" +
      "不影响合成 —— 音频放哪儿都能用",
    () => tts().refAudioDir,
    value => {
      tts().refAudioDir = value.trim();
    },
    "D:\\我的音色\\参考音频",
    "directory",
    picked => {
      const count = scanAudioCandidates(picked).length;
      new Notice(
        count > 0
          ? `参考音频目录已设为：${picked}\n扫到 ${count} 个音频，点「选择」即可看到`
          : `参考音频目录已设为：${picked}\n该目录下没扫到音频文件（支持 wav/mp3/flac/ogg/m4a/aac）`,
        count > 0 ? 8000 : 12000
      );
    }
  );

  new Setting(containerEl)
    .setName("参考音频")
    .setDesc(
      "3–10 秒的清晰人声。实测该字段必须每个请求都携带，无法预先设定；" +
        "「选择」会列出「参考音频目录」（未设置时是 GPT-SoVITS 目录）里的候选，" +
        "选中后复制到插件目录（避免原位置被清理）"
    )
    .setClass("gm-stack-row")
    .addText(input => {
      input
        .setPlaceholder("点右侧「选择」导入")
        .setValue(tts().refAudioPath)
        .onChange(value => {
          tts().refAudioPath = value.trim();
          saveTtsSoon();
        });
    })
    .addButton(button =>
      button.setButtonText("选择").onClick(() => {
        new ReferenceAudioPickerModal(plugin.app, {
          pluginId: plugin.manifest.id,
          installRoot: tts().installRoot,
          refAudioDir: tts().refAudioDir,
          currentPath: tts().refAudioPath,
          // 在弹窗里改了目录也要落盘，下次打开才记得
          onChangeDir: dir => {
            tts().refAudioDir = dir;
            void plugin.saveSettings();
            // 设置页上的「参考音频目录」文本框同步刷新（整页重绘即可，弹窗本身不受影响）
            refresh();
          },
          onPick: absolutePath => {
            tts().refAudioPath = absolutePath;
            void plugin.saveSettings();
            plugin.refreshReaderEngine();
            // 统一以设置值重绘一次：弹窗期间可能已经重绘过，直接改旧输入框的引用会失效
            refresh();
          },
        }).open();
      })
    );

  text(
    "参考文本",
    "建议与参考音频实际念的内容逐字一致，可稳定音色与情感（SoVITS V3 必填）。" +
      "留空也可以生成（无文本提示模式）——实测短参考与文本不匹配时反而会吞内容，" +
      "此时留空或换更长的参考音频是两条解法",
    () => tts().promptText,
    value => {
      tts().promptText = value.trim();
    },
    "",
    true
  );

  new Setting(containerEl)
    .setName("参考音频语言")
    .setDesc("参考音频本身的语种，可与朗读语种不同（支持跨语种）")
    .addDropdown(dropdown =>
      dropdown
        .addOptions({ zh: "中文", ja: "日文", en: "英文", ko: "韩文", yue: "粤语", auto: "自动" })
        .setValue(tts().promptLang)
        .onChange(value => {
          tts().promptLang = value;
          saveTtsSoon();
        })
    );

  new Setting(containerEl)
    .setName("朗读语种")
    .setDesc("待朗读文本的语种")
    .addDropdown(dropdown =>
      dropdown
        .addOptions({ zh: "中文", ja: "日文", en: "英文", ko: "韩文", yue: "粤语", auto: "自动" })
        .setValue(tts().textLang)
        .onChange(value => {
          tts().textLang = value;
          saveTtsSoon();
        })
    );

  new Setting(containerEl)
    .setName("输出格式")
    .setDesc("ogg 体积最小且无额外延迟；wav 最大但解码最直接。实测服务端不支持 mp3")
    .addDropdown(dropdown =>
      dropdown
        .addOptions({ ogg: "ogg（推荐）", wav: "wav", aac: "aac", raw: "raw（裸 PCM）" })
        .setValue(tts().mediaType)
        .onChange(value => {
          tts().mediaType = value as ReaderTtsSettings["mediaType"];
          saveTtsSoon();
        })
    );


  new Setting(containerEl)
    .setName("语速")
    .setDesc(
      `上限 ${MAX_SPEED_FACTOR.toFixed(1)}x —— 实测 2.0x 时合成耗时已接近音频时长（比值 0.97），再高会跟不上播放`
    )
    .addSlider(slider =>
      slider
        .setLimits(MIN_SPEED_FACTOR, MAX_SPEED_FACTOR, 0.05)
        .setValue(tts().speedFactor)
        .setDynamicTooltip()
        .onChange(value => {
          tts().speedFactor = value;
          saveTtsSoon();
        })
    );
}

/**
 * Qwen3-TTS（VoiceDesign）提供方的配置组。
 *
 * 与 GPT-SoVITS 的差异：音色来自自然语言描述（instruct），随每个请求发送，
 * 改完即生效 —— 没有「应用音色」步骤；接口也没有语速参数。
 */
function renderQwenSections(
  containerEl: HTMLElement,
  plugin: GlimpsePlugin,
  ctx: SectionContext
) {
  const { settings, refresh, saveSoon, saveTtsSoon, text, pathField } = ctx;
  const qwen = () => settings().qwen;

  new Setting(containerEl).setName("服务（Qwen3-TTS）").setHeading();

  const launcher = plugin.readerQwenLauncher;
  const stateLabel = STATE_LABEL[launcher.getState()] ?? STATE_LABEL.stopped;
  const health = launcher.getHealth();
  const isStopped = launcher.getState() === "stopped";

  const healthText = isStopped
    ? ""
    : health.state === "ok"
      ? "推理正常"
      : health.state === "broken"
        ? `⚠ 推理失败：${health.reason ?? "原因未知"}`
        : "推理状态未知（尚未合成过）";

  const dotClass = isStopped
    ? "is-stopped"
    : health.state === "broken"
      ? "is-broken"
      : health.state === "ok"
        ? "is-running"
        : "is-unknown";

  const descParts = [stateLabel.text];
  if (healthText) descParts.push(healthText);
  const instruct = qwen().instruct.trim();
  descParts.push(
    instruct
      ? `音色：${instruct.length > 24 ? `${instruct.slice(0, 24)}…` : instruct}`
      : "音色：模型默认（未设置描述）"
  );
  if (health.state === "broken") {
    descParts.push("→ 执行「朗读：重启本地服务」可尝试恢复");
  }

  new Setting(containerEl)
    .setName(statusDot(dotClass, "服务状态"))
    .setDesc(descParts.join("　·　"))
    .addButton(button => button.setButtonText("刷新").onClick(() => refresh()));

  // 一键准备：找模型目录 → 挑 Python → 建 venv → 装 qwen-tts → 回填。
  // 幂等：装过一次后再点秒回「环境已就绪」
  let preparing = false;
  new Setting(containerEl)
    .setName("一键准备环境")
    .setDesc(
      "自动查找模型目录、挑选合适的 Python、创建独立环境并安装 qwen-tts（首次需下载数 GB）。" +
        "已经配置好的项会直接复用，不会重复安装"
    )
    .addButton(button =>
      button.setButtonText("开始").onClick(async () => {
        if (preparing) return;
        preparing = true;
        const notice = new Notice("正在准备 Qwen3-TTS 运行环境…", 0);
        try {
          const result = await prepareQwenEnvironment({
            modelPath: qwen().modelPath,
            pythonPath: qwen().pythonPath,
            setupLogPath: plugin.pluginFilePath("qwen-env-setup.log"),
            onProgress: message => {
              console.log(`[Qwen3-TTS 环境准备] ${message}`);
              notice.setMessage(message);
            },
          });
          notice.hide();
          if (result.modelPath) qwen().modelPath = result.modelPath;
          if (result.pythonPath) qwen().pythonPath = result.pythonPath;
          void plugin.saveSettings();
          plugin.refreshReaderEngine();
          console.log(`[Qwen3-TTS 环境准备] ${result.message}`);
          new Notice(result.message, result.ok ? 12000 : 25000);
          refresh();
        } catch (error) {
          notice.hide();
          const detail = error instanceof Error ? error.message : String(error);
          console.error("Qwen3-TTS 环境准备异常", error);
          new Notice(`环境准备失败：${detail}`, 15000);
        } finally {
          preparing = false;
        }
      })
    );

  text(
    "服务地址",
    "本机推理服务（reader-qwen-server.py，由插件自动生成并拉起）监听地址",
    () => qwen().baseUrl,
    value => {
      qwen().baseUrl = value.trim();
    },
    "http://127.0.0.1:9872",
    true
  );

  pathField(
    "模型目录",
    "HuggingFace 模型快照目录，需含 config.json / model.safetensors / speech_tokenizer，可点「浏览…」选择",
    () => qwen().modelPath,
    value => {
      qwen().modelPath = value.trim();
    },
    "F:\\_Frame\\Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    "directory",
    picked => {
      const outcome = validateQwenModelPath(picked);
      new Notice(
        outcome.ok ? `${outcome.message}\n可以启动服务了` : outcome.message,
        outcome.ok ? 8000 : 20000
      );
    }
  );

  new Setting(containerEl)
    .setName("校验模型目录")
    .setDesc("检查三个关键项是否齐全；只填到上层目录是启动失败最常见的原因")
    .addButton(button =>
      button.setButtonText("校验").onClick(() => {
        const outcome = validateQwenModelPath(qwen().modelPath);
        new Notice(
          outcome.ok ? `${outcome.message}\n可以启动服务了` : outcome.message,
          outcome.ok ? 8000 : 20000
        );
      })
    );

  pathField(
    "Python 解释器",
    "需已安装 qwen-tts 的 Python 3.10+（推荐 3.12），「浏览…」选中 python.exe；也可直接填 python 命令名",
    () => qwen().pythonPath,
    value => {
      qwen().pythonPath = value.trim();
    },
    "C:\\Python312\\python.exe",
    "executable"
  );

  new Setting(containerEl)
    .setName("检查 Python 环境")
    .setDesc("确认解释器可用且已安装 qwen-tts（会真实 import 一次，torch 较慢请稍候）")
    .addButton(button =>
      button.setButtonText("检查").onClick(async () => {
        new Notice("正在检查 Python 环境…", 4000);
        const outcome = await checkQwenPython(qwen().pythonPath);
        new Notice(
          outcome.ok
            ? outcome.message
            : `${outcome.message}\n安装：pip install -U qwen-tts`,
          outcome.ok ? 8000 : 20000
        );
      })
    );

  new Setting(containerEl)
    .setName("推理设备")
    .setDesc("传给模型加载的 device_map。CUDA 不可用时服务会静默降级到 CPU，状态行会提示")
    .addDropdown(dropdown =>
      dropdown
        .addOptions({ "cuda:0": "cuda:0（第一块 GPU）", "cuda:1": "cuda:1（第二块 GPU）", cpu: "cpu" })
        .setValue(qwen().device)
        .onChange(value => {
          qwen().device = value as ReaderQwenSettings["device"];
          saveSoon();
        })
    );

  new Setting(containerEl)
    .setName("启动本地服务")
    .setDesc(
      "自动拉起 reader-qwen-server.py 并加载模型（1.7B 首次加载约需几十秒）。" +
        "已有服务在运行时直接复用；停止时只关闭由本插件启动的进程"
    )
    .addButton(button =>
      button.setButtonText("启动 / 复用").onClick(async () => {
        await plugin.startReaderService();
        refresh();
      })
    )
    .addButton(button =>
      button.setButtonText("停止").onClick(async () => {
        await plugin.stopReaderService();
        refresh();
      })
    )
    .addButton(button =>
      button
        .setButtonText("强制停止")
        .setTooltip("不做归属判断，直接关掉该端口上的服务（用于插件重载后丢了归属的情况）")
        .onClick(async () => {
          await plugin.forceStopReaderService();
          refresh();
        })
    );

  new Setting(containerEl).setName("声音（Qwen3-TTS）").setHeading();

  let instructArea!: TextAreaComponent;
  new Setting(containerEl)
    .setName("音色预设")
    .setDesc("常用音色模板，选中即填入下方描述框（不影响服务运行）")
    .addDropdown(dropdown => {
      const options: Record<string, string> = {};
      for (const [name] of QWEN_VOICE_PRESETS) options[name] = name;
      dropdown.addOptions(options).setValue("");
      dropdown.onChange(name => {
        const preset = QWEN_VOICE_PRESETS.find(([label]) => label === name);
        if (!preset) return;
        qwen().instruct = preset[1];
        instructArea.setValue(preset[1]);
        dropdown.setValue("");
        saveTtsSoon();
      });
    });

  new Setting(containerEl)
    .setName("音色描述")
    .setDesc(
      "用自然语言描述想要的音色（可含性别、年龄、情绪、语速等），随每个请求发送、改完即生效；" +
        "留空则使用模型默认音色"
    )
    .setClass("gm-stack-row")
    .addTextArea(area => {
      instructArea = area;
      area.setValue(qwen().instruct).onChange(value => {
        qwen().instruct = value;
        saveTtsSoon();
      });
      area.inputEl.rows = 3;
      // setCssProps 而非 style.width（审核规则 no-static-styles-assignment）
      area.inputEl.setCssProps({ width: "100%" });
    });

  new Setting(containerEl)
    .setName("朗读语种")
    .setDesc(
      "VoiceDesign 官方支持 10 种语言。注意：该引擎暂不支持语速调节（接口无 speed 参数），" +
        "输出固定为 wav，「语速」「输出格式」仅对 GPT-SoVITS 生效"
    )
    .addDropdown(dropdown => {
      const options: Record<string, string> = {};
      for (const language of QWEN_LANGUAGES) options[language.value] = language.label;
      dropdown
        .addOptions(options)
        .setValue(qwen().language)
        .onChange(value => {
          qwen().language = value;
          saveTtsSoon();
        });
    });

  text(
    "合成超时（毫秒）",
    "单次合成的等待上限。首次推理含内核预热较慢；频繁报超时可调大",
    () => String(qwen().timeoutMs),
    value => {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 5000) {
        qwen().timeoutMs = Math.round(parsed);
      }
    },
    "120000"
  );

  new Setting(containerEl)
    .setName("环境诊断")
    .setDesc("按当前引擎检查子进程能力、服务可达性、音频解码与浏览器语音。诊断语音一项会出声")
    .addButton(button =>
      button.setButtonText("运行诊断").onClick(() => void plugin.runReaderDiagnostics())
    );
}

/**
 * Windows 本地语音（SAPI5）提供方的配置组 —— 零安装兜底。
 *
 * 与前两套的差别：没有服务、没有模型、没有 Python，用的是系统已装好的语音
 * （中文系统上通常是「Microsoft Huihui Desktop」），由插件起一次 PowerShell 合成到 wav。
 * 所以这里没有「服务」分组 —— 只有一个环境自检 + 语音 / 语速 / 音量。
 */
function renderWindowsTtsSections(
  containerEl: HTMLElement,
  plugin: GlimpsePlugin,
  ctx: SectionContext
) {
  const { settings, refresh, saveTtsSoon, text, pathField } = ctx;
  const windows = () => settings().windows;
  const engine = plugin.readerWindowsEngine;

  new Setting(containerEl).setName("环境（Windows 本地语音）").setHeading();

  if (!isWindows()) {
    new Setting(containerEl)
      .setName("⚠ 当前系统不是 Windows")
      .setDesc(
        "Windows 本地语音用系统内置的 SAPI5 语音，只能在 Windows 桌面端使用。" +
          "在其它平台上请改用 GPT-SoVITS 或 Qwen3-TTS"
      );
  }

  // 状态行：进程状态 / 推理健康度与两个服务型引擎同一套语义（但没有进程，只有健康度）
  const health = engine.getHealth();
  const resolvedShell = engine.getResolvedShell();
  const voices = engine.getVoices();
  const healthText =
    health.state === "ok"
      ? "推理正常"
      : health.state === "broken"
        ? `⚠ 推理失败：${health.reason ?? "原因未知"}`
        : "推理状态未知（尚未合成过）";
  const dotClass =
    health.state === "broken"
      ? "is-broken"
      : health.state === "ok"
        ? "is-running"
        : "is-unknown";
  const descParts = [
    "无需本地服务（直接调用系统语音）",
    resolvedShell ? `PowerShell：${resolvedShell}` : "PowerShell：尚未探测（点「检查环境」）",
    voices.length > 0 ? `系统语音 ${voices.length} 个` : "系统语音：尚未枚举",
    `当前语音：${engine.effectiveVoiceName() || "（未探测）"}`,
    healthText,
  ];

  new Setting(containerEl)
    .setName(statusDot(dotClass, "环境状态"))
    .setDesc(descParts.join("　·　"))
    .addButton(button => button.setButtonText("刷新").onClick(() => refresh()))
    .addButton(button =>
      button.setButtonText("检查环境").onClick(async () => {
        new Notice("正在检查系统语音环境…", 4000);
        const probe = await engine.probe();
        new Notice(probe.message, probe.ok ? 8000 : 15000);
        refresh();
      })
    );

  pathField(
    "PowerShell 路径（可选）",
    "留空自动探测：优先 Windows PowerShell 5.1（自带 System.Speech），失败再试 PowerShell 7。" +
      "只有自动探测失败（如被安全策略改名、或 PS7 缺 System.Speech）时才需要手填",
    () => windows().shellPath,
    value => {
      windows().shellPath = value.trim();
    },
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    "executable"
  );

  new Setting(containerEl)
    .setName("环境诊断")
    .setDesc("按当前引擎检查子进程能力、服务可达性、音频解码与浏览器语音。诊断语音一项会出声")
    .addButton(button =>
      button.setButtonText("运行诊断").onClick(() => void plugin.runReaderDiagnostics())
    );

  text(
    "合成超时（毫秒）",
    "单次合成的等待上限。实测单段 155 字约 0.46 秒（含 PowerShell 启动）；" +
      "频繁超时通常意味着 PowerShell 被安全软件拦截",
    () => String(windows().timeoutMs),
    value => {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 3000) {
        windows().timeoutMs = Math.round(parsed);
      }
    },
    "30000"
  );

  new Setting(containerEl).setName("声音（Windows 本地语音）").setHeading();

  // 语音下拉：列表要真起一次 PowerShell 才能拿到（约 0.4 秒），所以先渲染再异步补全。
  // 「自动」= 不调用 SelectVoice，用系统默认语音
  let voiceDropdown!: DropdownComponent;
  const fillVoices = (list: WindowsTtsVoice[], defaultVoice: string) => {
    const select = voiceDropdown.selectEl;
    select.empty();
    voiceDropdown.addOption(
      "",
      defaultVoice ? `自动（系统默认：${defaultVoice}）` : "自动（系统默认语音）"
    );
    for (const voice of list) {
      const label = voice.culture ? `${voice.name}（${voice.culture}）` : voice.name;
      voiceDropdown.addOption(voice.name, voice.enabled ? label : `${label} · 已禁用`);
    }
    // 已配置但系统里没有的名字也留着：静默改成别的语音比报错更难排查
    const configured = windows().voiceName.trim();
    if (configured && !list.some(voice => voice.name === configured)) {
      voiceDropdown.addOption(configured, `${configured}（系统中未找到）`);
    }
    voiceDropdown.setValue(windows().voiceName);
  };

  new Setting(containerEl)
    .setName("语音（音色）")
    .setDesc(
      "系统里已安装的 SAPI5 语音。带 zh-CN 的才能念中文；「自动」用系统的默认语音。" +
        "想加语音到「设置 → 时间和语言 → 语音」里装（中文语音包）"
    )
    .addDropdown(dropdown => {
      voiceDropdown = dropdown;
      dropdown.addOption("", "自动（系统默认语音）");
      dropdown.setValue(windows().voiceName);
      dropdown.onChange(value => {
        windows().voiceName = value;
        // 下拉是离散选择，立刻同步到引擎（不然抖动的 500ms 内试听/朗读还用旧语音）
        plugin.refreshReaderEngine();
        saveTtsSoon();
      });
      void engine.listVoices().then(report => {
        if (!report.ok) {
          console.warn(`朗读：枚举系统语音失败 —— ${report.message}`);
          return;
        }
        fillVoices(report.voices, report.defaultVoice);
      });
    })
    .addButton(button =>
      button.setButtonText("刷新语音列表").onClick(async () => {
        new Notice("正在读取系统语音列表…", 4000);
        const report = await engine.listVoices(true);
        if (!report.ok) {
          new Notice(report.message, 15000);
          return;
        }
        fillVoices(report.voices, report.defaultVoice);
        const effective = engine.effectiveVoiceName();
        new Notice(
          `${report.message}${effective ? `\n当前：${effective}` : ""}\n下拉列表已刷新`,
          8000
        );
      })
    );

  text(
    "语音名称（手动）",
    "一般不用填 —— 上面选好即可。列表读不出来、或想用未列出的名称（如 OneCore 语音）时，" +
      "可在这里直接填 SAPI 语音名；填的名称不在系统里时朗读前会明确报错",
    () => windows().voiceName,
    value => {
      windows().voiceName = value.trim();
    },
    "Microsoft Huihui Desktop",
    true
  );

  new Setting(containerEl)
    .setName("语速")
    .setDesc(
      `0.5–${MAX_SPEED_FACTOR.toFixed(1)}x。系统语音的档位是 −10…10 的 Rate，` +
        `换算约 rate = (倍速 − 1) × 6：当前约为 rate ${windowsTtsRate(windows().speedFactor)}`
    )
    .addSlider(slider =>
      slider
        .setLimits(MIN_SPEED_FACTOR, MAX_SPEED_FACTOR, 0.05)
        .setValue(windows().speedFactor)
        .setDynamicTooltip()
        .onChange(value => {
          windows().speedFactor = value;
          saveTtsSoon();
        })
    );

  new Setting(containerEl)
    .setName("音量")
    .setDesc("系统语音的音量（SAPI Volume，0–100）。播放器自身的音量不受它影响")
    .addSlider(slider =>
      slider
        .setLimits(0, 100, 5)
        .setValue(windows().volume)
        .setDynamicTooltip()
        .onChange(value => {
          windows().volume = value;
          saveTtsSoon();
        })
    );

  new Setting(containerEl)
    .setName("试听")
    .setDesc("用当前语音 / 语速 / 音量合成一句话并播放，验证这条路走得通（不写入任何文件）")
    .addButton(button =>
      button.setButtonText("试听").onClick(async () => {
        // 设置刚改过时防抖还没落盘，先同步一次，保证试听的就是眼前这组参数
        plugin.refreshReaderEngine();
        button.setDisabled(true);
        try {
          const audio = await engine.synthesize(
            "这是一段试听文本，用来检查语音、语速与音量。"
          );
          stopActiveAudition();
          const handle = createElementAudioPlayback(audio.bytes, audio.mimeType);
          activeAudition = handle;
          handle.onEnded = () => {
            handle.destroy();
            if (activeAudition === handle) activeAudition = null;
          };
          await handle.play();
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.error("Windows 本地语音试听失败", error);
          new Notice(`试听失败：${detail}`, 15000);
        } finally {
          button.setDisabled(false);
        }
      })
    );
}
