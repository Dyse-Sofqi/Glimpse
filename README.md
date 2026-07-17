## Gazer

Obsidian 插件，根据选中内容或搜索关键词动态高亮文本。

目前仅支持源码模式（Source）和实时预览模式（Live Preview）。阅读模式（Reading）和旧版编辑器暂不支持。

### 选择高亮

无选中内容时，自动高亮光标所在单词的所有出现位置：
- 大小写不敏感匹配
- 光标所在单词标记为 `.cm-current-word`
- 文档中其他位置匹配的单词标记为 `.cm-matched-word`
- 所有匹配项附带 `data-contents` 属性存储当前单词值

有选中内容时，高亮选中文本的所有出现位置：
- 大小写不敏感匹配
- 当前选中文本默认标记为 `.cm-selection`
- 文档中其他位置匹配的字符串标记为 `.cm-matched-string`
- 所有匹配项附带 `data-contents` 属性存储当前选中字符串值

### 持久高亮

定义搜索查询并关联 CSS 类名和颜色来创建持久高亮。匹配的字符串会自动标记对应 CSS 类并应用所选背景色。

支持正则表达式查询（需开启对应选项）。

可定义任意数量的独立高亮器，类名必须唯一。大量复杂正则查询可能影响性能，请注意控制复杂度。

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

#### 0.3.2 (2026-07-17)
- 拖拽图标改为 Obsidian 原生 Lucide `grip-vertical`
- 拖拽图标和颜色预览整合进 `highlighter-details` 内展示
- 移除 `highlighter-item-draggable` 冗余容器
- 设置项描述仅保留搜索表达式/搜索词，移除 CSS 类名和颜色
- 解锁中文选择高亮：`minSelectionLength` 默认值 3→1
- 修复 `.query-wrapper input` 宽度 `15ch` 导致切换按钮遮挡保存按钮
- TypeScript 严格模式全面清理，修复所有类型错误和模块导入问题
