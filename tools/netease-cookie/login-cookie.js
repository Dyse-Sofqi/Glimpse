/**
 * 网易云 Cookie 取件器 —— 真实浏览器方案
 *
 * 背景：网易云对「扫码登录」做了账号级风控（client/login 返回 8821，要求行为验证码），
 * 插件内直连 Node https 的二维码流程会被拦，换协议（type=1/3）、换 UA、补 Cookie 都无效。
 * 实测有效路径：用真实浏览器（Edge，Chromium 内核）正常登录，风控不拦，登录后直接从
 * 浏览器会话读 Cookie —— 比 F12 手动翻网络面板稳得多。
 *
 * 用法：双击同目录的 get-cookie.cmd，或 node login-cookie.js
 * 流程：拉起 Edge（独立配置目录）→ 你登录 → 脚本每 2 秒轮询 → 命中 MUSIC_U 后
 *       ① 用账号接口验证并打印昵称/UID ② 写 txt ③ 写 pending-cookie.json
 *       ④ 唤起 obsidian://glimpse-netease-cookie → 插件直接把凭证写进音乐设置，
 *          并用 Obsidian 原生弹窗告知结果（不必再回设置页粘贴）
 * 复用：登录态保存在 profile 目录，下次运行秒取，不必重新登录；换账号删该目录即可
 *
 * 可用环境变量覆盖：
 *   GLIMPSE_NETEASE_DIR     输出与配置目录的父目录（默认 E:\_Software\_work，不存在则用系统临时目录）
 *   GLIMPSE_NETEASE_PROFILE 浏览器配置目录（默认 <GLIMPSE_NETEASE_DIR>/netease-profile）
 *   GLIMPSE_BROWSER_CHANNEL 浏览器通道（默认 msedge；装了 Chrome 可设 chrome）
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const { spawn } = require("child_process");

/** 从脚本位置向上找含 node_modules/playwright-core 的目录，避免把插件路径写死 */
function findPluginRoot(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "node_modules", "playwright-core"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const PLUGIN_ROOT = findPluginRoot(__dirname);
if (!PLUGIN_ROOT) {
  console.error("[x] 没找到 node_modules/playwright-core。");
  console.error("    请在插件目录执行 npm install（playwright 是本项目的正式依赖）。");
  process.exit(1);
}

const WORK_DIR = process.env.GLIMPSE_NETEASE_DIR
  || (fs.existsSync("E:\\_Software\\_work") ? "E:\\_Software\\_work" : path.join(os.tmpdir(), "glimpse-netease"));
const PROFILE_DIR = process.env.GLIMPSE_NETEASE_PROFILE || path.join(WORK_DIR, "netease-profile");
const OUT_FULL = path.join(WORK_DIR, "netease-cookie.txt");
const OUT_SLIM = path.join(WORK_DIR, "netease-cookie-slim.txt");
const CHANNEL = process.env.GLIMPSE_BROWSER_CHANNEL || "msedge";
const LOGIN_URL = "https://music.163.com/#/login";
/** 回传给插件的文件名（插件侧只认这个名字，见 src/music/cookie-import.ts） */
const PENDING_FILE = path.join(WORK_DIR, "pending-cookie.json");
const OBSIDIAN_ACTION = "glimpse-netease-cookie";
const TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 2000;
/** 登录必需的键：其余（Hm_* / WM_* / gdxidpyhxdE 等）都是埋点，留着只会让粘贴串变长 */
const PRIMARY = ["MUSIC_U", "__csrf", "NMTID", "_ntes_nuid", "MUSIC_A", "__remember_me", "_iuqxldmzr_"];

const { chromium } = require(path.join(PLUGIN_ROOT, "node_modules", "playwright-core"));

/** 从浏览器会话读凭证；含 MUSIC_U 才算登录成功 */
async function readCookies(ctx) {
  const all = await ctx.cookies();
  const music = all.filter((c) => /(^|\.)163\.com$/.test(c.domain.replace(/^\./, "")));
  const map = new Map();
  for (const c of music) map.set(c.name, c.value); // 同名取后者（域名更具体的通常在后）
  if (!map.get("MUSIC_U")) return null;
  const full = music.map((c) => `${c.name}=${c.value}`).join("; ");
  const slim = PRIMARY.filter((k) => map.has(k)).map((k) => `${k}=${map.get(k)}`).join("; ");
  return { full, slim, map };
}

/** 用凭证调一次账号接口：既能验证可用性，也把昵称打印出来让用户确认是哪个号 */
function fetchAccount(cookie) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "music.163.com",
      path: "/api/nuser/account/get?timestamp=" + Date.now(),
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://music.163.com",
        Cookie: cookie,
      },
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(body);
          const p = j && j.profile;
          resolve(p ? { ok: true, nickname: p.nickname, uid: p.userId, vip: p.vipType } : { ok: false, code: j && j.code });
        } catch { resolve({ ok: false }); }
      });
    });
    req.setTimeout(8000, () => req.destroy());
    req.on("error", () => resolve({ ok: false }));
    req.end();
  });
}

function copyToClipboard(text) {
  return new Promise((resolve) => {
    try {
      const p = spawn("clip.exe", []);
      p.on("close", (code) => resolve(code === 0));
      p.on("error", () => resolve(false));
      p.stdin.write(text, "utf8");
      p.stdin.end();
    } catch { resolve(false); }
  });
}

/**
 * 用 ShellExecuteEx 打开 URI。
 *
 * 实测（本机）：`rundll32 url.dll,FileProtocolHandler` 被安全策略当 LOLBin 拦掉；
 * `cmd /c start` 会把 URI 里的 `%3A` 当环境变量展开，链接被撕坏；`explorer.exe <url>`
 * 把它当文件路径，退出码 1。只有 PowerShell 的 Start-Process 能稳定送达。
 */
function shellOpen(uri) {
  return new Promise((resolve) => {
    const ps = "Start-Process -FilePath '" + uri.replace(/'/g, "''") + "'";
    try {
      const p = spawn("powershell", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps],
        { stdio: "ignore", windowsHide: true });
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    } catch { resolve(false); }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 结果回传：写 pending-cookie.json + 唤起 obsidian://glimpse-netease-cookie。
 * 弹窗交给 Obsidian 自己渲染（原生 Modal），不再用系统 MessageBox —— 那是另一个程序的观感，
 * 中文文案经 PowerShell 单引号传递时也容易把 \r\n 变成字面量。
 *
 * 送达判据：插件读完回传文件会立即删除它。只凭「进程退出码 0」会误报 —— URI 可能被安全
 * 软件吞掉，用户那边什么都不会出现。所以这里轮询文件是否消失，超时即认为没送到。
 */
async function notifyObsidian(payload, waitMs = 15000) {
  let file = null;
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(payload), "utf8");
    file = PENDING_FILE;
  } catch (e) {
    console.error("[!] 无法写回传文件：" + e.message);
    return false;
  }
  const uri = "obsidian://" + OBSIDIAN_ACTION
    + "?source=" + OBSIDIAN_ACTION
    + "&file=" + encodeURIComponent(file);
  const opened = await shellOpen(uri);
  if (!opened) console.error("[!] 唤起 Obsidian 失败（Start-Process 返回非 0）");

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(500);
    if (!fs.existsSync(PENDING_FILE)) return true; // 插件读走即删除
  }
  return false;
}

(async () => {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  console.log("[1/4] 启动 " + CHANNEL + "（独立配置目录，不影响日常浏览器）…");

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: CHANNEL,
      headless: false,
      viewport: null,
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    });
  } catch (e) {
    console.error("[x] 启动浏览器失败：" + e.message);
    console.error("    若提示配置目录被占用，先把弹出的浏览器窗口全部关掉再试。");
    await notifyObsidian({
      status: "error",
      message: "启动浏览器失败：" + e.message + "。若提示配置目录被占用，请把残留的浏览器窗口全部关掉后重试。",
    });
    process.exit(1);
  }

  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" }).catch(() => {});

  let grabbed = await readCookies(ctx).catch(() => null);
  if (grabbed) {
    console.log("[i] 配置目录里已有登录态，直接取用（换账号请删 " + PROFILE_DIR + "）");
  } else {
    console.log("[2/4] 请在弹出的浏览器里登录网易云（扫码 / 密码 / 短信都行）…");
  }

  const deadline = Date.now() + TIMEOUT_MS;
  while (!grabbed && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (ctx.pages().length === 0) {
      console.log("[!] 浏览器已关闭，退出。");
      process.exit(0);
    }
    grabbed = await readCookies(ctx).catch(() => null);
  }
  if (!grabbed) {
    console.error("[x] 超时：十分钟内没有检测到登录。");
    await notifyObsidian({
      status: "error",
      message: "十分钟内没有检测到登录，已退出。重跑一次即可，登录成功后会自动抓取。",
    });
    await ctx.close().catch(() => {});
    process.exit(1);
  }

  console.log("[3/4] 已捕获，全量 " + grabbed.full.length + " 字符 / 精简 " + grabbed.slim.length + " 字符");
  const who = await fetchAccount(grabbed.slim);
  if (who.ok) console.log("      验证通过：昵称「" + who.nickname + "」 UID " + who.uid + " vipType " + who.vip + (who.vip ? "" : "（非会员，VIP 曲目仍不可下）"));
  else console.log("      [!] 账号接口未确认（code=" + who.code + "），但 MUSIC_U 已存在，可先试用");

  fs.writeFileSync(OUT_FULL, grabbed.full, "utf8");
  fs.writeFileSync(OUT_SLIM, grabbed.slim, "utf8");
  // 剪贴板与 txt 保留为兜底：万一插件没重载，用户仍能手动粘贴，不必再跑一遍浏览器
  const copied = await copyToClipboard(grabbed.slim);
  console.log("      已写入 " + OUT_SLIM);
  console.log(copied ? "      ✓ 已复制到剪贴板（兜底用）" : "      [!] 剪贴板写入失败，需要时手动打开上面的 txt 复制");

  await ctx.close().catch(() => {});

  console.log("[4/4] 正在交给 Obsidian…（等待插件接收）");
  const handed = await notifyObsidian({
    status: "ok",
    cookie: grabbed.slim,
    nick: who.ok ? who.nickname : "",
    uid: who.ok ? who.uid : 0,
    vip: who.ok ? who.vip : 0,
  });
  if (handed) {
    console.log("[√] 已送达：凭证直接写入 Glimpse 音乐设置，无需粘贴");
  } else {
    console.error("[!] 没能送达 Obsidian（15 秒内未见插件接收）。可能原因：");
    console.error("    1) 插件未重载 → 设置 → 第三方插件 → Glimpse 关掉再开启；");
    console.error("    2) 安全软件拦截了唤起动作；");
    console.error("    兜底：剪贴板里已有精简版，到设置里展开「网易云音乐」行 Ctrl+V 即可。");
    process.exitCode = 1;
  }
  console.log("[√] 完成");
})();
