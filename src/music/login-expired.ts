/**
 * 登录态失效的主动提示：把「重新登录」摆到用户面前，而不是等他自己想起来去设置页。
 *
 * 为什么需要它：cookieJar 的自动续期只对「服务端在响应头里回吐新凭证」的平台有效。
 * 网易云的 `MUSIC_U` 是登录那一刻下发的一次性长效 token，之后的 weapi / eapi 请求
 * 实测 `Set-Cookie` 为 0 条 —— 也就是说这个平台不存在「滚动续期」这回事。
 * 凭证失效只可能是被服务端吊销（账号风控 8821 / 异地登录 / 改密码），
 * 而吊销后的旧值不会被任何响应头救回来，只能重新取一次。
 *
 * 既然重新取是必然的，那就把它做成一次点击：弹原生 Modal（与 Obsidian 同款样式），
 * 主按钮直接拉起仓库内的取件器。节流由「一次失效会在多个请求里同时暴露」决定，
 * 避免歌单、试听、下载同时报错时叠出一堆弹窗。
 */
import { Modal, Notice, Setting } from "obsidian";
import type GlimpsePlugin from "../main";
import { launchBrowserCookieHelper } from "./browser-login";
import { openMusicSettings } from "./cookie-import";

/** 宿主（在插件 onload 时注入一次，避免把 plugin 一路透传到请求层） */
let host: GlimpsePlugin | null = null;

/** 注入宿主（幂等；重复注入只换引用） */
export function configureLoginExpiredHost(plugin: GlimpsePlugin | null): void {
  host = plugin;
}

/** 同一窗口内只提示一次：一次失效往往同时命中多个请求（账号歌单 / 试听 / 下载） */
const REPEAT_WINDOW_MS = 10 * 60 * 1000;
let lastShownAt = 0;

/**
 * `revoked`：凭证存在但被服务端作废（接口返回未登录）
 * `anonymous`：凭证里根本没有 MUSIC_U（多半只复制了 document.cookie 的可见项）
 */
export type LoginExpiredReason = "revoked" | "anonymous";

/** 上报一次「网易云登录失效」；未注入宿主或处于节流窗口内时静默返回 */
export function reportNeteaseLoginExpired(reason: LoginExpiredReason = "revoked"): void {
  if (!host) return;
  const now = Date.now();
  if (now - lastShownAt < REPEAT_WINDOW_MS) return;
  lastShownAt = now;
  new LoginExpiredModal(host, reason).open();
}

class LoginExpiredModal extends Modal {
  constructor(
    private plugin: GlimpsePlugin,
    private reason: LoginExpiredReason,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText("网易云登录已失效");
    contentEl.createEl("p", {
      cls: "gm-cookie-import-lead",
      text: this.reason === "anonymous"
        ? "设置里这份 Cookie 不含登录凭证 MUSIC_U —— 控制台复制到的只是可见项，账号歌单与 VIP 音质都拿不到。"
        : "网易云把这枚凭证作废了。常见于账号风控、异地登录或改过密码，原凭证会立即失去效力。",
    });

    new Setting(contentEl)
      .setName("为什么没有自动续期")
      .setDesc(
        this.reason === "anonymous"
          ? "MUSIC_U 是 HttpOnly，普通脚本读不到，必须从请求头或真实浏览器登录里取。"
          : "MUSIC_U 是登录时一次性下发的长效凭证，之后的接口不会回吐新值（响应头无 Set-Cookie），没有可续期的对象；被吊销后只能重新获取。",
      );

    new Setting(contentEl)
      .setName("重新获取")
      .setDesc("打开浏览器登录一次，凭证经 obsidian:// 直接写回，全程不用复制粘贴。")
      .addButton((btn) =>
        btn.setButtonText("一键登录").setCta().onClick(() => this.startBrowserLogin()),
      )
      .addButton((btn) =>
        btn.setButtonText("打开设置").onClick(() => {
          this.close();
          openMusicSettings(this.plugin);
        }),
      );

    const foot = contentEl.createDiv({ cls: "modal-button-container" });
    const later = foot.createEl("button", { text: "稍后" });
    later.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** 拉起取件器；起不来就退化为设置页手动路径（不在这里教用户复制，设置页已有指引） */
  private startBrowserLogin(): void {
    if (launchBrowserCookieHelper(this.plugin.app) === "spawned") {
      new Notice("已打开登录窗口：登录完成后凭证会自动写回", 5000);
      this.close();
      return;
    }
    new Notice("未能启动取件器：请在设置页点「一键登录」，或双击 tools/netease-cookie/get-cookie.cmd");
    this.close();
    openMusicSettings(this.plugin);
  }
}
