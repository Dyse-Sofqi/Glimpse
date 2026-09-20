/**
 * 最小 ID3v2 标签解析器：提取 MP3 内嵌歌词（USLT / ULT 帧）。
 * 零外部依赖 —— 桌面与移动端均可用。
 */

/** 读 syncsafe 整数（每字节仅用 7 位） */
function readSyncsafe(bytes: Uint8Array, offset: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) {
    value = (value << 7) | (bytes[offset + i] & 0x7f);
  }
  return value;
}

/** 读普通大端整数 */
function readBE(bytes: Uint8Array, offset: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) {
    value = (value << 8) | bytes[offset + i];
  }
  return value;
}

/** 撤销 ID3 去同步化：`0xFF 0x00` → `0xFF` */
function deunsync(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    out.push(data[i]);
    if (data[i] === 0xff && i + 1 < data.length && data[i + 1] === 0x00) {
      i++;
    }
  }
  return new Uint8Array(out);
}

/** `pos` 处是否为 `len` 个连续零字节 */
function isTerminator(data: Uint8Array, pos: number, len: number): boolean {
  for (let i = 0; i < len; i++) {
    if (data[pos + i] !== 0) return false;
  }
  return true;
}

/**
 * 按 ID3 文本编码字节解码文本。
 * 编码 0 名义上是 ISO-8859-1，但很多工具实际存 GBK/GB2312 字节，
 * 因此按 UTF-8 → GBK → Latin-1 顺序尝试。
 */
export function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 3) return new TextDecoder("utf-8").decode(bytes);
    if (encoding === 1) return new TextDecoder("utf-16").decode(bytes);
    if (encoding === 2) return new TextDecoder("utf-16be").decode(bytes);
    // encoding 0
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      try {
        return new TextDecoder("gbk").decode(bytes);
      } catch {
        return new TextDecoder("latin1").decode(bytes);
      }
    }
  } catch {
    return "";
  }
}

/**
 * 解析单个歌词帧（帧头之后）。
 * 格式：`[encoding(1)] [language(3)] [内容描述符 \0] [歌词]`
 */
function parseLyricsFrame(data: Uint8Array): string | null {
  if (data.length < 4) return null;
  const encoding = data[0];
  const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
  let pos = 4; // 跳过 encoding + language
  while (pos + termLen <= data.length) {
    if (isTerminator(data, pos, termLen)) break;
    pos++;
  }
  pos += termLen;
  if (pos >= data.length) return null;
  const text = decodeText(data.subarray(pos), encoding).trim();
  return text ? text : null;
}

/**
 * 从 MP3 的 ID3v2 标签提取内嵌歌词（USLT / ULT 帧）。
 * 返回各帧原文（可能有多个，如每种语言一个）。
 * 无歌词或标签不可解析时返回空数组。
 */
export function extractEmbeddedLyrics(input: ArrayBuffer | Uint8Array): string[] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 10) return [];
  // "ID3" 魔数
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return [];

  const major = bytes[3];
  const flags = bytes[5];
  const tagSize = readSyncsafe(bytes, 6, 4);
  let tagData: Uint8Array = bytes.slice(10, Math.min(10 + tagSize, bytes.length));

  // 撤销标签级去同步化
  if ((flags & 0x80) !== 0) tagData = deunsync(tagData);

  const lyrics: string[] = [];
  let offset = 0;

  // 跳过扩展头（如存在）
  if ((flags & 0x40) !== 0) {
    if (major >= 4) {
      const extSize = readSyncsafe(tagData, offset, 4);
      offset += 4 + extSize;
    } else {
      const extSize = readBE(tagData, offset, 4);
      offset += 4 + extSize;
    }
  }

  while (offset + 6 <= tagData.length) {
    let frameId = "";
    for (let i = 0; i < 4 && offset + i < tagData.length; i++) {
      frameId += String.fromCharCode(tagData[offset + i]);
    }

    let frameSize = 0;
    let frameHeaderSize = 10;
    if (major === 2) {
      // v2.2：3 字节 id + 3 字节大端大小
      frameId = frameId.substring(0, 3);
      frameSize = readBE(tagData, offset + 3, 3);
      frameHeaderSize = 6;
    } else if (major >= 3) {
      frameSize = major === 3
        ? readBE(tagData, offset + 4, 4)
        : readSyncsafe(tagData, offset + 4, 4);
    } else {
      break; // 不支持的主版本
    }

    const contentStart = offset + frameHeaderSize;
    const contentEnd = contentStart + frameSize;
    if (contentEnd > tagData.length) break;

    let frameData: Uint8Array = tagData.slice(contentStart, contentEnd);

    // v2.4 帧格式标志：此处不支持压缩/加密
    if (major === 4) {
      const fmt = tagData[offset + 9];
      if (fmt & 0x20) { offset = contentEnd; continue; } // 已压缩
      if (fmt & 0x10) { offset = contentEnd; continue; } // 已加密
      if (fmt & 0x40) frameData = frameData.subarray(1); // 组标识字节
      if (fmt & 0x04) frameData = frameData.subarray(4); // 数据长度指示
      if (fmt & 0x08) frameData = deunsync(frameData);
    }

    const isLyric = major === 2 ? frameId === "ULT" : frameId === "USLT";
    if (isLyric) {
      const text = parseLyricsFrame(frameData);
      if (text) lyrics.push(text);
    }

    offset = contentEnd;
  }

  return lyrics;
}

/** 挑选最有用的歌词帧：优先形似 LRC 的帧 */
export function pickEmbeddedLyrics(frames: string[]): string {
  if (frames.length === 0) return "";
  for (const text of frames) {
    if (/\[\d{1,2}:\d{2}/.test(text)) return text;
  }
  return frames[0];
}
