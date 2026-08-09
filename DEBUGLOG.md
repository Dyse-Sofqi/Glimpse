# 调试日志（DEBUGLOG）

关键避坑记录，供后期维护快速定位。按版本聚合。

## 1.0.1 审核合规 (2026-08-09)

### onunload 禁止 detachLeavesOfType
- 审核规则：卸载时分离叶子会把叶子重置回默认位置（用户挪过也复位）
- 修复：删除 `onunload` 中 `detachLeavesOfType(HIGHLIGHT_INDEX_VIEW)`；视图清理交由 Obsidian 处理

### 禁止创建/挂载 `<style>` 元素
- 审核规则：`document.createElement("style")` + `head.appendChild` 不允许；静态 CSS 用 `styles.css`
- 本插件场景是**运行时用户自定义 CSS**（query.css），无官方注入 API
- 修复：改用 `CSSStyleSheet` + `document.adoptedStyleSheets`（不创建样式元素，Chromium 全支持）；卸载时从 adoptedStyleSheets 移除
- 备选失败：`EditorView.theme`/`StyleModule` 只接受对象 spec，原始 CSS 字符串运行时逐字符遍历会坏，不可用
- 避坑：动态 CSS 合规注入用 CSSStyleSheet，勿用 style 元素；CM 主题不接受原始 CSS 文本

### no-static-styles-assignment（回顾）
- 规则只禁 `.style.X = "静态字面量"`；`style.setProperty`（含动态）与 Obsidian `hide()/show()` 放行
- `setCssProps` 在 obsidian 0.14.8 类型未声明，TS 报错，未用
- 新增样式切换优先 `hide()/show()`，动态值用 `setProperty`

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
