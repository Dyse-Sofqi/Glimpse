/**
 * 访问 Node 运行时的桥接。
 *
 * esbuild 把 node 内置模块标为 external，运行时的 require 由宿主（Obsidian 桌面端）提供。
 * 实测确认：插件内 `require("child_process")` 与 spawn 均可用。
 *
 * 这里同时尝试全局与词法作用域两条路径，取到哪个用哪个 ——
 * 不同打包/宿主组合下 require 的可见位置不一定相同。
 */
export type NodeRequire = (id: string) => unknown;

export function resolveRequire(): NodeRequire | null {
  const scope = window as unknown as { require?: NodeRequire };
  if (typeof scope.require === "function") return scope.require;
  try {
    if (typeof require === "function") return require as NodeRequire;
  } catch {
    /* 词法作用域里没有 require */
  }
  return null;
}

/** 取 node 内置模块；取不到或模块不存在时返回 null */
export function loadNodeModule<T>(id: string): T | null {
  const req = resolveRequire();
  if (!req) return null;
  try {
    return req(id) as T;
  } catch {
    return null;
  }
}

/** 是否运行在 Windows（决定内嵌解释器路径与 shell 选择） */
export function isWindows(): boolean {
  const proc = (window as unknown as { process?: { platform?: string } }).process;
  return proc?.platform === "win32";
}

interface NodeProcessApi {
  kill?: (pid: number, signal?: number | string) => boolean;
}

function processApi(): NodeProcessApi | null {
  const proc = (window as unknown as { process?: NodeProcessApi }).process;
  return proc?.kill ? proc : null;
}

/**
 * 进程是否还活着。
 * 用 signal 0 探测（不发信号，只做存在性与权限检查）。
 * EPERM 表示进程存在但无权限 —— 对我们来说同样算「活着」。
 */
export function isProcessAlive(pid: number): boolean {
  const proc = processApi();
  if (!proc?.kill || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    proc.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string }).code === "EPERM";
  }
}

/** 终止进程；返回是否发出了信号 */
export function killProcess(pid: number): boolean {
  const proc = processApi();
  if (!proc?.kill || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    proc.kill(pid);
    return true;
  } catch {
    return false;
  }
}
