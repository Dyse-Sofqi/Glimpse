/**
 * 外部取件器 → Obsidian 的凭证回传通道。
 *
 * 取件器（tools/netease-cookie/login-cookie.js）抓到 Cookie 后不再弹 Windows 消息框，
 * 而是写一份 pending-cookie.json 并唤起 obsidian://glimpse-netease-cookie。
 * 本模块收到后直接把凭证写进音乐设置并落盘，再用 Obsidian 自己的弹窗反馈结果 ——
 * 用户不需要回设置页粘贴，也看不到系统级对话框。
 *
 * 安全约束：只接受取件器约定的文件名、限长、必须含 MUSIC_U，且必须带 source 标记，
 * 避免任意 obsidian:// 链接把来路不明的值写进设置。
 */
import { App, Modal, Setting } from "obsidian";
import type GlimpsePlugin from "../main";
import { hydratePlatformCookie, sanitizeCookie } from "./cookieJar";
import { loadNodeModule } from "../reader/node-bridge";

/** 协议 action：与取件器拼出的 obsidian:// 链接保持一致 */
const ACTION = "glimpse-netease-cookie";
/** 只认取件器写的文件名（防止该协议被当成「读任意文件」的入口） */
const PENDING_NAME = /pending-cookie\.json$/i;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_COOKIE_LEN = 6000;

/** 取件器写下的回传内容 */
interface PendingPayload {
  status?: string;
  cookie?: string;
  nick?: string;
  uid?: number;
  vip?: number;
  message?: string;
}

interface NodeFs {
  statSync(p: string): { size: number };
  readFileSync(p: string, enc: string): string;
  unlinkSync(p: string): void;
}

interface ImportView {
  ok: boolean;
  nick?: string;
  uid?: number;
  vip?: number;
  chars: number;
  message?: string;
}

function nodeFs(): NodeFs | null {
  return loadNodeModule<NodeFs>("fs");
}

function removePending(filePath: string): void {
  const fs = nodeFs();
  if (!fs) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* 已被清理或权限不足：留着也无害，下次覆盖 */
  }
}

/** 回传路径可能被 URI 解析层二次编码（%5C 之类），解码一次后再交给 fs */
function normalizePath(raw: string): string {
  const p = (raw ?? "").trim();
  if (!p) return "";
  if (!/%[0-9a-f]{2}/i.test(p)) return p;
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

/** 读取并粗校验回传文件；任何一步不对都返回 null，由调用方提示重跑 */
function readPending(filePath: string): PendingPayload | null {
  const fs = nodeFs();
  if (!fs || !PENDING_NAME.test(filePath)) return null;
  try {
    const st = fs.statSync(filePath);
    if (!st || st.size <= 0 || st.size > MAX_FILE_BYTES) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PendingPayload;
  } catch {
    return null;
  }
}

/** 打开设置并定位到「音乐」分区（先改 activeMainTab，openTabById 触发的 display 才会落在音乐页） */
export function openMusicSettings(plugin: GlimpsePlugin): void {
  plugin.settingsTab.activeMainTab = "music";
  const setting = (
    plugin.app as unknown as { setting?: { open?: () => void; openTabById?: (id: string) => void } }
  ).setting;
  setting?.open?.();
  setting?.openTabById?.(plugin.manifest.id);
}

/** 结果弹窗：沿用 Obsidian 原生 Modal 与 Setting 样式，不引入自定义 CSS */
class CookieImportModal extends Modal {
  constructor(
    app: App,
    private view: ImportView,
    private openSettings: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    const ok = this.view.ok;
    titleEl.setText(ok ? "网易云凭证已写入" : "网易云凭证未能写入");

    contentEl.createEl("p", {
      text: ok
        ? "取件器已把凭证直接交给 Glimpse，无需再复制粘贴，可以立刻使用 VIP 高音质下载与账号歌单同步。"
        : this.view.message || "取件器没有拿到有效凭证。",
      cls: ok ? "gm-cookie-import-lead" : "gm-cookie-import-lead mod-warning",
    });

    if (ok) {
      new Setting(contentEl)
        .setName("账号")
        .setDesc(this.view.nick ? `${this.view.nick}（UID ${this.view.uid ?? "未知"}）` : "已登录账号");
      new Setting(contentEl)
        .setName("凭证")
        .setDesc(`${this.view.chars} 字符 · 仅保存在本地 data.json`);
      new Setting(contentEl)
        .setName("会员")
        .setDesc(
          this.view.vip
            ? "VIP 账号，可下载高音质与 VIP 曲目"
            : "非会员：VIP 专属曲目与无损仍不可下载，免费歌 320kbps 不受影响",
        );
      new Setting(contentEl)
        .setName("有效期")
        .setDesc("MUSIC_U 不会被「续期」——网易云之后的请求不回吐新值。失效只可能是被吊销（风控 / 异地登录 / 改密码），届时插件会弹窗提示，点「一键登录」重取即可");
    }

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    if (ok) {
      const go = buttons.createEl("button", { text: "打开音乐设置", cls: "mod-cta" });
      go.addEventListener("click", () => {
        this.close();
        this.openSettings();
      });
    }
    const done = buttons.createEl("button", { text: ok ? "完成" : "知道了" });
    done.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

async function applyCookie(plugin: GlimpsePlugin, cookie: string): Promise<void> {
  const settings = plugin.settings.music;
  settings.platformCookies = { ...settings.platformCookies, netease: cookie };
  // 外部重新导入＝新的手工基线，之前的「已自动续期」标记失效
  settings.platformCookiesUpdatedAt = { ...settings.platformCookiesUpdatedAt, netease: 0 };
  // 播种会话内 JAR：之后第一次请求就会带上它，并在响应头续期时把新值合并回来
  hydratePlatformCookie("netease", cookie);
  plugin.music?.updateSettings(settings);
  await plugin.saveSettings();
  // 设置页若正开着，它手里还是导入前的空输入框；重绘一次让它显示刚落库的凭证，
  // 否则用户在那个空框里任何一次输入都可能把刚写入的值覆盖掉。
  const tab = plugin.settingsTab;
  if (tab?.containerEl?.isShown?.()) tab.display();
}

async function handleImport(plugin: GlimpsePlugin, params: Record<string, string>): Promise<void> {
  // source 标记由取件器固定写入，挡住随手拼的 obsidian:// 链接
  if (params.source !== ACTION) return;
  const filePath = normalizePath(params.file ?? "");
  const fail = (message: string): void => {
    new CookieImportModal(plugin.app, { ok: false, chars: 0, message }, () => openMusicSettings(plugin)).open();
  };

  const payload = readPending(filePath);
  if (!payload) {
    fail("回传文件读取失败或已过期，请重新运行 tools/netease-cookie/get-cookie.cmd。");
    return;
  }
  if (payload.status === "error") {
    fail(payload.message || "取件器报告失败，详见命令行窗口的输出。");
    removePending(filePath);
    return;
  }

  const cookie = sanitizeCookie(String(payload.cookie ?? ""));
  if (!cookie || !/(^|;\s*)MUSIC_U=/.test(cookie) || cookie.length > MAX_COOKIE_LEN) {
    fail("回传的凭证不完整（缺少 MUSIC_U 或长度异常），请重新运行取件器。");
    removePending(filePath);
    return;
  }

  try {
    await applyCookie(plugin, cookie);
  } catch (error) {
    fail(`写入设置失败：${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  removePending(filePath);

  new CookieImportModal(
    plugin.app,
    {
      ok: true,
      nick: typeof payload.nick === "string" && payload.nick ? payload.nick : undefined,
      uid: typeof payload.uid === "number" ? payload.uid : undefined,
      vip: Number(payload.vip ?? 0),
      chars: cookie.length,
    },
    () => openMusicSettings(plugin),
  ).open();
}

/** 在插件 onload 中调用一次：注册 obsidian://glimpse-netease-cookie 处理器 */
export function registerNeteaseCookieImport(plugin: GlimpsePlugin): void {
  plugin.registerObsidianProtocolHandler(ACTION, (params) => {
    void handleImport(plugin, params as Record<string, string>);
  });
}
