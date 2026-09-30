/**
 * 段队列：边播当前段、边预取后几段，顺序播放。
 *
 * 设计要点（依据实测与 zhuomianling 的做法，见 docs/tts-provider-plan.md）：
 * - **预取用 Promise 句柄**：`item.audioPromise ??= synthesize(...)` 保证幂等，
 *   重复调用不会重复发请求（实测 RTF ≈ 0.52，预取 2 段就够）
 * - **代际计数取消**：Obsidian 的 requestUrl 没有 abort()，所以取消只能「丢弃结果」
 * - 音频播放抽成工厂函数，便于在 Node 里注入假播放器做验证
 */
import type { Segment } from "./segmenter";
import { isTtsCanceled, TtsAudio, TtsEngine } from "./tts/types";

export type ReaderState = "idle" | "preparing" | "playing" | "paused" | "error";

/** 一次播放的句柄；队列通过回调属性接收事件 */
export interface AudioPlayback {
  /** 开始播放；被浏览器 autoplay 策略拒绝时 reject */
  play(): Promise<void>;
  pause(): void;
  destroy(): void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export type AudioPlaybackFactory = (bytes: ArrayBuffer, mimeType: string) => AudioPlayback;

/** 流式播放工厂：直接把 <audio> 指向服务端 GET URL */
export type AudioUrlPlaybackFactory = (url: string) => AudioPlayback;

/** 默认实现：Blob + <audio>，负责回收 object URL */
export function createElementAudioPlayback(
  bytes: ArrayBuffer,
  mimeType: string
): AudioPlayback {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;

  const handle: AudioPlayback = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    destroy: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    },
  };
  audio.addEventListener("ended", () => handle.onEnded?.());
  audio.addEventListener("timeupdate", () =>
    handle.onTimeUpdate?.(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0)
  );
  return handle;
}

/**
 * 流式播放：媒体元素直连服务端 GET URL。
 *
 * 为什么必须走媒体元素：api_v2 没有任何 CORS 头（实测确认），fetch 读响应会被拦；
 * 而 Obsidian 的 requestUrl 不支持流式读取（只返回完整 buffer）。
 * 媒体元素加载不受 CORS 限制，是插件侧唯一能增量消费的路径。
 *
 * destroy 用 `removeAttribute("src") + load()` 中断在途请求（没有 blob URL 要回收）。
 */
export function createUrlAudioPlayback(url: string): AudioPlayback {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;

  const handle: AudioPlayback = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    destroy: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
  audio.addEventListener("ended", () => handle.onEnded?.());
  audio.addEventListener("timeupdate", () =>
    handle.onTimeUpdate?.(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : 0)
  );
  return handle;
}

export interface SegmentQueueOptions {
  engine: TtsEngine;
  /** 预取深度（段） */
  lookahead: number;
  createAudio: AudioPlaybackFactory;
  /**
   * 流式源（实验性）：返回 GET URL 走流式播放，返回 null 走常规合成。
   * 存在时**不做预取** —— 预取会白跑一次整段合成，且多条流并发会被服务端串行处理。
   */
  streamSource?: (text: string) => string | null;
  createAudioFromUrl?: AudioUrlPlaybackFactory;
  /**
   * 流式：段末提前多少毫秒预开下一段的流。
   * RTF < 1 时当前段的流早就传完、GPU 在段中后期是空闲的，提前请求不抢资源，
   * 却能把段间停顿从「下一段首字节 ≈0.6s + 起播」压到几乎为零。
   */
  streamLeadMs?: number;
  /** 流式：媒体元素给不出总时长（chunked）时，用它估算段长（秒）以判断何时预开 */
  estimateDuration?: (text: string) => number;
  onSegmentStart?: (index: number, segment: Segment) => void;
  onSegmentProgress?: (index: number, currentTime: number, duration: number) => void;
  onSegmentEnd?: (index: number) => void;
  onFinish?: () => void;
  onError?: (index: number, error: unknown) => void;
  /** 浏览器拦截了自动播放 */
  onPlaybackBlocked?: (message: string) => void;
}

interface QueueItem {
  segment: Segment;
  audioPromise?: Promise<TtsAudio>;
}

export class SegmentQueue {
  private items: QueueItem[] = [];
  private cursor = -1;
  private state: ReaderState = "idle";
  private current: AudioPlayback | null = null;
  private generation = 0;
  /** 正在播放的段是否已结束（用于 pause 后判断能否 resume） */
  private endedCurrent = false;
  /** 已提前预开的下一段流（段末预开，消除段间停顿）；advance 时直接取用 */
  private pendingStream: { index: number; playback: AudioPlayback } | null = null;

  /** 段末预开下一段的流：到点（剩余时长 ≤ streamLeadMs）就发起，只发一次 */
  private maybePreopenNext(currentTime: number, duration: number): void {
    if (!this.options.streamSource || !this.options.createAudioFromUrl) return;
    if (this.pendingStream) return;
    const next = this.cursor + 1;
    if (next >= this.items.length) return;
    const total =
      Number.isFinite(duration) && duration > 0
        ? duration
        : this.options.estimateDuration?.(this.items[this.cursor].segment.text) ?? 0;
    if (total <= 0) return;
    const leadSec = Math.max(0, (this.options.streamLeadMs ?? 2000) / 1000);
    if (currentTime < total - leadSec) return;
    const url = this.options.streamSource(this.items[next].segment.text);
    if (!url) return;
    this.pendingStream = { index: next, playback: this.options.createAudioFromUrl(url) };
  }

  private disposePendingStream(): void {
    const pending = this.pendingStream;
    this.pendingStream = null;
    if (!pending) return;
    try {
      pending.playback.destroy();
    } catch {
      /* 已经销毁 */
    }
  }

  private attach(playback: AudioPlayback, generation: number): void {
    this.current = playback;
    this.endedCurrent = false;
    playback.onEnded = () => {
      if (generation !== this.generation) return;
      this.endedCurrent = true;
      this.options.onSegmentEnd?.(this.cursor);
      void this.advance();
    };
    playback.onTimeUpdate = (currentTime, duration) => {
      if (generation !== this.generation) return;
      this.options.onSegmentProgress?.(this.cursor, currentTime, duration);
      if (playback === this.current) this.maybePreopenNext(currentTime, duration);
    };
  }

  constructor(private readonly options: SegmentQueueOptions) {}

  getState(): ReaderState {
    return this.state;
  }

  /** 当前段下标（-1 表示尚未开始） */
  getCursor(): number {
    return this.cursor;
  }

  getTotal(): number {
    return this.items.length;
  }

  private setState(state: ReaderState): void {
    if (this.state !== state) this.state = state;
  }

  /**
   * 装入段列表并重置。
   * `startIndex` 是**段数组的 0 基下标**（用于「从光标/选区起读」）；
   * 传 0 即从头开始。
   */
  load(segments: Segment[], startIndex = 0): void {
    this.teardown();
    this.items = segments.map(segment => ({ segment }));
    this.cursor = Math.max(-1, Math.min(startIndex - 1, this.items.length - 1));
    this.setState(this.items.length === 0 ? "idle" : "preparing");
  }

  /** 从当前 cursor 之后开始播下一段 */
  async start(): Promise<void> {
    await this.advance();
  }

  /**
   * 取某段的合成 Promise，没有就发起。
   * 用 `??=` 语义保证幂等（重复调用不会重复发请求）；
   * 同时挂一个空 catch 把 Promise 标记为已处理，
   * 否则预取失败会先触发「未捕获拒绝」告警，而真正的错误处理在 await 处。
   */
  private ensureAudio(index: number): Promise<TtsAudio> {
    const item = this.items[index];
    if (!item.audioPromise) {
      const promise = this.options.engine.synthesize(item.segment.text);
      promise.catch(() => undefined);
      item.audioPromise = promise;
    }
    return item.audioPromise;
  }

  /**
   * 该段是否会走流式播放。
   *
   * **必须看 streamSource 的返回值，不能看它是否存在**：控制器始终传入这个闭包
   * （关闭流式时它返回 null），用「函数存在」当标志会把预取整体关掉 ——
   * 非流式路径会退化成「上一段播完才合成下一段」，段间停顿变成一整次合成耗时。
   */
  private isStreamed(index: number): boolean {
    if (!this.options.streamSource || !this.options.createAudioFromUrl) return false;
    const item = this.items[index];
    if (!item) return false;
    return this.options.streamSource(item.segment.text) !== null;
  }

  /**
   * 预取窗口 [cursor, cursor + lookahead)。
   * **必须包含 cursor 本身** —— 否则当前段的 Promise 从未创建，
   * `await item.audioPromise` 会拿到 undefined 而炸掉。
   *
   * 流式段跳过：它走 URL 播放，预取会白跑一次整段合成（服务端串行，反而拖慢首块）。
   */
  private prime(): void {
    const lookahead = Math.max(1, Math.floor(this.options.lookahead));
    const end = Math.min(this.items.length, this.cursor + lookahead);
    for (let i = this.cursor; i < end; i++) {
      if (this.isStreamed(i)) continue;
      void this.ensureAudio(i);
    }
  }

  /** 常规路径：requestUrl 合成整段 → Blob 播放；合成失败走 onError */
  private async playViaSynthesis(item: QueueItem, generation: number): Promise<void> {
    let audio: TtsAudio;
    try {
      audio = await this.ensureAudio(this.cursor);
    } catch (error) {
      if (generation !== this.generation || isTtsCanceled(error)) return;
      this.setState("error");
      this.options.onError?.(this.cursor, error);
      return;
    }
    if (generation !== this.generation) return;

    const playback = this.options.createAudio(audio.bytes, audio.mimeType);
    this.attach(playback, generation);
    // 先亮高亮再出声，避免「声音已响但还没标出来」
    this.options.onSegmentStart?.(this.cursor, item.segment);

    try {
      await playback.play();
      if (generation !== this.generation) return;
      this.setState("playing");
    } catch (error) {
      if (generation !== this.generation) return;
      this.setState("error");
      const detail = error instanceof Error ? error.message : String(error);
      this.options.onPlaybackBlocked?.(`播放被拦截：${detail}`);
    }
  }

  private async advance(): Promise<void> {
    const generation = this.generation;
    this.disposeCurrent();
    this.cursor += 1;

    if (this.cursor >= this.items.length) {
      this.finish();
      return;
    }

    const item = this.items[this.cursor];
    this.prime();

    // 流式路径（实验性）：媒体元素直连 GET URL，首块到达即可出声。
    // 上一段播到「剩余 ≤ streamLeadMs」时已预开本段的流，这里直接取用 → 段间无停顿
    const streamUrl = this.options.streamSource?.(item.segment.text) ?? null;
    const createUrlPlayback = this.options.createAudioFromUrl;
    if (streamUrl && createUrlPlayback) {
      const preopened = this.pendingStream?.index === this.cursor ? this.pendingStream : null;
      if (this.pendingStream && !preopened) this.disposePendingStream(); // 预开的流已过期（跳段等）
      const playback = preopened ? preopened.playback : createUrlPlayback(streamUrl);
      this.pendingStream = null;
      this.attach(playback, generation);
      this.options.onSegmentStart?.(this.cursor, item.segment);
      try {
        await playback.play();
        if (generation !== this.generation) return;
        this.setState("playing");
        return;
      } catch (error) {
        if (generation !== this.generation) return;
        // 流式失败多半是服务端回了 JSON 错误体（媒体元素只会报通用错误）：
        // 回退到 requestUrl 合成 —— 成功就用字节播放，失败才拿到真实错误信息
        console.warn("朗读：流式播放失败，回退到常规合成", error);
        this.disposeCurrent();
        await this.playViaSynthesis(item, generation);
        return;
      }
    }
    this.disposePendingStream();

    await this.playViaSynthesis(item, generation);
  }

  /** 暂停当前段；再调 resume 可继续（同一个 <audio> 元素） */
  pause(): boolean {
    if (this.state !== "playing" || !this.current || this.endedCurrent) return false;
    this.current.pause();
    this.setState("paused");
    return true;
  }

  async resume(): Promise<boolean> {
    if (this.state !== "paused" || !this.current) return false;
    try {
      await this.current.play();
      this.setState("playing");
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.options.onPlaybackBlocked?.(`恢复播放失败：${detail}`);
      return false;
    }
  }

  private finish(): void {
    this.setState("idle");
    this.options.onFinish?.();
  }

  private disposeCurrent(): void {
    if (!this.current) return;
    const handle = this.current;
    this.current = null;
    handle.onEnded = undefined;
    handle.onTimeUpdate = undefined;
    try {
      handle.destroy();
    } catch {
      /* 已经销毁 */
    }
  }

  private teardown(): void {
    this.generation += 1;
    this.options.engine.cancel();
    this.disposeCurrent();
    this.disposePendingStream();
    this.items = [];
    this.cursor = -1;
    this.endedCurrent = false;
  }

  /** 停止并清空；在途请求的结果会被丢弃 */
  stop(): void {
    this.teardown();
    this.setState("idle");
  }
}
