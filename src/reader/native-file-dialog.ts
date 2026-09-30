/**
 * 系统原生文件/文件夹对话框。
 *
 * 首选 **`electron.remote.dialog.showOpenDialogSync`** —— 这是 Obsidian 自己用的方式
 * （在它的 asar 里能直接搜到 `electron.remote.dialog.showOpenDialogSync({...})`），
 * 说明渲染进程里 `remote` 是可用的，而且它是同步返回绝对路径，最省事。
 * 文件与**文件夹**（openDirectory）都走它。
 *
 * 备选 `<input type="file">`：在 Electron 里也能唤起系统对话框，
 * 但**取回路径**必须用 `webUtils.getPathForFile` ——
 * 本机 Obsidian 是 Electron 43.3.0（从 exe 二进制里读到 `Electron/43.3.0`），
 * 而 `File.path` 自 Electron 32 起已被移除。
 * 注意：这条备选**只能选文件**，选不了文件夹 —— 所以选目录前先用
 * `canPickDirectories()` 判断，不支持就让用户手动填。
 *
 * 注意 `dialog.showOpenDialog` 直接挂在 `electron` 上是不存在的（那是主进程模块），
 * 必须走 `electron.remote.dialog`。
 */
import { loadNodeModule } from "./node-bridge";

interface ElectronRemoteModule {
  remote?: {
    dialog?: {
      showOpenDialogSync?: (options: unknown) => string[] | undefined;
    };
  };
  webUtils?: { getPathForFile?: (file: File) => string };
}

function electronModule(): ElectronRemoteModule | null {
  return loadNodeModule<ElectronRemoteModule>("electron");
}

/** 当前环境是否支持原生路径选择（诊断用） */
export type NativeDialogMethod = "electron-remote" | "input-file" | "none";

export function detectNativeDialogMethod(): NativeDialogMethod {
  const electron = electronModule();
  if (typeof electron?.remote?.dialog?.showOpenDialogSync === "function") {
    return "electron-remote";
  }
  if (typeof electron?.webUtils?.getPathForFile === "function") {
    return "input-file";
  }
  return "none";
}

/** 从 File 对象解析出绝对路径；解析不到返回 null */
export function resolveFilePath(file: File): string | null {
  const fromWebUtils = electronModule()?.webUtils?.getPathForFile?.(file);
  if (typeof fromWebUtils === "string" && fromWebUtils) return fromWebUtils;

  // Electron < 32 的旧写法，仅作兜底
  const legacy = (file as unknown as { path?: string }).path;
  if (typeof legacy === "string" && legacy) return legacy;

  return null;
}

/**
 * 计算对话框的起始目录：**当前值所在的目录**。
 * 对文件字段即它所在目录；对文件夹字段即其父目录（这样当前配置的那一项
 * 直接出现在对话框列表里，再选一次只要点一下）。
 * 当前值为空时退回 fallbackDir（通常是安装根目录），都空则 undefined（系统记忆位置）。
 */
export function startDirFor(
  currentPath: string | undefined,
  fallbackDir?: string
): string | undefined {
  const value = (currentPath ?? "").trim();
  if (value) {
    const index = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
    if (index <= 0) return undefined;
    const parent = value.slice(0, index);
    // 盘根（如 F:\）没有"所在目录"可言；"F:" 在 Windows API 里语义含糊，也归入这种情况
    return /^[A-Za-z]:$/.test(parent) ? undefined : parent;
  }
  const fallback = (fallbackDir ?? "").trim();
  return fallback || undefined;
}

export interface NativeFileDialogOptions {
  title?: string;
  /** 例如 [{ name: "音频文件", extensions: ["wav", "mp3"] }] */
  filters?: Array<{ name: string; extensions: string[] }>;
  /** 是否允许选多个（默认单选） */
  multiple?: boolean;
  /** 对话框打开时所在的目录（electron-remote 支持；input-file 兜底不支持） */
  defaultPath?: string;
}

/** 首选实现：electron.remote.dialog（同步，直接返回绝对路径） */
function pickViaElectronRemote(options: NativeFileDialogOptions): string[] | null {
  const showOpenDialogSync = electronModule()?.remote?.dialog?.showOpenDialogSync;
  if (typeof showOpenDialogSync !== "function") return null;

  try {
    const result = showOpenDialogSync({
      title: options.title,
      filters: options.filters,
      defaultPath: options.defaultPath,
      properties: options.multiple
        ? ["openFile", "multiSelections", "dontAddToRecent"]
        : ["openFile", "dontAddToRecent"],
    });
    // 用户取消时返回 undefined
    return Array.isArray(result) ? result.filter(p => typeof p === "string" && p) : [];
  } catch (error) {
    console.error("electron.remote.dialog 打开失败，回退到 input[type=file]", error);
    return null;
  }
}

/** 备选实现：input[type=file] + webUtils.getPathForFile */
function pickViaInputElement(options: NativeFileDialogOptions): Promise<string[]> {
  return new Promise(resolve => {
    if (typeof document === "undefined") {
      resolve([]);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    if (options.filters?.length) {
      input.accept = options.filters
        .flatMap(filter => filter.extensions.map(ext => `.${ext}`))
        .join(",");
    }
    if (options.multiple) input.multiple = true;
    // 必须挂进文档才会触发 change；用离屏而不是 display:none
    // 样式经 setCssProps 下发（审核规则 no-static-styles-assignment 禁止静态样式直改）
    input.setCssProps({ position: "fixed", left: "-9999px", opacity: "0" });
    document.body.appendChild(input);

    let settled = false;
    const finish = (paths: string[]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
      resolve(paths);
    };

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) {
        finish([]);
        return;
      }
      const paths: string[] = [];
      for (const file of files) {
        const path = resolveFilePath(file);
        if (path) paths.push(path);
      }
      finish(paths);
    });

    // 用户取消时多数平台不触发任何事件，靠窗口重获焦点后判断
    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) finish([]);
      }, 600);
    };
    window.addEventListener("focus", onWindowFocus, { once: true });

    try {
      input.click();
    } catch {
      finish([]);
    }
  });
}

/** 打开原生文件对话框，返回绝对路径数组；取消返回空数组 */
export async function pickFilesWithNativeDialog(
  options: NativeFileDialogOptions
): Promise<string[]> {
  const viaRemote = pickViaElectronRemote(options);
  if (viaRemote !== null) return viaRemote;
  return pickViaInputElement(options);
}

/** 单文件版本；取消或失败返回 null */
export async function pickFileWithNativeDialog(
  options: NativeFileDialogOptions
): Promise<string | null> {
  const paths = await pickFilesWithNativeDialog(options);
  return paths.length > 0 ? paths[0] : null;
}

export interface NativeDirectoryDialogOptions {
  title?: string;
  /** 对话框打开时所在的目录 */
  defaultPath?: string;
}

/**
 * 当前环境能否打开系统**文件夹**对话框。
 * 选目录没有 input[type=file] 兜底（webkitdirectory 取不到可靠路径），
 * 调用方应先判断，不支持时提示用户手动填写。
 */
export function canPickDirectories(): boolean {
  return typeof electronModule()?.remote?.dialog?.showOpenDialogSync === "function";
}

/** 选择单个文件夹；用户取消或环境不支持返回 null */
export async function pickDirectoryWithNativeDialog(
  options: NativeDirectoryDialogOptions
): Promise<string | null> {
  const showOpenDialogSync = electronModule()?.remote?.dialog?.showOpenDialogSync;
  if (typeof showOpenDialogSync !== "function") return null;
  try {
    const result = showOpenDialogSync({
      title: options.title,
      defaultPath: options.defaultPath,
      properties: ["openDirectory", "dontAddToRecent"],
    });
    const first = Array.isArray(result) ? result[0] : undefined;
    return typeof first === "string" && first ? first : null;
  } catch (error) {
    console.error("系统文件夹对话框打开失败", error);
    return null;
  }
}
