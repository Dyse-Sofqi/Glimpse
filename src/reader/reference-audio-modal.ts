/**
 * 参考音频选择弹窗。
 *
 * 三件事：
 * 1. 扫描候选目录，列出候选音频（用户不必自己去记那串 hash 路径）
 * 2. 选中后**复制到插件目录**再使用 —— 网页里用过的参考音频常落在
 *    `TEMP/gradio/<hash>/`，会被 Gradio 清理；复制一份才稳定
 * 3. 候选目录优先用设置里的「参考音频目录」，留空才退回扫描安装根目录 ——
 *    指向一个固定的音色文件夹后，换音色只要点一下，不必每次重新翻路径
 */
import { App, DataAdapter, FileSystemAdapter, Modal, Notice, Setting, setIcon } from "obsidian";
import { isWindows, loadNodeModule } from "./node-bridge";
import {
  canPickDirectories,
  pickDirectoryWithNativeDialog,
  pickFileWithNativeDialog,
} from "./native-file-dialog";
import { AudioCandidate, formatSize, scanAudioCandidates } from "./tts/audio-scanner";

interface NodeFsModule {
  readFileSync: (path: string) => Uint8Array;
}

export interface ReferenceAudioPickerOptions {
  pluginId: string;
  /** GPT-SoVITS 安装根目录（未配置「参考音频目录」时的候选扫描位置） */
  installRoot: string;
  /** 参考音频目录（设置项，可空） */
  refAudioDir: string;
  /** 当前参考音频路径，仅用于展示 */
  currentPath: string;
  /** 用户在本弹窗里改了「参考音频目录」—— 调用方负责落盘 */
  onChangeDir: (dir: string) => void;
  onPick: (absolutePath: string) => void;
}

/**
 * 目标文件名：同名但**体积不同**（= 不是同一个文件）时改用 `name-2.wav`、`name-3.wav`…，
 * 避免静默互相覆盖。
 *
 * 为什么需要：用户常把参考音频按音色分目录放（`音色A/ref.wav`、`音色B/ref.wav`），
 * 只用基名做目标名的话，选第二个音色会**悄悄覆盖**第一个 —— 再想切回去已经没有文件了。
 * 体积相同视为同一个文件，直接原地覆盖（重复导入同一音频不会堆文件）。
 */
async function resolveTargetName(
  adapter: DataAdapter,
  dir: string,
  baseName: string,
  sizeBytes: number
): Promise<string> {
  const stem = baseName.replace(/\.[^.]+$/, "");
  const ext = baseName.slice(stem.length);
  for (let index = 1; index <= 50; index++) {
    const name = index === 1 ? baseName : `${stem}-${index}${ext}`;
    let size: number | null = null;
    try {
      size = (await adapter.stat(`${dir}/${name}`))?.size ?? null;
    } catch {
      size = null;
    }
    if (size === null || size === sizeBytes) return name;
  }
  return baseName;
}

/**
 * 把外部音频复制进插件目录，返回其**绝对路径**（GPT-SoVITS 需要绝对路径或相对安装根的路径）。
 * 失败返回 null。
 */
export async function importReferenceAudio(
  app: App,
  pluginId: string,
  sourcePath: string
): Promise<string | null> {
  const fs = loadNodeModule<NodeFsModule>("fs");
  if (!fs) return null;

  let bytes: Uint8Array;
  try {
    bytes = fs.readFileSync(sourcePath);
  } catch {
    return null;
  }
  if (bytes.byteLength === 0) return null;

  const baseName = sourcePath.split(/[\\/]/).pop() ?? "reference.wav";
  const dir = `${app.vault.configDir}/plugins/${pluginId}/reader-voice`;
  const adapter = app.vault.adapter;

  let relative: string;
  try {
    const name = await resolveTargetName(adapter, dir, baseName, bytes.byteLength);
    relative = `${dir}/${name}`;
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    // Buffer 可能是大 ArrayBuffer 上的视图，必须按 byteOffset/byteLength 切片
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    await adapter.writeBinary(relative, buffer);
  } catch (error) {
    console.error("导入参考音频失败", error);
    return null;
  }

  if (adapter instanceof FileSystemAdapter) {
    const separator = isWindows() ? "\\" : "/";
    return `${adapter.getBasePath()}${separator}${relative.split("/").join(separator)}`;
  }
  // 非文件系统适配器（移动端）拿不到绝对路径，而 GPT-SoVITS 本来就只在桌面端跑
  return null;
}

export class ReferenceAudioPickerModal extends Modal {
  private candidates: AudioCandidate[] = [];
  private listEl: HTMLElement | null = null;
  private dirLabelEl: HTMLElement | null = null;
  private manualValue = "";
  private readonly options: ReferenceAudioPickerOptions;
  /**
   * 弹窗内当前生效的参考音频目录。
   *
   * 必须自己持一份**可变**副本：在弹窗里改了目录后要立刻重扫列表，
   * 而 options.refAudioDir 是构造时捕获的字符串，改设置并不会改它。
   */
  private currentDir: string;

  constructor(app: App, options: ReferenceAudioPickerOptions) {
    super(app);
    this.options = options;
    this.currentDir = options.refAudioDir;
  }

  /** 实际要扫描的目录：优先「参考音频目录」，其次安装根目录 */
  private get scanRoot(): string {
    return (this.currentDir.trim() || this.options.installRoot.trim()).replace(/[\\/]+$/, "");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("glimpse-reference-audio-modal");
    contentEl.createEl("h3", { text: "选择参考音频" });
    contentEl.createEl("p", {
      cls: "glimpse-reference-audio-hint",
      text:
        "需要 3–10 秒的清晰人声。选中的文件会被复制到插件目录，避免原位置被清理后失效。" +
        "参考文本必须与音频实际念的内容一致，否则音色会跑偏。",
    });
    contentEl.createEl("p", {
      cls: "glimpse-reference-audio-hint",
      text:
        "音频放哪儿都行（绝对路径、相对安装根目录的路径都被接受）。要避开的只有 GPT-SoVITS 的 " +
        "TEMP/gradio/ —— 那是临时目录，会被清理。",
    });

    // 「参考音频目录」在这里也能改：用户正是在这个弹窗里发现「又要翻路径」的
    const dirSetting = new Setting(contentEl)
      .setName("参考音频目录")
      .setDesc(
        "列在下面的候选音频就来自这个目录。设成一个固定放参考音频的文件夹后，" +
          "以后换音色只要在列表里点一下；留空则扫描 GPT-SoVITS 安装根目录"
      )
      .addButton(button =>
        button.setButtonText("更改目录…").onClick(() => void this.pickDirectory())
      )
      .addExtraButton(button =>
        button
          .setIcon("x")
          .setTooltip("清空（改为扫描安装根目录）")
          .onClick(() => {
            this.currentDir = "";
            this.options.onChangeDir("");
            this.refreshDirLabel();
            this.renderList();
          })
      );
    this.dirLabelEl = dirSetting.descEl.createDiv({ cls: "glimpse-reference-audio-dir" });
    this.refreshDirLabel();

    if (this.options.currentPath.trim()) {
      contentEl.createEl("p", {
        cls: "glimpse-reference-audio-current",
        text: `当前：${this.options.currentPath}`,
      });
    }

    new Setting(contentEl)
      .setName("从资源管理器选择")
      .setDesc("打开系统文件对话框，可选任意位置的音频文件（选中后同样会复制到插件目录）")
      .addButton(button =>
        button.setButtonText("浏览文件…").onClick(() => void this.browseAndPick())
      );

    this.listEl = contentEl.createDiv({ cls: "glimpse-reference-audio-list" });
    this.renderList();

    new Setting(contentEl)
      .setName("或直接填写路径")
      .setDesc("支持绝对路径，或相对 GPT-SoVITS 安装根目录的路径")
      .addText(text => {
        text.setPlaceholder("例如 TEMP/gradio/xxxx/voice.wav").onChange(value => {
          this.manualValue = value;
        });
      })
      .addButton(button =>
        button.setButtonText("使用此路径").onClick(() => void this.useManualPath())
      );
  }

  private refreshDirLabel(): void {
    const dir = this.currentDir.trim();
    this.dirLabelEl?.setText(
      dir ? `当前目录：${dir}` : "当前目录：（未设置，扫描安装根目录）"
    );
  }

  /** 选一个新目录：立刻落盘（调用方），随后就地重扫列表，不打断选择流程 */
  private async pickDirectory(): Promise<void> {
    const picked = await pickDirectoryWithNativeDialog({
      title: "选择参考音频目录",
      defaultPath: this.currentDir.trim() || this.options.installRoot.trim() || undefined,
    });
    if (!picked) {
      // 选目录没有 input[type=file] 兜底，环境不支持时要说清楚
      if (!canPickDirectories()) {
        new Notice("当前环境打不开系统文件夹对话框，请到「设置 → 朗读 → 声音（GPT-SoVITS）」手动填写", 10000);
      }
      return;
    }
    this.currentDir = picked;
    this.options.onChangeDir(picked);
    this.refreshDirLabel();
    this.renderList();
  }

  private renderList(): void {
    const list = this.listEl;
    if (!list) return;
    list.empty();

    const root = this.scanRoot;
    if (!root) {
      list.createEl("p", {
        cls: "glimpse-reference-audio-hint",
        text: "既没设置「参考音频目录」，也没配置安装根目录，无法扫描候选音频。可在下方直接填写路径。",
      });
      return;
    }

    this.candidates = scanAudioCandidates(root);
    if (this.candidates.length === 0) {
      list.createEl("p", {
        cls: "glimpse-reference-audio-hint",
        text: `在 ${root} 下没扫到音频文件。可换一个「参考音频目录」，或用上面的「浏览文件…」直接选。`,
      });
      return;
    }

    list.createEl("p", {
      cls: "glimpse-reference-audio-hint",
      text: `扫描到 ${this.candidates.length} 个候选（按体积升序）：`,
    });

    for (const candidate of this.candidates) {
      const row = list.createDiv({ cls: "glimpse-reference-audio-row" });
      const icon = row.createSpan({ cls: "glimpse-reference-audio-row-icon" });
      setIcon(icon, "music");
      row.createSpan({ cls: "glimpse-reference-audio-row-label", text: candidate.label });
      row.createSpan({
        cls: "glimpse-reference-audio-row-size",
        text: formatSize(candidate.sizeBytes),
      });
      row.addEventListener("click", () => void this.importAndPick(candidate.path));
    }
  }

  /** 走系统原生对话框选文件，之后与列表选择走同一条导入流程 */
  private async browseAndPick(): Promise<void> {
    const picked = await pickFileWithNativeDialog({
      title: "选择参考音频（3–10 秒）",
      filters: [{ name: "音频文件", extensions: ["wav", "mp3", "flac", "ogg", "m4a", "aac"] }],
      // 锚定「参考音频目录」，没有就锚安装根目录：候选音频基本在这两处。
      // 注意不能锚 currentPath —— 那是已导入到插件目录的副本，没有导航意义
      defaultPath: this.scanRoot || undefined,
    });
    if (!picked) return;
    await this.importAndPick(picked);
  }

  private async importAndPick(sourcePath: string): Promise<void> {
    const absolute = await importReferenceAudio(
      this.app,
      this.options.pluginId,
      sourcePath
    );
    if (!absolute) {
      new Notice("导入失败：无法读取该文件，或插件目录不可写", 10000);
      return;
    }
    this.options.onPick(absolute);
    new Notice(`已导入并设为参考音频：${absolute}`, 8000);
    this.close();
  }

  private async useManualPath(): Promise<void> {
    const value = this.manualValue.trim();
    if (!value) {
      new Notice("请先填写路径");
      return;
    }
    // 绝对路径直接用；相对路径交给服务端按安装根目录解析（实测可行）
    if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("/")) {
      this.options.onPick(value);
      this.close();
      return;
    }
    const fs = loadNodeModule<NodeFsModule>("fs");
    const separator = isWindows() ? "\\" : "/";
    const absolute = `${this.options.installRoot.replace(/[\\/]+$/, "")}${separator}${value.replace(
      /\//g,
      separator
    )}`;
    if (fs) {
      // 用导入流程，把文件复制到插件目录，避免依赖安装目录里的相对位置
      await this.importAndPick(absolute);
      return;
    }
    this.options.onPick(value);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
