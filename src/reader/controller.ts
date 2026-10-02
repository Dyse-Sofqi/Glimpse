/**
 * 朗读控制器：把「分段 → 合成 → 播放 → 高亮」串起来。
 *
 * 关键前提：`view.editor.getValue()` 返回的整篇文本，其字符偏移与 CM6 位置**同一坐标系**。
 * 所以分段器给出的 rawFrom / rawTo 可以直接当 CM6 位置用 —— 这正是
 * text-pipeline 坚持「偏移保持」的回报，不需要任何坐标换算。
 */
import type { EditorView } from "@codemirror/view";
import { ChangeSet } from "@codemirror/state";
import { MarkdownView, Notice } from "obsidian";
import type GlimpsePlugin from "../main";
import { clauseIndexAt, clauseRawSpans, segmentContentRawRange, type ClauseSpan, type RawSpan } from "./clause-highlight";
import { applyReaderHighlight, hasReaderHighlight, mapRangeThroughDelta, scrollPosToCenter, setReaderDocChangeListener, shouldHoldCursorForUser } from "./highlight";
import {
  createElementAudioPlayback,
  createUrlAudioPlayback,
  ReaderState,
  SegmentQueue,
} from "./playback";
import { buildSegments, trimSegmentAtCursor, type Segment } from "./segmenter";
import type { PositionMap } from "./text-pipeline";

/**
 * 「光标跟随」为用户操作让路的窗口（毫秒）。
 *
 * 取 8 秒而不是更短：窗口太短会在用户还在改一句话的中途就过期，光标随即被朗读抢走
 * （那正是要避免的打断）；太长则只是在用户确实闲下来后多等一会儿，代价很小。
 */
const CURSOR_FOLLOW_GRACE_MS = 8000;

export interface ReaderProgress {
  state: ReaderState;
  /** 当前段（从 1 计，0 表示尚未开始） */
  index: number;
  total: number;
  /** 当前段内的播放进度 0–1 */
  ratio: number;
  message?: string;
}

export class ReaderController {
  private readonly queue: SegmentQueue;
  private view: MarkdownView | null = null;
  private segments: Segment[] = [];
  /** 当前段列表对应的映射（段内细分高亮把子区间换算回原文坐标用） */
  private segmentMap: PositionMap | null = null;
  /** 正在播放段的标点子区间：spans 带权重（进度定位），raw 是原文坐标（高亮） */
  private clauseSpans: ClauseSpan[] | null = null;
  private clauseRaw: RawSpan[] | null = null;
  private clauseIndex = -1;
  /** 朗读会话序号：每次 startWithSegments 递增；失败自动重试前确认会话未变 */
  private sessionSeq = 0;
  /** 首段合成失败 → 自动重启重试一次；每次用户主动发起朗读时重置 */
  private autoRetryUsed = false;
  private autoRetrying = false;
  private ratio = 0;
  private lastMessage: string | undefined;
  /** 最近一次意图下发的朗读区间。编辑器被 Obsidian 卸载重建后装饰会丢，
      布局/活动叶子变化时据此补发（见 restoreSession） */
  private lastAppliedRange: RawSpan | null = null;
  /** 朗读会话绑定的文档路径。工作区切换会整体拆建叶子（MarkdownView 实例随之
      销毁重建），据此在新布局里找回同文档的新视图（见 rebindIfStale） */
  private boundPath: string | null = null;
  private readonly listeners = new Set<(progress: ReaderProgress) => void>();

  /**
   * 自分段以来文档的累计变更，用于把「分段时坐标」换算到当前文档。
   *
   * 所有内部持有的坐标（segment.rawFrom/rawTo、clauseRaw、lastAppliedRange）**一律是
   * 分段那一刻的坐标**，只在两个出口换算成当前文档坐标：`toLiveRange()`。
   * 这样「编辑中朗读」的高亮就不再整体偏移 —— 用户插入/删除多少字符，重算时都跟着挪。
   *
   * 关联方向与 CM 自己平移装饰（`RangeSet.map`：from 用 assoc 1、to 用 assoc -1）**必须
   * 一致**，否则「自动平移」与「重算」两种路径在插入点边界上的取舍相反，换段瞬间会跳动。
   *
   * 用 `null` 表示「还没有任何编辑」而不是 `ChangeSet.empty` —— 后者在
   * `@codemirror/state` 6.7 是 `empty(length)` 静态方法，需要一个文档长度且语义不等价。
   */
  private docDelta: ChangeSet | null = null;
  /** 上面这条变更链对应的编辑器；只累计它所绑定的那个编辑器的事务 */
  private deltaView: EditorView | null = null;
  /** 最近一次用户编辑 / 双击定位的时间戳（供「光标跟随」让路窗口判断） */
  private lastUserActivityAt = 0;

  constructor(private readonly plugin: GlimpsePlugin) {
    // 累计变更：只认朗读会话绑定的编辑器，且只在分段之后（分段时基线清零）
    setReaderDocChangeListener((view, changes) => {
      if (view !== this.deltaView) return;
      // 第一笔编辑直接作为链头（它的 length 必须是分段时的文档长度，此时成立）
      this.docDelta = this.docDelta ? this.docDelta.compose(changes) : changes;
      // 用户正在编辑 → 「光标跟随」先让路，别把光标从输入位置挪走
      this.lastUserActivityAt = Date.now();
    });
    this.queue = new SegmentQueue({
      engine: plugin.readerEngine,
      lookahead: plugin.settings.reader.lookahead,
      createAudio: createElementAudioPlayback,
      createAudioFromUrl: createUrlAudioPlayback,
      // 流式首响（实验性）：仅 GPT-SoVITS 且开启流式时给出 URL，其余走常规合成
      streamSource: text => plugin.readerEngine.streamSource?.(text) ?? null,
      // 流式下媒体元素常给不出总时长（chunked），段末预开下一段流要靠这个估算判断时机
      estimateDuration: text =>
        text.length * 0.216 / plugin.readerSpeedFactor(),
      onSegmentStart: (_index, segment) => {
        // 音频已经拿到手，说明这次合成是成功的 —— 上报健康度
        this.plugin.markReaderHealth(true);
        this.ratio = 0;
        // 段内按标点细分：预计算子区间的原文范围，播放中由 onSegmentProgress 推进。
        // 首帧直接点亮第一个子区间（音频起点必然是它）——
        // 若先点整段再等 timeupdate 收窄，换段瞬间会整行闪一下
        const clauses =
          this.plugin.settings.reader.highlightClauses && this.segmentMap
            ? clauseRawSpans(segment, this.segmentMap)
            : null;
        this.clauseSpans = clauses?.spans ?? null;
        this.clauseRaw = clauses?.raw ?? null;
        if (this.clauseRaw) {
          this.clauseIndex = 0;
          this.applyClauseHighlight(this.clauseRaw[0]);
        } else {
          this.clauseIndex = -1;
          this.applyHighlight(segment);
        }
        this.emit();
      },
      onSegmentProgress: (index, currentTime, duration) => {
        // 流式播放时媒体元素可能暂时拿不到总时长（chunked 传输），用字数估算兜底
        const total = this.effectiveDuration(index, duration);
        this.ratio = total > 0 ? Math.min(1, currentTime / total) : 0;
        // 段内高亮按标点推进：ratio（真实音频时钟）映射到子区间，变了才重设装饰
        if (this.clauseSpans && this.clauseRaw && total > 0) {
          const clause = clauseIndexAt(this.clauseSpans, currentTime / total);
          if (clause !== this.clauseIndex) {
            this.clauseIndex = clause;
            this.applyClauseHighlight(this.clauseRaw[clause]);
          }
        }
        this.emit();
      },
      onSegmentEnd: () => this.emit(),
      onFinish: () => {
        this.clearHighlight();
        this.lastMessage = "朗读完成";
        this.emit();
      },
      onError: (index, error) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.lastMessage = `第 ${index + 1} 段合成失败：${detail}`;
        // 真实合成失败 → 记录健康度，设置页的状态行会据此显示「推理失败」
        this.plugin.markReaderHealth(false, detail);
        // 服务端的 Python traceback 在它自己的 stdout 里，我们捕获了 —— 一并打出来，
        // 否则用户只能看到「tts failed」这种毫无信息量的报错
        const tail = this.plugin.readerLogTail(12);
        console.error(
          `朗读：第 ${index + 1} 段合成失败`,
          error,
          tail.length > 0
            ? `\n服务日志尾部：\n${tail.join("\n")}`
            : "\n（未捕获到服务日志：该服务不是在本次会话里由本插件启动的，" +
              "所以没有它的 stdout。先「朗读：强制停止服务」再「朗读：启动本地服务」即可捕获。）"
        );

        this.clearHighlight();
        this.emit();

        // 「服务可达但推理坏」的状态只有真实合成能暴露 —— 首次失败自动重启重试一次
        //（预热自检已移除，见 autoRestartAndRetry）。重试机会用完后给出手动恢复指引
        const seq = this.sessionSeq;
        if (this.autoRetryUsed && !this.autoRetrying) {
          if (/Errno 22|Invalid argument/i.test(detail)) {
            new Notice(
              "本地语音服务处于坏状态（端口可达，但推理全部失败）。\n" +
                "执行「朗读：重启本地服务」即可恢复。",
              16000
            );
          }
          return;
        }
        void this.autoRestartAndRetry(index, seq);
      },
      onPlaybackBlocked: message => {
        this.lastMessage = message;
        this.emit();
      },
    });

    // 切标签页/切工作区时，编辑器（甚至整个视图实例）会被 Obsidian 销毁重建：
    // - 标签页：MarkdownView 存活，后台叶子的 CM 视图卸载，StateField 清空 → 补发高亮
    // - 工作区：叶子整体拆建，MarkdownView 销毁 → 按路径重绑视图 + 重挂播放条
    // 暂停状态下没有任何播放事件，不做这套自愈就永远回不来（高亮没了/播放条没了）
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("layout-change", () => this.restoreSession())
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("active-leaf-change", () => this.restoreSession())
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("file-open", file => {
        // 布局里没恢复正在读的文档时朗读继续但编辑器侧失联，重新打开时补绑
        if (file?.path === this.boundPath) this.restoreSession();
      })
    );
  }

  // ── 对外状态 ──────────────────────────────────────────────

  getState(): ReaderState {
    return this.queue.getState();
  }

  getProgress(): ReaderProgress {
    return {
      state: this.queue.getState(),
      index: this.queue.getCursor() + 1,
      total: this.queue.getTotal(),
      ratio: this.ratio,
      message: this.lastMessage,
    };
  }

  /** 订阅进度变化；返回退订函数 */
  subscribe(listener: (progress: ReaderProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 当前朗读高亮区间（**实时坐标**，已按编辑换算）：细分开启时是当前子区间，
   * 否则是整段内容区间（段尾标点已排除）。未在朗读 / 拿不到段时返回 null。
   *
   * 这是「界面显示的文字」（getCurrentText）与「双击选中并滚动的范围」
   * （revealCurrent）的**唯一来源** —— 两者共用同一个区间，
   * 因此不可能出现「显示的是这一段、选中的却是另一段」。
   */
  currentSpan(): RawSpan | null {
    if (this.queue.getState() === "idle") return null;
    const segment = this.segments[this.queue.getCursor()];
    if (!segment) return null;
    // 细分开启时取当前子区间；否则整段（段尾标点已由分段器剥掉，直接用段区间）
    const span = this.clauseRaw?.[this.clauseIndex];
    const stored: RawSpan =
      span ??
      (this.segmentMap
        ? segmentContentRawRange(segment, this.segmentMap)
        : { from: segment.rawFrom, to: segment.rawTo });
    return this.toLiveRange(stored);
  }

  /**
   * 当前正在朗读的块文本（细分开启时是当前子区间，否则是整段）。
   *
   * 从**编辑器实时文档**按高亮区间切片，而不是回存一份文本 —— 这样提词器展示的
   * 与实际被高亮/朗读的内容永远一致（含 Markdown 记号，因此提词器能渲染出格式）。
   * 未在朗读 / 拿不到编辑器时返回空串。
   */
  getCurrentText(): string {
    const range = this.currentSpan();
    const segment = this.segments[this.queue.getCursor()];
    if (!range || !segment) return "";
    // 编辑器可能在切标签页后被 Obsidian 卸载（后台叶子销毁 CM 视图），读取会抛 ——
    // 回退段文本兜底：这里抛出去会打断 emit 的后续订阅者（提词器/播放条全冻结）
    let doc = "";
    try {
      doc = this.view?.editor.getValue() ?? "";
    } catch {
      /* 编辑器不可用 */
    }
    const text = doc.slice(range.from, range.to);
    return text.trim() ? text : segment.text;
  }

  /**
   * 把编辑器定位到**正在朗读的区间**：滚动到该段，并把朗读高亮的那段文字选中。
   *
   * 提词器「朗读提取」模式双击时调用。朗读位置由**音频时钟**驱动，与编辑器光标无关
   * （而且「光标跟随」默认是关的），所以不能用 `ed.getCursor()` 当朗读位置 ——
   * 那会选中用户上次留下的光标所在行，表现为「双击后选中某个未知段落」。
   *
   * 区间与提词器显示的文字同源（currentSpan），因此选中的一定就是正在读、也正在高亮
   * 的那段。滚动刻意不用 `Editor.scrollIntoView` / `EditorView.scrollIntoView`：
   * 它们在自己滚不到时会连带滚动裁剪祖先容器，把播放条顶出视野
   * （见 highlight.scrollPosToCenter 的注释），故复用只动 cm-scroller 的那一个。
   */
  revealCurrent(): boolean {
    const range = this.currentSpan();
    const cm = this.cmView();
    const view = this.view;
    if (!range || !cm || !view) return false;
    try {
      // 朗读所在的叶子可能不在前台：先带到前台，否则「滚动到正在读的段落」看不见
      this.plugin.app.workspace.revealLeaf(view.leaf);
      view.editor.setSelection(
        view.editor.offsetToPos(range.from),
        view.editor.offsetToPos(range.to)
      );
      // 本次选区是我们自己设的：显式记为用户活动，让「光标跟随」在这段时间里别来抢光标
      // （选区变更不会触发文档变更钩子，所以这里必须自己记）
      this.lastUserActivityAt = Date.now();
      scrollPosToCenter(cm, range.from);
      view.editor.focus();
      this.pinBar(); // 焦点/选区变化若连带滚了容器，这里复位，别把播放条顶出去
      return true;
    } catch {
      return false; // 编辑器已被卸载或尚未重建：交给 restoreSession 兜底
    }
  }

  private emit(): void {
    const progress = this.getProgress();
    for (const listener of this.listeners) {
      // 单个订阅者异常不能打断其余订阅者，更不能把异常抛回播放队列的事件回调
      try {
        listener(progress);
      } catch (error) {
        console.error("朗读：进度订阅者异常", error);
      }
    }
  }

  private cmView(): EditorView | null {
    return this.cmViewOf(this.view);
  }

  /** 从任意 MarkdownView 取底层 CM6 编辑器（分段时 this.view 还没挂上，须按参数取） */
  private cmViewOf(view: MarkdownView | null): EditorView | null {
    if (!view) return null;
    const cm = (view.editor as unknown as { cm?: EditorView }).cm;
    return cm ?? null;
  }

  /**
   * 分段基线：段坐标以**此刻的文档**为准。
   * 清零变更链并记住对应编辑器；之后的编辑由 docDelta 累计，取用时经 toLiveRange() 换算。
   *
   * 必须在 buildSegments 处调用，**不能**放进 startWithSegments —— 后者还会被
   * 「首段失败自动重启重试」复用（那时段列表没重建，清零会把用户的编辑丢掉），
   * 且它内部有 `await ensureService()`（冷启动可达 20–65 秒），期间用户的编辑也会被丢。
   */
  private baselineSegmentation(view: MarkdownView): void {
    this.deltaView = this.cmViewOf(view);
    this.docDelta = null;
    // 新会话：让「光标跟随」立刻生效（否则刚编辑完就点朗读，头 8 秒会莫名不跟随）
    this.lastUserActivityAt = 0;
  }

  /**
   * 「光标跟随」是否该为用户操作让路（有选区 / 刚编辑过）。
   * 判定规则是纯函数（highlight.shouldHoldCursorForUser），此处只负责取实时状态。
   */
  private shouldHoldCursor(cm: EditorView): boolean {
    return shouldHoldCursorForUser({
      selectionEmpty: cm.state.selection.main.empty,
      msSinceUserActivity: Date.now() - this.lastUserActivityAt,
      graceMs: CURSOR_FOLLOW_GRACE_MS,
    });
  }

  /**
   * 「分段时坐标」→ **当前文档**坐标（编辑后自动修正）。
   * 区间被删到不含任何字符时返回 null，调用方据此清掉高亮。
   */
  private toLiveRange(range: RawSpan): RawSpan | null {
    return mapRangeThroughDelta(this.docDelta, range);
  }

  /**
   * 进度推进用的总时长：优先真实时长；流式（chunked）期间媒体元素常给不出时长，
   * 退回按字数估算（0.216 s/字 ÷ 语速，本机实测常量）。
   */
  private effectiveDuration(index: number, duration: number): number {
    if (Number.isFinite(duration) && duration > 0) return duration;
    const segment = this.segments[index];
    if (!segment) return 0;
    return (segment.text.length * 0.216) / this.plugin.readerSpeedFactor();
  }

  /**
   * 整段高亮（不细分时用）。段尾标点不纳入 —— 与细分的子区间同一观感，
   * 见 clause-highlight.segmentContentRawRange。
   */
  private applyHighlight(segment: Segment): void {
    const cm = this.cmView();
    if (!cm) return;
    const range = this.segmentMap
      ? segmentContentRawRange(segment, this.segmentMap)
      : { from: segment.rawFrom, to: segment.rawTo };
    this.applyRange(range);
  }

  /**
   * 把内容容器的意外滚动复位：播放条是 .view-content 的第一个子元素，
   * 而 CM 为把「靠近文档顶部的目标」居中（EditorView.scrollIntoView y:"center"）
   * 在自身滚动不到时，会连带滚动这个裁剪祖先 —— 容器一滚，播放条就被顶出视野。
   * 正常布局下 .view-content 不该有滚动量，所以非 0 即复位（sticky 只是第二道保险）。
   */
  private pinBar(): void {
    const el = this.view?.contentEl;
    if (el && el.scrollTop !== 0) el.scrollTop = 0;
  }

  /** 段内细分高亮：范围由 clauseRawSpans 预先换算成原文坐标 */
  private applyClauseHighlight(span: RawSpan): void {
    this.applyRange(span);
  }

  /** 统一的高亮下发：滚动与光标跟随都由设置项决定。
      编辑器可能在切标签页后被 Obsidian 卸载（后台叶子销毁 CM 视图），此时 dispatch
      会抛 —— 必须吞掉：调用链在播放队列的回调里，抛出去会打断 onSegmentStart 之后
      的 playback.play()（队列卡死、声音停住）和 emit()（提词器冻结）。 */
  private applyRange(range: RawSpan): void {
    const cm = this.cmView();
    if (!cm) return;
    // 存的是分段时坐标；下发前统一换算到当前文档（编辑后自动修正）
    this.lastAppliedRange = range;
    const live = this.toLiveRange(range);
    if (!live) {
      // 这一段/子区间的文本已被删空：没有可高亮的内容，清掉装饰即可
      try {
        applyReaderHighlight(cm, null, false);
      } catch {
        /* 编辑器不可用 */
      }
      this.pinBar();
      return;
    }
    try {
      // 「光标跟随」为用户操作让路：双击定位选中的那段文字、或正在编辑时都不抢光标
      // （判定见 shouldHoldCursor；用户停手且没有选区后自动恢复跟随）
      const follow = this.plugin.settings.reader.cursorFollow && !this.shouldHoldCursor(cm);
      applyReaderHighlight(
        cm,
        live,
        this.plugin.settings.reader.autoScroll,
        follow
      );
    } catch {
      /* 编辑器不可用：高亮暂丢可接受，切回时 restoreHighlight 会补发 */
    }
    this.pinBar();
  }

  private clearHighlight(): void {
    this.lastAppliedRange = null; // 清除后无需补发（停止/出错/读完）
    const cm = this.cmView();
    if (!cm) return;
    try {
      applyReaderHighlight(cm, null, false);
    } catch {
      /* 同 applyRange：编辑器可能已被 Obsidian 卸载 */
    }
  }

  /**
   * 会话自愈：视图实例失效重绑（rebindIfStale）+ 编辑器装饰丢失补发（reapplyIfLost）。
   *
   * 机制：切走标签页后，后台叶子的 CM6 EditorView 会被 Obsidian 销毁，切回时重建
   * —— StateField 随新 EditorState 重新初始化为空，朗读装饰就此丢失；切工作区更
   * 彻底，叶子整体拆建、MarkdownView 实例销毁（播放条挂在 view.contentEl 里随之
   * 消失，控制器持有的 view 引用也失效）。暂停状态下没有任何播放事件会再触发下发，
   * 不自愈就表现为「切回来，高亮/播放条没了」。
   *
   * 装饰还在（正常播放中）就不动 —— 不干扰手动滚动；编辑器重载/布局重建可能晚于
   * 布局事件（文档异步加载），所以再补 300ms / 1000ms 两次一次性复查。
   * 常驻开销只有 contentEl.isConnected 一个标志位读取，挂在低频事件上可忽略。
   */
  private restoreSession(scheduleFollowUps = true): void {
    if (this.queue.getState() === "idle") return;
    this.rebindIfStale();
    if (!this.lastAppliedRange) return;
    this.reapplyIfLost();
    if (!scheduleFollowUps) return;
    for (const delay of [300, 1000]) {
      window.setTimeout(() => this.restoreSession(false), delay);
    }
  }

  /** 视图实例失效（contentEl 已不在文档里 —— 工作区切换拆建叶子、笔记在别的叶子
      重开等）时，按会话绑定的文档路径找回新视图并重新挂接：view 引用、播放条。
      找到并重绑返回 true。后台标签页不算失效：叶子仍在布局里，contentEl 仍连着文档。 */
  private rebindIfStale(): boolean {
    const path = this.boundPath;
    if (!path) return false;
    const el = this.view?.contentEl;
    if (el?.isConnected) return false;
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const mv = leaf.view;
      if (mv instanceof MarkdownView && mv.file?.path === path) {
        this.view = mv;
        // 换到新编辑器：变更链**保留**（旧视图里的编辑已经落到文档里了，坐标仍然是
        // 相对分段那一刻的），只把累计目标改到新编辑器上
        this.deltaView = this.cmViewOf(mv);
        this.plugin.readerPlayerBar.mount(mv); // 播放条随旧视图销毁了，重挂
        return true;
      }
    }
    return false; // 新布局里还没恢复这篇文档：保持出声失联，等 file-open/下一次布局事件
  }

  private reapplyIfLost(): void {
    const cm = this.cmView();
    if (!cm || hasReaderHighlight(cm)) return;
    // 走 applyRange：补发同样要经过 toLiveRange 换算（期间可能编辑过文档）
    this.applyRange(this.lastAppliedRange!);
  }

  // ── 朗读入口 ──────────────────────────────────────────────

  /** 从指定段开始读；startIndex 省略时从头开始 */
  async start(view: MarkdownView, startIndex = 0): Promise<boolean> {
    this.autoRetryUsed = false; // 用户主动发起：失败自动重启的机会重置
    const raw = view.editor.getValue();
    const built = buildSegments(
      raw,
      this.plugin.settings.reader.filters,
      this.plugin.settings.reader.segment,
      this.plugin.readerSegmentLimits()
    );
    this.baselineSegmentation(view);
    return this.startWithSegments(view, built.segments, startIndex, built.readable.map);
  }

  /** 用已构建好的段列表朗读（「从光标读」需要在构建后对首段做光标截断） */
  private async startWithSegments(
    view: MarkdownView,
    segments: Segment[],
    startIndex: number,
    map: PositionMap | null
  ): Promise<boolean> {
    this.sessionSeq += 1;
    // 先做配置自检：缺参考音频/参考文本时立刻说清楚，
    // 否则会拖到「第 1 段合成失败」才报，且报错信息对用户没有指引
    const configError = this.validateConfig();
    if (configError) {
      this.lastMessage = configError;
      this.emit();
      new Notice(configError, 14000);
      return false;
    }

    const ready = await this.ensureService();
    if (!ready) return false;

    if (segments.length === 0) {
      this.lastMessage = "这篇笔记没有可朗读的内容（可能全被过滤规则排除了）";
      this.emit();
      return false;
    }

    this.view = view;
    this.boundPath = view.file?.path ?? null;
    this.segments = segments;
    this.segmentMap = map;
    this.clauseSpans = null;
    this.clauseIndex = -1;
    this.lastAppliedRange = null; // 新会话：旧区间不参与补发
    this.lastMessage = undefined;
    this.queue.load(segments, Math.max(0, Math.min(startIndex, segments.length - 1)));
    this.emit();
    await this.queue.start();
    return true;
  }

  /** 从光标所在段开始读 */
  async startFromCursor(view: MarkdownView): Promise<boolean> {
    const offset = view.editor.posToOffset(view.editor.getCursor());
    return this.startFromOffset(view, offset);
  }

  /** 从选区起点所在段开始读 */
  async startFromSelection(view: MarkdownView): Promise<boolean> {
    const selection = view.editor.getSelection();
    if (!selection.trim()) {
      new Notice("没有选中内容");
      return false;
    }
    const from = view.editor.getCursor("from");
    return this.startFromOffset(view, view.editor.posToOffset(from));
  }

  private async startFromOffset(view: MarkdownView, offset: number): Promise<boolean> {
    this.autoRetryUsed = false; // 用户主动发起：失败自动重启的机会重置
    // 先算出段列表，再定位到包含该偏移的段
    const raw = view.editor.getValue();
    const { readable, segments } = buildSegments(
      raw,
      this.plugin.settings.reader.filters,
      this.plugin.settings.reader.segment,
      this.plugin.readerSegmentLimits()
    );
    if (segments.length === 0) {
      new Notice("这篇笔记没有可朗读的内容");
      return false;
    }
    const index = this.findSegmentIndex(segments, offset);
    if (index < 0) {
      // 光标在所有段之后（如文档末尾）—— 兜底会把最后一段整个读出来，明确告知无可读内容
      new Notice("光标之后没有可朗读的内容");
      return false;
    }
    this.baselineSegmentation(view);

    // 光标落在段中间时把首段在光标处截断，只读光标之后的内容 ——
    // 段按「弱边界 36 字」合并分句，整段照读会把光标前面的分句也读进去
    const trimmed = trimSegmentAtCursor(segments[index], readable.map, offset);
    if (trimmed) {
      const next = segments.slice();
      next[index] = trimmed;
      return this.startWithSegments(view, next, index, readable.map);
    }
    // 光标在该段末尾：从下一段开始；已是最后一段则无事可读
    if (index + 1 >= segments.length) {
      new Notice("光标之后没有可朗读的内容");
      return false;
    }
    return this.startWithSegments(view, segments, index + 1, readable.map);
  }

  /** 找到包含该原文偏移的段；落在段间空隙时取其后一段；偏移在所有段之后返回 -1 */
  private findSegmentIndex(segments: Segment[], offset: number): number {
    for (let i = 0; i < segments.length; i++) {
      if (offset < segments[i].rawTo) return i;
    }
    return -1;
  }

  // ── 播放控制 ──────────────────────────────────────────────

  async togglePlayPause(): Promise<void> {
    const state = this.queue.getState();
    if (state === "playing") {
      this.queue.pause();
      this.emit();
      return;
    }
    if (state === "paused") {
      await this.queue.resume();
      this.emit();
      return;
    }
    // 未在朗读时，对当前活动笔记从头开始
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) await this.start(view);
  }

  stop(): void {
    this.queue.stop();
    this.clearHighlight();
    this.ratio = 0;
    this.clauseSpans = null;
    this.clauseIndex = -1;
    this.lastMessage = undefined;
    this.emit();
  }

  /** 停止并清空（笔记切换或插件卸载时用） */
  dispose(): void {
    this.stop();
    this.listeners.clear();
    this.view = null;
    this.boundPath = null;
    this.segments = [];
  }

  // ── 服务可用性 ────────────────────────────────────────────

  /**
   * 合成前的配置自检。
   *
   * 只有 GPT-SoVITS 的参考音频是服务端硬性必填；参考文本**可以留空** ——
   * 实测空参考文本走「无文本提示」模式不但能生成，还避开了
   * 「文本与音频不匹配 → 对齐滑移吞内容」的坑（见交接文档坑 14）。
   *
   * Qwen3-TTS 没有必填的音频类配置（音色描述可空），Windows 本地语音
   * 用的是系统装好的语音 —— 两者都不该被这条检查拦住（否则兜底引擎根本起不来）。
   *
   * 公开给「生成音频文件」复用：导出与朗读走同一套引擎，门槛必须一致。
   */
  validateConfig(): string | null {
    if (this.plugin.settings.reader.provider !== "gpt-sovits") return null;
    const tts = this.plugin.settings.reader.tts;
    if (!tts.refAudioPath.trim()) {
      return (
        "未配置参考音频。\n" +
        "请在「设置 → 朗读 → 声音」点「选择参考音频」—— 需要 3–10 秒的清晰人声。\n" +
        "没有 GPT-SoVITS 环境？把「设置 → 朗读 → 引擎」的「TTS 引擎」换成「Windows 本地语音」，" +
        "用系统内置语音即可直接朗读（零安装、离线可用）。"
      );
    }
    return null;
  }

  /**
   * 探测服务；未运行时尝试拉起（按当前引擎分发到对应启动器）。
   *
   * 不做「预热自检」——见 autoRestartAndRetry：预热请求的结果被丢弃，
   * 纯属首字延迟浪费；推理是否正常交给第一段真实合成验证，失败自动重启重试一次。
   */
  private async ensureService(): Promise<boolean> {
    const probe = await this.plugin.readerEngine.probe();
    if (probe.ok) return true;

    // 进度显示在播放条上，不弹 Notice —— Notice 浮在窗口右上角且层级最高，
    // 朗读开始时弹「正在准备服务…」会盖住顶部的播放条（首次朗读服务未起时尤其明显）
    this.lastMessage = "正在准备本地语音服务…";
    this.emit();
    try {
      const result = await this.plugin.ensureReaderServiceRunning(message => {
        this.lastMessage = message;
        this.emit();
      });
      if (!result.ok) {
        this.lastMessage = result.message;
        this.emit();
        new Notice(result.message, 15000);
        return false;
      }
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.lastMessage = `启动服务失败：${detail}`;
      this.emit();
      new Notice(this.lastMessage, 12000);
      return false;
    }
  }

  /**
   * 首段合成失败时自动重启服务，并从失败的段重试一次。
   *
   * 原「预热自检」的职责移交于此：预热请求（合成「嗯。」）的结果是被丢弃的，
   * 纯属首字延迟的浪费（~1.5s），而且每次请求约 1s 的固定开销也不会因预热省掉。
   * 「服务可达但推理全失败」的坏状态只有真实合成才能暴露 —— 那就让第一段来暴露，
   * 失败的代价从「白等一次预热」变成「这里的一次自动重启」。
   *
   * 每次朗读只自动重试一次（用户主动发起新朗读时重置）；重试仍失败则维持错误展示。
   */
  private async autoRestartAndRetry(index: number, seq: number): Promise<void> {
    if (this.autoRetrying || this.autoRetryUsed || seq !== this.sessionSeq) return;
    this.autoRetrying = true;
    this.autoRetryUsed = true;
    // 同样用播放条显示进度（silent：不弹 Notice，避免盖住播放条）
    this.lastMessage = "语音服务推理失败，正在自动重启并从当前位置重试…";
    this.emit();
    try {
      const view = this.view;
      const segments = this.segments;
      const map = this.segmentMap;
      if (!view || segments.length === 0) return;
      const restarted = await this.plugin.restartReaderService(true);
      if (!restarted || seq !== this.sessionSeq) return;
      await this.startWithSegments(view, segments, index, map);
    } finally {
      this.autoRetrying = false;
    }
  }
}