/**
 * 诊断：网易云接口到底会不会「续期」Cookie？
 *
 * 背景：插件的 Cookie JAR（src/music/cookieJar.ts）只有在响应头出现 Set-Cookie 时才能回写。
 * 网易云的 MUSIC_U 是登录时一次性下发的长效 token，实测之后所有接口都不回吐 Set-Cookie，
 * 因此这个平台不存在滚动续期 —— 凭证失效只可能是被吊销（风控 / 异地登录 / 改密码）。
 * 本脚本就是那条结论的证据采集器：带着本地保存的凭证请求一次账号接口，只打印
 * 「状态码 + Set-Cookie 条数」，不写任何东西。
 *
 * 用法（在插件目录下）：
 *   node tools/netease-cookie/probe-setcookie.js
 *   node tools/netease-cookie/probe-setcookie.js "D:/vault/.obsidian/plugins/Glimpse/data.json"
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const dataPath = process.argv[2] || path.join(__dirname, "..", "..", "data.json");

function readCookie() {
  if (!fs.existsSync(dataPath)) {
    console.error(`找不到 ${dataPath}\n请把 data.json 路径作为第一个参数传入。`);
    process.exit(1);
  }
  const music = JSON.parse(fs.readFileSync(dataPath, "utf8")).music || {};
  const cookie = String(music.platformCookies?.netease || "");
  if (!cookie) {
    console.error("data.json 里没有网易云凭证（music.platformCookies.netease 为空）。");
    process.exit(1);
  }
  return { cookie, stamp: music.platformCookiesUpdatedAt?.netease };
}

function probe(url, cookie, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://music.163.com/",
          Cookie: cookie,
          ...(opts.headers || {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          const setCookie = res.headers["set-cookie"] || [];
          let loggedIn = "未知";
          try {
            const data = JSON.parse(body);
            loggedIn = Number(data?.profile?.userId ?? 0) > 0 ? "是" : "否";
          } catch {
            /* 非 JSON 响应：保持未知 */
          }
          console.log(`\n── ${url}`);
          console.log(`   状态码        : ${res.statusCode}`);
          console.log(`   已登录        : ${loggedIn}`);
          console.log(`   Set-Cookie 条数: ${setCookie.length}`);
          for (const raw of setCookie) {
            const name = String(raw).split("=")[0];
            console.log(`     - ${name}${/MUSIC_U/.test(raw) ? "   ← 含 MUSIC_U（会续期！）" : ""}`);
          }
          resolve();
        });
      },
    );
    req.on("error", (e) => {
      console.log(`\n── ${url}\n   请求失败: ${e.message}`);
      resolve();
    });
    req.end(opts.body);
  });
}

(async () => {
  const { cookie, stamp } = readCookie();
  console.log(`凭证来源: ${dataPath}`);
  console.log(`凭证长度: ${cookie.length} 字符`);
  console.log(`续期落盘: ${stamp ? new Date(stamp).toLocaleString("zh-CN") : "从未（符合预期）"}`);
  await probe("https://music.163.com/api/nuser/account/get", cookie);
  console.log("\n结论：Set-Cookie 为 0 条即证明该平台不做续期，凭证失效只能重新获取。");
})();
