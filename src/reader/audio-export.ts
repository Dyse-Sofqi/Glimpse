/**
 * 「朗读：生成音频文件」：把选中文本经朗读的同一条分段链送到当前 TTS 引擎，
 * 逐段合成后拼成**一个**音频文件落盘。
 *
 * 与朗读共用 buildSegments（同样的过滤规则与分段参数），所以导出的音频与
 * 「朗读选区」听到的内容一致：Markdown 记号被过滤、长选区按句切分。
 *
 * 拼接策略按 mimeType 分流：
 * - 单段：原样写盘，不经任何重打包（最常见的短选区零风险）；
 * - 多段 WAV：解析 RIFF 块，拷贝首段的 fmt 块原样作头、PCM 顺序拼接 ——
 *   各段出自同一引擎同一次生成，格式必然一致，仍显式校验避免产出坏文件；
 * - 多段 OGG 等流式容器：直接字节拼接（OGG 的链接/chaining 本身就是标准语义，
 *   播放器会顺序播完各个逻辑流）。
 *
 * 仅桌面端可用（写盘走 Node fs，入口侧已用 Platform.isDesktop 拦截）。
 */
import { buildSegments } from "./segmenter";
import { loadNodeModule } from "./node-bridge";
import type GlimpsePlugin from "../main";

export interface GenerateAudioResult {
	path: string;
}

interface WavParts {
	format: number;
	channels: number;
	sampleRate: number;
	bits: number;
	/** 首段 fmt 块的原始字节（含扩展字段），重打包时原样复制 */
	fmtChunk: Uint8Array;
	pcm: Uint8Array;
}

const TAG_RIFF = 0x52494646; // "RIFF"
const TAG_WAVE = 0x57415645; // "WAVE"
const TAG_FMT = 0x666d7420; // "fmt "
const TAG_DATA = 0x64617461; // "data"

function parseWav(buffer: ArrayBuffer): WavParts | null {
	const view = new DataView(buffer);
	if (buffer.byteLength < 12) return null;
	if (view.getUint32(0, false) !== TAG_RIFF || view.getUint32(8, false) !== TAG_WAVE) {
		return null;
	}
	let format = 0;
	let channels = 0;
	let sampleRate = 0;
	let bits = 0;
	let fmtChunk: Uint8Array | null = null;
	let pcm: Uint8Array | null = null;

	let offset = 12;
	while (offset + 8 <= buffer.byteLength) {
		const id = view.getUint32(offset, false);
		const size = view.getUint32(offset + 4, true);
		if (id === TAG_FMT) {
			format = view.getUint16(offset + 8, true);
			channels = view.getUint16(offset + 10, true);
			sampleRate = view.getUint32(offset + 12, true);
			bits = view.getUint16(offset + 22, true);
			fmtChunk = new Uint8Array(buffer.slice(offset + 8, Math.min(offset + 8 + size, buffer.byteLength)));
		} else if (id === TAG_DATA) {
			pcm = new Uint8Array(buffer.slice(offset + 8, Math.min(offset + 8 + size, buffer.byteLength)));
		}
		// RIFF 块按字对齐：奇数长度补一个填充字节
		offset += 8 + size + (size & 1);
	}
	if (!fmtChunk || !pcm || channels === 0 || sampleRate === 0) return null;
	return { format, channels, sampleRate, bits, fmtChunk, pcm };
}

/** 把多段同格式 WAV 重打包成一个：fmt 头取首段原样，PCM 顺序拼接 */
export function concatWavFiles(buffers: ArrayBuffer[]): { wav: ArrayBuffer } | { error: string } {
	const parts: WavParts[] = [];
	for (const buffer of buffers) {
		const parsed = parseWav(buffer);
		if (!parsed) return { error: "音频段不是有效的 WAV 数据，无法拼接" };
		parts.push(parsed);
	}
	const first = parts[0];
	for (const part of parts) {
		if (
			part.format !== first.format ||
			part.channels !== first.channels ||
			part.sampleRate !== first.sampleRate ||
			part.bits !== first.bits
		) {
			return { error: "各段 WAV 的采样率/位深/声道不一致，无法拼接" };
		}
	}

	const dataSize = parts.reduce((sum, part) => sum + part.pcm.length, 0);
	const fmtSize = first.fmtChunk.length;
	const total = 12 + (8 + fmtSize) + (8 + dataSize);
	const out = new Uint8Array(total);
	const view = new DataView(out.buffer);

	const writeTag = (at: number, tag: number) => view.setUint32(at, tag, false);
	writeTag(0, TAG_RIFF);
	view.setUint32(4, total - 8, true);
	writeTag(8, TAG_WAVE);
	writeTag(12, TAG_FMT);
	view.setUint32(16, fmtSize, true);
	out.set(first.fmtChunk, 20);

	const dataAt = 20 + fmtSize;
	writeTag(dataAt, TAG_DATA);
	view.setUint32(dataAt + 4, dataSize, true);
	let cursor = dataAt + 8;
	for (const part of parts) {
		out.set(part.pcm, cursor);
		cursor += part.pcm.length;
	}
	return { wav: out.buffer };
}

/** 文件名用的选区摘录：去掉 Windows 非法字符与换行，压成一行再截断 */
function sanitizeFileName(text: string): string {
	const cleaned = text
		.replace(/[\\/:*?"<>|\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return (cleaned.slice(0, 24).trim() || "选区");
}

function timestamp(): string {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	return (
		`${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
		`-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
	);
}

function extensionFor(mimeType: string): string {
	const subtype = (mimeType.split("/")[1] ?? "wav").split(";")[0].trim().toLowerCase();
	if (subtype === "mpeg") return "mp3";
	if (subtype === "x-wav" || subtype === "wave") return "wav";
	return subtype || "wav";
}

/** 逐段拼接：WAV 重打包，其余容器直接字节拼接 */
function joinAudio(buffers: ArrayBuffer[], mimeType: string): { data: ArrayBuffer } | { error: string } {
	if (buffers.length === 1) return { data: buffers[0] };
	if (mimeType.includes("wav")) {
		const joined = concatWavFiles(buffers);
		return "error" in joined ? joined : { data: joined.wav };
	}
	let total = 0;
	for (const buffer of buffers) total += buffer.byteLength;
	const out = new Uint8Array(total);
	let cursor = 0;
	for (const buffer of buffers) {
		out.set(new Uint8Array(buffer), cursor);
		cursor += buffer.byteLength;
	}
	return { data: out.buffer };
}

/** 解析保存目录；设置留空时退回系统下载文件夹 */
function resolveSaveDir(plugin: GlimpsePlugin): string | null {
	const configured = plugin.settings.reader.generateAudioPath.trim();
	if (configured) return configured;
	const os = loadNodeModule<typeof import("os")>("os");
	if (!os) return null;
	return `${os.homedir()}/Downloads`;
}

/**
 * 生成音频文件的完整编排：分段 → 服务就绪 → 逐段合成 → 拼接 → 落盘。
 * 进度经 onProgress 上报（调用方负责 Notice 展示）；任何一步失败返回 { error }。
 */
export async function generateAudioFileFromText(
	plugin: GlimpsePlugin,
	text: string,
	onProgress?: (message: string) => void
): Promise<GenerateAudioResult | { error: string }> {
	const fs = loadNodeModule<typeof import("fs")>("fs");
	if (!fs) return { error: "写盘需要桌面端环境（Node 运行时不可用）" };

	const report = (message: string) => onProgress?.(message);

	const { segments } = buildSegments(
		text,
		plugin.settings.reader.filters,
		plugin.settings.reader.segment,
		plugin.readerSegmentLimits()
	);
	if (segments.length === 0) {
		return { error: "选区没有可朗读的内容（可能全被过滤规则排除了）" };
	}

	// 与朗读同源的门槛：GPT-SoVITS 缺参考音频必须在这里说清楚
	const configError = plugin.readerController.validateConfig();
	if (configError) return { error: configError };

	const probe = await plugin.readerEngine.probe();
	if (!probe.ok) {
		report("正在准备本地语音服务…");
		const result = await plugin.ensureReaderServiceRunning(onProgress);
		if (!result.ok) return { error: result.message };
	}

	const audios: ArrayBuffer[] = [];
	let mimeType = "audio/wav";
	for (const [index, segment] of segments.entries()) {
		report(`正在合成第 ${index + 1}/${segments.length} 段…`);
		try {
			const audio = await plugin.readerEngine.synthesize(segment.text);
			audios.push(audio.bytes);
			mimeType = audio.mimeType;
			plugin.markReaderHealth(true);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			plugin.markReaderHealth(false, detail);
			// 与朗读 onError 一致：服务端 traceback 在启动器捕获的日志里，一并打出来
			const tail = plugin.readerLogTail(12);
			console.error(
				`生成音频：第 ${index + 1} 段合成失败`,
				error,
				tail.length > 0 ? `\n服务日志尾部：\n${tail.join("\n")}` : ""
			);
			return { error: `第 ${index + 1} 段合成失败：${detail}` };
		}
	}

	report("正在写入音频文件…");
	const joined = joinAudio(audios, mimeType);
	if ("error" in joined) return { error: joined.error };

	const dir = resolveSaveDir(plugin);
	if (!dir) return { error: "无法确定保存目录，请在「设置 → 朗读 → 生成音频文件」中指定" };

	const name = `朗读 ${sanitizeFileName(text)} ${timestamp()}`;
	const ext = extensionFor(mimeType);
	try {
		await fs.promises.mkdir(dir, { recursive: true });
		// 同名不覆盖：加 -2、-3 后缀（与参考音频复制的策略一致）
		let target = `${name}.${ext}`;
		for (let n = 2; fs.existsSync(`${dir}/${target}`); n++) {
			target = `${name}-${n}.${ext}`;
		}
		const fullPath = `${dir.replace(/[\\/]+$/, "")}/${target}`;
		// 直接写 Uint8Array：Node fs 原生支持，不依赖渲染进程的 Buffer 全局
		await fs.promises.writeFile(fullPath, new Uint8Array(joined.data));
		return { path: fullPath };
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return { error: `写入文件失败：${detail}` };
	}
}
