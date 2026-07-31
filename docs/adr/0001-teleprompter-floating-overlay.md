# 0001 — 提词器采用 Obsidian 窗口内浮动 Overlay

提词器需要「桌面歌词」式交互：透明、置顶、可穿透点击、悬停显背景。Obsidian API 不提供 OS 级置顶窗口，直接访问 Electron `BrowserWindow` 违反插件审核规范且随版本更新易碎。因此提词器渲染为挂在 `document.body` 的 `position:fixed` 浮动层，以最高 `z-index` 置于 Obsidian 全部面板之上——「置顶」定义域为 Obsidian 窗口内部，而非整个桌面。

**决策**：方案 A——浮动 overlay div。桌面端专用；移动端隐藏命令与设置。

**被否决的替代**：
- Electron `BrowserWindow` 直连——可做真 OS 级置顶/穿透，但违反 Obsidian 插件审核规范（项目自 0.6.0 起明示遵循），且升级易碎。
- Popout 叶子视图（Obsidian「弹出窗口」）——独立 OS 窗口，但带正常窗口边框、无法悬停显背景、无法穿透点击、无法强制置顶、移动端不可用。

**推论**：穿透锁定用 `pointer-events:none`（仅保留三个可交互按钮）、磁吸/居中辅助线/拖拽均为原生 DOM 事件实现。多实例各自维护独立状态并整体持久化到插件 `data.json`。
