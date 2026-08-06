# 提词器文本域双击跳转 + 右键复制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提词器文本显示域加双击跳转光标到捕获行 + 右键复制纯文本。

**Architecture:** 单文件改动 `src/teleprompter.ts`。buildDOM 中 contentEl 创建后挂两个 DOM 事件监听;双击解析目标行(setCursor + focus),右键 preventDefault + 复制 innerText。

**Tech Stack:** Obsidian API (Editor.setCursor/focus), DOM events, Clipboard API + execCommand 回退。

## Global Constraints

- 无测试设施 → `npm run build`(tsc --noEmit + esbuild)为验证门槛,Obsidian 人工清单见 Task 1
- 目标行规则:高亮 → `matches[currentIndex].line`;行模式 → `currentLine`;选中覆盖 → `ed.getCursor().line`
- 编辑器来源:`resolveDoc()`(绑定 > 活动),回退 `followEditor`
- 复制内容:`contentEl.innerText` 后 `.trim()`
- 右键必须 `preventDefault` 抑制原生菜单
- 提交:`feat:` 前缀,中文正文;含 `src/teleprompter.ts` + `main.js`(构建产物)
- 仅行模式生效规则沿用既有代码,不动轮询/模式逻辑

---

### Task 1: 双击跳转 + 右键复制事件

**Files:**
- Modify: `src/teleprompter.ts:225`(contentEl 创建后,加事件绑定)
- Modify: `src/teleprompter.ts:674-719`(渲染区,加两个处理方法)

**Interfaces:**
- Consumes: 既有 `resolveDoc()`、`currentLine`、`currentIndex`、`matches`、`selectionOverride`、`followEditor`、`state.mode`
- Produces: 无(最终行为)

- [ ] **Step 1: 事件绑定**

在 `src/teleprompter.ts` 的 `this.contentEl = this.bodyEl.createDiv(...)`(225 行)后加:

```ts
    // 双击：光标跳到捕获文本所在行并聚焦编辑器（穿透锁定时事件穿透,天然失效）
    this.contentEl.addEventListener("dblclick", () => this.jumpToCapturedLine());
    // 右键：复制捕获文本的纯文本（渲染后 innerText,无 md 语法;抑制原生菜单）
    this.contentEl.addEventListener("contextmenu", e => {
      e.preventDefault();
      this.copyCapturedText();
    });
```

- [ ] **Step 2: 加 `jumpToCapturedLine()`**

在 `startDrag` 方法(721 行)前加:

```ts
  /** 双击：光标跳到捕获文本所在行并聚焦编辑器。
      高亮模式 → 当前匹配项行;行模式 → 当前显示行;选中覆盖 → 编辑器光标行 */
  private jumpToCapturedLine() {
    const src = this.resolveDoc();
    const ed = src?.view?.editor ?? this.followEditor;
    if (!ed) return;
    const line = this.state.mode === "highlight"
      ? (this.matches[this.currentIndex]?.line ?? ed.getCursor().line)
      : (this.selectionOverride ? ed.getCursor().line : this.currentLine);
    ed.setCursor({ line: Math.max(line, 0), ch: 0 });
    ed.focus();
  }
```

- [ ] **Step 3: 加 `copyCapturedText()`**

在 `jumpToCapturedLine()` 后加:

```ts
  /** 右键：复制捕获文本的纯文本（渲染后 innerText 天然无 md 语法）。
      clipboard API 失败回退 execCommand 隐藏 textarea */
  private async copyCapturedText() {
    const text = (this.contentEl.innerText ?? "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }
```

- [ ] **Step 4: 构建验证**

Run: `npm run build 2>&1 | Select-Object -Last 3`
Expected: tsc 无错误,`main.js` 更新

- [ ] **Step 5: 提交**

```bash
git add src/teleprompter.ts main.js
git commit -m "feat: 提词器文本域双击跳转光标行，右键复制纯文本"
```

- [ ] **Step 6: 人工验证清单(Obsidian 手测,用户执行)**

1. 行模式双击 → 编辑器光标跳到该行并聚焦,可立即打字
2. 高亮模式双击 → 跳到当前匹配项所在行
3. 选中提取时双击 → 光标跳到编辑器光标行
4. 右键 → 无原生菜单;粘贴得纯文本(`**加粗**` 显示时复制得 `加粗`)
5. 穿透锁定时双击/右键均无反应
6. 无文档打开时双击/右键无报错(静默)
