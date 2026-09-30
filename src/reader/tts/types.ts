/** TTS 提供方的统一契约。实现可以是本地服务、云服务或浏览器内置语音。 */

export interface TtsAudio {
  bytes: ArrayBuffer;
  mimeType: string;
}

export interface TtsProbeResult {
  ok: boolean;
  /** 面向用户的说明 */
  message: string;
}

export interface TtsEngine {
  readonly id: string;
  readonly label: string;
  /** 服务是否可达且可用 */
  probe(): Promise<TtsProbeResult>;
  /**
   * 合成一段文本。
   * 被 cancel() 打断时 reject TtsCanceledError —— 调用方应静默忽略。
   */
  synthesize(text: string): Promise<TtsAudio>;
  /**
   * 可选（实验性）：返回该段的**流式播放 URL**，让媒体元素直连服务端增量播放；
   * 返回 null 表示走常规合成。仅实现了服务端流式的引擎（GPT-SoVITS）提供。
   */
  streamSource?(text: string): string | null;
  /**
   * 打断所有在途请求。
   * 注意：Obsidian 的 requestUrl 不支持中止，所以底层请求仍会跑完，
   * 只是结果被丢弃。保持短段（≤150 字）可把浪费控制在 ~19s 以内。
   */
  cancel(): void;
  dispose(): void;
}

export class TtsCanceledError extends Error {
  constructor(message = "语音合成已取消") {
    super(message);
    this.name = "TtsCanceledError";
  }
}

/** 服务进程状态。GPT-SoVITS 与 Qwen3-TTS 两个启动器共用同一套语义 */
export type ServiceState = "stopped" | "starting" | "external" | "owned";

/**
 * 服务的**推理健康度**。
 *
 * 与 ServiceState 正交：进程活着（端口可达）不代表能推理 ——
 * 实测存在「服务可达但每次合成都失败」的坏状态。
 * 只看进程状态会让用户以为一切正常，所以必须单独跟踪真实的合成结果。
 */
export type ServiceHealth = "unknown" | "ok" | "broken";

export interface ServiceHealthInfo {
  state: ServiceHealth;
  /** 失败原因（state === "broken" 时有值） */
  reason?: string;
  /** 最近一次判定的时间戳 */
  checkedAt?: number;
}

export function isTtsCanceled(error: unknown): boolean {
  return error instanceof TtsCanceledError;
}

/** 把 100ns 之外的时间统一成秒，便于日后接入其他提供方 */
export interface TtsTiming {
  text: string;
  /** 相对本段音频起点的秒数 */
  start: number;
  duration: number;
}
