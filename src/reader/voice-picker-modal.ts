/**
 * 音色选择弹窗。
 *
 * 与「参考音频」不同，权重必须成对：GPT 权重（.ckpt）与 SoVITS 权重（.pth）
 * 来自同一套模型。实测**错配不会报错** —— 服务照样返回音频，只是音色是错的；
 * 这种静默错误很难自己发现，所以按配对列出，一次选中同时设置两项。
 */
import { App, Modal, Notice, Setting, setIcon } from "obsidian";
import { pickFileWithNativeDialog, startDirFor } from "./native-file-dialog";
import {
  findCounterpartWeights,
  scanVoiceCandidates,
  VoiceCandidate,
} from "./tts/weight-scanner";

/**
 * 选择结果。
 * 传 null 表示「该项保持不变」—— 浏览单个 .ckpt 时只填 GPT，不该把已有的 SoVITS 清空。
 */
export type VoicePickHandler = (gptPath: string | null, sovitsPath: string | null) => void;

export class VoicePickerModal extends Modal {
  constructor(
    app: App,
    private readonly installRoot: string,
    private readonly currentGpt: string,
    private readonly currentSovits: string,
    private readonly onPick: VoicePickHandler
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("glimpse-voice-picker-modal");
    contentEl.createEl("h3", { text: "选择音色" });
    contentEl.createEl("p", {
      cls: "glimpse-reference-audio-hint",
      text:
        "GPT 权重与 SoVITS 权重必须来自同一套模型。实测错配不会报错 —— " +
        "服务照样出声，只是音色是错的，很难自己发现。所以这里按配对列出，选中即同时设置两项。",
    });

    if (this.currentGpt.trim() || this.currentSovits.trim()) {
      contentEl.createEl("p", {
        cls: "glimpse-reference-audio-current",
        text: `当前：${this.currentGpt.trim() || "（未设置）"}　+　${
          this.currentSovits.trim() || "（未设置）"
        }`,
      });
    }

    new Setting(contentEl)
      .setName("从资源管理器选择")
      .setDesc("权重放在安装目录之外时用这个。选 .ckpt 后会按同名基名自动配上 .pth")
      .addButton(button =>
        button.setButtonText("浏览 .ckpt…").onClick(() => void this.browseWeight("ckpt"))
      )
      .addButton(button =>
        button.setButtonText("浏览 .pth…").onClick(() => void this.browseWeight("pth"))
      );

    if (!this.installRoot.trim()) {
      contentEl.createEl("p", {
        cls: "glimpse-reference-audio-hint",
        text: "未配置安装根目录，无法扫描权重。可在设置里直接填写路径。",
      });
      return;
    }

    const candidates = scanVoiceCandidates(this.installRoot);
    if (candidates.length === 0) {
      contentEl.createEl("p", {
        cls: "glimpse-reference-audio-hint",
        text:
          "在安装根目录下没找到 GPT_weights* / SoVITS_weights* 里的权重文件。" +
          "如果你还没训练过音色，请先在 GPT-SoVITS 里完成训练。",
      });
      return;
    }

    const complete = candidates.filter(c => c.complete);
    const incomplete = candidates.filter(c => !c.complete);
    contentEl.createEl("p", {
      cls: "glimpse-reference-audio-hint",
      text: `找到 ${complete.length} 套完整音色${
        incomplete.length > 0 ? `，另有 ${incomplete.length} 项缺少配对` : ""
      }：`,
    });

    const list = contentEl.createDiv({ cls: "glimpse-voice-picker-list" });
    for (const candidate of candidates) {
      this.renderRow(list, candidate);
    }
  }

  /**
   * 浏览权重文件的统一入口（.ckpt 与 .pth 对称）：
   * 选中任一后自动找同名配对的另一个 —— 先查安装根目录的常规布局，
   * 再查被选文件的同目录；都找不到才只填当前项并提示。
   */
  private async browseWeight(kind: "ckpt" | "pth"): Promise<void> {
    const isCkpt = kind === "ckpt";
    const picked = await pickFileWithNativeDialog({
      title: isCkpt ? "选择 GPT 权重（.ckpt）" : "选择 SoVITS 权重（.pth）",
      filters: [
        isCkpt
          ? { name: "GPT 权重", extensions: ["ckpt"] }
          : { name: "SoVITS 权重", extensions: ["pth"] },
      ],
      // 从当前权重所在目录（或安装根目录）打开，免去手动翻目录
      defaultPath: startDirFor(isCkpt ? this.currentGpt : this.currentSovits, this.installRoot),
    });
    if (!picked) return;

    const baseName =
      (picked.split(/[\\/]/).pop() ?? "").replace(/\.(ckpt|pth)$/i, "");
    const pair = findCounterpartWeights(picked, this.installRoot);

    if (pair.gptPath && pair.sovitsPath) {
      this.onPick(pair.gptPath, pair.sovitsPath);
      new Notice(`已按同名基名自动配对：${baseName}`, 6000);
      this.close();
      return;
    }

    if (isCkpt) {
      this.onPick(picked, null);
    } else {
      this.onPick(null, picked);
    }
    new Notice(
      `没找到与「${baseName}」同名的${isCkpt ? " .pth" : " .ckpt"}（安装根目录与该文件所在目录都找过）。\n` +
        `已填入${isCkpt ? " GPT" : " SoVITS"}权重，请再选${isCkpt ? " SoVITS" : " GPT"}权重补上 —— ` +
        "缺一半不会报错，但音色是错的。",
      16000
    );
    this.close();
  }

  private renderRow(list: HTMLElement, candidate: VoiceCandidate): void {
    const row = list.createDiv({ cls: "glimpse-voice-picker-row" });
    if (!candidate.complete) row.addClass("is-incomplete");

    const icon = row.createSpan({ cls: "glimpse-reference-audio-row-icon" });
    setIcon(icon, candidate.complete ? "mic" : "alert-triangle");

    const main = row.createDiv({ cls: "glimpse-voice-picker-main" });
    main.createSpan({ cls: "glimpse-voice-picker-name", text: candidate.name });
    main.createSpan({
      cls: "glimpse-voice-picker-meta",
      text: candidate.complete
        ? `${candidate.versionHint} · 配对完整`
        : `缺少 ${candidate.gptPath ? "SoVITS(.pth)" : "GPT(.ckpt)"} 配对，无法使用`,
    });

    if (!candidate.complete) return;
    row.addEventListener("click", () => {
      this.onPick(candidate.gptPath!, candidate.sovitsPath!);
      new Notice(`已选择音色：${candidate.name}`, 6000);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
