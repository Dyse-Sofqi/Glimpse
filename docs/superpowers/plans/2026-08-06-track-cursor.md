# 跟踪光标按钮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提词器顶栏加「跟踪光标」按钮(lucide `text-cursor`),把行模式光标跟随独立成开关,默认关。

**Architecture:** 单一文件改动 `src/teleprompter.ts`。`TeleprompterWindowState` 加 `trackCursor` 字段(按窗口持久化);工具栏加图标按钮;现有 150ms 轮询 `pollCursor` 加门控——选中提取分支不变,行跟随分支仅在 `mode === "line" && trackCursor` 时执行。轮询启停仍由模式控制。

**Tech Stack:** Obsidian API (ButtonComponent, Editor, Component), TypeScript, esbuild(`npm run build`)。

## Global Constraints

- 无测试设施(仓库无测试运行器)→ 验证靠 `npm run build` + Obsidian 人工检查,不写单测
- 图标名必须为 lucide 名称 `text-cursor`(Obsidian `setIcon` 直接收)
- 所有按钮文案中文,与现有按钮一致
- 旧窗口持久化状态无 `trackCursor` 字段 → 按 `undefined`(假)处理,不需要迁移逻辑
- 提交信息遵循仓库风格:`feat:` / `docs:` 前缀,中文正文

---

### Task 1: 状态字段 + 按钮 UI

**Files:**
- Modify: `src/teleprompter.ts:13-24`(`TeleprompterWindowState` 接口)
- Modify: `src/teleprompter.ts:60`(字段声明区)
- Modify: `src/teleprompter.ts:181-187`(buildDOM 模式按钮后)
- Modify: `src/teleprompter.ts:100-101`(构造函数)
- Modify: `src/teleprompter.ts:473-478`(`updateModeBtn` 附近,加 `updateTrackBtn`)
- Modify: `src/teleprompter.ts:856-868`(createWindow 默认状态)

**Interfaces:**
- Produces: `TeleprompterWindowState.trackCursor: boolean`(默认 `false`);`private trackBtnEl: ButtonComponent`;`private updateTrackBtn()`——后续 Task 2 用
- Consumes: 无(独立 UI 层)

- [ ] **Step 1: `TeleprompterWindowState` 加字段**

在 `src/teleprompter.ts` 接口 `TeleprompterWindowState`(约 13-24 行)的 `boundDoc` 行后加:

```ts
  trackCursor: boolean;
```

- [ ] **Step 2: 实例字段声明**

在 `private modeBtnEl!: ButtonComponent;`(60 行)后加:

```ts
  private trackBtnEl!: ButtonComponent;
```

- [ ] **Step 3: buildDOM 加按钮**

在 `this.modeBtnEl.onClick(...)` 行(187 行)后加:

```ts
    // 跟踪光标 —— 行模式光标跟随开关（默认关，独立于模式）
    this.trackBtnEl = addBtn("text-cursor", "跟踪光标", () => this.toggleTrackCursor(), true);
```

- [ ] **Step 4: 构造函数初始化按钮**

在构造函数 `this.updateModeBtn();`(101 行)后加:

```ts
    this.updateTrackBtn();
```

- [ ] **Step 5: 加 `updateTrackBtn()`**

在 `updateModeBtn()` 方法(473-478 行)后加:

```ts
  private updateTrackBtn() {
    this.trackBtnEl?.buttonEl.toggleClass("is-active", this.state.trackCursor);
    this.setTpTooltip(this.trackBtnEl?.buttonEl ?? null, () =>
      this.state.trackCursor ? "跟踪光标（已开启）" : "跟踪光标"
    );
  }
```

- [ ] **Step 6: createWindow 默认状态**

在 `createWindow()` 状态对象(856-868 行)加 `boundDoc: null,` 后加:

```ts
      trackCursor: false,
```

- [ ] **Step 7: 构建验证**

Run: `npm run build`
Expected: esbuild 无错误输出,`main.js` 更新

- [ ] **Step 8: 提交**

```bash
git add src/teleprompter.ts
git commit -m "feat: 提词器工具栏加跟踪光标按钮（UI 层）"
```

### Task 2: 开关行为 + 轮询门控

**Files:**
- Modify: `src/teleprompter.ts:567-581`(`pollCursor`)

**Interfaces:**
- Consumes: `state.trackCursor`、`toggleTrackCursor` 自身定义、`refreshLine()`、`startPolling()`、`lastPollKey`(Task 1 及现有代码)
- Produces: 无(最终行为)

- [ ] **Step 1: 加 `toggleTrackCursor()`**

在 `pollCursor()` 方法(567 行)前加:

```ts
  /** 跟踪光标开关：开启立即提取当前行并跟随光标；关闭保持原位（行模式静态化） */
  private toggleTrackCursor() {
    this.state.trackCursor = !this.state.trackCursor;
    this.updateTrackBtn();
    if (this.state.trackCursor) {
      this.refreshLine(); // 立即提取当前光标行（行模式守卫在 refreshLine 内）
      this.startPolling(); // 重解析跟随编辑器 + 强制首轮同步（内部置 lastPollKey = ""）
    }
    this.persist();
  }
```

- [ ] **Step 2: `pollCursor()` 加门控**

将 `pollCursor()` 整体(567-581 行)替换为:

```ts
  /** 轮询：选中提取始终生效；行跟随仅在「行模式 + 跟踪光标开启」时执行。
      跟踪关闭 → 行模式静态，光标移动不覆盖（prev/next 手动浏览也不被覆盖） */
  private pollCursor() {
    const ed = this.followEditor;
    if (!ed) return;
    try {
      const extractEnabled = this.plugin.settings.teleprompter?.selectionExtractEnabled !== false;
      if (extractEnabled && ed.somethingSelected()) {
        const key = "S:" + ed.getSelection();
        if (key === this.lastPollKey) return;
        this.extractFrom(ed);
        return;
      }
      if (!this.state.trackCursor || this.state.mode !== "line") return;
      const key = "L:" + ed.getCursor().line;
      if (key === this.lastPollKey) return;
      this.extractFrom(ed);
    } catch {
      this.resyncFollow(); // 编辑器已销毁，重解析
    }
  }
```

注意:`extractFrom` 内部仍会写 `lastPollKey`,与原有去重语义一致;选中提取分支不再依赖 `extractFrom` 里的行模式逻辑(该分支原本就会先走选中覆盖)。

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: esbuild 无错误输出

- [ ] **Step 4: 人工验证清单(Obsidian 里手动过一遍)**

1. 打开提词器 → 按钮出现在模式切换与「上一项」之间,图标为光标形状,未激活
2. 默认关闭:在编辑器移动光标 → 提词器内容不变;prev/next 手动浏览正常
3. 点击按钮激活(`is-active` 高亮)→ 内容立即跳到当前光标行;移动光标 → 内容跟随
4. 开启跟踪时切高亮提取模式 → 光标移动不更新;切回逐行提取 → 恢复跟随
5. 关闭跟踪 → 内容保持原位,移动光标无变化
6. 关闭跟踪时选中文本 → 选中提取仍生效(内容显示选中文本);取消选中 → 内容保持原位
7. 重启 Obsidian → 按钮状态恢复(开/关各试一次)
8. 开启跟踪后手动 prev/next 浏览,光标不动 → 内容不被覆盖

- [ ] **Step 5: 提交**

```bash
git add src/teleprompter.ts
git commit -m "feat: 跟踪光标开关与轮询门控，行模式光标跟随独立可切换"
```
