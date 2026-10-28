/**
 * 「一键登录」：从插件内拉起仓库自带的取件器（tools/netease-cookie/login-cookie.js）。
 *
 * 为什么这是主路径而不是备选：网易云对扫码登录做了账号级风控（`8821`，要求行为验证码），
 * 换协议 / 换 UA / 补 Cookie 都绕不过，也就是说对多数账号「先扫码再失败」是必然的。
 * 真实浏览器登录则不触发这套风控 —— 所以入口直接走浏览器，扫两次墙只浪费用户时间。
 *
 * 取件器用 playwright-core + 本机 Edge（独立配置目录）打开登录页，登录后把 MUSIC_U 经
 * `obsidian://glimpse-netease-cookie` 回传，插件写入设置并弹原生窗口。全程无需复制粘贴。
 */
import { App, Notice } from "obsidian";

export type BrowserLoginResult = "spawned" | "failed";

/** 取件脚本相对插件根目录的路径 */
const HELPER_REL = ["tools", "netease-cookie", "login-cookie.js"];

/**
 * 定位取件脚本。插件目录可能被改名，所以先试同名目录，再遍历 `plugins/*` 按
 * 「谁的 tools/netease-cookie 下真有这个文件」来认。
 */
export function findCookieHelper(app: App): string | null {
  try {
    const req = (window as any).require;
    const fs = req?.("fs");
    const path = req?.("path");
    const adapter = app.vault.adapter as unknown as { getBasePath?: () => string };
    const base = typeof adapter?.getBasePath === "function" ? adapter.getBasePath() : null;
    if (!fs || !path || !base) return null;
    const rel = path.join(...HELPER_REL);
    const pluginsDir = path.join(base, app.vault.configDir, "plugins");
    const direct = path.join(pluginsDir, "Glimpse", rel);
    if (fs.existsSync(direct)) return direct;
    for (const name of fs.readdirSync(pluginsDir)) {
      const candidate = path.join(pluginsDir, name, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    /* 交给调用方降级 */
  }
  return null;
}

/**
 * 拉起取件器。返回 `spawned` 表示进程已交出去（不代表用户已登录成功 —— 结果由
 * `obsidian://` 回传后另行提示）；`failed` 表示这台机器上起不来，调用方应降级为
 * 「打开登录页 + 手动粘贴」。
 */
export function launchBrowserCookieHelper(app: App): BrowserLoginResult {
  const script = findCookieHelper(app);
  const cp = (window as any).require?.("child_process");
  if (!script || typeof cp?.spawn !== "function") return "failed";
  try {
    const dir = script.replace(/[\\/][^\\/]+$/, "");
    // detached + stdio ignore：脚本要跑几分钟（等用户登录），不能拖住宿主进程
    const child = cp.spawn("node", [script], {
      cwd: dir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    // spawn 的失败是异步的（ENOENT 等）：这里只能提示，结果仍以回传弹窗为准
    child.on("error", () => {
      new Notice("未能启动取件器：请改用「打开登录页」手动复制 Cookie，或双击 tools/netease-cookie/get-cookie.cmd");
    });
    child.unref();
    return "spawned";
  } catch {
    return "failed";
  }
}
