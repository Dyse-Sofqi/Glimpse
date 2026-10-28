# 网易云登录：扫码被风控后怎么处理

> 结论先放这里：**插件内的扫码登录对多数账号已经走不通了（服务端返回 `8821`），
> 可靠路径是「在真实浏览器里登录一次，再把 Cookie 交给插件」**。
> 仓库自带取件脚本 `tools/netease-cookie`，把这一步压缩成「双击 → 登录一次 → 自动写入」。

## 现象

- 手机 App 扫码、点确认，手机上显示「已确认」；
- 插件弹窗停在「已扫码，请在手机上确认」，几秒后服务端返回：

```
801 等待扫码
802 授权中            ← 手机端确认确实成功了
8821 请切换其他登录方式或升级新版本再试
```

`802` 说明**扫码链路是通的**，二维码、轮询、确认都对；`8821` 是签发凭证（`MUSIC_U`）
这一步被服务端拒绝。

## 已排除的原因

| 假设 | 结论 | 依据 |
|---|---|---|
| 出口 IP 异常 | 排除 | 实测出口为中国移动上海住宅网段（`120.229.183.102`），非机房 IP |
| 代理 / VPN | 排除 | 系统未启用代理；命令行里的 `*_proxy` 变量只作用于 agent 进程 |
| 协议版本旧 | 排除 | `unikey?type=1` 与 `type=3` 都能正常拿到 key；改用 eapi + 设备指纹的开源实现同样报 8821 |
| 中间层缓存 | 已排除 | URL 已带 `timestamp`，请求头 `Cache-Control: no-cache` |
| 会话 Cookie 未串联 | 已修复 | unikey 下发的 `Set-Cookie` 已在轮询时回传 |
| 客户端读不到 `Set-Cookie` | 已修复 | 改为 Node `https` 直连（浏览器 `fetch` 读不到该响应头） |

## 根因

`8821` = **账号级风控拦截，要求行为验证码**。多个仍在维护的开源项目（含改用新版
eapi 协议、带客户端设备指纹的实现）都在文档里写明同一现象，并统一建议改用 Cookie。
换协议、换 UA、加参数都绕不过——判断依据是客户端指纹与账号历史行为，不是某个接口参数。

## 方案 A：取件脚本（默认路径）

三个入口，效果完全一样：

1. **设置页「一键登录」（推荐）**：音乐 → 展开「网易云音乐」→ 点「一键登录」。插件
   `spawn` 这个脚本，Edge 打开，登录后凭证经 `obsidian://` 直接写回；
2. **扫码弹窗**：真走到 `8821` 时，面板上的「用浏览器登录」也是同一个动作；
3. **手动**：双击 `tools/netease-cookie/get-cookie.cmd`。

```powershell
F:\_Workspace\Plugin-Test\.obsidian\plugins\Glimpse\tools\netease-cookie\get-cookie.cmd
```

流程：

1. 脚本用 `playwright-core` + 本机 **Edge**（Chromium 内核）拉起独立配置目录的窗口，
   打开 `music.163.com` 登录页；
2. 你在窗口里正常登录（扫码 / 密码 / 短信都行）——真实浏览器不触发风控；
3. 脚本每 2 秒读一次浏览器 Cookie，命中 `MUSIC_U` 后：
   - 调 `/api/nuser/account/get` 校验，打印**昵称 / UID / vipType**（确认是哪个号）；
   - 写 `netease-cookie.txt`（全量）与 `netease-cookie-slim.txt`（精简）；
   - 写 `pending-cookie.json`，再唤起 `obsidian://glimpse-netease-cookie`；
4. Obsidian 收到后**直接把凭证写进音乐设置并落盘**，用原生弹窗显示账号、字符数、
   会员状态与失效说明——**不用回设置页粘贴**，也不想看系统消息框时按「完成」即可。

> 回传通道靠 `registerObsidianProtocolHandler` 注册，**插件需已加载**才生效：改完代码要
> 重载插件（设置 → 第三方插件 → Glimpse 关掉再开启）。插件没响应时脚本已把精简版放进
> 剪贴板、也写了 txt，手动粘一次即可，不必重跑浏览器。

**复用**：登录态保存在配置目录（默认 `E:\_Software\_work\netease-profile`），
下次运行**秒取、无需登录**。换账号删除该目录即可。

### 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `GLIMPSE_NETEASE_DIR` | 输出文件与配置目录的父目录 | `E:\_Software\_work`（不存在则用系统临时目录） |
| `GLIMPSE_NETEASE_PROFILE` | 浏览器配置目录 | `<GLIMPSE_NETEASE_DIR>\netease-profile` |
| `GLIMPSE_BROWSER_CHANNEL` | 浏览器通道 | `msedge`（装了 Chrome 可设 `chrome`） |

### 精简版为什么更短

浏览器里有 40+ 个 Cookie，其中 `Hm_lvt_*`、`WM_*`、`gdxidpyhxdE` 等全是埋点。
精简版只保留 `MUSIC_U` / `__csrf` / `NMTID` / `_ntes_nuid` / `MUSIC_A` / `__remember_me` /
`_iuqxldmzr_`，实测效果完全一致（账号接口、搜索、`320kbps` 播放地址均正常），
长度从约 2900 字符降到约 990 字符，粘贴更不容易出错。

## 方案 B：手动复制

1. 设置页点「打开登录页」→ 浏览器里正常登录；
2. `F12` → **Network / 网络** → `F5` 刷新；
3. 点任意发往 `music.163.com` 的请求 → **Request Headers** 里复制整段 `Cookie`；
4. 粘进设置的输入框 → 「测试连接」。

⚠️ `MUSIC_U` 是 **HttpOnly**，控制台 `document.cookie` 读不到，必须从请求头复制。

## 为什么网易云没有「自动续期」

插件的 Cookie JAR（`src/music/cookieJar.ts`）会在响应头出现 `Set-Cookie` 时，把登录凭证合并回
`data.json`。这套机制对 **QQ 音乐**（`qm_keyst` 随请求刷新）是有效的，但**对网易云一直是空转**：

- `MUSIC_U` 是登录那一刻一次性下发的长效 token，之后所有 weapi / eapi 请求都**不回吐** `Set-Cookie`；
- 实测：带着有效凭证请求 `https://music.163.com/api/nuser/account/get`，返回 `200`、账号信息正常，
  但响应头 **`set-cookie` 为 0 条**；
- 两个 vault 的 `data.json` 里 `platformCookiesUpdatedAt.netease` 均为空（从未落盘过一次续期）。

也就是说，**网易云凭证的失效不是「过期」，而是「被吊销」**——账号风控（`8821`）、异地登录、
改密码都会让旧值立即作废，而这种失效没有任何续期可以回收，只能重新取一次。

插件的应对：账号歌单等接口一旦返回未登录（`code≠200`，或 `code=200` 但 `profile` 为空），
就弹 Obsidian 原生窗口说明原因，并给出「一键登录」按钮（同一失效 10 分钟内不重复弹）。
所以正常情况下你不需要主动想起去设置页——它自己会来找你。

诊断脚本：`node tools/netease-cookie/probe-setcookie.js`（读 `data.json` 的凭证请求一次账号接口，
只打印状态码与 `Set-Cookie` 条数，不写入任何东西）。

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 脚本报「配置目录被占用」 | 上一次的 Edge 窗口没关干净，全部关掉再跑 |
| 脚本报找不到 `playwright-core` | 在插件目录执行 `npm install`（`playwright` 是本项目正式依赖） |
| 提示「账号接口未确认」但拿到了 MUSIC_U | 服务端偶发抖动，凭证已写入，点「测试连接」再验一次 |
| 双击后 Obsidian 没有任何弹窗 | 插件还是旧代码（未重载），或 Obsidian 未安装：重载插件后重跑，或用剪贴板里的值手动粘贴 |
| 弹窗说「回传文件读取失败或已过期」 | 回传文件被清理了，重跑一次脚本即可 |
| `vipType: 0` | 该账号不是黑胶会员，VIP 曲目与无损仍不可下，与插件无关 |
| Cookie 某天突然失效 | 网易云没有「续期」这回事，见下一节。插件会在账号接口返回未登录时直接弹「一键登录」，点一下重取即可 |

## 安全说明

- Cookie 只写入本地 `data.json`，脚本产生的 `netease-cookie*.txt` 与 `pending-cookie.json`
  也在本地工作目录（`pending-cookie.json` 被插件读取后立即删除），写入完成后可删掉 txt；
- 回传用的 `obsidian://glimpse-netease-cookie` 只接受名为 `pending-cookie.json`、体积小于
  64KB、且含 `MUSIC_U=` 的内容，防止任意链接往设置里塞值；
- 浏览器配置目录里保存着完整登录态，等同账号凭证，不要拷给别人；
- 不要把 Cookie 贴到聊天窗口、issue 或截图里。

## 后续可做的方向

插件内部如果想彻底摆脱外部脚本，可把传输层从 Node `https` 换成 Obsidian 的
`requestUrl`（Electron 网络栈，TLS 指纹与 Chromium 一致），并先访问一次首页收集
`_ntes_nuid` / `NMTID` 再走 unikey → 轮询，尽量贴近真实浏览器行为。该路径尚未验证，
`requestUrl` 是否暴露 `Set-Cookie` 也需实测；在验证通过前，上文方案仍是唯一可靠路径。
