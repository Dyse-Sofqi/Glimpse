## Glimpse

Obsidian 插件，根据选中内容或搜索关键词动态高亮文本。

目前仅支持源码模式（Source）和实时预览模式（Live Preview）。阅读模式（Reading）和旧版编辑器暂不支持。

### 选择高亮

有选中内容时，高亮选中文本的所有出现位置：
- 大小写不敏感匹配
- 当前选中文本默认标记为 `.cm-selection`
- 文档中其他位置匹配的字符串标记为 `.cm-matched-string`
- 所有匹配项附带 `data-contents` 属性存储当前选中字符串值

### 持久高亮

定义搜索查询并关联 CSS 类名和颜色来创建持久高亮。匹配的字符串会自动标记对应 CSS 类并应用所选背景色。每条样式与颜色缓存于索引，标记可随时开关控制匹配表现。

支持正则表达式查询（需开启对应选项），正则模式下可使用**命名捕获组**（如 `(?<groupName>…)`）精确高亮子匹配内容。

#### 标记类型

每条样式可组合启用多种标记方式：

- **匹配**：高亮完整匹配文本（默认开启）
- **父行**：为匹配所在整行添加 CSS 类，支持针对整行而非单词设置样式
- **开始 / 结束**：在匹配起止位置插入零宽度 widget 元素，配合 CSS 可实现前缀/后缀图标
- **捕获组**：正则模式下，高亮命名捕获组 `(?<name>…)` 匹配的子内容，而非完整表达式。捕获组名即 CSS 类名

#### 自定义 CSS

每条样式可编写独立 CSS 规则，自动注入页面 `<style>` 元素。编辑器内通过 CodeMirror 实例高亮渲染，支持深色/浅色主题适配。CSS 变更随保存即时生效。

#### 标签组

样式支持分组管理：新建、重命名、删除分组，拖拽样式至标签页即可归类。「全部启用/禁止」工具栏按钮统一控制当前分组匹配开关状态。

#### 导入导出

支持一键导入（从剪贴板 JSON）、一键导出（批量导出所有样式含分组信息）、单条样式导出。兼容旧格式数据（无分组 → 归入"默认"）。

#### 示例

可在插件设置右上角点击 `Import` 按钮导入以下示例。

##### 视觉检查
高亮双空格、空列表标记、双重列表标记、多余前置空格和尾部空格。

```json
{
  "Mini-Linting": {
    "class": "Mini-Linting",
    "color": "#A70F0F38",
    "regex": true,
    "query": " {2,}(?!\\|| |$)|- - |^\\s*- \\n|^ +(?![0-9-`])",
    "mark": ["match"],
    "css": ".cm-line .Mini-Linting {\n  background: none;\n}\n\n.cm-line:not(.cm-active) .Mini-Linting {\n  outline: 1px solid var(--text-error);\n}"
  }
}
```

##### 标出写作中应避免的填充词
```json
{
  "Filler-Words": {
    "class": "Filler-Words",
    "color": "#2D801838",
    "regex": true,
    "query": "\\b([Aa] bit|[Aa]bsolutely|[Aa]ctually|[Aa]nd all that|[Aa]nd so forth|[Aa]nyway|[Bb]asically|[Cc]ertainly|[Cc]learly|[Cc]ompletely|[Dd]efinitely|[Ee]ffectively|[Ee]ntirely|[Ee]ssentially|[Ee]vidently|[Ee]xtremely|[Ff]airly|[Ff]rankly|[Ff]requently|[Gg]enerally|[Hh]opefully|[Kk]ind of|[Ll]argely|[Ll]iterally|[Mm]ore or less|[Mm]ostly|[Oo]ccasionally|[Oo]ften|[Oo]verall|[Pp]articularly|[Pp]erhaps|[Pp]ossibly|[Pp]ractically|[Pp]recisely|[Pp]resumably|[Pp]retty|[Pp]rimarily|[Pp]robably|[Pp]urely|[Qq]uite|[Rr]arely|[Rr]ather|[Rr]eally|[Rr]elatively|[Ss]eriously|[Ss]ignificantly|[Ss]imply|[Ss]lightly|[Ss]omehow|[Ss]ort of|[Ss]pecifically|[Ss]trongly|[Ss]upposedly|[Ss]urely|[Tt]he fact that|[Tt]otally|[Tt]ruly|[Tt]ypically|[Uu]ltimately|[Uu]sually|[Vv]ery|[Vv]irtually|[Ww]idely)\\b",
    "mark": ["match"],
    "css": ".cm-line .Filler-Words{\n\ttext-decoration: line-through;\n\tbackground: none;\n\tcolor: var(--text-muted);\n}\n\n/* where to disable */\n.HyperMD-quote.cm-line .Filler-Words,\n.pdf-annotations .cm-line .Filler-Words {\n\ttext-decoration: none;\n\tcolor: unset;\n}"
  }
}
```

##### Pandoc 导出中的自定义样式高亮（`:::`）
```json
{
  "Pandoc-Syntax": {
    "class": "Pandoc-Syntax",
    "color": "#77787C4A",
    "regex": true,
    "query": "::: \\{.*?\\}[\\s\\S]*?:::",
    "mark": ["match", "group"],
    "css": ""
  }
}
```

### 高亮索引

自动检索当前文档中 `==...==` 包裹的 Obsidian 标准高亮文本，以标题层级组织在侧边栏展示。

- **标题分组**：按文档标题结构组织高亮项，无标题的高亮项归入文档名分组展示
- **层级图标**：h1-h6 标题前显示对应 lucide heading 图标，颜色跟随 `--h1-color` ~ `--h6-color` CSS 变量
- **祖先标题栏**：共享祖先标题以独立行展示于首个索引项前，与正常标题使用相同图标和配色
- **毛玻璃卡片**：高亮文本以圆角毛玻璃卡片展示，支持悬浮增强毛玻璃特效
- **一键复制**：每张卡片右上角复制按钮，点击复制文本内容并弹出提示
- **自动刷新**：切换文档时自动刷新索引；新焦点文档无高亮时保留上次检索结果
- **命令面板**：注册「打开高亮索引」命令，可从命令面板呼出
- **设置开关**：可选择插件启动时自动打开高亮索引

### 设置

#### 延迟（Delay）

光标移动后高亮应用的延迟时间

#### 忽略词（Ignored Words）

逗号分隔的单词列表，这些单词不会被高亮

默认词表：https://gist.github.com/sebleier/554280

### 限制

- 阅读/预览模式暂不支持动态高亮

### 致谢

感谢 @chrisgrieser（aka @pseudometa）提供的插件创意和反馈。
感谢 @chetachiezikeuzor 的插件设置界面代码，灵感来自 https://github.com/chetachiezikeuzor/highlightr-Plugin/

---


### 更新日志

#### 0.8.2 (2026-07-24)

- **修复保存自定义样式不生效**：`updateStaticHighlighter` 重构时移除了 `Compartment` 和 `iterateCM6` 调度，导致已打开编辑器中的 Facet 值未更新，ViewPlugin 不会重绘；恢复完整 compartment 架构
- **修复开关切换样式不立即生效**：`reconfigureStaticHighlighter` 仅传入 Facet 配置遗漏了 `staticHighlighter` ViewPlugin，compartment 替换时 ViewPlugin 丢失 → 需重启生效；现在 reconfigure 同时包含 ViewPlugin 和 Facet
- **完善自定义样式功能介绍**：补充标记类型、自定义 CSS 注入机制、分组管理、导入导出等详细说明

#### 0.8.1 (2026-07-24)

- **修复捕获组不生效**：`regexp-cursor.ts` 正则 flags 缺 `d`（`hasIndices`），改用原生 `this.re.exec()` 替代 `regexp-match-indices` polyfill
- **修复捕获组位置偏移错误**：`linePos + groupFrom` 改为 `(from - match.index) + groupFrom`，单行/多行光标通用
- **修复编译阻塞**：`esbuild.config.mjs` 移除 `watch` 选项，升级 esbuild 至 `0.25.12`

#### 0.8.0 (2026-07-23)

- **高亮索引代码拆分**：将 `HighlightIndexView` 从 `main.ts` 提取为独立模块 `src/highlight-index-view.ts`，消除主文件膨胀
- **标题层级分组**：高亮索引支持按文档标题结构分组展示，每个匹配项归入最近的前置标题下
- **祖先标题追溯**：展示每个标题的父标题链（祖先面包屑路径），首个索引项前集中展示共享祖先
- **标题等级图标与配色**：h1-h6 标题使用 `setIcon(heading-1~6)` lucide 图标，`--h1-color` ~ `--h6-color` CSS 变量着色；祖先标题复用同套样式
- **文档名标题**：索引顶部居中显示当前文档名
- **孤立匹配前置**：无标题归属的高亮项（文档标题之前的内容）置于最前，以文档名为分组名
- **标签页切换 Bug 修复**：点击索引条目不再因焦点切换清空内容回退到上一个文档的索引
- **README 补充**：新增「高亮索引」功能介绍

#### 0.7.2 (2026-07-19)

- **高亮索引**：新增「高亮索引」侧边栏标签页，自动检索文档中 `==...==` 包裹的 Obsidian 标准高亮文本
- **毛玻璃卡片**：高亮文本以圆角毛玻璃卡片展示，支持悬浮增强毛玻璃特效（0.08s 快速过渡）
- **一键复制**：每张卡片右上角添加复制按钮（lucide clipboard-paste），点击复制文本内容并弹出提示
- **自动检索**：切换文档时自动刷新高亮索引；新焦点文档无高亮时保留上次检索结果
- **失焦保留**：焦点离开 Markdown 编辑器时仍展示最后文档的高亮结果
- **命令面板**：注册「打开高亮索引」命令，可从命令面板呼出
- **可选中文本**：卡片内文字可选中，字体为正文字体 0.8 倍
- **设置开关**：「默认打开高亮索引」开关，开启后插件启动时自动启用高亮索引标签页
- **唯一实例**：保证高亮索引标签页只同时存在一个，重载时正确清理
- **设置 UI 重构**：持久高亮/选择高亮/高亮索引三标签页切换架构，代码拆分为独立模块

#### 0.7.1 (2026-07-19)

- **缩略图重构**：固定宽度 120px，字体大小和换行根据编辑器每行最大字符数自适应，逐字符按像素宽度换行兼容中英混排
- **HiDPI 适配**：`ctx.scale(dpr, dpr)` 统一坐标系为 CSS 像素，字号、换行、行高不受设备像素比影响
- **滚动偏移渲染**：缩略图内容跟随编辑器滚动偏移，滑块拖到底时显示文档最后一行；拖拽滑块也按视觉内容高度映射
- **即时渲染**：滚动事件触发全量重绘（含偏移），消除滚动延迟
- **性能优化**：逐字 `measureText` 改为字符宽度查表（半角/全角各测一次再整数累加），长文档卡顿大幅减少
- **默认关闭**：缩略图设置默认值改为 `false`，需手动在设置中开启
- **行高修正**：`fontSize × 1.3` 文本行、`fontSize × 0.65` 空行，避免重叠
- 翻译：`src/highlighters/minimap.ts` 全部使用中文注释

#### 0.7.0 (2026-07-18)

- **滚动条标记**：选中文本时在滚动条上显示匹配位置矩形，使用主题强调色 `--interactive-accent`，canvas 实现
- **缩略图（Minimap）**：编辑器右侧显示文档缩略图（类似 VS Code minimap），支持拖拽滑块滚动、点击跳转、滚轮同步，可独立开关
- **全文档搜索**：选中匹配不再限于可见区域，使用 `SearchCursor` 遍历全文
- **匹配行采集与装饰限制分离**：先采集所有匹配行号再限制装饰数量，滚动条标记覆盖全文不受 `maxMatches` 限制
- **反向选区修复**：从锚点拖选到光标左侧时（`from > to`），规范化边界确保 `sliceDoc` 不返回空串
- **防抖修复**：默认延迟 200→0 的问题，`highlightDelay` 的 Facet combine 策略 `Math.min` → `Math.max`
- **过期 setTimeout 防护**：`clearVersion` 计数器避免旧 `setTimeout` 擦除新装饰
- **设置持久化**：`minSelectionLength`、`maxMatches` 强制跟随 `DEFAULT_SETTINGS`，data.json 残留值自动写回
- **中英文注释**：`selection.ts`、`scrollbar-markers.ts` 添加完整中文注释

- **插件重命名**：从 GazerPlugin 统一改为 GlimpsePlugin，更新所有文件中的类型引用、CSS 类名和导出文件名
- **修复新建高亮器不生效的 Bug**：`static.ts` 中错误使用了非标准数组方法 `.contains()`（返回 `undefined`），导致新保存的高亮器 `mark` 数组虽包含 `"match"` 却无法激活替换为 `.includes()`
- **设置 UI 全面 CSS 重构**：遵循 Obsidian 插件审核规范，移除所有内联 `setAttribute("style")`，改用 CSS 自定义属性（`--picker-bg`）和样式类（`.glimpse-modal-input`、`.highlighter-name`）；新增 `styles.css` 规则
- **新增从剪贴板导入**：保存按钮前添加带 `clipboard-copy` 图标的导入按钮，解析剪贴板 JSON 填充表单全部字段（名称、颜色、查询、正则、标记开关、自定义 CSS），自动适配暗/亮主题编辑器
- **新增单个高亮器导出**：编辑和删除按钮之间添加带 `clipboard-paste` 图标的导出按钮，可单独导出某个自定义样式的 JSON
- **新建表单增加"匹配"开关**：新建高亮器时默认开启，直观显示该样式保存后将处于激活状态；父行/开始/结束/捕获组默认关闭
- **工具栏按钮更名**："导入" → "一键导入"，"导出" → "一键导出"
- **代码清理**：`regexp-cursor.ts` 统一空白和格式风格

#### 0.5.0 (2026-07-18)

- TypeScript: 所有类属性添加 definite assignment 断言，移除未使用的 `customCSS` 属性及接口
- 修复 `updateConfig` 中 `reconfigureSelectionHighlighter` 类型不匹配问题
- tsconfig: 移除已弃用的 `baseUrl`，启用 `strict`，`moduleResolution` 改为 `bundler`
- 新增 `.clickable-icon:hover` 反主题渗透样式，使用 `--icon-color-hover` 和 `--background-modifier-hover`
- 新建高亮器时父行/开始/结束开关默认关闭

#### 0.4.0 (2026-07-17)

- 新增标签组功能：支持创建、重命名、删除标签组，自定义样式可归类管理
- 支持拖拽自定义样式到标签组标签页上，带悬停动画效果
- 添加标签组按钮默认弹出命名对话框
- 导入兼容旧格式数据（无标签组 → 全部归入"默认"）
- 标签组及其操作按钮全面使用 Obsidian 原生 `.clickable-icon` 样式
- 标签组 UI 重新设计：0 间隙排列、强调色激活标签、圆形上角/方形下角、贯穿分隔线
- TypeScript 严格模式错误修复

#### 0.3.2 (2026-07-17)
- 拖拽图标改为 Obsidian 原生 Lucide `grip-vertical`
- 拖拽图标和颜色预览整合进 `highlighter-details` 内展示
- 移除 `highlighter-item-draggable` 冗余容器
- 设置项描述仅保留搜索表达式/搜索词，移除 CSS 类名和颜色
- 解锁中文选择高亮：`minSelectionLength` 默认值 3→1
- 修复 `.query-wrapper input` 宽度 `15ch` 导致切换按钮遮挡保存按钮
- TypeScript 严格模式全面清理，修复所有类型错误和模块导入问题
