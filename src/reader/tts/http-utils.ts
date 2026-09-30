/**
 * TTS 引擎共享的 HTTP 应答处理工具。
 *
 * 本地 TTS 服务（GPT-SoVITS / Qwen3-TTS 服务脚本）在配置错误时经常
 * 返回 HTTP 200 + JSON 错误体，不校验就会拿到一段「看起来是音频」的字节，
 * 然后 <audio> 静默失败，用户只看到「没声音」。所以每个引擎拿到字节后都要：
 * 1. extractJsonErrorMessage —— 尝试取出可读的错误文本
 * 2. sniffAudioFormat —— 魔数校验，确认真的是期望的音频格式
 */

export type SniffedFormat = "wav" | "ogg" | "aac" | "mp3";

/** 按文件魔数嗅探音频格式；raw（裸 PCM）没有文件头，返回 null */
export function sniffAudioFormat(bytes: ArrayBuffer): SniffedFormat | null {
  const b = new Uint8Array(bytes);
  if (b.length < 12) return null;
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...Array.from(b.slice(offset, offset + length)));
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "wav";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (b[0] === 0xff && (b[1] & 0xf0) === 0xf0) return "aac";
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  return null;
}

/**
 * 从应答字节里尝试取出 JSON 错误文本；不是 JSON（即正常音频）时返回 null。
 *
 * **必须把 `Exception` 字段也带上**：服务返回的是
 * `{"message":"tts failed","Exception":"[Errno 22] Invalid argument"}`，
 * 只取 `message` 会丢掉真正的原因，用户只能看到一句毫无信息量的「tts failed」。
 */
export function extractJsonErrorMessage(bytes: ArrayBuffer): string | null {
  let text: string;
  try {
    text = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 4000)).trim();
  } catch {
    return null;
  }
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(text) as {
      message?: unknown;
      detail?: unknown;
      Exception?: unknown;
      exception?: unknown;
    };
    const message = parsed.message ?? parsed.detail;
    const exception = parsed.Exception ?? parsed.exception;
    if (typeof message === "string" && message.trim()) {
      return typeof exception === "string" && exception.trim()
        ? `${message.trim()} —— ${exception.trim()}`
        : message.trim();
    }
  } catch {
    /* 不是 JSON，落到下面 */
  }
  return text.slice(0, 300);
}

/** 去掉 baseUrl 末尾的斜杠，方便拼接路径 */
export function stripTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
