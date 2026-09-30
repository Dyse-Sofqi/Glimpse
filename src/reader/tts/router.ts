/**
 * 朗读引擎路由器：常驻的 TtsEngine 门面，内部按 provider 转发。
 *
 * 为什么需要：SegmentQueue 在构造时捕获了 engine 引用（playback.ts），
 * 如果切换提供方时直接替换 plugin.readerEngine 字段，队列仍会拿着旧引擎。
 * 有了路由器，main.ts 在 onload 里创建一次，之后切引擎只改 active 即可。
 */
import type { ReaderTtsProvider } from "../settings-types";
import { TtsAudio, TtsEngine, TtsProbeResult } from "./types";

export class RoutingTtsEngine implements TtsEngine {
  readonly id = "reader";
  readonly label = "朗读引擎（按设置路由）";

  private activeProvider: ReaderTtsProvider;

  constructor(
    private readonly engines: Record<ReaderTtsProvider, TtsEngine>,
    initial: ReaderTtsProvider
  ) {
    this.activeProvider = initial;
  }

  setActive(provider: ReaderTtsProvider): void {
    this.activeProvider = provider;
  }

  getProvider(): ReaderTtsProvider {
    return this.activeProvider;
  }

  get active(): TtsEngine {
    return this.engines[this.activeProvider];
  }

  probe(): Promise<TtsProbeResult> {
    return this.active.probe();
  }

  synthesize(text: string): Promise<TtsAudio> {
    return this.active.synthesize(text);
  }

  /** 流式源：只有实现了服务端流式的引擎会给 URL（当前仅 GPT-SoVITS） */
  streamSource(text: string): string | null {
    return this.active.streamSource?.(text) ?? null;
  }

  cancel(): void {
    // 只取消当前引擎即可：切换提供方时旧引擎不会还有在途合成
    // （真要发生也只是结果被丢弃，无害）
    this.active.cancel();
  }

  dispose(): void {
    for (const engine of Object.values(this.engines)) engine.dispose();
  }
}
