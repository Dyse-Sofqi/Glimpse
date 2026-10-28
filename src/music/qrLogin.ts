/**
 * 平台扫码登录（设置页 Cookie 行的「扫码登录」按钮）。
 *
 * 当前仅支持网易云：其余平台（QQ / 酷狗 / 酷我）的网页扫码要走 ptlogin / 签名跳转链，
 * 且酷狗 / 酷我的 Cookie 本就不参与下载，暂不提供。
 *
 * 网易云流程（三个公开明文接口，均已实测可用，无需 weapi 加密）：
 *  1. GET https://music.163.com/api/login/qrcode/unikey?type=1 → { code:200, unikey }
 *  2. 二维码内容 https://music.163.com/login?codekey=<unikey>（手机网易云音乐 App 扫码确认）
 *  3. 轮询 GET https://music.163.com/api/login/qrcode/client/login?key=<unikey>&type=1
 *     801=等待扫码 802=已扫码待确认 803=已确认 800=已过期；803 的本响应 Set-Cookie
 *     携带 MUSIC_U / __csrf 等登录凭证
 *     两个非可选项：① URL 带 timestamp、请求头禁缓存（中间层缓存住第一次的 802 会让
 *     「已确认」永远读到旧状态）；② unikey 响应下发的 Set-Cookie 要在轮询时回传
 *     （裸 https 请求没有浏览器的 Cookie 罐，否则轮询与二维码会话是两个客户端）。
 *  4. 803 时把 Set-Cookie 交给 cookieJar.applyLoginSetCookie：过平台名字白名单、
 *     合并会话内旧值、经 sink 立即落盘（platformCookies + 时间戳）。
 *
 * 请求优先走 Node https（桌面端，绕过 CSP、可读 Set-Cookie 响应头），回退浏览器 fetch
 * （读不到 Set-Cookie，仅够生成二维码用）；扫码登录按钮只在桌面端渲染——扫二维码
 * 本来就需要另一台手机，而移动端 fetch 拿不到登录凭证。
 */
import { App, Modal, Notice } from "obsidian";
import qrcode from "qrcode-generator";
import {
  applyLoginCookieString,
  applyLoginSetCookie,
  parseCookieHeader,
  parseSetCookie,
  splitSetCookieHeader,
  type CookiePlatform,
} from "./cookieJar";
import type { MusicSource } from "./shared";
import { launchBrowserCookieHelper } from "./browser-login";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 2000;
/** 连续网络失败达到该次数后停止轮询，给出重试按钮（避免弹窗静默空转）。
 *  超时 6s × 4 次 ≈ 半分钟内必然给出原因，不会像旧实现那样把「授权后请求全失败」藏成
 *  一直停在「请在手机上确认」——失败不更新文案，用户只能干等。 */
const MAX_CONSECUTIVE_ERRORS = 4;
/** 连续「已扫码待确认」达到该次数（15 × 2s ≈ 30 秒）后，提示用户重新扫码 */
const SCANNED_STUCK_POLLS = 15;

/** 支持扫码登录的平台元信息；不在表里的平台不渲染「扫码登录」按钮 */
const QR_LOGIN_PLATFORMS: Partial<Record<CookiePlatform, { name: string; loginUrl: string }>> = {
  netease: { name: "网易云音乐", loginUrl: "https://music.163.com/#/login" },
};

export function supportsQrLogin(key: MusicSource): boolean {
  return QR_LOGIN_PLATFORMS[key as CookiePlatform] !== undefined;
}

// --- 二维码渲染 ---

/** qrcode-generator 实例里本文件用到的两个方法（该包不带 .d.ts，这里给出最小结构） */
interface QrMatrix {
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 把二维码矩阵直接画成 SVG 节点。
 *
 * 为什么不再用 qrcode-generator 自带的 createSvgTag()：它返回 HTML 字符串，只能经
 * innerHTML 注入，而 Obsidian 审核直接判「Unsafe assignment to innerHTML」不通过。
 * 这里用 createElementNS 逐个建节点——所有属性值都是本地生成的整数与固定色值，
 * 没有任何外部内容参与，既过审也不会引入注入面。
 *
 * 同一行相邻的暗块合并成一个 rect，33×33 的码通常只产生百余个节点（不合并要 500+）。
 */
function paintQrSvg(container: HTMLElement, qr: QrMatrix): void {
  container.empty();
  const count = qr.getModuleCount();
  // 静区（quiet zone）：二维码规范要求图案四周留白 ≥4 模块，缺了手机很难对准。
  // 容器只有 10px padding，不够；这里把留白做进 viewBox，SVG 自己保证 3 模块白边。
  const quiet = 3;
  const side = count + quiet * 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("viewBox", `${-quiet} ${-quiet} ${side} ${side}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  // 扫码对边缘锐利度敏感：关掉抗锯齿，避免缩放后模块之间糊出灰边
  svg.setAttribute("shape-rendering", "crispEdges");

  // 白底：图案必须黑压白，深色主题下透明底会出现反色码，扫不出来
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", String(-quiet));
  bg.setAttribute("y", String(-quiet));
  bg.setAttribute("width", String(side));
  bg.setAttribute("height", String(side));
  bg.setAttribute("fill", "#ffffff");
  svg.appendChild(bg);

  const appendRun = (x: number, y: number, width: number): void => {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", "1");
    rect.setAttribute("fill", "#000000");
    svg.appendChild(rect);
  };

  for (let row = 0; row < count; row++) {
    let runStart = -1;
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        if (runStart < 0) runStart = col;
      } else if (runStart >= 0) {
        appendRun(runStart, row, col - runStart);
        runStart = -1;
      }
    }
    if (runStart >= 0) appendRun(runStart, row, count - runStart);
  }
  container.appendChild(svg);
}

// --- 传输层 ---

interface JsonWithHeaders {
  json: unknown;
  headers: Record<string, string>;
  /** HTTP 状态码（诊断用：失败时能区分「服务器 502」和「状态就是 802」） */
  status: number;
}

/** 请求选项：扫码会话内的临时 Cookie 上下文（仅内存，不落盘）与跳转预算 */
interface RequestOptions {
  cookie?: string;
  redirects?: number;
}

/** 状态接口的固定请求头：不协商压缩（Node 不自动解压，gzip 体会让 JSON.parse 失败）、
 *  禁缓存（中间层缓存住第一次的 802 会让「已确认」永远读到旧状态）。 */
const BASE_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://music.163.com",
};

/** 把响应 Set-Cookie 里的 name=value 合并进请求侧 Cookie 串（会话上下文，仅内存）。
 *  浏览器扫码时这一步由 Cookie 罐自动完成；裸 https 请求没有罐，必须自己串联，
 *  否则轮询与 unikey 会话是两个互不相识的客户端。 */
function mergeSessionCookies(cookie: string, setCookie: string | undefined): string {
  if (!setCookie) return cookie;
  const map = new Map<string, string>();
  for (const [k, v] of parseCookieHeader(cookie)) map.set(k, v);
  for (const item of splitSetCookieHeader(setCookie)) {
    const parsed = parseSetCookie(item);
    if (!parsed || parsed.isDelete || !parsed.value) continue;
    map.set(parsed.name, parsed.value);
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function getJsonWithHeaders(url: string, opts: RequestOptions = {}): Promise<JsonWithHeaders | null> {
  try {
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    const https = w?.require?.("https");
    if (https && typeof https.request === "function") return await httpsGetJson(https, url, opts);
  } catch { /* 回退 fetch */ }
  return fetchGetJson(url, opts);
}

/** Node https 版：Set-Cookie 响应头是登录凭证的唯一来源，浏览器 fetch 读不到 */
function httpsGetJson(https: any, url: string, opts: RequestOptions): Promise<JsonWithHeaders> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try { u = new URL(url); } catch (e) { reject(e); return; }

    const headers: Record<string, string> = { ...BASE_HEADERS };
    if (opts.cookie) headers.Cookie = opts.cookie;

    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers,
      },
      (res: any) => {
        const status = Number(res.statusCode ?? 0);
        const respHeaders: Record<string, string> = {};
        for (const k of Object.keys(res.headers ?? {})) {
          const v = res.headers[k];
          // 多条 Set-Cookie 用逗号折叠成一个键，交给 parseSetCookieHeader 按边界切回
          respHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
        }

        // 803 有时经一次跳转中转：跟随并带上本次下发的会话 Cookie（最多 3 跳）
        const location = respHeaders["location"];
        const budget = opts.redirects ?? 3;
        if (status >= 300 && status < 400 && location && budget > 0) {
          res.resume();
          let nextUrl: string;
          try { nextUrl = new URL(location, url).toString(); }
          catch { reject(new Error(`跳转地址无效：${location}`)); return; }
          httpsGetJson(https, nextUrl, {
            cookie: mergeSessionCookies(opts.cookie ?? "", respHeaders["set-cookie"]),
            redirects: budget - 1,
          }).then(resolve, reject);
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { body += chunk; });
        res.on("end", () => {
          let json: unknown = null;
          try { json = JSON.parse(body); } catch { json = null; }
          if (json === null) {
            // 非 JSON（如网关 502 的 HTML）把状态码与片段带出来，别只丢一句「不是有效 JSON」
            const snippet = body.replace(/\s+/g, " ").trim().slice(0, 120);
            reject(new Error(`HTTP ${status} 响应不是 JSON${snippet ? `：${snippet}` : ""}`));
            return;
          }
          resolve({ json, headers: respHeaders, status });
        });
        res.on("error", () => reject(new Error("连接中断")));
      },
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("请求超时")));
    req.on("error", reject);
    req.end();
  });
}

/** 浏览器 fetch 回退（无 Node require 场景）：读不到 Set-Cookie，仅用于生成二维码 */
async function fetchGetJson(url: string, opts: RequestOptions): Promise<JsonWithHeaders | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: opts.cookie ? { Cookie: opts.cookie } : undefined,
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    let json: unknown = null;
    try { json = await res.json(); } catch { json = null; }
    return { json, headers, status: res.status };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

// --- 网易云二维码登录接口 ---

export interface QrLoginSession {
  unikey: string;
  /** 二维码内容（手机 App 扫码后打开的登录确认页） */
  qrContent: string;
  /** 会话 Cookie：unikey 接口下发的 NMTID 等，轮询时回传（模拟浏览器的 Cookie 罐） */
  cookies: string;
}

export async function createQrLoginSession(platform: CookiePlatform): Promise<QrLoginSession> {
  if (platform !== "netease") throw new Error("该平台暂不支持扫码登录");
  // timestamp 防中间层缓存同一个 unikey（官方文档明确要求「调用务必带上时间戳，防止缓存」）
  const res = await getJsonWithHeaders(`https://music.163.com/api/login/qrcode/unikey?type=1&timestamp=${Date.now()}`);
  if (!res) throw new Error("二维码接口无响应（网络或代理不可达）");
  if (!res.status || res.status < 200 || res.status >= 300) throw new Error(`二维码接口 HTTP ${res.status}`);
  const json = (res.json ?? {}) as { unikey?: unknown };
  const unikey = json.unikey;
  if (typeof unikey !== "string" || !unikey) throw new Error("未取得二维码 key");
  return {
    unikey,
    qrContent: `https://music.163.com/login?codekey=${unikey}`,
    cookies: mergeSessionCookies("", res.headers["set-cookie"]),
  };
}

export interface QrLoginCheck {
  /** 800=已过期 801=等待扫码 802=已扫码待确认 803=已确认 */
  code: number;
  message: string;
  /** code=803 时的原始 Set-Cookie 响应头（可能含多条折叠串），交给 applyLoginSetCookie 过白名单 */
  setCookie?: string;
  /** 803 响应体里直接给的 Cookie 串（部分实现在 body 返回 `MUSIC_U=…; __csrf=…`） */
  bodyCookie?: string;
  /** 本次响应后的会话 Cookie（轮询继续沿用） */
  cookies: string;
  /** HTTP 状态码（诊断用） */
  status: number;
}

const CHECK_MESSAGES: Record<number, string> = {
  800: "二维码已过期",
  801: "等待扫码",
  802: "已扫码，请在手机上确认",
  803: "授权成功",
  /** 实测：手机确认后服务端直接回 8821（「请切换其他登录方式或升级新版本再试」），
   *  属账号级风控（要求行为验证码），换 eapi/type=3 等协议同样如此，客户端无解。 */
  8821: "网易云风控拦截（要求行为验证码）",
};

/** 协议已知状态码：其余一律视为服务端拒绝，必须当场报出来并停轮询 */
const KNOWN_CODES = new Set([800, 801, 802, 803]);

export async function checkQrLogin(platform: CookiePlatform, session: QrLoginSession): Promise<QrLoginCheck> {
  if (platform !== "netease") throw new Error("该平台暂不支持扫码登录");
  const url = `https://music.163.com/api/login/qrcode/client/login?key=${encodeURIComponent(session.unikey)}&type=1&timestamp=${Date.now()}`;
  const res = await getJsonWithHeaders(url, { cookie: session.cookies });
  if (!res) throw new Error("状态接口无响应（网络或代理不可达）");
  const cookies = mergeSessionCookies(session.cookies, res.headers["set-cookie"]);
  const json = (res.json ?? {}) as { code?: unknown; message?: unknown; cookie?: unknown };
  const code = Number(json.code);
  // 非 2xx 或 code 不可识别：一律抛错交给轮询计数，避免「拿到一个无效响应却静默当成 801」
  if (!res.status || res.status < 200 || res.status >= 300) {
    throw new Error(`状态接口 HTTP ${res.status}${Number.isFinite(code) ? `（code ${code}）` : ""}`);
  }
  if (!Number.isFinite(code) || code === 0) throw new Error("状态接口返回了无法识别的响应");
  const message = typeof json.message === "string" && json.message
    ? json.message
    : (CHECK_MESSAGES[code] ?? `未知状态 ${code}`);
  const raw = res.headers["set-cookie"];
  const bodyCookie = typeof json.cookie === "string" && json.cookie.trim() ? json.cookie.trim() : undefined;
  return {
    code,
    message,
    setCookie: typeof raw === "string" && raw ? raw : undefined,
    bodyCookie,
    cookies,
    status: res.status,
  };
}

// --- 扫码登录弹窗 ---

/** 取错误文本（Error 的 message 才有诊断价值） */
function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? "未知错误");
}

export class QrLoginModal extends Modal {
  private statusEl!: HTMLElement;
  private qrEl!: HTMLElement;
  private actionsEl!: HTMLElement;
  private pollTimer: number | null = null;
  private closed = false;
  private inFlight = false;
  private consecutiveErrors = 0;
  /** 当前二维码会话（unikey + 会话 Cookie，随轮询延续） */
  private session: QrLoginSession | null = null;
  /** 连续处于「已扫码待确认」的轮询次数：超阈值就给出可操作提示，不让用户干等 */
  private stuckScanned = 0;
  /** 风控收口时替换二维码的说明面板（刷新二维码/重试时移除） */
  private blockedEl: HTMLElement | null = null;
  /** 窗口重新聚焦时立即补一次查询（扫码期间 Obsidian 在后台，定时器可能被节流） */
  private readonly onWindowFocus = (): void => { void this.pollOnce(); };

  constructor(
    app: App,
    private platform: CookiePlatform,
    /** 用户已保存的旧 Cookie（803 合并时叠加，避免丢掉非白名单的辅助项） */
    private stored: string,
    /** 登录成功回调：把写入后的 Cookie 同步回设置页输入框 */
    private onSuccess: (cookie: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("gm-qr-login-modal");
    this.titleEl.setText(`扫码登录 · ${QR_LOGIN_PLATFORMS[this.platform]?.name ?? ""}`);
    this.contentEl.empty();
    const body = this.contentEl.createDiv({ cls: "gm-qr-login-body" });
    this.qrEl = body.createDiv({ cls: "gm-qr-login-qr" });
    this.statusEl = body.createDiv({ cls: "gm-qr-login-status" });
    this.actionsEl = body.createDiv({ cls: "gm-qr-login-actions" });
    // 扫码时用户在手机上操作，Obsidian 处于后台：Chromium 会节流后台定时器，
    // 切回窗口时立刻补一次查询，不必等下一个 2s 周期（甚至被冻结后等很久）
    window.addEventListener("focus", this.onWindowFocus);
    void this.newSession();
  }

  onClose(): void {
    this.closed = true;
    window.removeEventListener("focus", this.onWindowFocus);
    this.stopPolling();
  }

  /** 重新取 unikey 并渲染二维码，随后开始轮询（首次打开、刷新二维码、网络重试共用） */
  private async newSession(): Promise<void> {
    this.stopPolling();
    this.consecutiveErrors = 0;
    this.stuckScanned = 0;
    this.session = null;
    this.actionsEl.empty();
    this.clearBlocked();
    this.qrEl.removeClass("is-expired");
    this.qrEl.setText("正在获取二维码…");
    this.setStatus("正在获取二维码…");
    try {
      const session = await createQrLoginSession(this.platform);
      if (this.closed) return;
      this.session = session;
      const qr = qrcode(0, "M");
      qr.addData(session.qrContent);
      qr.make();
      paintQrSvg(this.qrEl, qr);
      this.setStatus("打开手机网易云音乐 App 扫一扫");
      this.startPolling();
    } catch (e) {
      if (this.closed) return;
      this.qrEl.empty();
      this.setStatus(`二维码获取失败：${errText(e)}`, "bad");
      this.addRetryButton("重试");
    }
  }

  private setStatus(text: string, cls?: "ok" | "bad"): void {
    this.statusEl.setText(text);
    this.statusEl.toggleClass("is-ok", cls === "ok");
    this.statusEl.toggleClass("is-bad", cls === "bad");
  }

  private addRetryButton(text: string): void {
    this.actionsEl.empty();
    this.actionsEl.createEl("button", { text, cls: "mod-cta" })
      .addEventListener("click", () => void this.newSession());
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
    void this.pollOnce();
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    const session = this.session;
    if (!session || this.inFlight || this.closed) return;
    this.inFlight = true;
    try {
      const r = await checkQrLogin(this.platform, session);
      if (this.closed) return;
      session.cookies = r.cookies; // 会话 Cookie 随轮询延续（等价浏览器的 Cookie 罐）
      this.consecutiveErrors = 0;
      console.debug(`[Glimpse] 网易云扫码状态 ${r.code}（HTTP ${r.status}）`);
      if (r.code !== 802) this.stuckScanned = 0;
      if (r.code === 803) {
        this.finishLogin(r);
        return;
      }
      if (r.code === 802) {
        this.stuckScanned += 1;
        // 15 次 ≈ 30 秒：服务端一直认为「已扫码未确认」。此时多半是手机端的确认没落到
        // 这个 unikey 上（或确认被吞），给出一条能自己走出来的提示，别让用户干等。
        if (this.stuckScanned === SCANNED_STUCK_POLLS) {
          this.setStatus("已扫码，但服务端一直未确认；若手机上已点确认，请点下方按钮重新扫码", "bad");
          this.addRetryButton("重新扫码");
        } else if (this.stuckScanned < SCANNED_STUCK_POLLS) {
          this.setStatus("已扫码，请在手机上确认");
        }
        return;
      }
      if (r.code === 800) {
        this.stopPolling();
        this.qrEl.addClass("is-expired");
        this.setStatus("二维码已过期", "bad");
        this.addRetryButton("刷新二维码");
        return;
      }
      if (!KNOWN_CODES.has(r.code)) {
        // 800/801/802/803 之外的码必须当场收口。实测风控返回 8821 时旧实现落不到任何
        // 分支，界面会一直停在「已扫码，请在手机上确认」——正是用户报的那个「卡住」。
        this.stopPolling();
        this.addRiskFallback(r);
        return;
      }
      // 801（等待扫码）：保持当前状态文案，不打扰
    } catch (e) {
      if (this.closed) return;
      this.consecutiveErrors += 1;
      const detail = errText(e);
      console.warn(`[Glimpse] 网易云扫码轮询失败（第 ${this.consecutiveErrors} 次）：${detail}`);
      // 失败必须当场说话：旧实现只在连续 5 次后报「网络异常」，在此之前界面一直停在
      // 上一次成功状态（「请在手机上确认」），看起来像卡死
      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        this.stopPolling();
        this.setStatus(`轮询失败：${detail}`, "bad");
        this.addRetryButton("重试");
      } else {
        this.setStatus(`状态查询失败，重试中（${this.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}）：${detail}`, "bad");
      }
    } finally {
      this.inFlight = false;
    }
  }

  /** 服务端拒绝时只留一行事实，解释交给下面面板（避免同一件事说两遍） */
  private describeReject(r: QrLoginCheck): string {
    if (r.code === 8821) return "服务端拒绝：code 8821 · 需要行为验证码";
    return `登录被服务端拒绝（code ${r.code}）：${r.message}`;
  }

  /** 恢复二维码区域（仅在重试/刷新时调用；风控收口是终态，不会回到这里） */
  private clearBlocked(): void {
    this.blockedEl?.remove();
    this.blockedEl = null;
    this.qrEl.removeClass("is-hidden");
    this.titleEl.setText(`扫码登录 · ${QR_LOGIN_PLATFORMS[this.platform]?.name ?? ""}`);
  }

  /**
   * 风控拒绝后的收口。旧实现只把二维码调成半透明、按钮换成「重新扫码」，结果是：
   * 一张死掉的二维码仍占着弹窗正中间，文字说「扫不通」、画面却在请你扫；
   * 而「重新扫码」等于诱导用户重复一个注定被拒的动作，短时间内反复扫只会把风控坐实。
   * 所以这里把二维码整块换掉，主操作直接指向唯一走得通的路（真实浏览器登录）。
   */
  private addRiskFallback(r: QrLoginCheck): void {
    this.stopPolling();
    this.qrEl.addClass("is-hidden");
    this.actionsEl.empty();
    this.titleEl.setText(`登录 · ${QR_LOGIN_PLATFORMS[this.platform]?.name ?? ""}`);
    // 面板已经说清结论，这里只留一行灰色的服务端原话，供排查时对码
    this.setStatus(this.describeReject(r));

    const panel = createDiv({ cls: "gm-qr-login-blocked" });
    panel.createDiv({ cls: "gm-qr-login-blocked-title", text: "扫码登录被网易云拦截" });
    panel.createDiv({
      cls: "gm-qr-login-blocked-desc",
      text: "服务端要求行为验证码（8821），重新扫码也不会通过；短时间内反复扫只会让风控更重。",
    });
    panel.createDiv({
      cls: "gm-qr-login-blocked-hint",
      text: "改用浏览器登录：在弹出的窗口里登录一次，凭证会自动写进 Glimpse，不需要复制粘贴。",
    });
    this.statusEl.insertAdjacentElement("beforebegin", panel);
    this.blockedEl = panel;

    const go = this.actionsEl.createEl("button", { text: "用浏览器登录", cls: "mod-cta" });
    go.addEventListener("click", () => this.startBrowserLogin());
    this.actionsEl.createEl("button", { text: "手动粘贴", cls: "" })
      .addEventListener("click", () => {
        this.close();
        window.open(QR_LOGIN_PLATFORMS[this.platform]?.loginUrl ?? "https://music.163.com", "_blank");
      });
    this.actionsEl.createEl("button", { text: "关闭", cls: "" })
      .addEventListener("click", () => this.close());
  }

  /**
   * 启动仓库内的取件脚本（tools/netease-cookie）：真实浏览器登录 → 脚本抓 MUSIC_U
   * → obsidian:// 回传 → 插件写入设置。失败一律降级为「打开登录页 + 提示手动粘贴」，
   * 不让用户卡在无反馈的状态里。
   */
  private startBrowserLogin(): void {
    if (launchBrowserCookieHelper(this.app) === "spawned") {
      this.close();
      new Notice("已打开浏览器：登录完成后凭证会自动写入，无需粘贴");
      return;
    }
    this.manualFallback();
  }

  private manualFallback(): void {
    window.open(QR_LOGIN_PLATFORMS[this.platform]?.loginUrl ?? "https://music.163.com", "_blank");
    this.setStatus("已打开登录页：登录后复制整行 Cookie，粘进「音乐 → 网易云音乐」", "bad");
    new Notice("未能自动启动取件脚本：请手动复制 Cookie，或双击 tools/netease-cookie/get-cookie.cmd");
  }

  private finishLogin(r: QrLoginCheck): void {
    // 先解析再停轮询：解析抛错时 catch 能给出可读原因、按钮仍可重试。
    // 旧实现在第一行就 stopPolling，任何异常都会让弹窗永久停在「请在手机上确认」。
    let cookie: string | null = null;
    try {
      cookie = applyLoginSetCookie(this.platform, this.stored, r.setCookie);
      // 部分实现把登录凭证放在响应体（`cookie` 字段）而不是 Set-Cookie 头
      if (!cookie && r.bodyCookie) {
        cookie = applyLoginCookieString(this.platform, this.stored, r.bodyCookie);
      }
    } catch (e) {
      this.stopPolling();
      this.setStatus(`已授权，但写入 Cookie 失败：${errText(e)}`, "bad");
      this.addRetryButton("重试");
      return;
    }
    this.stopPolling();
    if (!cookie) {
      console.warn("[Glimpse] 网易云扫码已确认，但未取到登录凭证", {
        status: r.status,
        hasSetCookie: Boolean(r.setCookie),
        hasBodyCookie: Boolean(r.bodyCookie),
      });
      this.setStatus("已授权，但响应里没有 MUSIC_U，请重试或改用手动复制 Cookie", "bad");
      this.addRetryButton("重新扫码");
      return;
    }
    this.setStatus("登录成功", "ok");
    new Notice(`${QR_LOGIN_PLATFORMS[this.platform]?.name ?? "平台"}登录成功，Cookie 已写入并保存`);
    this.onSuccess(cookie);
    this.close();
  }
}
