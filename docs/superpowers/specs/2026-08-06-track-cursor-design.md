# 跟踪光标按钮 — 设计

日期:2026-08-06
范围:提词器(`src/teleprompter.ts`)

## 背景

逐行提取模式目前通过 150ms 轮询(`pollCursor` → `extractFrom`)自动跟随编辑器光标,提取光标所在行。该跟随行为与行模式绑定。目标:把「光标位置变动时自动提取光标所在行」独立成可开关功能,默认关闭,按钮激活后启用。

## 需求

1. 顶部按钮栏,模式切换按钮之后(prev 之前)加「跟踪光标」按钮,lucide `text-cursor` 图标
2. 按钮开关控制光标跟随功能,默认不启动
3. 跟踪光标仅行模式生效(用户确认):高亮模式下暂停跟随

## 设计

### 状态

- `TeleprompterWindowState` 加字段 `trackCursor: boolean`,默认 `false`
- 按窗口持久化到 data.json(与 `locked`/`bgHidden` 同模式)
- 旧窗口状态无此字段 → `undefined` 即假,无需迁移

### 按钮

- `buildDOM()` 中模式按钮之后创建:`addBtn("text-cursor", "跟踪光标", toggle, interactive = true)`
- 激活态 `is-active` 类,复用现有 CSS,不改 styles.css
- 新增 `updateTrackBtn()` 同步激活态并 persist

### 行为

- 切换开:`lastPollKey = ""` 强制首轮同步 + `refreshLine()` 立即提取当前光标行 + `startPolling()`(若行模式)
- 切换关:内容保持原位不跳变
- `pollCursor()` 加门控(唯一改动点):
  - 选中覆盖分支不变(选中提取设置项 `selectionExtractEnabled` 照常工作)
  - 行跟随分支仅在 `mode === "line" && trackCursor` 时执行
- 轮询启停仍由模式控制(`startPolling`/`setMode` 不动)→ 高亮模式跟踪暂停
- 打开窗口/切文档的 `refreshLine()` 一次性提取保留,不受开关影响

### 边界

- 关闭跟踪 = 行模式静态化:打开/切文档提取一次,prev/next 手动浏览,光标移动不覆盖
- 手动 prev/next 浏览不被跟踪覆盖(现有 `lastPollKey` 去重保留)
- `extractFrom` 唯一调用者即 `pollCursor`,门控放 pollCursor 一处,extractFrom 不动

## 验证

- 无测试设施;`npm run build` 构建,Obsidian 人工验证:
  - 默认关闭:行模式光标移动不更新内容
  - 开启:光标移动更新内容;切高亮模式暂停,切回恢复
  - 选中文本提取不因关闭跟踪而失效
  - 重启 Obsidian 按钮状态恢复
