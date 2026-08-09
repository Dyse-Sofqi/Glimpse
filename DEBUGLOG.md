# 调试日志（DEBUGLOG）

关键避坑记录，供后期维护快速定位。按版本聚合。

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
