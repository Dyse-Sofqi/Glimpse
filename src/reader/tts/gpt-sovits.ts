/**
 * GPT-SoVITS 提供方（本机 HTTP 服务）。
 *
 * 契约来自本机实测（见 docs/gpt-sovits-integration.md），要点：
 * - 端点：POST {baseUrl}/tts；模型热切换 GET /set_gpt_weights、/set_sovits_weights
 * - ref_audio_path / prompt_text / prompt_lang **必须每个请求都带**
 *   （先调 /set_refer_audio 并不会让后续请求省略它们，实测仍返回 400）
 * - media_type 不支持 mp3；用 ogg（体积仅 wav 的 1/8.4，无延迟代价）
 * - text_split_method 用 cut0（不切）—— 分句由我们自己控制，才能拿到原文偏移
 * - 服务在配置错误时可能返回 HTTP 200 + JSON 错误体，所以必须校验音频魔数
 *
 * 取消：Obsidian 的 requestUrl 返回普通 Promise，**没有 abort()**。
 * 因此用「代际计数 + 丢弃结果」实现取消。
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
  SniffedFormat,
  stripTrailingSlash,
} from "./http-utils";

export interface GptSoVitsOptions {
  baseUrl: string;
  refAudioPath: string;
  promptText: string;
  promptLang: string;
  textLang: string;
  mediaType: "wav" | "ogg" | "aac" | "raw";
  seed: number;
  speedFactor: number;
  timeoutMs: number;
  /**
   * 流式首响（实验性）：0 = 关闭；2/3 = 服务端分片流式。
   * 实测首字节 5.62s → 0.69s(2) / 0.58s(3)，代价是质量/体积与总时长增加。
   * 注意 API 模式的模式 1 会被服务端退化成非流式（源码注释：那是旧版语义），故不提供。
   */
  streamingMode: 0 | 2 | 3;
}

const EXPECTED: Record<GptSoVitsOptions["mediaType"], SniffedFormat | null> = {
  wav: "wav",
  ogg: "ogg",
  aac: "aac",
  raw: null, // 裸 PCM，无文件头，不做魔数校验
};

export class GptSoVitsEngine implements TtsEngine {
  readonly id = "gpt-sovits";
  readonly label = "GPT-SoVITS（本机服务）";

  private options: GptSoVitsOptions;
  /** 代际计数：cancel() 递增，用于丢弃过期结果 */
  private generation = 0;

  constructor(options: GptSoVitsOptions) {
    this.options = options;
  }

  updateOptions(options: GptSoVitsOptions): void {
    this.options = options;
  }

  private get ttsUrl(): string {
    return `${stripTrailingSlash(this.options.baseUrl)}/tts`;
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
   * 可达性探测：故意发一个不合法请求。
   * 拿到任何 HTTP 状态码都说明服务活着（连不上才是没起来）。
   */
  async probe(): Promise<TtsProbeResult> {
    const url = this.ttsUrl;
    try {
      const response = await requestUrl({
        url,
        method: "POST",
        contentType: "application/json",
        body: "{}",
        throw: false,
      });
      if (typeof response.status === "number") {
        return {
          ok: true,
          message: `服务可达（${url} → HTTP ${response.status}）`,
        };
      }
      return { ok: false, message: `服务响应异常（${url}）` };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `连不上 ${url}。请确认 api_v2.py 已启动。\n${detail}`,
      };
    }
  }

  /**
   * 流式播放 URL（实验性）。走 GET：媒体元素直连时带不了请求体，
   * 而 api_v2 的 GET 与 POST 接受同一组参数（实测两者首字节一致）。
   * media_type 固定 ogg —— 流式分片需要可渐进解码的容器（wav 分片在浏览器里不可靠）。
   */
  streamSource(text: string): string | null {
    const mode = this.options.streamingMode;
    if (mode !== 2 && mode !== 3) return null;
    if (!text.trim() || !this.options.refAudioPath.trim()) return null;
    const params = new URLSearchParams({
      text,
      text_lang: this.options.textLang,
      ref_audio_path: this.options.refAudioPath,
      prompt_text: this.options.promptText,
      // api_v2 对 prompt_lang 硬性必填；空时兜底到朗读语种（与 synthesize 一致）
      prompt_lang: this.options.promptLang || this.options.textLang || "zh",
      text_split_method: "cut0",
      media_type: "ogg",
      streaming_mode: String(mode),
      seed: String(this.options.seed),
      speed_factor: String(this.options.speedFactor),
    });
    return `${stripTrailingSlash(this.options.baseUrl)}/tts?${params.toString()}`;
  }

  async synthesize(text: string): Promise<TtsAudio> {
    const generation = this.generation;
    const options = this.options;

    if (!text.trim()) throw new Error("没有可合成的文本");
    if (!options.refAudioPath.trim()) {
      throw new Error("未配置参考音频路径（ref_audio_path 每个请求都必须携带）");
    }

    const body = JSON.stringify({
      text,
      text_lang: options.textLang,
      ref_audio_path: options.refAudioPath,
      // 参考文本留空 = 「无文本提示」模式（实测可用且避开对齐滑移，见坑 14）；
      // api_v2 对 prompt_lang 仍硬性必填，空时兜底到朗读语种
      prompt_text: options.promptText,
      prompt_lang: options.promptLang || options.textLang || "zh",
      text_split_method: "cut0",
      media_type: options.mediaType,
      streaming_mode: false,
      seed: options.seed,
      speed_factor: options.speedFactor,
    });

    const response = await this.raceTimeout(
      requestUrl({
        url: this.ttsUrl,
        method: "POST",
        contentType: "application/json",
        body,
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

    const expected = EXPECTED[options.mediaType];
    if (expected) {
      const actual = sniffAudioFormat(bytes);
      if (actual !== expected) {
        throw new Error(
          `音频格式不符：期望 ${expected}，实际 ${actual ?? "无法识别"}` +
            `（${bytes.byteLength} 字节）。常见原因是参考音频路径或参考文本不对。`
        );
      }
    }

    const mimeType =
      response.headers?.["content-type"] ?? `audio/${options.mediaType}`;
    return { bytes, mimeType: mimeType.split(";")[0] || `audio/${options.mediaType}` };
  }

  /** 运行时热切换模型；空值表示跳过该项 */
  async setWeights(
    gptWeights: string,
    sovitsWeights: string
  ): Promise<TtsProbeResult> {
    const base = stripTrailingSlash(this.options.baseUrl);
    const tasks: Array<[string, string]> = [];
    if (gptWeights.trim()) {
      tasks.push([
        "GPT",
        `${base}/set_gpt_weights?weights_path=${encodeURIComponent(gptWeights.trim())}`,
      ]);
    }
    if (sovitsWeights.trim()) {
      tasks.push([
        "SoVITS",
        `${base}/set_sovits_weights?weights_path=${encodeURIComponent(sovitsWeights.trim())}`,
      ]);
    }
    if (tasks.length === 0) {
      return { ok: true, message: "未指定权重，跳过切换" };
    }

    const failures: string[] = [];
    for (const [name, url] of tasks) {
      try {
        const response = await requestUrl({ url, method: "GET", throw: false });
        if (response.status !== 200) {
          failures.push(`${name} 切换失败：HTTP ${response.status}`);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        failures.push(`${name} 切换失败：${detail}`);
      }
    }
    return failures.length === 0
      ? { ok: true, message: "权重已切换" }
      : { ok: false, message: failures.join("\n") };
  }

  cancel(): void {
    this.generation += 1;
  }

  /**
   * 请求服务自行退出（GET /control?command=exit，实测该端点存在）。
   * **只应对本插件自己启动的进程调用** —— 外部已在运行的服务不能动。
   */
  async requestShutdown(): Promise<boolean> {
    const base = stripTrailingSlash(this.options.baseUrl);
    try {
      await requestUrl({ url: `${base}/control?command=exit`, method: "GET", throw: false });
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    this.cancel();
  }
}

export { isTtsCanceled };
