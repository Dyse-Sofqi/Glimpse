# 提词器文本域双击跳转 + 右键复制 — 设计

日期:2026-08-06
范围:`src/teleprompter.ts`(TeleprompterWindow)

## 需求

1. 文本显示域(`.glimpse-tp-content`)双击:光标移动到捕获文本所在行,并聚焦编辑器(用户确认)
2. 右键单击:复制捕获文本的纯文本(无 md 格式)内容

## 设计

### 事件绑定(buildDOM,contentEl 创建后)

- `contentEl.addEventListener("dblclick", ...)`
- `contentEl.addEventListener("contextmenu", ...)` — preventDefault 抑制原生菜单

### 双击跳转

- 目标行:
  - 高亮模式:`matches[currentIndex].line`(当前匹配项行号)
  - 行模式:`currentLine`(当前显示行)
  - 选中覆盖(selectionOverride):`ed.getCursor().line`(选中文本的所在行 = 编辑器光标行)
- `ed.setCursor({ line: Math.max(line, 0), ch: 0 })`
- `ed.focus()`(确认聚焦)
- 编辑器来源:`resolveDoc()`(绑定 > 活动);取不到 view 时回退 `followEditor`

### 右键复制

- 内容 = `contentEl.innerText`(渲染后纯文本,天然无 md 语法)
- `.trim()` 去首尾空白
- 复制:`navigator.clipboard.writeText`,失败回退 `execCommand("copy")` 隐藏 textarea

### 边界

- 穿透锁定(root `pointer-events: none`)时事件天然失效,符合预期
- 占位回退态复制显示内容(lastText),所见即所得
- 拖拽与双击无冲突(root mousedown 拖拽需 4px 位移阈值)
- 无视觉反馈提示

## 验证

- `npm run build`(tsc + esbuild)
- Obsidian 人工:
  - 行模式双击 → 编辑器光标跳到该行并聚焦,可立即打字
  - 高亮模式双击 → 跳到当前匹配项所在行
  - 选中提取时双击 → 光标跳到编辑器光标行
  - 右键 → 无原生菜单,剪贴板得到纯文本(`**加粗**` → `加粗`)
  - 穿透锁定时双击/右键均无反应
