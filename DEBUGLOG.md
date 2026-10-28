# 调试日志（DEBUGLOG）

关键避坑记录，供后期维护快速定位。按版本聚合。

## 未发布 (2026-09-23)

### 「自动续期」对该平台一直是空转（2026-10-28）

**现象：** 用户反问「自动续期不是之前就做过吗」——如果早有续期，为什么凭证还是需要重取？

**查证：** 机制确实存在（`cookieJar.ts` 的 `refreshCookieFromResponse` + `downloadManager` 的 `writeBackCookieRefresh`，域名/名字双重白名单）。但两条硬证据说明它从未生效：

1. 两个 vault 的 `data.json` 里 `platformCookiesUpdatedAt.netease` 都是 0 —— 一次都没落过盘；
2. 带有效凭证请求 `https://music.163.com/api/nuser/account/get`，返回 `200`、账号可读，但 `set-cookie` **0 条**。

**结论：** `MUSIC_U` 是登录那一刻一次性下发的长效 token，之后所有 weapi/eapi 请求都不回吐新值。这个平台不存在滚动续期，凭证失效只可能是被**吊销**（风控 `8821` / 异地登录 / 改密码），而吊销后的旧值没有任何响应头能救回来。机制对 QQ（`qm_keyst` 随请求刷新）有效，对网易云是死代码。

**修复：**

- 新增 `src/music/login-expired.ts`：`reportNeteaseLoginExpired()` 弹 Obsidian 原生 Modal，主按钮「一键登录」直接拉起取件器，10 分钟节流防多请求叠窗；宿主在 `onload` 用 `configureLoginExpiredHost()` 注入（同 cookieJar 的 sink 模式，不必把 plugin 透传到请求层）；
- `downloadManager` 两处上报：账号歌单接口（`code≠200` 或被吊销的 `profile` 为空）、VIP 下载链路（原本会被静默降级成 128k 外链，用户只看到「无损没了」）；
- 文案按平台说实话：README 两条、`docs/netease-login.md` 新增「为什么网易云没有自动续期」一节、设置页提示、导入成功弹窗的「有效期」行；
- 新增 `tools/netease-cookie/probe-setcookie.js`：随时复验 `Set-Cookie` 条数，只读不写。

**避坑：**

1. **「实现了机制」不等于「机制在生效」** —— 判断标准不是代码有没有，而是有没有可观测的触发记录（时间戳、计数）。没有观测点的功能，文档里写「会自动 X」就是在撒谎。
2. **平台差异要按平台措辞，不要写成一锅** —— 同一段「会自动续期」同时描述 QQ 和网易云，前者为真、后者为空转，读者只会记住失败的那次。
3. **静默降级会掩盖失效** —— 拿不到 VIP 直链就退回 128k 外链，看代码是「优雅降级」，看体验是「会员白买了」。凡是降级路径，都要有一条显式上报把原因说出来。

### 默认入口还在走一条必然失败的路（2026-10-28）

**现象：** 用户看了风控说明后反问：既然 `8821` 是必然，为什么还要先扫码、撞墙、再给替代方案？

**判断：** 上一版把「扫码」当主路径、浏览器当兜底，逻辑上是「先试可能可行的」，但前提不成立 —— `8821` 是**账号级**风控（看账号历史行为 + 客户端指纹），对受影响的账号是确定性结果，不是概率事件。于是主路径的期望收益为零，成本是「扫一次码 + 手机上确认一次 + 等轮询」。

**修复：**

- 新增 `src/music/browser-login.ts`：`findCookieHelper()` + `launchBrowserCookieHelper()`，把「定位并拉起取件器」从弹窗里抽出来复用；
- 设置页那行按钮改为「**一键登录**」（`mod-cta`，排第一）→ 直接 `spawn` 取件器，成功即 Notice「已打开浏览器…」，失败自动降级「打开登录页 + 手动粘贴」；
- 「扫码」降级为第二个普通按钮（备选，仅未被风控的账号有效），`8821` 面板里的主按钮仍是同一个「用浏览器登录」；
- `.gm-cookie-body-actions` 加 `flex-wrap: wrap`（这一行现在有 5 个按钮）；
- 文档：README「网易云登录」改为「默认入口：一键登录」，`docs/netease-login.md` 方案 A 增加设置页入口。

**避坑：**

1. **默认动作要按「期望收益 / 成本」选，不是按「理论上可能」选**：只要失败是确定性的，就不该放在默认路径上。留着当备选可以，别让它占主按钮。
2. **「失败后再给替代方案」等于让用户先付一次许可费**：能预判的失败应该提前消除，而不是设计成流程的一环。

### 风控收口「留着死二维码」（2026-10-28）

**现象：** `8821` 之后弹窗里二维码仍在正中，只是变淡了；红字说「扫码这条路走不通」，画面却还在请你扫。用户反馈「成这样了」。

**原因：** 上一版 `addRiskFallback` 只做了 `qrEl.addClass("is-expired")`（`opacity: .25`）+ 换按钮。**结论和画面打架**：一个 184×184 的死码仍是视觉焦点，而按钮「打开登录页」把「怎么拿 Cookie」这一步又丢回给用户（F12、找请求、复制整行），文案里还写着 `tools/netease-cookie` 这种开发路径。

**修复：**

- 风控是**终态**：`qrEl.addClass("is-hidden")` 整块撤掉（不是调透明度），标题从「扫码登录 · 网易云音乐」改为「登录 · 网易云音乐」；
- 原位换成 `.gm-qr-login-blocked` 面板（左侧 3px 红边 + 次级底色）：「扫码登录被网易云拦截 / 服务端要求行为验证码（8821），重扫也不会通过 / 改用浏览器登录，凭证会自动写入，不需要复制粘贴」；
- 原红字降级为一行灰色脚注（`服务端拒绝：code 8821 · 需要行为验证码`），结论由面板承担，不再同一件事说两遍；
- 主按钮改为「**用浏览器登录**」= `child_process.spawn("node", [tools/netease-cookie/login-cookie.js], { cwd, detached, stdio:"ignore", windowsHide:true })`，成功后关弹窗 + Notice；`error`/无 `require` 时降级为「打开登录页 + 提示手动粘贴」；
- 脚本路径不写死：`app.vault.adapter.getBasePath()` + `vault.configDir`，先试 `plugins/Glimpse/…`，再遍历 `plugins/*` 找真含 `tools/netease-cookie/login-cookie.js` 的目录（插件文件夹改名也不失效）。

**避坑：**

1. **不要用「变淡」表达「不可用」**：透明度只是让元素退让，它仍占位、仍是视觉中心。状态与画面必须一致 —— 死的控件要么换掉，要么撤掉。
2. **收口要给「下一步」，不是「换一条说明」**：用户卡住时的成本在「怎么拿到凭证」，不在「为什么失败」。把脚本入口做进按钮，比写清 F12 步骤有用得多。
3. 插件内起外部进程可以，但**必须显式降级**：`window.require` 可能不存在、`node` 可能不在 PATH、脚本可能被改名。任一步失败都要退回「打开登录页」，否则点下去毫无反应。

### 取件器用系统 MessageBox 提醒（2026-10-28）

**现象：** 取件脚本抓完 Cookie 弹出一个 Windows 消息框：字体是系统宋体、按钮是「确定」，和 Obsidian 完全不搭；弹窗正文里的换行还显示成字面量 `\r\n`。

**原因：** 报错文案走 `PowerShell → System.Windows.Forms.MessageBox`。两个问题叠在一起：一是这是**另一个程序**的界面，插件无法控制观感；二是文案经 `-Command` 单引号串拼接，`\\r\\n` 在 JS 里已是反斜杠字面量，PowerShell 又不解释它，于是原样打印。

**修复：**

- 脚本不再弹任何系统对话框，改为写 `pending-cookie.json` + 唤起 `obsidian://glimpse-netease-cookie?source=…&file=…`。**触发方式实测只留下一种可用**（见避坑 4），最终用 PowerShell `Start-Process -FilePath '<uri>'`。
- 新增「送达判据」：插件读完回传文件会立刻删除它，脚本轮询该文件是否消失（≤15 秒）才能确认送到。只凭子进程退出码会误报 —— 实测第一次跑完脚本打印「已交给 Obsidian」，而插件根本没收到。
- 新增 `src/music/cookie-import.ts`：`registerObsidianProtocolHandler` 收到后校验（文件名必须是 `pending-cookie.json`、≤64KB、必须含 `MUSIC_U=`、必须带 `source` 标记）→ 写入 `settings.music.platformCookies.netease` → `hydratePlatformCookie` 播种 → `saveSettings` → 读后删除回传文件。
- 结果用 Obsidian 原生 `Modal` + `Setting` 呈现（账号 / 字符数 / 会员 / 续期），带「打开音乐设置」按钮（`app.setting.open()` + `openTabById`，先改 `settingsTab.activeMainTab = "music"` 才落在音乐页）。
- **顺带取消了粘贴这一步**：凭证直接落库，用户从「复制→切窗口→展开行→粘贴→测试」缩成「看一眼弹窗」。
- 失败/超时也走同一通道（`status: "error"` + `message`），用户在 Obsidian 里读到中文原因，不必回控制台翻日志。剪贴板与 txt 保留作兜底（插件未重载时仍可手粘）。

**避坑记录：**

1. **别用系统对话框给应用内工具做提示**：跨程序弹窗既不能跟随主题，也无法携带应用内的下一步动作。有宿主的（Obsidian / VS Code / 浏览器）一律走宿主自己的 UI。
2. **URI 回传是「脚本 → 应用」最短的路**，但要设白名单：只认约定文件名 + 内容特征（`MUSIC_U=`），否则任意网页都能构造 `obsidian://` 往设置里写值。
3. **URI 里的路径可能被二次编码**：`%5C` 不一定被解析层还原，插件侧解码一次再交给 `fs`，否则读不到文件；`E:////_Software////_work` 这种畸形路径 `fs` 反而能容忍（Windows 会归一化），别因此以为编码正确。
4. **唤起自定义协议只有 ShellExecuteEx 一条路可靠**：本机实测 —— `url.dll,FileProtocolHandler` 被安全策略当 LOLBin 拦掉；`cmd /c start` 会把 URI 里的 `%3A` 当环境变量展开，链接被撕成 `E:%2F...`；`explorer.exe <url>` 当文件路径处理，退出码 1。只有 PowerShell `Start-Process -FilePath '<uri>'` 能稳定送达。别为了"少起一个进程"换更轻的方式，那正是静默失败的地方。
5. **投递 ≠ 送达**：写完文件、起完子进程不等于对方收到。判据要用业务侧的副作用（插件读后删文件），否则脚本会打印「已交给 Obsidian」而用户屏幕上什么都没有。

### 扫码被风控后仍给「重新扫码」（2026-10-28）

**现象：** 扫码确认后服务端回 8821，弹窗把二维码原样留在上面，主按钮是「重新扫码」，红色说明占了 5 行。

**问题：** 8821 是账号级风控，重扫只会再撞一次，频繁重试还会把风控坐实 —— 这个按钮等于诱导用户做一件注定失败、且有副作用的事。说明文字里既讲原理又讲三种替代方案，用户读完仍不知道该点哪。

**修复（`src/music/qrLogin.ts`）：** 风控分支改走 `addRiskFallback()` —— 二维码置灰（`is-expired`，语义上它确实失效了），主按钮换成「打开登录页」（真实浏览器登录，风控不拦），次按钮「关闭」，不再提供重扫。文案缩成一句结论 + 一句出路。

**避坑记录：** 界面上**每一个可点的按钮都要有一个能成功的前景**。明知会失败还摆着「重试」，比不给按钮更糟。

### 网易云扫码登录「授权后仍停在『请在手机上确认』」（2026-10-28）

**现象：** 手机扫码并在 App 里确认授权后，`QrLoginModal` 的状态一直停在「已扫码，请在手机上确认」（802），既不成功也不报错。

**定位：** 先用 WebFetch 直连两个接口核对协议仍有效 —— `unikey?type=1` 返回 `{code:200,unikey}`，未知 key 返回 `{code:800,"二维码不存在或已过期"}`，说明 801/802/803 语义没变、接口没下线。问题在客户端这一侧，三处叠加：

1. **失败完全静默**：`pollOnce` 的 catch 只在连续 5 次后改文案，之前界面停在上一次**成功**状态。而超时是 8 秒、interval 2 秒（`inFlight` 会跳过重叠），5 次失败要等 40 秒 —— 用户看到的就是「卡在 802」。扫码确认后网易若返回 502（官方文档明确记过这个坑：「如扫码后返回 502，则需加上 noCookie」），`JSON.parse` 抛错 → 全被吞掉。
2. **`finishLogin` 先 `stopPolling()` 再解析 Cookie**：`applyLoginSetCookie` 或 sink 一旦抛错，轮询已停、异常又被 `pollOnce` 的 catch 吞掉 → 弹窗**永久**停在 802，连重试按钮都没有。
3. **轮询可能是「另一个客户端」**：`createQrLoginSession` 丢掉了 unikey 响应里的 `Set-Cookie`（NMTID 等），轮询也不回传；浏览器扫码时这层由 Cookie 罐自动完成。同时两个 URL 都没有 `timestamp`、没有禁缓存头，中间层缓存住第一次的 802 就会一直读到旧状态。

**修复（`src/music/qrLogin.ts`）：**

- 会话 Cookie 串联：`mergeSessionCookies()` 把 unikey/轮询响应里的 `Set-Cookie` 合并进请求侧 `Cookie` 头（仅内存、不过白名单——它只是会话上下文，不落盘）；`QrLoginSession.cookies` 随每次轮询更新。
- 请求层：两个 URL 都带 `&timestamp=`，固定头加 `Cache-Control/Pragma: no-cache`、`Accept-Encoding: identity`（Node 不自动解压，gzip 体会让 JSON.parse 失败）、`Accept: application/json`；跟随 3xx（803 有时经跳转中转）并带上跳转前下发的 Cookie。
- 失败可见：catch 里**当场**把原因写进状态行（`状态查询失败，重试中（1/4）：HTTP 502 …`），非 JSON 响应带 HTTP 状态码与 120 字符片段；阈值降到 4 次、超时降到 6 秒。
- `finishLogin` 先解析后停轮询，全包 `try/catch`，异常/无凭证都给重试按钮；803 若 `Set-Cookie` 里没有凭证，回退解析响应体 `cookie` 字段（新增 `applyLoginCookieString`，与 `applyLoginSetCookie` 共用 `commitLogin`）。
- 后台节流兜底：窗口 `focus` 时立刻补一次查询（扫码时 Obsidian 在后台，Chromium 会节流定时器）。
- 802 连续 15 次（≈30 秒）后提示并可重新扫码，不再无限干等。

**避坑记录：**

1. **「状态不动」≠「状态没变」**：轮询失败不更新 UI，是这类弹窗最容易骗人的地方 —— 只要有一处 catch 只计数不说话，用户看到的就是「卡在上一步」。**任何轮询循环的失败都必须当场写进可见状态。**
2. **收尾函数的第一行不要做不可逆动作**：`stopPolling()` 放在解析之前，等于把所有异常都变成「永久卡死」。先算出结果，再停。
3. **裸 HTTP 客户端要自己当 Cookie 罐**：浏览器里的扫码登录和 `https.request` 里的不是同一件事，`Set-Cookie` 不接就是两套会话；同理 `timestamp`/`no-cache` 对状态接口不是可选优化。
4. 无法实测扫码（本机 shell 沙箱不可用，跑不了 `npm run build`，也起不了脚本），所以这一版把「可诊断」排在「猜根因」前面：失败原因直接显示在弹窗上，用户下次一试就能定位到具体环节。

**结论更正（同日晚，shell 恢复后用探针实测）：真凶是 `code 8821` 风控，不是上面的三处实现缺陷。**

用 `E:\_Software\_work\qr_probe.js` 复刻同一套请求序列，手机扫码确认后服务端返回的序列是：

```
#18 code=801  等待扫码
#19 code=802  授权中          ← 手机端确实确认成功了
#20 code=8821 请切换其他登录方式或升级新版本再试
#21..#38 code=8821（每 2s 重复，持续到过期）
```

也就是说扫码链路（unikey → 801 → 802）完全正常，凭证签发的最后一步被**账号级风控**拦住了。佐证：改用 eapi + `type=3` + 客户端设备指纹的开源实现（dsh-netease-music）README 同样写着「会出现 8821，需要行为验证码，暂不支持扫码登录」；`ncmctl` 也标了同一坑。所以换协议、换 UA、补 Cookie 都绕不过去。

**真正的代码 bug 是「码不认识就被吞掉」**：`pollOnce` 只处理 800/801/802/803，8821 落空 → 走 `// 801：保持当前文案不打扰` 那条路，界面就永远停在 802 的「已扫码，请在手机上确认」；而 802 卡顿计数只在 `code === 802` 时累加，也不会触发 30 秒提示。**任何未知状态码都会让弹窗伪装成「还在等你确认」。**

修复：新增 `KNOWN_CODES = {800,801,802,803}`，其余码一律 `stopPolling()` + 红字 `登录被服务端拒绝（code X）：<服务端原话>` + 「重新扫码」按钮；`describeReject()` 对 8821 追加「网易云对扫码登录做了风控，可稍后重试，或改用手动复制 Cookie」。

**避坑记录（追加）：**

5. **协议只覆盖已知码，未知码必须走拒绝分支**：状态机的 `else` 一旦写成「不打扰」，就等于把服务端的拒绝伪装成「进行中」。宁可在未知码上吵一次。
6. **排查顺序应该是「先看服务端原话，再改客户端」**：这次先按经验改了三处（静默失败、stopPolling 顺序、Cookie 罐），都对、都不是根因；探针一跑，10 秒就看到 8821。有 shell 时优先写探针复刻请求，而不是对着 UI 猜。

### 高亮索引漏掉含等号的高亮（2026-10-28）

**现象：** `长歌门.md` 的高亮索引一条都不显示（面板空白），但笔记里的 `==…==` 明明在编辑器里是亮着的。

**根因：** 扫描正则是 `/==[^=]+?==/g` —— `[^=]` 把等号当成**内容禁区**，而这篇笔记的 5 处高亮全都带算式（`==青莲剑·宫=4631==`、`==青莲剑·角=3909+971·4=3909+3884=7793==` …）。以第一个 `==` 起算，惰性匹配走不到下一个 `==` 就因为遇到 `=` 失效；而该行也不存在第二个可作起点的 `==`，于是**整篇 0 匹配**。编辑器能亮是因为 Obsidian 的高亮只以成对 `==` 为界，`=` 不是分隔符 —— 扫描规则比渲染规则严，两边就对不上了。

**修复：** 两处同一规则同改 —— `highlight-index-view.ts::scanHighlightMatches` 与 `teleprompter.ts::scanMatches` 改为 `/==([^\n]+?)==/g`，内容取捕获组；排除纯等号串（`====`/`======`，由 `/^=+$/` 判定）避免误判分隔线。跨行仍不匹配（`[^\n]`），与本就不跨段的 inline 语义一致。

**避坑记录：**

1. **扫描规则必须与渲染规则同宽，不能更严**：`[^=]` 这类「猜内容里不会出现的字符」的写法，只要用户写算式/键值对就会整条漏掉，且**静默**（0 匹配不报错，表现成面板空白）。
2. **两处实现要同步改**：索引与提词器高亮模式各有一份 `scan*`，注释里也互相标注「同规则」——只改一处会让「索引有卡片、点进去提词器空白」。
3. **改源码同时同步了 `main.js`**：本次环境 shell 不可用（sandbox 创建失败）跑不了 `npm run build`，为让用户立刻验证，产物里的同一正则字面量一并替换（等价、可被后续 `npm run build` 覆盖为一致结果）。

### 提词器顶栏折行的「瞬态自愈」（2026-10-05）

**现象：** 切换文档标签页后，提词器顶栏折成两三行（绑定按钮显示的活动文档名把顶栏撑得比窗口宽），约 1 秒后自行恢复。用户观察为「第二次鼠标移入时恢复」——实际与悬停无关：**悬停只改 opacity，不影响任何宽度**，恢复来自每秒兜底再同步的 `autoFitWidth()`。

**定位：** 离线 harness 能复现「文档名变长 → 下限变大 → 窗口跟随」的正常路径（追加回归用例后仍是绿的），说明触发点与真实事件时序有关；但排查出两处**必然放大**该症状的机制，按机制修而不是按猜测修：

1. **判据用状态而不是事实**：`raiseToMinWidth()` 写的是 `if (this.state.width >= min) return;` —— 状态宽度一旦偏大就早退，DOM 明明偏窄也不再补；而 1 秒后的 `autoFitWidth()` 没有这个早退（它无条件重算并写回），所以能自愈。**改为以实际渲染宽度（`rootEl.offsetWidth`）为判据。**
2. **下限只在少数事件点补测**：绑定按钮换名、模式文案、穿透锁定、宽度锁定四处；事件时序错位一次就漏补，要等 1 秒兜底。**新增顶栏 ResizeObserver，尺寸一变就在布局后、绘制前补一次下限。**

**避坑记录：**

1. **宽度类不变量别只看状态字段**：`state.width` 是「意图」，`offsetWidth` 才是「事实」；「是否需要修正」要用事实判断，否则状态一旦领先就永久早退 —— 本例的「1 秒自愈」就是这个早退的典型指纹（有人兜底，但没人按事件即时纠正）。
2. **ResizeObserver 当不变量兜底，优于在每个事件点补**：回调在布局之后、绘制之前 → 修正不会闪屏；且天然覆盖事件时序、字体度量、主题/片段改样式等未知触发。**注意它只看被观察元素的盒子**：顶栏被 `max-width` 钳住（折行态）时改文档名只改按钮宽度、不改顶栏盒子，所以绑定按钮也要一起观察。
3. **测量不要改被测元素**：原先「临时 `nowrap + max-content` 量一次再还原」虽然同帧还原、不会画出来，但会让测量动作本身参与布局与观察者（新加的 ResizeObserver 就在同一条链上）。改成「可见项实际几何相加」后测量是纯读取：折行只决定各项落在哪一行，不改变各项宽度，故折行态相加即为单行所需宽度。
4. **该失效类的最小可复现模型**：直接压窄 DOM 宽度、并让 `state.width` 保持偏大 → 等一帧 → 断言顶栏回到一行且宽度 ≥ 下限。比等真实事件时序稳定得多，已固化为回归用例。

### 试听起播切歌词面板 + 自动匹配歌词（2026-10-05）

**需求：** 点「试听」播放在线歌曲时，应像播放本地歌曲一样跳到歌词页面并自动匹配歌词。

**根因：** 自动匹配的前置条件是**歌词面板可见** —— `maybeAutoSearchLyrics()` 第一行就是 `if (this.viewMode !== "lyrics" ...) return`。试听此前不切面板（`togglePreview` 里没有 `setViewMode`），所以试听歌曲永远停在「无歌词」空态，只有用户手动切到歌词面板才会触发匹配。试听歌词的落地链路本身早就有了（`applyLyricToTarget` 对 `preview:` 路径走 `applyPreviewLyrics` 内存临时挂载）。

**修复：** `togglePreview` 起播分支里补 `this.setViewMode("lyrics")`（与本地行 `void playSong(song); this.setViewMode("lyrics")` 同一写法，含队列续播的后续曲目）；另在歌词面板给一条 `renderLyricSearchStatus("正在加载试听 …")`，`stopPreview()` 里 `clearLyricCandidates()` 收起。

**避坑记录：**

1. **「切面板」就是自动匹配的开关**：这个链路的所有零件（空歌词判定、四平台搜索、`preview:` 临时挂载）都已存在，唯独缺「面板可见」这一前置条件。排查「某功能不触发」时先看它的守卫条件，而不是急着补新逻辑。
2. **切面板会遮住歌单面板里的进度条**（`renderTabProgress` 挂在歌单面板的标签栏下方）：试听拉取要几秒，切走后就没了反馈，故在歌词面板补同义状态（`renderLyricSearchStatus`，出声后由「正在自动匹配在线歌词…」自然接替；无匹配时被候选列表/空态接替）。
3. **`stopPreview()` 是试听收尾的统一出口**（失败、被接管、切歌、onClose 都走它）：新增的「正在加载试听…」状态挂在这一处清理，就不会出现「拉取失败后状态永远挂着」。它本身已承担浮层图标复位与 key 清理。
4. **harness 要手动订阅状态**：真实 `onOpen` 里才 `plugin.onLyricsStateChange(this._onStateChange)`，只构造 `MusicView`（构造器只存 plugin）不会订阅 —— 端到端测试里要显式接上，否则自动匹配这条「状态推送驱动」的链路永远不跑（本次实测先误报一条：切面板成功但 searchCalls=0）。

### 试听行封面浮层与本地行统一（2026-10-05）

**需求：** 在线歌曲试听播放中，封面浮层显示的是「停止试听」方块，与本地歌曲播放中的暂停图标不一致；用户要求统一为本地那套。

**实现：** 试听行（`renderOnlineRow` 的 `previewing` 分支、`_onStateChange` 的队列续播分支）改调 `renderCoverPlayIcon(coverPlay, playing)`；点击浮层由「停止（销毁播放器 + `stopPreview`）」改为 `toggleActivePlayer()`（暂停/续播）；新增 `syncPreviewCover(state)` 在状态推送里同步图标。`.gm-download-item-cover-play-active` 只剩「常驻显示 + 可点击」，底色回落到基础规则的压暗封面（与本地行同款），不再用 `--interactive-accent` 纯色底。

**避坑记录：**

1. **图标必须在状态推送里同步，且要按播放态翻转去重**：暂停/续播不只从浮层点击发生 —— 底栏播放键、快捷键、队列续播、别的歌曲抢播放位都会改状态。旧实现「点击时设一次方块、`stopPreview` 时复位」只在「方块=停止」这套语义下成立；换成暂停/播放后必须有状态驱动。但 `_onStateChange` 每秒推 4 次以上，`setIcon` 会重建 svg（按压瞬间重建会吞掉 click，见 musicView 顶部 setIconIfChanged 的注释），所以用 `previewPlaying` 标记只在翻转时重设。
2. **暂停试听 = 保留播放器，不是销毁**：旧「停止」走 `stopAllPlayback()`（销毁播放器 + revoke blob），续播要重新拉取；改暂停后 blob 与播放位置都留着，续播不重新下载。代价是没有显式「停止试听」入口 —— 让位（播放别的歌/切歌/队列续播）时照旧由接管守卫停止并复位浮层。
3. **拉取中（播放器尚未建立）先显播放图标**：`togglePreview` 里 `previewKey` 一旦置上，此刻状态还不是 `preview:` 路径，若直接显暂停就是在骗人；出声后由状态推送切暂停。这段时间的重复点击仍然忽略（否则试听会「永远差一次」）。
4. **浮层底色跟着本地行走，别留「强调色纯色底」**：`.gm-download-item-cover-play-active` 原先同时承担「常驻」与「强调色底 + 反白图标」；底色去掉后只留常驻与可点击，颜色/悬停色全部回落到 `.gm-download-item-cover-play` 的基础规则 —— 少一处颜色来源，就不会出现「本地是压暗封面、试听是纯色块」的不一致。
5. **Playwright 桩里的 `setIcon` 必须替换而非追加**：真实 Obsidian 的 `setIcon` 会替换元素内已有 svg，桩里若只 `appendChild`，断言图标时会读到旧的那个（本次实测先误报两条：暂停后仍读到 pause）。断言图标前先让桩与真实行为对齐。
6. **断浮层 opacity 要等过渡走完**：`.gm-download-item-cover-play` 有 `transition: opacity .15s`，类一去掉就读 `getComputedStyle().opacity` 会读到过渡中的 1（本次实测误报一条）；要么断言类名，要么 `await 250ms` 再读。

### 提词器歌词模式双击播放/暂停 + 穿透锁定正文区未穿透（2026-10-05）

**需求：** 歌词提取模式下双击提词器文本区应控制当前歌曲（原先该手势直接 `return`：歌词没有「对应的文档行」可跳）。

**实现：** `handleContentDblClick()` 按模式分派 —— 歌词模式 `music.toggleCurrentSong()`，其余模式沿用 `jumpToCapturedLine()`。切换语义与提示收在 `MusicManager.toggleCurrentSong()`：正在播放 → 暂停（`audio.pause()`）/ 已暂停 → 续播（`audio.play()`，被拒时提示）/ 无当前歌曲 → 提示「未在播放歌曲」（与占位文案一致）/ 音频没挂上 → 提示「未就绪」。

**避坑记录：**

1. **手势语义照用户认知走，别替他做安全假设**：第一版按「只播放、正在播放时不动」实现（理由：双击落在文本域上，误触停歌比没反应更糟），用户随即要求「正在播放时双击就是暂停」—— 桌面歌词的认知就是播放/暂停。**结论：先问/先按用户明确说的语义做；「更安全」的默认值不等于用户想要的默认值。**
2. **状态判断放在管理器，不放在提词器**：提词器窗口拿到的 `isPlaying` 是推送来的快照，据此判断会有竞态；暂停链路（`audio.pause()` → audio 的 pause 事件 → 播放器回调 → `emitState`）与面板按钮完全同源，`toggle()` 也走同一条。提词器只做「哪个模式的哪个手势」的分派。
3. **要提示的场景只有「手势完全没反应」**：没歌、音频没挂上、起播被拒。已在播放/暂停成功都不提示（每次双击弹通知会很吵）—— 这也是与面板按钮/命令用的 `toggleActivePlayer()`（纯切换、没歌静默）唯一的差别。
4. **`pointer-events: none` 只写在根上挡不住子元素**：1.1.2 起根窗口常驻 `none`、`.glimpse-tp-body`（正文所在）打回 `auto`（为的是失配的透明区域不挡编辑器）。但子元素显式 `auto` 会**重新参与命中**，于是「穿透锁定」只隐藏了按钮：正文区照样吃掉点击（划词/编辑被挡，双击跳转、右键复制照旧触发 —— 新增的双击播放会在锁定态误触）。修复是补 `.glimpse-teleprompter.is-locked .glimpse-tp-body { pointer-events: none }`。**结论：点击穿透是「命中测试」层面的逐元素属性，父级 none 必须对每个显式 auto 的子元素逐一收口**；排查同类问题先看子元素有没有自己的 `pointer-events`。
5. **验证用命中测试而不是「事件没触发」**：`document.elementFromPoint(正文中心)` 在锁定态应落在提词器之外（编辑器/body），解锁后落回正文；比人工手测更快，且能定位到「到底是谁接住了这一下」。
6. **`styles.css` 里的锁定态注释也要跟着改**：注释若仍写「根已恒为 none，本态仅隐藏非交互按钮」，下一个维护者会照着重犯第 4 条。

### 提词器顶栏最小宽度（2026-10-05）：1.1.2 的「工具栏不参与宽度」收窄为「只提供下限」

**现象：** 提词器窗口较窄时，悬停顶栏的 12 个控件（文档绑定、模式下拉 + 10 个图标按钮）被折成两三行，一行只剩两三个按钮。

**根因：** 1.1.2 修「背景远宽于内容」时把工具栏从宽度计算里彻底摘掉（宽度只由内容决定，顶栏窄了靠 `flex-wrap` 折行收纳），而最小宽度是固定常量 `TP_MIN_WIDTH = 240` —— 与顶栏实际单行自然宽度（本机 ≈470px，随文档名/模式文案浮动）无关。

**修复：** `minWidth() = min(max(240, 顶栏单行宽 + 4px 缓冲), 视口宽)`，由 `clampWidth()` 统一施加（宽度自适应 / 右缘拖宽 / 宽度锁定三条路径）。「工具栏不参与宽度」的 1.1.2 结论被收窄为：工具栏不**撑宽**内容宽度，但提供**下限**。

**避坑记录：**

1. **不能直接量已折行顶栏的宽度** — 顶栏 `max-width:100%`，折行后 `offsetWidth` 量到的是窗口宽（折行后的值），拿它当最小值只会把现状锁死。测量时临时 `flex-wrap:nowrap + width:max-content + max-width:none`，读 `offsetWidth`（强制同步布局）后立即 `setCssProps(…null)` 还原：同帧还原，中间态不会被绘制（与 `measureNaturalWidth` 的离屏探针同一套路，但这里必须量真实元素才能带上 `is-locked` 等状态）。
2. **顶栏组成/文案变化处都要补下限** — 绑定按钮显示活动文档名、模式文案随模式切换、穿透锁定只留交互按钮，三处都会改变顶栏单行宽度。只在 `autoFitWidth()` 里算不够：宽度锁定的窗口跳过自适应，而构造顺序是 `setWidthLocked()` → `updateBindBtn()`/`updateModeSelect()`，前者量到的顶栏还是「— + 空模式标签」（实测偏小 42px）：恢复一个窄锁定窗口会停在 430px、顶栏照样两行。故四处（`setLocked`/`updateBindBtn`/`updateModeSelect`/`setWidthLocked`）统一调 `raiseToMinWidth()`（只抬不缩）。
3. **穿透锁定要按当前可见按钮计下限** — 锁定时 `.glimpse-tp-btn` 被 `display:none`，量到的就是真实的 100px（3 个按钮），`minWidth` 取 240 常量兜底；若按解锁态统一测，锁定的「桌面歌词」式窄窗会被撑到 470px，破坏「锁定=不打扰」的意图。解除锁定时在下限变更点补回。
4. **宽度锁定仍受下限约束** — 锁定语义是「不随内容变化」，不是「可以窄到折行」；旧 data.json 存的窄锁定宽度在恢复时抬到下限（`raiseToMinWidth` 只抬不缩，不碰用户所选宽度，也不按内容重排）。
5. **下限也是视口的函数** — 视口比顶栏还窄时 `minWidth` 退到视口宽（窗口不越出屏幕），此时折行不可避免；不要为了「永不折行」把窗口撑出屏幕。
6. **验证方式** — Playwright（仓库已有依赖）+ esbuild 把真实 `src/teleprompter.ts` 与桩 `obsidian` 打成 IIFE，页面引入真实 `styles.css`，跑 22 项断言：15 项宽度/拖宽/视口、4 项歌词双击与行模式双击回归、3 项穿透锁定命中测试（顶栏行数用「可见 flex 项的 top 去重数」独立判定，不依赖被测代码的测量值）。

### 面板重新挂载用了 `getRightLeaf(true)`：右栏被多切一个分栏

**现象：** 用户报告「弹了个 notice 后，右侧边栏的音乐标签页移到下半区」。工作区快照对比：`workspaces.json` 里 2026-09-20 保存的「写作」布局中，`glimpse-music-panel` 是右栏**唯一**标签组里的第 7 个标签（叶子 id `980b6256a2548b7f`）；当前 `workspace.json` 中右栏有两个标签组，音乐面板独占 `children[1]`，叶子 id 变为 `d11aea471006ed72`（同文件里其他叶子的 id 逐一对得上）→ 该叶子是被**销毁后重建**的，不是被拖动。

**根因：** 面板丢失后 `ensureViewLoaded()` 走 `getRightLeaf(true)`。Obsidian 1.13 运行时 `getSideLeaf(sideSplit, split)`：`split === true` → 向侧栏 `insertChild(-1, new WorkspaceTabs)` 再塞一个叶子（**新建标签组**）；`split === false` → 取 `children[0]` 后 `insertChild(-1, new WorkspaceLeaf)`（**在首个标签组内新建空叶子**，不触碰已有叶子、不 `setActiveLeaf`）。所以 `true` 恰好把面板拆到了右栏下半区。

**修复：** 改用 `getRightLeaf(false)`，两个挂载入口（`activateView` / `ensureViewLoaded`）统一走 `mountMusicLeaf()`；顺带给 `activateView()` 补 `revealLeaf()`（`setViewState({active:true})` 不展开收起的侧栏）。

**避坑记录：**

1. **`getRightLeaf(split)` 的参数不是「新建标签」而是「新建标签组」** — 旧注释「`getRightLeaf(true)` 新建一个标签，避免 `setViewState` 覆盖右栏已有其他插件视图」把语义理解反了：`false` 返回的是**新建的空叶子**（不覆盖任何视图），`true` 才多切一个分栏。同族 API 佐证：`getLeaf('tab' | true)` 走 `createLeafInTabGroup()`（组内新建标签），`getLeaf('split')` 走 `splitActiveLeaf()`；`createLeafBySplit()` 在不能切分时也回退到 `createLeafInTabGroup()`。
2. **`createLeafInParent(parent, index)` 会 `setActiveLeaf(新叶子)`**（运行时实现里显式调用）→ 想「静默挂载、不抢占当前激活标签」时不要用它（除非自己把原激活叶子恢复回去，否则 `workspace.getActiveFile()` 会变 null）；`getRightLeaf(false)` 不激活叶子，符合静默语义。另外注意它内部已 `insertChild` 一个新叶子，若再自行 `createLeafInParent` 同组会多留一个空标签。
3. **本插件被懒加载接管时 hot-reload 不会重载它** — Glimpse 处于「持久化停用 + 会话内运行」态（MDRazor 懒加载接管）时，hot-reload 的 `reload()` 开头 `if (!plugins.enabledPlugins.has(plugin)) return` 会静默跳过：重建 `main.js` 不会生效（本次实测 `workspace.json` / `data.json` 的 mtime 均不变）。要加载新产物需重启 Obsidian 或先在第三方插件设置里启用该插件。

## 1.0.4 (2026-08-15)

### 新版设置项行内元素顶部对齐（.setting-item align-items: flex-start）

- **现象**：设置页「持久高亮」列表行内 `grip-vertical` 拖拽图标垂直居中失效，悬在行顶
- **根因**：Obsidian 新版设置 UI 中 `.setting-item` 基类为 `align-items: flex-start`（子元素顶部对齐）；插件行内自定义元素未做 `align-self` 补偿。颜色预览曾在 0.4.0 补过 `align-self: center`，拖拽图标漏了（其 `display:flex; align-items:center` 只居中 svg 于手柄内部，手柄本身仍顶部对齐）
- **修复**：`.highlighter-setting-icon-drag` 与 `.highlighter-details .setting-item-control` 补 `align-self: center`
- **避坑**：新版设置项自定义行内元素（图标/控件/预览）一律显式 `align-self: center`，勿依赖基类对齐；旧版（`align-items: center`）下该属性无副作用

## 1.0.1–1.0.2 审核合规 (2026-08-09)

### onunload 禁止 detachLeavesOfType
- 审核规则：卸载时分离叶子会把叶子重置回默认位置（用户挪过也复位）
- 修复：删除 `onunload` 中 `detachLeavesOfType(HIGHLIGHT_INDEX_VIEW)`；视图清理交由 Obsidian 处理

### 禁止创建/挂载 `<style>` 元素
- 审核规则：`document.createElement("style")` + `head.appendChild` 不允许；静态 CSS 用 `styles.css`
- 本插件场景是**运行时用户自定义 CSS**（query.css），无官方注入 API
- 修复：改用 `CSSStyleSheet` + `document.adoptedStyleSheets`（不创建样式元素，Chromium 全支持）；卸载时从 adoptedStyleSheets 移除
- 备选失败：`EditorView.theme`/`StyleModule` 只接受对象 spec，原始 CSS 字符串运行时逐字符遍历会坏，不可用
- 避坑：动态 CSS 合规注入用 CSSStyleSheet，勿用 style 元素；CM 主题不接受原始 CSS 文本

### no-static-styles-assignment（规则边界实测两轮）
- 禁：`.style.X = "静态字面量"`、`style.setProperty(prop, val)` 两参调用
- 放行：CSS 类、`setCssProps`/`setCssStyles`（评审明确建议）、`hide()/show()`、自定义属性（`--xxx`）、带 `important` 三参 setProperty（applySettings 的字体覆盖未被抓）
- `setCssProps` 在 obsidian 0.14.8 类型未声明 → `src/dom-augment.d.ts` 声明增强（运行时自 1.0 存在，驼峰自动转连字符，null 移除属性）
- 新增样式切换优先 `hide()/show()` / `setCssProps`

## 1.0.3 (2026-08-09)

### 首次打开新文档高亮索引不刷新（两阶段根因）

- **现象**：打开未被索引过的文档，索引面板不检索（显示 0 匹配）；切换另一文档再切回才统计正常
- **阶段一（事件缺监听）**：索引重渲染仅监听 `active-leaf-change`；新文档在**已激活叶子**内打开（新建 / 资源管理器点击当前标签页）叶子未变，不触发 `active-leaf-change`，只触发 `file-open`
- **修复一**：`onOpen` 补监听 `file-open`（视图加载后触发）；`extension !== "md"` 或 `path === renderedPath` 跳过，保留选中态
- **阶段二（内容未就绪）**：`collectFromView` 只读 CM 编辑器 `state.doc`；`file-open` 触发时 CM 内容尚未加载（doc 为空）→ 首扫误报 0 匹配，面板滞留空。切走再切回正常 = 视图已加载读到了真内容
- **修复二**：`collectFromView` 改 async，CM doc 为空时回退 `vault.cachedRead` 读盘；两处调用点加 `await`
- **避坑**：新打开文档的编辑器内容异步就绪，`file-open` 后立即读 CM state 可能为空；实时内容优先、空则读盘兜底。事件补 `file-open`（加载后）+ 内容回退读盘，两者缺一都会复现
- 诊断日志已清（console.log 全部移除）

## 0.9.10 (2026-08-09)

### 崩溃：提词器管理器未初始化即被引用（全局 ↑/↓ 失效的真凶）
- **现象**：`Uncaught TypeError: Cannot read properties of undefined (reading 'lastFocused')`，栈在 `anchoredDocPath → collectAnchoredDoc → renderIndexPanel`；索引视图 onOpen 抛错导致其后续注册（keydown/轮询/事件）全部未执行，视图损坏
- **根因**：`main.ts` onload 中 `teleprompterManager = new TeleprompterManager()` 位于 `registerView` + `autoOpenRightLeaf`（layout-ready 回调开视图）之后；layout-ready 同步触发时视图先渲染，读到未初始化字段
- **修复**：manager 初始化提前到 `registerView` 之前；`anchoredDocPath` 加 `!mgr` 空检查
- **避坑**：插件字段若被视图 onOpen/layout-ready 回调读取，初始化必须早于视图注册；跨组件引用一律空检查

### 叶子变更重渲染冲掉选中态
- **现象**：未聚焦索引页时点击卡片，选中瞬间消失
- **根因**：点击使焦点切到索引 leaf → `active-leaf-change` → 旧逻辑无条件重置 `highlightLine` + 重渲染，卡片重建无 `.active`
- **修复**：重渲染判定改为按渲染源文档路径（`renderedPath`）比较 —— 内容未变（回焦同文档编辑器、聚焦本标签页、焦点到非 markdown 叶子）跳过重渲染
- **避坑**：重渲染前判断内容源是否真变，勿用视图实例身份比较；`revealMatch` 跨文档切源后也要同步维护 `renderedPath`/`renderingAnchored`

### 光标轮询覆盖主动选中
- **现象**：滚动同步选中卡片后立即被取消（光标静止）
- **根因**：轮询用 `highlightLine` 兼任「光标移动检测」与「选中记录」；`selectCard` 写 `highlightLine` 后轮询误判光标已移动，`applyCursorHighlight` 清空全部 `.active`
- **修复**：光标移动检测拆出独立 `lastPollCursorLine`；首次轮询（未初始化）前已有主动选中（`highlightLine ≥ 0`）只记录光标不覆盖
- **避坑**：「检测状态」与「选中状态」分开存，勿共用一字段

### revealMatch 回喂提词器竞态
- **现象**（潜在，随双击联动引入）：索引 `selectCard → activateCard → handleCardClick → showMatch` 同步清空提词器 `matches`，随后 `jumpToCapturedLine` 读不到匹配文本，选中段退化为整行
- **修复**：`selectCard(index, notifyTp = false)` —— 来源即提词器（revealMatch）时跳过回喂；点击/键盘仍回喂
- **避坑**：双向联动必须防环（A 驱动 B 时 B 不得再驱动 A）；提词器 `showMatch` 清缓存是同步的，外部调用后紧接读 `matches` 必空

### 悬停键盘导航移除（设计结论）
- **经过**：悬停提词器 ↑/↓ 切换 → 编辑器原生 ↑/↓ 失效 → 加 `activeElement`/聚焦守卫仍不可靠
- **根因**：window capture 劫持全局抢键，`isHovered`/`activeElement` 判定任一失效（焦点代理、锁定态 mouseleave 不触发等）即破坏编辑
- **结论**：不做全局键盘劫持；提词器上一项/下一项走滚轮 + 工具栏按钮（零冲突）。索引页键盘导航（聚焦 gate）是安全的
- **避坑**：功能键冲突时优先放弃全局劫持方案，而非叠守卫

### 穿透锁定与 hover 状态
- **现象**：锁定后 `pointer-events:none` 使 `mouseleave` 不再触发，`isHovered` 卡死
- **结论**：随悬停键盘移除，hover 状态已删；滚动同步按钮为非交互按钮（无 `is-interactive`），锁定态随其余按钮隐藏 —— 新增按钮默认不要带 `is-interactive`，除非锁定态仍需可点

### 滚动同步光标跳转细节
- 行模式同步用 `setCursor` 但不 `focus()`，浏览不抢焦点；高亮模式同步复用 `notifyIndexCardSelect → revealMatch`
- `prevItem`/`nextItem` 为 async（滚动按需加载匹配），事件调用处用 `void`
