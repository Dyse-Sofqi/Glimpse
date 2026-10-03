/**
 * 平台登录 Cookie 的「回写 JAR」：把服务端响应头里的 `Set-Cookie` 合并回本地保存的 Cookie。
 *
 * 背景：用户是手工从浏览器 F12 复制一整段 Cookie 粘贴进来的（网易云 MUSIC_U / QQ qm_keyst 均为
 * HttpOnly，读不到 document.cookie）。这段静态字符串不会被更新，因此即使平台在校验接口里
 * 回吐了续期后的新凭证，本地也一直拿旧的去请求 → 过一段时间就「Cookie 过期」，只能重新去 F12 复制。
 *
 * 本模块负责：解析 `Set-Cookie` → 域名 + 平台白名单双重把关 → 与原 Cookie 逐项合并 → 交给持久化回调。
 * 只做「回写」，不做过期预测，也不做登录/刷新（那属于后续步骤）。
 *
 * 安全边界（务必保持）：
 *  1. 域名白名单：只有 host 属于该平台时才接受，避免把 A 平台的凭证写到 B 平台；
 *  2. 名字白名单：只接受明确属于该平台登录态的 Cookie 名，平台塞进来的无关 Cookie
 *     （埋点/AB/地区偏好等）一律不落盘，防止 data.json 里堆积垃圾；
 *  3. 删除语义（`Max-Age=0` / 已过期）不落地：只接受「有值」的续期，删除一律忽略，
 *     否则平台一次清理动作就会把用户粘贴的凭证抹掉。
 */

/** 平台标识（与 MusicSource / platformCookies 的键一致） */
export type CookiePlatform = "netease" | "qq" | "kugou" | "kuwo";

/** 各平台 Cookie 白名单：允许回写的 host 与 Cookie 名 */
export const PLATFORM_COOKIE_SPEC: Record<CookiePlatform, { hosts: string[]; names: string[] }> = {
  netease: {
    hosts: ["music.163.com", "interface.music.163.com", "interface3.music.163.com", "163.com"],
    names: ["MUSIC_U", "MUSIC_A", "MUSIC_R_T", "__csrf", "__remember_me", "os"],
  },
  qq: {
    hosts: ["y.qq.com", "u.y.qq.com", "c.y.qq.com", "qq.com"],
    names: ["qm_keyst", "qqmusic_key", "qqmusic_uin", "uin", "wxuin", "psrf_qqunionid", "psrf_qqopenid", "psrf_qqrefresh_token", "psrf_qqaccess_token", "qqmusic_uin_enc", "qqmusic_key_enc"],
  },
  kugou: {
    hosts: ["kugou.com"],
    names: ["token", "userid", "vip_type", "vip_token", "KugooID", "kg_mid", "kg_dfid"],
  },
  kuwo: {
    hosts: ["kuwo.cn"],
    names: ["kw_token", "userid", "websid", "kw_id"],
  },
};

/** host 是否属于该平台（含子域） */
function hostAllowed(platform: CookiePlatform, host: string): boolean {
  const h = host.toLowerCase();
  return PLATFORM_COOKIE_SPEC[platform].hosts.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Cookie 名是否属于该平台的登录态白名单；拒绝 `__proto__` 等会污染原型链的名字 */
function nameAllowed(platform: CookiePlatform, name: string): boolean {
  if (name === "__proto__" || name === "constructor" || name === "prototype") return false;
  return PLATFORM_COOKIE_SPEC[platform].names.some((n) => n.toLowerCase() === name.toLowerCase());
}

/** Set-Cookie 属性名（不是 Cookie 本身，需剔除） */
const ATTRIBUTES = new Set(["path", "domain", "expires", "max-age", "secure", "httponly", "samesite", "priority", "partitioned"]);

/** 折叠串切分时同样要跳过的属性名（属性后跟的 `=` 不是新 cookie 边界） */
const COOKIE_ATTRS = new Set([...ATTRIBUTES, "comment", "version"]);

/** 一条 Set-Cookie 解析结果：空值或缺名视为无效 */
export interface ParsedSetCookie {
  name: string;
  value: string;
  /** 是否为删除指令（`Max-Age=0` 或 `Expires` 已过期） */
  isDelete: boolean;
}

/** 是否被声明为删除/已过期（此值不落地，见模块头注释第 3 条）；`Max-Age` 存在时优先于 `Expires`（RFC 6265） */
function isExpiredDelete(attrs: string[]): boolean {
  let maxAge: number | null = null;
  let expires = "";
  for (const raw of attrs) {
    const eq = raw.indexOf("=");
    if (eq < 0) continue;
    const k = raw.slice(0, eq).trim().toLowerCase();
    const v = raw.slice(eq + 1).trim();
    if (k === "max-age") {
      const n = Number(v);
      if (Number.isFinite(n)) maxAge = n;
    } else if (k === "expires") {
      expires = v;
    }
  }
  if (maxAge !== null) return maxAge <= 0;
  if (!expires) return false;
  const t = Date.parse(expires);
  return Number.isFinite(t) && t <= Date.now();
}

/**
 * 解析单条 Set-Cookie（splitCookiesString 之后的每一项）。
 * 只取第一个 `name=value` 段，属性段单独用于判断删除语义；非法项返回 null。
 */
export function parseSetCookie(raw: string): ParsedSetCookie | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const parts = text.split(";");
  const first = parts[0] ?? "";
  const eq = first.indexOf("=");
  if (eq <= 0) return null; // 无 `name=` 前缀（如裸属性）直接跳过
  const name = first.slice(0, eq).trim();
  if (!name || ATTRIBUTES.has(name.toLowerCase())) return null;
  const value = first.slice(eq + 1).trim();
  if (!value) return null; // 空值不落地
  return { name, value, isDelete: isExpiredDelete(parts.slice(1)) };
}

/**
 * 解析 `set-cookie` 响应头值：可能是数组（Node 的分隔粒度），也可能是一整串。
 * 浏览器 fetch 会把多个 Set-Cookie 折叠成 `a=1, b=2`，需要按逗号切回；切换时要求逗号后紧跟
 * `token=`（且不能是 Expires 里的日期逗号）。
 */
export function parseSetCookieHeader(value: string | string[] | undefined | null): ParsedSetCookie[] {
  if (value == null) return [];
  const rawItems = Array.isArray(value) ? value : splitSetCookieHeader(value);
  const out: ParsedSetCookie[] = [];
  for (const item of rawItems) {
    const parsed = parseSetCookie(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * 浏览器 fetch 的折叠串按逗号切分（`a=1, b=2` → 两条）。
 * 只有「逗号后紧跟 cookie 名= 或纯 token，且不是日期/时间的续段」才切：
 * `HttpOnly, __csrf=xyz`、`, NMTID=zzz` 切；`Expires=Fri, 13 Jun 2026`、`Domain=a, Path=/` 不切。
 */
export function splitSetCookieHeader(header: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < header.length; i++) {
    const ch = header[i];
    if (ch !== ",") { buf += ch; continue; }
    const attr = lastAttrName(buf);
    // Expires/Domain 的值本身含逗号，这两个属性后面的逗号一律不切
    if (attr === "expires" || attr === "domain") { buf += ch; continue; }
    const rest = header.slice(i + 1);
    const m = /^\s*([A-Za-z0-9_.~-]+)\s*=/.exec(rest);
    const isDateContinuation = /^\s*\d/.test(rest) || /^\s*[A-Za-z]{3},\s/.test(rest);
    if (m && !COOKIE_ATTRS.has(m[1].toLowerCase()) && !isDateContinuation) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** 取缓冲区里最后一个 `;` 分隔段的属性名（无 `=` 的段按属性名返回，空段返回空） */
function lastAttrName(buf: string): string {
  const seg = (buf.split(";").pop() ?? "").trim();
  if (!seg) return "";
  const eq = seg.indexOf("=");
  return (eq < 0 ? seg : seg.slice(0, eq)).trim().toLowerCase();
}

/** 解析 `Cookie` 请求头为有序键值对（值可能含 `=`，按首个 `=` 切分） */
export function parseCookieHeader(header: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const seg of String(header ?? "").split(";")) {
    const part = seg.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    out.push([part.slice(0, eq).trim(), part.slice(eq + 1).trim()]);
  }
  return out;
}

/** 归一化手工粘贴的 Cookie：去掉换行/制表符，压缩多余空格，去掉首尾分号 */
export function sanitizeCookie(value: string): string {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").replace(/^\s*;\s*|\s*;\s*$/g, "").trim();
}

/** 该平台 Cookie 的登录凭证名（用于登录态判断/测试连接提示） */
export const PLATFORM_LOGIN_COOKIE: Record<CookiePlatform, string> = {
  netease: "MUSIC_U",
  qq: "qm_keyst",
  kugou: "token",
  kuwo: "kw_token",
};

/** 该平台 Cookie 里是否含登录凭证（无 = 只是匿名指纹，不代表已登录） */
export function hasLoginCookie(platform: CookiePlatform, value: string): boolean {
  const key = PLATFORM_LOGIN_COOKIE[platform].toLowerCase();
  return parseCookieHeader(value).some(([k, v]) => k.toLowerCase() === key && !!v);
}

/**
 * 合并旧 Cookie 与 Set-Cookie 列表：旧项保序，同名新值原位覆盖，新名追加，返回新串。
 * 无实际变化时返回 null（调用方据此跳过落盘，避免每次请求都写 data.json）。
 */
export function mergeCookieUpdates(
  oldCookie: string,
  updates: ParsedSetCookie[],
): string | null {
  const kept = updates.filter((u) => !u.isDelete);
  if (kept.length === 0) return null;
  const entries = parseCookieHeader(oldCookie);
  const have = new Set(entries.map(([k]) => k.toLowerCase()));
  let changed = false;
  for (const [k, v] of entries) {
    const u = kept.find((x) => x.name.toLowerCase() === k.toLowerCase());
    if (u && u.value !== v) changed = true;
  }
  const rest: ParsedSetCookie[] = [];
  for (const u of kept) {
    if (!have.has(u.name.toLowerCase())) rest.push(u);
  }
  if (rest.length > 0) changed = true;
  if (!changed) return null;
  const merged = entries.map(([k, v]) => {
    const u = kept.find((x) => x.name.toLowerCase() === k.toLowerCase());
    return `${k}=${u ? u.value : v}`;
  });
  for (const u of rest) merged.push(`${u.name}=${u.value}`);
  return merged.join("; ");
}

// --- 运行时状态（按平台） ---

/** 持久化回调：由 MusicManager 注入，负责把新 Cookie 写回设置并落盘 */
export type PlatformCookieSink = (platform: CookiePlatform, cookie: string) => void;

let sink: PlatformCookieSink | null = null;
/** 会话内有效的 Cookie 覆盖值：读接口优先用它，其次回落到设置里的值 */
const jar = new Map<CookiePlatform, string>();
/** 用户本次粘贴的原始值（用于设置页判断「是否已自动续期」） */
const baseline = new Map<CookiePlatform, string>();
/** 各平台最近一次通知落盘的时间：平台若每个请求都轮换 Cookie，避免高频写 data.json */
const lastPersist = new Map<CookiePlatform, number>();
/** 落盘节流窗口：窗口内只更新内存值，磁盘写合并到下一次（值不会丢） */
const PERSIST_THROTTLE_MS = 30000;

/** 注入持久化回调（幂等；重复注入只换回调，不清会话内覆盖值） */
export function configureCookieSink(next: PlatformCookieSink | null): void {
  sink = next;
}

/** 平台 Cookie 的当前值：会话内覆盖值优先，其次读持久化设置 */
export function getJarCookie(platform: CookiePlatform, stored?: string): string {
  const live = jar.get(platform);
  if (live) return live;
  return stored ?? "";
}

/** 用户粘贴的原始值（未被 Set-Cookie 更新过的那份），用于「是否已自动续期」展示 */
export function getBaselineCookie(platform: CookiePlatform): string {
  return baseline.get(platform) ?? "";
}

export function isCookiePlatform(v: string): v is CookiePlatform {
  return v === "netease" || v === "qq" || v === "kugou" || v === "kuwo";
}

/** 读取持久化设置里的平台 Cookie（供 UI 展示/判断是否已自动续期） */
export function getStoredPlatformCookie(settings: { platformCookies?: Record<string, string> } | null | undefined, platform: CookiePlatform): string {
  return sanitizeCookie(settings?.platformCookies?.[platform] ?? "");
}

/**
 * 请求开始前调用：确保会话内值已从设置播种。
 * - 从未播种（或设置为空）→ 用传入的持久化值播种，同时记录 baseline；
 * - 已播种 → 以传入的持久化值为准回写设置（设置页「清除」/重新粘贴都能立刻生效），
 *   并把 baseline 更新为用户新粘贴的值。
 */
export function hydratePlatformCookie(platform: CookiePlatform, stored: string): string {
  const s = sanitizeCookie(stored);
  const live = jar.get(platform);
  if (!s) {
    if (live) jar.delete(platform);
    baseline.delete(platform);
    return "";
  }
  if (s !== live) jar.set(platform, s);
  // baseline = 用户手上那份原始值（设置页拿它判断「现在的值是否已被自动续期」）
  if (s !== baseline.get(platform)) baseline.set(platform, s);
  return s;
}

/**
 * 按平台取 Cookie：优先会话内（可能已被续期）的值；为空时用调用方传入的持久化值播种后再用。
 * 请求前调用一次即完成播种，后续响应里的续期才有对象可合并（冷启动第一发请求的关键）。
 */
export function resolvePlatformCookie(platform: CookiePlatform, stored?: string): string {
  const live = jar.get(platform);
  if (live) return live;
  return hydratePlatformCookie(platform, stored ?? "");
}

export interface RefreshResult {
  /** 合并后的新 Cookie（未变化时为调用方传入的原值） */
  cookie: string;
  /** 是否发生实际变化 */
  changed: boolean;
  /** 本次被更新的 Cookie 名（供日志/调试） */
  updatedKeys: string[];
}

/**
 * 传输层钩子：请求收到响应后调用，把响应头里的续期 Cookie 合并回本地。
 * 只有 host 命中平台白名单、且 Cookie 名命中白名单时才落地；未变化时不做任何事。
 */
export function refreshCookieFromResponse(
  url: string,
  responseHeaders: Record<string, string> | undefined | null,
  platform?: string,
): RefreshResult {
  const original = platform && isCookiePlatform(platform) ? getJarCookie(platform) : "";
  const result: RefreshResult = { cookie: original, changed: false, updatedKeys: [] };
  if (!platform || !isCookiePlatform(platform) || !responseHeaders || !original) return result;
  let host = "";
  try { host = new URL(url).hostname; } catch { return result; }
  if (!hostAllowed(platform, host)) return result;

  const parsed = parseSetCookieHeader(responseHeaders["set-cookie"]);
  if (parsed.length === 0) return result;
  const allowed = parsed.filter((c) => nameAllowed(platform, c.name));
  if (allowed.length === 0) return result;

  const merged = mergeCookieUpdates(original, allowed);
  if (!merged) return result;

  const before = new Map(parseCookieHeader(original));
  const after = new Map(parseCookieHeader(merged));
  const updatedKeys = [...after.entries()].filter(([k, v]) => before.get(k) !== v).map(([k]) => k);

  jar.set(platform, merged);
  // baseline 的更新时机是「用户重新粘贴」（hydratePlatformCookie）；这里只兜底：
  // 续期前没有 baseline 时，把合并前的值当作原始值，避免设置页显示成「已自动续期」
  if (!baseline.has(platform)) baseline.set(platform, original);
  result.cookie = merged;
  result.changed = true;
  result.updatedKeys = updatedKeys;
  // 内存值立即生效；落盘首次必写（否则重启会丢掉刚续期的凭证），之后按平台节流，
  // 避免平台每请求轮换 Cookie 时高频写 data.json（节流窗口内只更新内存值，值不会丢）
  const now = Date.now();
  const last = lastPersist.get(platform);
  if (sink && (last === undefined || now - last >= PERSIST_THROTTLE_MS)) {
    lastPersist.set(platform, now);
    sink(platform, merged);
  }
  return result;
}

/** 仅测试/调试用：清空会话内状态 */
export function resetCookieJar(): void {
  jar.clear();
  baseline.clear();
  lastPersist.clear();
}
