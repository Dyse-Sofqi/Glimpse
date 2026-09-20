/**
 * 标签编辑弹窗（MP3/M4A 可编辑）：文件名/标题/艺术家/专辑/歌词/封面。
 * 「获取歌词」「获取封面」走四平台（网易云/QQ/酷狗/酷我）搜索，
 * 候选列表手动选择后导入；保存时写回音频标签（node-id3 / writeMp4Tags）。
 */
import { App, Modal, Notice, Setting, TFile, ButtonComponent, setIcon } from "obsidian";
import type { MusicManager } from "./manager";
import { readAudioFileBytes, parseTagsForPlugin, readGenericTags, writeAudioTags, getAudioFileSize, type Mp3Tags, type AudioSource, isEditableSource } from "./tags";
import { downloadImage } from "./onlineLyrics";
import { searchCandidates, fetchSongLyrics, type DownloadSong } from "./downloadManager";
import { formatDuration } from "./downloadUtils";
import { estimateEmbeddedSize, estimateM4aEmbeddedSize, formatBytes } from "./tagSize";
import { estimateMp3Duration } from "./mp3Duration";
import { formatDurationColon } from "./lrc";
import { extractMp4Duration } from "./bytes/mp4";
import { detectAudioContainer } from "./songScanner";
import { SOURCE_LABELS, blobOf } from "./shared";

export default class TagEditorModal extends Modal {
  private tags: Mp3Tags = {};
  private source: AudioSource | null = null;
  private saving = false;
  private coverInput: HTMLInputElement | null = null;
  private coverPreview: HTMLElement | null = null;
  private coverCandidatesEl: HTMLElement | null = null; // 多平台封面候选列表容器（缩略图网格）
  private newFileName = ""; // 文件名重命名目标（含扩展名），空 = 不改名
  private fetching = false; // 在线歌词/封面获取中标志（防重复点击）
  private fileSizeBytes = 0; // 当前文件字节数（0 = 读取失败/未知）
  private durationSec = 0; // 当前音频时长（秒，0 = 解析失败/未知）
  private container: "mp3" | "m4a" = "mp3"; // 真实容器（编辑弹窗按容器分派写入与体积估算）
  private baselineEmbedded = 0; // 打开时原标签的估算字节，用于计算保存后的预计增量
  private sizeDescEl: HTMLElement | null = null; // 「文件大小」提示行，随编辑实时刷新
  private lyricCandidatesEl: HTMLElement | null = null; // 多平台歌词候选列表容器
  private fetchingLyrics = false; // 歌词候选加载中标志

  constructor(
    app: App,
    private plugin: MusicManager,
    private initialSource: AudioSource,
  ) {
    super(app);
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("gm-tag-editor");
    this.titleEl.setText("编辑标签");

    const loading = this.contentEl.createDiv({ cls: "gm-tag-loading", text: "正在读取标签…" });
    this.source = this.initialSource;
    if (!this.source) {
      new Notice("未找到该歌曲的音频文件");
      this.close();
      return;
    }
    // 可编辑格式：MP3/M4A（node-id3 写 MP3、writeMp4Tags 写 M4A）；其余只读展示
    if (!isEditableSource(this.source)) {
      new Notice("仅 MP3/M4A 可编辑标签，该格式为只读展示", 4000);
      this.close();
      return;
    }
    const bytes = await readAudioFileBytes(this.app, this.source);
    // 真实容器检测：扩展名 .mp3 实为 M4A/AAC（从 mp4 提取只改扩展名）等伪扩展名按真实容器编辑；
    // FLAC/OGG 无写入器直接拒绝，避免损坏文件。
    if (bytes) {
      const container = detectAudioContainer(bytes);
      if (container === "flac" || container === "ogg") {
        new Notice(`该文件实为 ${container.toUpperCase()} 格式，为避免损坏文件已禁止编辑`, 6000);
        this.close();
        return;
      }
      this.container = container === "m4a" ? "m4a" : "mp3";
    }
    let tags: Mp3Tags = {};
    if (bytes) {
      if (this.container === "m4a") {
        // M4A：readGenericTags 读 MP4 atom（node-id3 只认 MP3 ID3 帧）
        tags = (await readGenericTags(bytes)) ?? {};
      } else {
        tags = parseTagsForPlugin(bytes) ?? {};
      }
    }
    this.tags = tags;
    this.durationSec = bytes
      ? (this.container === "m4a" ? extractMp4Duration(bytes) ?? 0 : estimateMp3Duration(bytes) ?? 0)
      : 0;
    const size = await getAudioFileSize(this.app, this.source);
    this.fileSizeBytes = size ?? 0;
    this.baselineEmbedded = this.container === "m4a" ? estimateM4aEmbeddedSize(this.tags) : estimateEmbeddedSize(this.tags);
    loading.remove();
    this.render();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    // 文件名（重命名；保存时 vault 用 Obsidian 重命名，库外 fs 重命名）
    const nameSetting = new Setting(contentEl)
      .setName("文件名")
      .setDesc(this.getCurrentAbsolutePath());
    nameSetting.addText((text) => {
      const current = this.getCurrentFileName();
      text.setValue(current)
        .setPlaceholder("输入新文件名（含扩展名）")
        .onChange((v) => { this.newFileName = v.trim(); });
    });

    // 文件大小 + 预计保存后大小（歌词/封面/文本编辑时实时刷新）
    const sizeSetting = new Setting(contentEl).setName("文件大小");
    this.sizeDescEl = sizeSetting.descEl;
    this.updateSizeEstimate();

    const textFields: Array<["title" | "artist" | "album", string]> = [
      ["title", "标题"], ["artist", "艺术家"], ["album", "专辑"],
    ];
    for (const [key, label] of textFields) {
      new Setting(contentEl).setName(label).addText((text) => {
        text.setValue(this.tags[key] ?? "");
        text.onChange((v) => { this.tags[key] = v; this.updateSizeEstimate(); });
      });
    }

    // 歌词（textarea，一键粘贴整段；「获取歌词」多平台搜索候选手动选择）
    const lyricsSetting = new Setting(contentEl).setName("歌词").setDesc(
      (this.durationSec > 0 ? formatDurationColon(this.durationSec) + " · " : "")
      + "保存后内嵌到音频；若同目录存在同名 .lrc 侧车文件，播放时侧车优先显示",
    );
    const lyricsArea = contentEl.createEl("textarea", { cls: "gm-tag-lyrics" });
    lyricsArea.value = this.tags.lyrics ?? "";
    lyricsArea.addEventListener("input", () => { this.tags.lyrics = lyricsArea.value; this.updateSizeEstimate(); });
    lyricsSetting.addButton((btn) => btn.setCta().setButtonText("获取歌词").onClick(() => void this.fetchOnlineLyrics(lyricsArea, btn)));
    // 多平台歌词候选列表（获取歌词后展示，点击某条导入后收起）
    const candidateBox = contentEl.createDiv({ cls: "gm-tag-lyric-candidates gm-tag-lyric-candidates-hidden" });
    this.lyricCandidatesEl = candidateBox;

    // 封面
    const coverSetting = new Setting(contentEl).setName("封面");
    this.coverPreview = contentEl.createDiv({ cls: "gm-tag-cover-preview" });
    this.renderCoverPreview();
    coverSetting.addButton((btn) => btn.setButtonText("选择图片").onClick(() => this.coverInput?.click()));
    coverSetting.addButton((btn) => btn.setCta().setButtonText("获取封面").onClick(() => void this.fetchCover(btn)));
    coverSetting.addButton((btn) => btn.setWarning().setButtonText("移除封面").onClick(() => {
      this.tags.cover = null;
      this.renderCoverPreview();
      this.updateSizeEstimate();
    }));
    this.coverInput = contentEl.createEl("input", {
      cls: "gm-tag-cover-input",
      attr: { type: "file", accept: "image/*" },
    });
    // 多平台封面候选列表（获取封面后展示，缩略图，点击某条导入）
    const coverCandidatesBox = contentEl.createDiv({ cls: "gm-tag-cover-candidates gm-tag-lyric-candidates-hidden" });
    this.coverCandidatesEl = coverCandidatesBox;
    this.coverInput.addEventListener("change", () => {
      const f = this.coverInput?.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.tags.cover = { mime: f.type || "image/jpeg", data: new Uint8Array(reader.result as ArrayBuffer) };
        this.renderCoverPreview();
        this.updateSizeEstimate();
      };
      reader.readAsArrayBuffer(f);
    });

    // 按钮：删除文件（垃圾桶图标，二次点击确认）/ 取消 / 保存
    const actions = contentEl.createDiv({ cls: "gm-tag-actions" });
    const deleteBtn = actions.createEl("button", { cls: "gm-tag-delete" });
    let deleteArmed = false;
    let armTimer: number | null = null;
    const renderDelete = () => {
      deleteBtn.empty();
      if (deleteArmed) {
        deleteBtn.setText("再次点击确认删除");
        return;
      }
      const ic = deleteBtn.createSpan({ cls: "gm-tag-delete-icon" });
      setIcon(ic, "trash");
      deleteBtn.createSpan({ text: "删除文件" });
    };
    renderDelete();
    deleteBtn.addEventListener("click", () => {
      if (this.saving) return;
      if (!deleteArmed) {
        // 第一次点击：武装，需再次点击才真正删除
        deleteArmed = true;
        deleteBtn.addClass("gm-tag-delete-armed");
        renderDelete();
        new Notice("再次点击确认删除该文件", 4000);
        if (armTimer !== null) window.clearTimeout(armTimer);
        armTimer = window.setTimeout(() => {
          deleteArmed = false;
          deleteBtn.removeClass("gm-tag-delete-armed");
          renderDelete();
        }, 4000);
        return;
      }
      if (armTimer !== null) window.clearTimeout(armTimer);
      void this.deleteFile();
    });
    actions.createEl("button", { text: "取消", cls: "mod-cta gm-tag-cancel" })
      .addEventListener("click", () => this.close());
    actions.createEl("button", { text: "保存", cls: "mod-cta gm-tag-save" })
      .addEventListener("click", () => this.save());
  }

  /** 用标题/艺术家做多平台搜索，返回候选列表（含来源/时长），供手动选择；无标题返回空 */
  private async searchLyricCandidates(): Promise<DownloadSong[]> {
    const title = (this.tags.title ?? "").trim() || this.getCurrentFileName().replace(/\.[^.]+$/, "");
    const artist = (this.tags.artist ?? "").trim();
    if (!title) {
      new Notice("无标题，无法搜索");
      return [];
    }
    const query = artist ? `${title} ${artist}` : title;
    // 四平台并行搜索（downloadManager 内部已按相似度排序），返回含 source/duration 的候选
    return await searchCandidates(query, this.plugin.getSettings().downloadSources);
  }

  /** 从多平台拉取当前歌曲歌词：搜索后展示候选列表（含来源/时长），点击某条导入歌词框 */
  private async fetchOnlineLyrics(lyricsArea: HTMLTextAreaElement, btn: ButtonComponent): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    btn.setDisabled(true);
    btn.setButtonText("搜索中…");
    try {
      const candidates = await this.searchLyricCandidates();
      if (candidates.length === 0) {
        new Notice("未找到匹配的歌曲");
        return;
      }
      this.renderLyricCandidates(candidates, lyricsArea);
    } catch (e) {
      new Notice(`获取歌词失败：${(e as Error).message || "网络错误"}`, 5000);
    } finally {
      this.fetching = false;
      btn.setDisabled(false);
      btn.setButtonText("获取歌词");
    }
  }

  /** 渲染多平台歌词候选列表：每行来源胶囊 + 歌名/歌手 + 时长，点击导入对应歌词 */
  private renderLyricCandidates(candidates: DownloadSong[], lyricsArea: HTMLTextAreaElement): void {
    const box = this.lyricCandidatesEl;
    if (!box) return;
    box.empty();
    box.removeClass("gm-tag-lyric-candidates-hidden");
    // 标题行：文字 + 右上角关闭按钮
    const titleRow = box.createDiv({ cls: "gm-tag-lyric-candidates-title" });
    titleRow.createSpan({ cls: "gm-tag-lyric-candidates-title-text", text: "选择歌词来源（点击导入）：" });
    const closeBtn = titleRow.createEl("button", { cls: "gm-tag-lyric-candidates-close", text: "✕" });
    closeBtn.setAttribute("title", "关闭");
    closeBtn.addEventListener("click", () => this.hideLyricCandidates());
    for (const s of candidates) {
      const row = box.createDiv({ cls: "gm-tag-lyric-candidate" });
      row.setAttribute("data-key", `${s.source}:${s.id}`);
      // 来源胶囊
      row.createSpan({ cls: `gm-tag-lyric-source gm-tag-lyric-source-${s.source}`, text: SOURCE_LABELS[s.source] ?? s.source });
      // 歌名/歌手 + 时长
      const meta = row.createSpan({ cls: "gm-tag-lyric-candidate-meta" });
      meta.setText(`${s.name} - ${s.artist || "未知艺术家"}${s.duration ? ` · ${formatDuration(s.duration)}` : ""}`);
      row.addEventListener("click", () => void this.importLyric(s, row, lyricsArea));
    }
  }

  /** 拉取并导入所选候选的歌词到歌词框（保存时写回 USLT） */
  private async importLyric(song: DownloadSong, row: HTMLElement, lyricsArea: HTMLTextAreaElement): Promise<void> {
    if (this.fetchingLyrics) return;
    this.fetchingLyrics = true;
    row.addClass("gm-tag-lyric-candidate-loading");
    try {
      const lrc = await fetchSongLyrics(song);
      if (!lrc) {
        new Notice(`该歌曲无歌词（${SOURCE_LABELS[song.source] ?? song.source}）`, 4000);
        return;
      }
      lyricsArea.value = lrc;
      this.tags.lyrics = lrc;
      this.updateSizeEstimate();
      new Notice(`已导入歌词：${song.name} - ${song.artist}`, 3000);
    } catch (e) {
      new Notice(`获取歌词失败：${(e as Error).message || "网络错误"}`, 5000);
    } finally {
      this.fetchingLyrics = false;
      row.removeClass("gm-tag-lyric-candidate-loading");
    }
  }

  /** 收起多平台歌词候选列表 */
  private hideLyricCandidates(): void {
    if (this.lyricCandidatesEl) {
      this.lyricCandidatesEl.empty();
      this.lyricCandidatesEl.addClass("gm-tag-lyric-candidates-hidden");
    }
  }

  /** 搜索多平台候选，过滤有封面的，展示封面候选缩略图列表（点击某条导入） */
  private async fetchCover(btn: ButtonComponent): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    btn.setDisabled(true);
    btn.setButtonText("获取中…");
    try {
      const candidates = await this.searchLyricCandidates();
      // 候选带 coverUrl（各平台搜索解析均带）；无 coverUrl 的跳过
      const withCover = candidates.filter((c) => c.coverUrl);
      if (withCover.length === 0) {
        new Notice("该歌曲无封面");
        return;
      }
      this.renderCoverCandidates(withCover);
    } catch (e) {
      new Notice(`获取封面失败：${(e as Error).message || "网络错误"}`, 5000);
    } finally {
      this.fetching = false;
      btn.setDisabled(false);
      btn.setButtonText("获取封面");
    }
  }

  /** 渲染多平台封面候选列表：标题行 + 缩略图网格（来源胶囊 + 歌名/歌手），点击某条导入对应封面 */
  private renderCoverCandidates(candidates: DownloadSong[]): void {
    const box = this.coverCandidatesEl;
    if (!box) return;
    box.empty();
    box.removeClass("gm-tag-lyric-candidates-hidden");
    // 标题行：文字 + 右上角关闭按钮
    const titleRow = box.createDiv({ cls: "gm-tag-lyric-candidates-title" });
    titleRow.createSpan({ cls: "gm-tag-lyric-candidates-title-text", text: "选择封面来源（点击导入）：" });
    const closeBtn = titleRow.createEl("button", { cls: "gm-tag-lyric-candidates-close", text: "✕" });
    closeBtn.setAttribute("title", "关闭");
    closeBtn.addEventListener("click", () => this.hideCoverCandidates());
    // 缩略图网格
    const grid = box.createDiv({ cls: "gm-tag-cover-candidates-grid" });
    for (const s of candidates) {
      if (!s.coverUrl) continue;
      const item = grid.createDiv({ cls: "gm-tag-cover-candidate" });
      item.setAttribute("data-key", `${s.source}:${s.id}`);
      const img = item.createEl("img", { cls: "gm-tag-cover-candidate-img" });
      img.src = s.coverUrl;
      img.alt = `${s.name} - ${s.artist || ""}`;
      // 缩略图加载失败：隐藏 img 留灰底占位，避免破图图标
      img.onerror = () => { img.addClass("gm-tag-cover-candidate-img-broken"); };
      // 来源胶囊
      item.createSpan({ cls: `gm-tag-lyric-source gm-tag-lyric-source-${s.source}`, text: SOURCE_LABELS[s.source] ?? s.source });
      // 歌名/歌手
      const meta = item.createDiv({ cls: "gm-tag-cover-candidate-meta" });
      meta.setText(`${s.name}${s.artist ? ` - ${s.artist}` : ""}`);
      item.addEventListener("click", () => void this.importCover(s, item));
    }
    // 无任何可用缩略图项（理论上 filter 已保证至少一个，但防御性兜底）
    if (grid.children.length === 0) {
      new Notice("该歌曲无封面");
      this.hideCoverCandidates();
    }
  }

  /** 拉取并导入所选候选的封面到标签（保存时写回 APIC 帧） */
  private async importCover(song: DownloadSong, item: HTMLElement): Promise<void> {
    if (this.fetching || !song.coverUrl) return;
    this.fetching = true;
    item.addClass("gm-tag-lyric-candidate-loading");
    try {
      const img = await downloadImage(song.coverUrl);
      if (!img) {
        new Notice("封面下载失败");
        return;
      }
      this.tags.cover = img;
      this.renderCoverPreview();
      this.updateSizeEstimate();
      new Notice(`已导入封面：${song.name} - ${song.artist}`, 3000);
      // 不自动收起候选列表：用户可连续试多个封面，需手动点右上角 ✕ 关闭
    } catch (e) {
      new Notice(`获取封面失败：${(e as Error).message || "网络错误"}`, 5000);
    } finally {
      this.fetching = false;
      item.removeClass("gm-tag-lyric-candidate-loading");
    }
  }

  /** 收起多平台封面候选列表 */
  private hideCoverCandidates(): void {
    if (this.coverCandidatesEl) {
      this.coverCandidatesEl.empty();
      this.coverCandidatesEl.addClass("gm-tag-lyric-candidates-hidden");
    }
  }

  /** 当前音频文件名（含扩展名） */
  private getCurrentFileName(): string {
    if (!this.source) return "";
    if (this.source.type === "vault" && this.source.file) return this.source.file.name;
    if (this.source.type === "external" && this.source.path) {
      return this.source.path.split(/[\\/]/).pop() ?? "";
    }
    return "";
  }

  /** 当前音频的绝对路径：vault 用 adapter.getFullPath（磁盘真实路径），库外即 source.path */
  private getCurrentAbsolutePath(): string {
    if (!this.source) return "未知";
    if (this.source.type === "vault" && this.source.file) {
      try {
        const adapter = this.app.vault.adapter as any;
        return typeof adapter?.getFullPath === "function"
          ? adapter.getFullPath(this.source.file.path)
          : this.source.file.path;
      } catch {
        return this.source.file.path;
      }
    }
    if (this.source.type === "external" && this.source.path) return this.source.path;
    return "未知";
  }

  /** 实时刷新「当前大小 → 预计保存后大小」提示（歌词/封面/文本编辑时调用） */
  private updateSizeEstimate() {
    if (!this.sizeDescEl) return;
    const current = formatBytes(this.fileSizeBytes);
    if (this.fileSizeBytes <= 0) {
      this.sizeDescEl.setText(`当前 ${current}`);
      return;
    }
    // 预计大小 ≈ 当前大小 − 原标签字节 + 新标签字节（node-id3 重写标签区并保留音频）
    const newEmbedded = this.container === "m4a" ? estimateM4aEmbeddedSize(this.tags) : estimateEmbeddedSize(this.tags);
    const estimated = Math.max(0, this.fileSizeBytes - this.baselineEmbedded + newEmbedded);
    const delta = estimated - this.fileSizeBytes;
    const deltaText = delta === 0 ? "" : `（${delta > 0 ? "+" : "-"}${formatBytes(Math.abs(delta))}）`;
    this.sizeDescEl.setText(`当前 ${current} → 预计保存后 ${formatBytes(estimated)}${deltaText}`);
  }

  private renderCoverPreview() {
    if (!this.coverPreview) return;
    this.coverPreview.empty();
    if (this.tags.cover) {
      const url = URL.createObjectURL(blobOf(this.tags.cover.data, this.tags.cover.mime));
      const img = this.coverPreview.createEl("img", { cls: "gm-tag-cover-img" });
      img.src = url;
      // onload / onerror 均释放，避免图片加载失败时 blob URL 泄漏
      const revoke = () => URL.revokeObjectURL(url);
      img.onload = revoke;
      img.onerror = revoke;
    } else {
      this.coverPreview.createDiv({
        cls: "gm-tag-cover-empty",
        text: this.tags.cover === null ? "（无封面）" : "（未设置）",
      });
    }
  }

  private async save() {
    if (this.saving || !this.source) return;
    this.saving = true;
    try {
      // 1. 先写标签（使用当前 source 路径）
      const ok = await writeAudioTags(this.app, this.source, this.tags);
      if (!ok) {
        new Notice("保存失败，已还原原文件", 5000);
        return;
      }
      // 2. 若改了文件名，重命名音频
      const renamed = await this.renameAudioFile();
      if (!renamed) {
        new Notice("标签已保存，但文件名重命名失败（标签已写入原文件）", 5000);
        return;
      }
      new Notice("保存成功");
      // 刷新歌单：传音频路径触发重扫 + 清缓存 + 播放中歌词重读
      const refreshKey = this.source?.type === "vault" ? this.source.file?.path : this.source?.path;
      if (refreshKey) this.plugin.notifyTagsEdited(refreshKey);
      this.close();
    } finally {
      this.saving = false;
    }
  }

  /** 删除当前歌曲文件：vault 内移入系统回收站（可恢复），库外永久删除；删除正在播放的文件会停播 */
  private async deleteFile(): Promise<void> {
    if (!this.source || this.saving) return;
    this.saving = true;
    const name = this.getCurrentFileName();
    try {
      if (this.source.type === "vault" && this.source.file) {
        await this.app.vault.trash(this.source.file, true); // 系统回收站
      } else if (this.source.type === "external" && this.source.path) {
        const fs = (window as any).require("fs");
        await fs.promises.unlink(this.source.path); // 库外无回收站，永久删除
      } else {
        new Notice("未找到文件，无法删除");
        return;
      }
    } catch {
      new Notice("删除失败，请检查文件权限", 5000);
      return;
    } finally {
      this.saving = false;
    }
    // 通知插件：若删除的是正在播放的文件则停播；随后重扫歌单
    const audioPath = this.source.type === "vault" ? this.source.file?.path : this.source.path;
    if (audioPath) await this.plugin.handleAudioDeleted(audioPath);
    new Notice(`已删除：${name}`, 4000);
    this.close();
  }

  /** 重命名音频文件：vault 内用 Obsidian 重命名（自动更新引用），库外用 fs 重命名 */
  private async renameAudioFile(): Promise<boolean> {
    if (!this.source || !this.newFileName || !this.newFileName.includes(".")) return true; // 未改或非法 → 视为成功
    const current = this.getCurrentFileName();
    if (this.newFileName === current) return true;

    if (this.source.type === "vault" && this.source.file) {
      const dir = this.source.file.path.split("/").slice(0, -1).join("/");
      const newPath = dir ? `${dir}/${this.newFileName}` : this.newFileName;
      try {
        await this.app.fileManager.renameFile(this.source.file, newPath);
        this.source.file = this.app.vault.getAbstractFileByPath(newPath) as TFile;
        return true;
      } catch {
        return false;
      }
    }
    if (this.source.type === "external" && this.source.path) {
      const oldPath = this.source.path;
      try {
        const fs = (window as any).require("fs");
        const dir = oldPath.split(/[\\/]/).slice(0, -1).join("/");
        const newPath = dir ? `${dir}\\${this.newFileName}` : this.newFileName;
        await fs.promises.rename(oldPath, newPath);
        this.source.path = newPath;
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  onClose() {
    this.contentEl.empty();
  }
}
