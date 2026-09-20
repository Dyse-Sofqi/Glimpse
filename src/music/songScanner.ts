/**
 * 音频文件扫描（歌单来源：音频文件夹，单 MP3/FLAC/M4A/OGG）。
 */

import { type App, TFile } from "obsidian";
import type { MusicSong } from "./manager";

/** 识别的音频扩展名（小写比较） */
const AUDIO_EXTENSIONS = ["mp3", "flac", "wav", "ogg", "aac", "m4a"];

/** 判断路径是否是音频文件（扩展名大小写不敏感） */
export function isAudioFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.includes(ext);
}

/** 是否 Windows 盘符绝对路径（`D:\` 或 `D:/`，库外音频文件夹支持） */
export function isWindowsAbsolutePath(p: string): boolean {
  return p.length >= 3 && /^[A-Za-z]:[\\/]/.test(p);
}

/** 取文件名去扩展名（兼容 `/` 与 `\` 两种分隔符，库外盘符路径用反斜杠） */
export function basenameNoExt(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/\.[^.]+$/, "");
}

/** 音频路径 → 同目录同名 .lrc 侧车歌词路径（保留原分隔符风格；无扩展名则直接追加） */
export function sidecarLrcPath(audioPath: string): string {
  const dot = audioPath.lastIndexOf(".");
  const slash = Math.max(audioPath.lastIndexOf("/"), audioPath.lastIndexOf("\\"));
  if (dot <= slash) return audioPath + ".lrc";
  return audioPath.slice(0, dot) + ".lrc";
}

/** 把歌词写入音频同目录同名 .lrc 侧车文件：vault 内 create/modify，库外盘符路径 fs 直写（桌面端）。成功返回 true */
export async function writeSidecarLrc(app: App, audioPath: string, text: string): Promise<boolean> {
  const lrcPath = sidecarLrcPath(audioPath);
  try {
    if (isWindowsAbsolutePath(audioPath)) {
      const fs = (window as any).require("fs");
      await fs.promises.writeFile(lrcPath, text, "utf-8");
      return true;
    }
    const existing = app.vault.getAbstractFileByPath(lrcPath);
    if (existing instanceof TFile) {
      await app.vault.modify(existing, text);
      return true;
    }
    await app.vault.create(lrcPath, text);
    return true;
  } catch {
    return false;
  }
}

/** 从音频路径构造裸音频歌单项（初始 title 用文件名兜底，标签富化后覆盖） */
export function buildAudioSong(path: string): MusicSong {
  return {
    path,
    title: basenameNoExt(path),
    actor: "未知艺术家",
    type: "",
    banner: "",
    audioPath: path,
  };
}

/** 音频真实容器类型（按文件头魔数判定，与扩展名无关） */
export type AudioContainer = "mp3" | "m4a" | "flac" | "ogg" | "unknown";

/** 按文件头魔数检测音频真实容器。用于识别「扩展名为 .mp3 实为 M4A/AAC」的伪 mp3，
 *  以及 FLAC/OGG 等非 MP3 容器，避免播放时按 mp3 解码失败。 */
export function detectAudioContainer(bytes: Uint8Array): AudioContainer {
  if (!bytes || bytes.length < 4) return "unknown";
  const b0 = bytes[0], b1 = bytes[1], b2 = bytes[2], b3 = bytes[3];
  // FLAC：'fLaC'
  if (b0 === 0x66 && b1 === 0x4c && b2 === 0x61 && b3 === 0x43) return "flac";
  // Ogg：'OggS'
  if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) return "ogg";
  // MP4/M4A：offset 4 处 'ftyp'（`00 00 00 xx 66 74 79 70`）
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "m4a";
  // ID3v2 标签（通常紧随其后是 MPEG 帧）
  if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) return "mp3";
  // MPEG 帧同步字（0xFF 0xEx）
  if (b0 === 0xff && (b1 & 0xe0) === 0xe0) return "mp3";
  return "unknown";
}
