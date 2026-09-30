/**
 * Qwen3-TTS（VoiceDesign）提供方 —— 本机 reader-qwen-server.py 推理服务。
 *
 * 与 GPT-SoVITS 的协议差异（详见 docs/qwen3-tts-integration.md）：
 * - 健康检查有真端点：GET /health 返回 {ok, ready, error}，不需要 GPT-SoVITS
 *   那种「故意发不合法请求拿任意状态码」的探测技巧
 * - 音色来自自然语言描述（instruct），随每个请求发送，没有参考音频/权重切换
 * - generate_voice_design 没有 speed 参数 —— 该引擎不支持语速调节
 * - 输出固定 wav（脚本用 stdlib wave 写 16bit PCM；ogg 需要额外的编码依赖，
 *   而 wav 的解码路径最直接）
 *
 * 取消与超时：Obsidian 的 requestUrl 没有 abort()，与 GPT-SoVITS 引擎一样用
 * 「代际计数 + 丢弃结果」。
 */
import { requestUrl } from "obsidian";
import {
  isTtsCanceled,
  TtsAudio,
  TtsCanceledError,
  TtsEngine,
  TtsProbeResult,
} from "./types";
import {
  extractJsonErrorMessage,
  sniffAudioFormat,
  stripTrailingSlash,
} from "./http-utils";

export interface Qwen3TtsOptions {
  baseUrl: string;
  /** generate_voice_design 的 language 参数（Chinese / English / …） */
  language: string;
  /** 音色描述（自然语言）；空串表示用模型默认音色 */
  instruct: string;
  timeoutMs: number;
}

export interface QwenHealthInfo {
  /** 端口上有 HTTP 应答（无论模型是否就绪） */
  reachable: boolean;
  /** 模型加载完成、可以合成 */
  ready: boolean;
  /** 模型加载失败的原因（/health 的 error 字段） */
  error: string | null;
  message: string;
}

export class Qwen3TtsEngine implements TtsEngine {
  readonly id = "qwen3-tts";
  readonly label = "Qwen3-TTS（本地 VoiceDesign）";

  private options: Qwen3TtsOptions;
  /** 代际计数：cancel() 递增，用于丢弃过期结果 */
  private generation = 0;

  constructor(options: Qwen3TtsOptions) {
    this.options = options;
  }

  updateOptions(options: Qwen3TtsOptions): void {
    this.options = options;
  }

  private get baseUrl(): string {
    return stripTrailingSlash(this.options.baseUrl);
  }

  private guard(generation: number): void {
    if (generation !== this.generation) throw new TtsCanceledError();
  }

  /** 超时后同样递增代际，使迟到结果被丢弃 */
  private async raceTimeout<T>(
    task: Promise<T>,
    generation: number,
    label: string
  ): Promise<T> {
    let timer: number | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = window.setTimeout(() => {
        if (generation === this.generation) this.generation += 1;
        reject(new Error(`${label}超时（${Math.round(this.options.timeoutMs / 1000)} 秒）`));
      }, this.options.timeoutMs);
    });
    try {
      return await Promise.race([task, timeout]);
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }

  /**
   * 详细健康状态（启动器靠它轮询「模型是否加载完成」）。
   * 连不上时 reachable 为 false，其余字段无意义。
   */
  async health(): Promise<QwenHealthInfo> {
    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/health`,
        method: "GET",
        throw: false,
      });
      let ready = false;
      let error: string | null = null;
      try {
        const parsed = response.json as { ready?: unknown; error?: unknown } | null;
        if (parsed && typeof parsed === "object") {
          ready = parsed.ready === true;
          error = typeof parsed.error === "string" && parsed.error ? parsed.error : null;
        }
      } catch {
        /* 应答不是 JSON —— 仍视为可达 */
      }
      const message = error
        ? `服务可达，但模型加载失败：${error}`
        : ready
          ? `服务可达，模型已就绪（${this.baseUrl}）`
          : `服务可达，模型正在加载（${this.baseUrl}）`;
      return { reachable: true, ready, error, message };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        reachable: false,
        ready: false,
        error: null,
        message: `连不上 ${this.baseUrl}。请启动 Qwen3-TTS 本地服务。\n${detail}`,
      };
    }
  }

  /** 服务是否可达且可用（模型已就绪才算 ok） */
  async probe(): Promise<TtsProbeResult> {
    const health = await this.health();
    if (!health.reachable) {
      return { ok: false, message: health.message };
    }
    if (health.error) {
      return { ok: false, message: health.message };
    }
    if (!health.ready) {
      return { ok: false, message: `${health.message}（请稍候再试）` };
    }
    return { ok: true, message: health.message };
  }

  async synthesize(text: string): Promise<TtsAudio> {
    const generation = this.generation;
    const options = this.options;

    if (!text.trim()) throw new Error("没有可合成的文本");

    // instruct 为空时不下发该字段：服务端会走「模型默认音色」而不是空描述
    const body: Record<string, string> = { text };
    if (options.language.trim()) body.language = options.language.trim();
    if (options.instruct.trim()) body.instruct = options.instruct.trim();

    const response = await this.raceTimeout(
      requestUrl({
        url: `${this.baseUrl}/tts`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(body),
        throw: false,
      }),
      generation,
      "语音合成"
    );
    this.guard(generation);

    const bytes = response.arrayBuffer;
    const jsonError = extractJsonErrorMessage(bytes);
    if (jsonError) {
      throw new Error(`服务返回错误：${jsonError}`);
    }
    if (response.status !== 200) {
      throw new Error(`合成失败：HTTP ${response.status}`);
    }
    if (!bytes || bytes.byteLength === 0) {
      throw new Error("服务没有返回音频数据");
    }

    const actual = sniffAudioFormat(bytes);
    if (actual !== "wav") {
      throw new Error(
        `音频格式不符：期望 wav，实际 ${actual ?? "无法识别"}（${bytes.byteLength} 字节）`
      );
    }

    return {
      bytes,
      mimeType: response.headers?.["content-type"]?.split(";")[0] || "audio/wav",
    };
  }

  /** 请求服务自行退出（POST /shutdown）。只应对本插件启动的进程调用 */
  async requestShutdown(): Promise<boolean> {
    try {
      await requestUrl({
        url: `${this.baseUrl}/shutdown`,
        method: "POST",
        throw: false,
      });
      return true;
    } catch {
      return false;
    }
  }

  cancel(): void {
    this.generation += 1;
  }

  dispose(): void {
    this.cancel();
  }
}

export { isTtsCanceled };
