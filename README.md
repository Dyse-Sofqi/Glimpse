> **English** — Scroll down for the English README.


## Glimpse

![Release](https://img.shields.io/github/v/release/Dyse-Sofqi/Glimpse?style=flat-square\&label=Release)

![Downloads](https://img.shields.io/github/downloads/Dyse-Sofqi/Glimpse/total?style=flat-square\&label=Downloads)



![Stars](https://img.shields.io/github/stars/Dyse-Sofqi/Glimpse?style=flat-square\&label=Stars)

![License](https://img.shields.io/github/license/Dyse-Sofqi/Glimpse?style=flat-square\&label=License)

> **关键词**：动态高亮、选择高亮、持久高亮、正则查询、捕获组、自定义 CSS、CSS 自动补全、高亮器描述、高亮索引、提词器、光标联动、滚动条标记、缩略图、文字渐变、字幕投影、滚动同步、穿透锁定、文档绑定、分组管理、导入导出、音乐播放、歌词面板、卡拉OK逐字高亮、在线歌词、多平台下载

根据选中内容或搜索关键词动态高亮文本的 Obsidian 插件，主要功能：

- **选择高亮**：选中文本后即时高亮全文所有匹配（**仅在检索到选区之外的至少一个出现位置时才出现装饰**），附滚动条标记与缩略图
- **持久高亮**：按正则/关键词查询持久标记，支持捕获组、父行、开始/结束 widget、自定义 CSS（内置带 CSS 自动补全的代码编辑器）与高亮器描述，配标签组管理与一键导入导出
- **高亮索引**：自动检索 `==高亮==` 文本，按文档标题层级组织为侧边栏索引，支持光标联动与键盘导航
- **提词器（桌面端）**：歌词式浮动提词窗口，跟随文档/光标实时显示，支持 100–900 字重、文字渐变、字幕投影、穿透锁定、文档绑定、滚动同步与多实例
- **音乐**：侧边栏歌词音乐面板——三标签页歌单（网易云**账号歌单**同步到本地 / 在线歌单四平台搜索下载 / 本地歌单自定义分组与拖拽排序）、逐字卡拉OK高亮与双语注释、歌词自动跟随（手动滚动即暂停）、音频文件夹（MP3/FLAC/M4A/OGG，支持库外绝对路径）作歌单、四平台在线歌词获取、下载前试听与推荐歌单

目前仅支持源码模式（Source）和实时预览模式（Live Preview）。阅读模式（Reading）和旧版编辑器暂不支持。

### 选择高亮

有选中内容时，高亮选中文本的所有出现位置：

- 大小写不敏感匹配，全文档检索（不限于可见区域）
- **装饰出现条件**：仅当检索到**选区之外的至少一个出现位置**时才施加装饰；选中仅出现一次的文本时不显示任何下划线，滚动条标记同样不出现
- 当前选中文本标记为 `.cm-current-string`
- 文档中其他位置匹配的字符串标记为 `.cm-matched-string`
- 所有匹配项附带 `data-contents` 属性存储当前选中字符串值
- **滚动条标记 / 缩略图**：检索到结果时滚动条显示匹配位置标记；可选在编辑器右侧显示缩略图（类似 VS Code minimap，可拖动滚动）
- **检索上限**：设置中可调「选择检索的字符串上限」（2-60，默认 30），超过该长度的选中文本不再进行全文匹配，避免超长选择拖慢编辑


### 持久高亮

定义搜索查询并关联 CSS 类名和颜色来创建持久高亮。匹配的字符串会自动标记对应 CSS 类，并按所设背景色着色（**背景色可留空**，未选色时只应用高亮类，样式完全交给自定义 CSS）。每条样式与颜色缓存于索引，标记可随时开关控制匹配表现。

每条样式可附带一段**描述**，备注该表达式匹配什么内容——仅用于设置页展示，不参与匹配。设置页里描述排在名称下一行，列表卡片里排在表达式下一行。

支持正则表达式查询（需开启对应选项），正则模式下可使用**命名捕获组**（如 `(?<groupName>…)`）或**无名捕获组**（如 `(…)`）精确高亮子匹配内容。

#### 标记类型

每条样式可组合启用多种标记方式：

- **匹配**：高亮完整匹配文本（默认开启）
- **父行**：为匹配所在整行添加 CSS 类，支持针对整行而非单词设置样式
- **开始 / 结束**：在匹配起止位置插入零宽度 widget 元素，配合 CSS 可实现前缀/后缀图标
- **捕获组**：正则模式下，高亮捕获组匹配的子内容而非完整表达式。子内容使用自定义样式颜色。支持命名组 `(?<name>…)` 和无名组 `(…)`，勾选「捕获组」时自动跳过整段匹配

#### 自定义 CSS

每条样式可编写独立 CSS 规则，经 `CSSStyleSheet` + `document.adoptedStyleSheets` 注入页面（不创建 `<style>` 元素）。  
编辑器内通过 CodeMirror 实例高亮渲染，支持深色/浅色主题适配。CSS 变更随保存即时生效。

输入框本身是一个完整的 **CodeMirror 6 代码编辑器**：语法高亮、括号与引号自动闭合、撤销历史，并**按输入自动补全 CSS**——属性名、属性值关键字与选择器标签名都会在输入时弹出候选，也可用 Ctrl/Cmd-Space 手动唤起；选中属性会连带插入冒号与空格。

#### 标签组

样式支持分组管理：新建、重命名、删除分组，拖拽样式至标签页即可归类，分组标签可拖动调整顺序（默认分组固定首位不可拖动）。「全部启用/禁止」工具栏按钮统一控制当前分组匹配开关状态。

#### 导入导出

支持一键导入（从剪贴板 JSON 或文件）、一键导出（批量导出所有样式含分组信息）、单条样式导出。导入/导出弹窗使用样式化纯文本框：按钮置于文本框上方（导出到文件 / 导出到粘贴板、从文件导入 / 从下面粘贴板导入），文本框高度随内容自适应，界面风格统一。兼容旧格式数据（无分组 → 归入"默认"）。

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
- **光标联动**：编辑器光标落入高亮语句所在行时，对应卡片自动选中并滚动至屏幕中央
- **键盘导航**：聚焦索引标签页时 ↑/↓ 切换上/下一项高亮卡片（从已选中卡片起算），并同步编辑器光标与提词器
- **右键复制**：右键卡片复制文本内容并弹出提示
- **锚定文档回退**：当前页面检索不到高亮时，自动从提词器锚定（绑定）的文档中检索展示；锚定文档未打开为视图时读盘检索
- **自动刷新**：首次打开文档即检索，切换文档时自动刷新索引（补监听 `file-open`，覆盖新建 / 资源管理器点击当前标签页等不触发叶子变更的打开方式）；新焦点文档无高亮时保留上次检索结果
- **命令面板**：注册「打开高亮索引」命令，可从命令面板呼出
- **设置开关**：「启动时默认打开高亮索引」（默认关闭），开启后插件启动时自动启用索引标签页


### 提词器（桌面端）

桌面歌词式浮动提词窗口，跟随文档内容实时显示，适合提词、朗读、讲解场景。仅桌面端可用。

- **三种内容模式**：
  - **行提取**：默认静态显示（打开/切换文档时提取一次），点击工具栏「跟踪光标」开启光标跟随——光标移动自动提取所在行（轮询检测，绑定/活动文档均可）；滚轮/按钮可手动切换上一行、下一行
  - **高亮提取**：按顺序显示 `==...==` 高亮匹配，适合按稿朗读
  - **歌词提取**：展示音乐模块当前正在播放的歌词行，随播放进度自动换行（按歌曲 + 行号去重，不被高频状态推送重绘）；上一项/下一项/滚轮跳转到相邻歌词行的时间戳（暂停时同样生效）；无播放会话时显示「未在播放歌曲」占位，前奏未唱到第一行显示「♪ 前奏 ♪」
  - **选中提取**：选中文本时临时覆盖显示选中内容，取消选中自动恢复
- **模式切换**：工具栏下拉列表（逐行提取 / 高亮提取 / 歌词提取），保留原生下拉箭头、收起值与弹出选项均居中；窗口拖拽/滚轮逻辑对下拉豁免（选项可正常弹出），穿透锁定时隐藏
- **高亮索引联动**：点击高亮索引卡片自动绑定该文档并切换到高亮提取模式；双击提词器文本区同步选中索引中对应卡片；开启滚动同步后，上一项/下一项切换同样联动选中对应卡片
- **滚动同步**：工具栏「穿透锁定」右侧按钮（lucide `link`）开启后，上一项/下一项切换同步触发——逐行模式光标跳转对应上一/下一行，高亮模式选中索引中对应上一/下一项卡片；穿透锁定时随非交互按钮一并隐藏
- **文档绑定**：将窗口固定到某个文档，不再跟随活动文档；已锁定后再次点击绑定按钮直接解除锁定，不会转向锁定当前活动文档
- **穿透锁定**：窗口整体穿透鼠标（仅保留交互按钮），不遮挡编辑；背景全透明统一由「隐藏背景」按钮控制，穿透锁定本身不再改动背景；锁定状态下按钮栏同样仅在鼠标悬停时显示，移出窗口自动隐藏，「跟踪光标」「滚动同步」按钮随其他非交互按钮一并隐藏
- **隐藏背景**：激活后窗口背景全透明（悬停/拖拽也不显示），未激活时背景色常显且透明度引用设置界面所设的背景透明度；激活时正文文字自动附加字幕投影
- **文字投影（字幕效果）**：隐藏背景时为正文文字附加柔和投影（`drop-shadow`，严格位于文字之下），设置「文字阴影」折叠分组可调投影开关、水平/垂直偏移、模糊半径、不透明度（均带重置按钮），默认右偏 2px/下偏 3px/模糊 6px/不透明度 35%
- **文字渐变**：正文文字渐变色，设置「文字渐变」折叠分组提供渐变开关（覆盖「字体颜色」）、线性/径向类型、整体/逐字范围（逐字模式每字独立裁切渐变，emoji 等组合字符不拆碎）、渐变角度与颜色停靠点编辑器（增删/位置/色板，按位置排序），附与提词器同参数的实时预览
- **宽度自适应**：按内容最宽行自动适配宽度（切换上一项/下一项不增宽），宽度钳制视口上限，长文本换行不溢出；右缘可拖拽调整并自动锁定，宽度锁定后仍可直接拖拽，新宽度继承为锁定宽度
- **拖拽吸附**：贴近视口边缘或中心线时自动吸附，附辅助线提示
- **位置稳定**：窗口位置由用户决定，内容高度变化（换行、改字号、宽度自适应重算）不会移动窗口；重启后按保存的位置原样恢复，不再因恢复后的行文变高被抬升
- **字体大小**：32/40/50/64/80px 五档循环
- **字体 / 字重 / 颜色**：设置中可调正文字体（本机字体选择模态窗，`queryLocalFonts()` 枚举、兜底候选表测宽；多选 + 拖拽调优先级，首个可用字体优先生效、缺失自动顺延；支持搜索、预览与自定义字体输入）、字重（跟随主题 / 100–900）与文字颜色（色板，点击即应用；「清除」恢复跟随主题），均带「重置为初始值」按钮
- **工具栏**：模式切换为下拉列表（逐行提取 / 高亮提取 / 歌词提取）；跟踪光标（`text-cursor`，光标跟随开关）、上一项/下一项（`arrow-big-left`/`arrow-big-right`）、宽度锁定（`move-horizontal`）、穿透锁定（`lock`/`unlock`）、隐藏背景（`eye-off`）、字体档位图标（`heading-1`~`heading-5`）均为语义化 lucide 图标；按钮提示默认在上方弹出、上方无空间时自动翻转到底部；穿透锁定时仅保留上一项/下一项、穿透锁定、关闭等交互按钮；设置按钮直达提词器设置页
- **透明度**：设置中可调字体透明度（默认 100%）与背景透明度（默认 80%），两项均带「重置为初始值」按钮（lucide `rotate-ccw`）；背景色、边框与外轮廓阴影常显，透明度实时生效
- **主题适配**：切换浅色/深色主题时窗口背景色即时更新，无需重启
- **渲染样式**：内容复用主题与自定义 CSS（标题、代码块、内联格式等），仅字体大小由提词器控制；单行渲染前自动去掉行首缩进，嵌套列表等缩进行按无缩进列表/文本展示，不被误判为代码块
- **垂直居中**：文本显示域内内容垂直居中，短内容不再顶置；内容超过最大高度时回退常规滚动，顶部不截断；高度上限取 `min(70vh, 窗口下方可用空间)`——窗口贴近屏幕下缘时长行文在窗口内滚动，而不是把窗口撑出屏幕
- **状态栏入口**：右下角状态栏「打开提词器」按钮（lucide-presentation）一键打开/聚焦，可在设置中关闭
- **双击定位 + 选中**：双击文本显示域，编辑器光标跳到捕获文本所在行并选中对应文本（高亮模式选中匹配文本段、行模式选中整行、选中提取保留现有选择），聚焦并将选中范围滚动至视口中央
- **右键复制**：右键单击文本显示域，复制捕获文本的渲染后纯文本（无 Markdown 语法），成功弹出「已复制」通知
- **状态持久化**：关闭后重新打开即恢复上次窗口的位置、尺寸、模式、绑定、跟踪光标等状态；已关闭窗口的状态跨重启保留，Obsidian 重启后重开仍可恢复，已关闭的窗口不会在重启后自动弹出；**窗口位置按保存值原样恢复**，不再因恢复后的行文变高被抬升
- **空行回退**：当前行为空时显示上一项内容（半透明占位）
- **命令**：「打开提词器」「关闭所有提词器」，支持多实例

### 音乐

侧边栏歌词音乐面板（点击左侧 ribbon 音乐图标或命令「打开音乐面板」）：

**歌曲播放**

- **歌单面板（默认显示，三标签页）**：标题栏为「歌曲列表 (数量)」标题 + 「歌单/歌词」切换按钮（lucide 图标 + 当前面板文字，歌词面板标题栏同构并显示行数计数）；顶部为共用搜索框 + 分类下拉（本地=专辑类型，在线=平台），下方三个整行等宽的分段式标签页：**账号歌单**（网易云登录后拉取账号全部歌单，卡片展示封面/曲目数/创建者，点开浏览曲目，歌单头部「同步到本地」批量下载整张歌单）、**在线歌单**（四平台实时搜索，边输边出，按关键词相关度排序，行内试听/下载；无关键词时展示四源推荐歌单首屏）、**本地歌单**（音频文件夹歌单，支持自定义分组与拖拽排序）
- **本地歌单自定义分组**：歌曲行「分组」按钮（或右键组头）新建分组 / 归组 / 移出分组；列表按分组手风琴展示——组头为吸附式背景条（滚动时钉在列表顶部），组名跟随主题粗体与界面字体，左侧把手按住可拖动调整组序，组名 + 数量，默认全部折叠（点击展开当前组并折叠其他组，再点折叠当前组），组内行相对缩进、当前播放行左侧强调色竖条；搜索/筛选中自动展开全部有结果的组；未指派的歌进「未分组」区块；分组数据存 data.json（不产生额外文件），未建分组时保持扁平列表
- **拖拽排序**：按住任意歌曲行上下拖动调整顺序（5px 阈值防误触，拖到列表上下边缘自动滚动；分组视图内只在同组内换位），顺序存 data.json 并**同时决定顺序播放的切歌顺序**；搜索/筛选视图下禁用拖拽
- **顺序播放按分组范围**：正在播放的歌属于某个分组时，顺序播放的下一首/上一首只在该分组内循环（分组末首→分组首首，分组内仅一首时等效单曲循环）；未分组或未建分组时仍按整张歌单顺序
- **歌曲行交互**：**双击播放**（单击留给浏览/滚动，避免误触），悬停时底色浮起 + 阴影 + 封面播放浮层淡入（不描边、指针保持默认箭头，悬停底色取不透明的主题色阶，不会透出面板底色）；封面浮层即播放/停止按钮（当前播放行悬停显示暂停图标，点即暂停/续播）；账号歌单里已下载到本地的行同样走本地播放链路
- **侧边栏歌词面板**：标题栏布局与歌单面板一致；实时歌词当前行放大高亮，非当前行缩小淡化，点击任意歌词行跳转到对应时间；**手动滚动即暂停自动跟随**（往上翻看歌词不会被立刻拽回，换行时视口按锚点保持不动），滚回当前行完整可见后自动恢复；标题栏另有 ±2000ms **歌词偏移**滑块（每首歌独立，默认 -150ms，负值=歌词提前）
- **逐字高亮（卡拉OK）**：当前行按字/词变色 + 光晕；支持主流增强 LRC 的精确 `<mm:ss.xx>` 时间戳（如 `<00:12.16>沧<00:13.00>海`），无精确标记的行按行时长均分逐字
- **双语注释**：`原文 | 译文` 竖线语法，译文以灰色小字显示在原文下方，不参与逐字高亮
- **歌单来源**：设置「音频文件夹」指定 vault 内文件夹或库外 Windows 盘符绝对路径（如 `D:\Music`，可点「浏览」打开系统资源管理器选择），扫描其中的 MP3/FLAC/M4A/OGG 音频；音频内嵌标题/歌手/专辑/封面自动填充歌单，并探测**时长与文件大小**（元数据胶囊展示）
- **歌词来源**：优先读取音频同目录同名 `.lrc` 侧车文件（在 Obsidian 中编辑保存后，正在播放的歌词即时刷新），其次音频内嵌歌词（MP3 USLT / FLAC Vorbis / M4A ©lyr / OGG comment）；外部改动音频或歌词文件后自动重读
- **在线歌词自动搜索**：歌词面板检索不到歌词时自动搜索网易云 / QQ / 酷狗 / 酷我四平台，并**按相关度自动应用第一份有歌词的候选**（保存为侧车 .lrc 并立即显示）；全部候选都无歌词时退回候选列表手动挑选；「换歌词」按钮可随时重搜覆盖
- **播放控制（底栏两行）**：第一行为「歌单/歌词」切换按钮 + 可选中复制（`user-select: text`）的歌名 + 「定位当前歌曲」按钮（切到本地歌单、展开所在分组并居中滚动到当前行）；第二行依次为播放模式（单曲循环 / 顺序 / 乱序，仅图标变化）、**上一首 / 播放暂停 / 下一首**、**可拖动进度条**（联动播放进度，拖动即时跳转）、时长、倍速（弹列表选择 0.5–2x）与水平音量滑条弹窗；图标按钮统一为 Obsidian 原生 `clickable-icon` 观感（lucide 图标、悬停背景变色、默认箭头光标）；命令面板提供播放/暂停、上一首、下一首等命令
- **后台播放与进度记忆**：切换应用/最小化后继续播放；退出 Obsidian 时自动保存正在播放的歌曲与进度（播放中每 5 秒节流写盘，暂停/切歌/退出即时保存），下次启动加载该歌曲、跳到上次进度但保持暂停；歌曲已删除或不在歌单时静默跳过恢复
- **标签编辑**：歌单行 hover 出现编辑按钮打开「编辑标签」（MP3/M4A 可编辑；FLAC/OGG 只读「查看标签」），支持改名与删除（vault 内进系统回收站），编辑正在播放的歌曲时标题/歌词实时刷新

**歌词获取**

- **在线歌词多平台**：标签编辑弹窗「获取歌词」按网易云 / QQ / 酷狗 / 酷我四平台搜索当前歌曲，候选列表（含来源/时长）手动选择后导入；「获取封面」同机制提供四平台封面候选（缩略图网格）
- **试听歌曲临时歌词**：无本地文件的试听歌曲同样可在线搜索并**临时挂载**歌词（仅本次试听有效，不写任何文件），切歌或试听结束自动失效

**歌曲下载与试听**

- **多平台下载**：已并入侧边栏「在线歌单」标签页，实时搜索网易云 / QQ / 酷狗 / 酷我（边输入边出结果，防抖 300ms，按关键词相关度排序），下载到音频文件夹并自动内嵌歌词/封面/标题；QQ 免费歌曲无需 Cookie 可直接下载/试听（实测免登录可拿直链），VIP 歌曲需绿钻账号的有效 Cookie（新版网页登录的 Cookie 可能不被下载接口认可，以下载实测为准；「测试连接」按钮探测的是真实下载通道），网易云可选粘贴会员 Cookie 解锁 VIP 高音质（weapi/eapi 无损逐级降级）；同名文件自动追加来源后缀防覆盖
- **下载前试听**：结果行「试听」拉取标准档音频直接播放（不写入库），**经底栏主播放器播放**（播放/暂停/进度/音量与歌词面板全部适用；播完按播放模式在试听队列内续播，加载失败自动跳下一首）；同歌再点命中会话内缓存秒播；设置页「释放缓存」一键清空
- **网易云客户端缓存**：设置「网易云客户端缓存目录」指向客户端缓存目录后，试听与网易云歌曲下载（含账号歌单同步）优先读客户端已缓存音频，命中即离线秒开
- **推荐歌单**：「在线歌单」标签页无关键词时展示四源推荐歌单（胶囊切换平台，可按平台与关键词筛选），点歌单查看歌曲并逐首下载，支持返回与刷新

### 设置

设置界面按功能分为五个页签：

- **选择高亮**：高亮选中文本出现位置开关；高亮延迟（毫秒，需 ≥200）；缩略图开关；选择检索的字符串上限滑杆（2-60，默认 30，带「恢复默认」按钮）
- **持久高亮**：自定义样式的创建、编辑、删除，标签组管理与一键导入导出。表单含名称、描述、背景色（可留空）、搜索词/表达式（带正则开关）、标记开关，以及带 CSS 自动补全的代码编辑器，并提供「清空当前编辑」一键复位
- **高亮索引**：「启动时默认打开高亮索引」开关，开启后插件启动时自动启用索引标签页
- **提词器**：字体（本机字体选择）、字重（跟随主题 / 100–900）、字体颜色、字体透明度（默认 100%）、背景透明度（默认 80%），均带「重置为初始值」按钮；可折叠「文字阴影」分组（投影开关、水平/垂直偏移、模糊半径、不透明度）与「文字渐变」分组（渐变开关、类型、范围、角度、颜色停靠点，附实时预览）；选中提取模式与状态栏按钮开关
- **音乐**：音频文件夹选择器（「浏览」按钮打开系统资源管理器选择，带刷新按钮与搜索下拉，支持库外盘符绝对路径）、逐字高亮开关、底部状态栏适配开关（开启后保留 view-content 默认样式，面板底部为悬浮的应用状态栏预留安全区留白；关闭则移除该默认样式贴边铺满，适配状态栏相对布局的主题）、歌词自动滚动开关、试听缓存释放；「下载」分组为四平台可折叠 Cookie 行（启用勾选、状态徽标、「打开登录页」直达平台登录页、可点击复制的 document.cookie 代码芯片、测试连接、清除，默认收起防凭证暴露）

### 限制

- 阅读（Reading）模式暂不支持动态高亮
- 音乐：库外绝对路径音频/下载写盘为桌面端功能；移动端仅支持 vault 内音频播放，在线歌词/下载接口在移动端可能因 Referer 头被剥离而不可用

### 赞助

如果 Glimpse 对你有帮助，欢迎赞助支持～

![赞助](https://raw.githubusercontent.com/Dyse-Sofqi/Glimpse/main/zanshang.jpg)

### 致谢

感谢 @chrisgrieser（aka @pseudometa）提供的插件创意和反馈。  
感谢 @chetachiezikeuzor 的插件设置界面代码，灵感来自 <https://github.com/chetachiezikeuzor/highlightr-Plugin/>

---


## English README

> **Keywords**: dynamic highlighting, selection highlighting, persistent highlighting, regex queries, capture groups, custom CSS, CSS autocompletion, highlighter description, highlight index, teleprompter, cursor-linked selection, scrollbar markers, minimap, text gradient, subtitle drop shadow, scroll sync, click-through lock, document binding, group management, import/export, music player, lyrics panel, karaoke word highlighting, online lyrics, multi-platform download

An Obsidian plugin that dynamically highlights text based on cursor selection or search query. Key features:

- **Selection highlighting**: instantly highlights all occurrences of the selected text (**decorations appear only when at least one occurrence other than the selection is found**), with scrollbar markers and a minimap
- **Persistent highlighting**: mark text persistently via regex/keyword queries, with capture groups, line/start/end widgets, custom CSS (a built-in code editor with CSS autocompletion), a per-highlighter description, group management, and one-click import/export
- **Highlight index**: auto-scans `==highlighted==` text and organizes it into a sidebar index by heading hierarchy, with cursor-linked selection and keyboard navigation
- **Teleprompter (desktop only)**: karaoke-style floating teleprompter windows that follow the document/cursor in real time, with font weights 100–900, text gradient, subtitle drop shadow, click-through lock, document binding, scroll sync, and multi-instance support
- **Music**: a sidebar lyrics music panel — a three-tab playlist (NetEase **account playlists** synced to local / online playlists searched and downloaded across four platforms / local songs with custom groups and drag ordering), karaoke word-by-word highlighting with bilingual annotations, auto-following lyrics (paused the moment you scroll manually), an audio folder (MP3/FLAC/M4A/OGG, absolute paths outside the vault supported) as the playlist, four-platform online lyrics fetching, preview-before-download and recommended playlists

Currently supports Source mode and Live Preview mode. Reading mode and the legacy editor are not supported.

### Selection Highlighting

When text is selected, highlights all occurrences of the selected text:

- Case-insensitive matching across the whole document (not just the visible viewport)
- **Decoration condition**: decorations are applied only when **at least one occurrence other than the selection itself** is found; selecting text that occurs only once draws no underline and no scrollbar marker
- Current selection marked as `.cm-current-string`
- Other matching strings in the document marked as `.cm-matched-string`
- All matches include `data-contents` attribute with the selected string value
- **Scrollbar markers / minimap**: match positions shown on the scrollbar when matches are found; an optional minimap on the editor's right edge (draggable to scroll)
- **Selection length cap**: a "Max selection length" slider in settings (2-60, default 30) skips full-document matching for selections longer than the cap, avoiding slowdowns from huge selections


### Persistent Highlighting

Define search queries with associated CSS class names and colors to create persistent highlights. Matched strings are automatically tagged with the corresponding CSS class and painted with the chosen background color (**the color may be left empty** — with no color picked, only the highlight class is applied and styling is left entirely to custom CSS). Each highlighter's style and color is cached in the index; match toggles can be switched on/off at any time to control how matches appear.

Each highlighter can also carry a **description** noting what its expression matches — display-only, never used for matching. It sits on the row below the name in settings and on the line below the expression in the list card.

Supports regex queries (enable the toggle for regex mode). In regex mode, **named capture groups** (e.g., `(?<groupName>…)`) or **unnamed capture groups** (e.g., `(…)`) can be used to highlight sub-matches with precision.

#### Mark Types

Each highlighter can combine multiple mark modes:

- **Match**: Highlight the full matched text (enabled by default)
- **Line**: Apply the CSS class to the entire line containing the match, enabling whole-line styling instead of word-level
- **Start / End**: Insert zero-width widget elements at match boundaries — use with CSS for prefix/suffix icons
- **Group**: In regex mode, highlight capture group sub-matches instead of the full match. Sub-matches use the highlighter's own color. Supports both named `(?<name>…)` and unnamed `(…)` capture groups. When "Group" is toggled on, full-match decoration is automatically skipped.

#### Custom CSS

Each highlighter can include its own CSS rules, injected into the page via `CSSStyleSheet` + `document.adoptedStyleSheets` (no `<style>` element is created). Renders through the editor's CodeMirror instance, supporting dark/light theme adaptation. CSS changes take effect immediately on save.

The field itself is a full **CodeMirror 6 editor**: syntax highlighting, auto-closing brackets and quotes, undo history, and **CSS autocompletion as you type** — property names, value keywords and selector tag names all suggest as you type, or on demand with Ctrl/Cmd-Space; accepting a property also inserts the colon and a space.

#### Group Management

Organize highlighters with groups: create, rename, delete groups; drag highlighters onto group tabs to categorize, and drag group tabs to reorder them (the default group stays first and cannot be dragged). The "Enable All / Disable All" toolbar button controls match toggles for the current group at once.

#### Import & Export

Supports one-click import (from clipboard JSON or a file), batch export of all highlighters with group metadata, and per-highlighter single export. The import/export dialogs use styled plain textareas: buttons sit above the box (Export to file / Export to clipboard; Import from file / Import from the paste box below), the box auto-fits its content height, and both dialogs share one visual style. Backward compatible with legacy data format (no groups → defaults to "默认").

##### Pandoc Fenced Divs Highlighting (`:::`)

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


### Highlight Index

Automatically scans the active document for `==...==` wrapped Obsidian standard highlights and organizes them in a sidebar view grouped by heading hierarchy.

- **Heading grouping**: Highlights organized by the document's heading structure; highlights without a preceding heading grouped under the document-name group
- **Level icons**: h1-h6 headings display a corresponding lucide heading icon, colored by `--h1-color` through `--h6-color` CSS variables
- **Ancestor breadcrumbs**: Shared ancestor headings rendered as standalone rows before the first entry in each subtree, using the same icon and color styling as direct headings
- **Frosted glass cards**: Highlights displayed as rounded frosted glass cards with a hover-enhanced frosted effect
- **Cursor-linked selection**: when the editor cursor lands on a line containing a highlight, the matching card is selected and scrolled to the center of the panel
- **Keyboard navigation**: with the index tab focused, ↑/↓ steps to the previous/next card (counting from the currently selected one), also syncing the editor cursor and the teleprompter
- **Right-click to copy**: right-clicking a card copies its text and shows a Notice toast
- **Anchored-document fallback**: when the current page has no highlights, the index scans the document bound to the teleprompter instead; documents not open in a view are read from disk
- **Auto-refresh**: Scans a document on first open and re-scans on document switch (a `file-open` listener covers opens that don't change the active leaf, e.g. new notes or explorer clicks on the current tab); keeps previous results when the new active document has no highlights
- **Command palette**: Registers "打开高亮索引" command to summon the index view
- **Settings toggle**: "Startup auto-open highlight index" (off by default) — enables the index tab on plugin load


### Teleprompter (desktop only)

Karaoke-style floating teleprompter windows that follow document content in real time — for cue cards, reading aloud, or lectures. Desktop only.

- **Three content modes**:
  - **Line extract**: static by default (extracts once when opened or when switching documents); click the "Track Cursor" button in the toolbar to enable cursor-following — the line under the cursor is auto-extracted as it moves (poll-based detection, bound or active document); wheel/buttons step up/down one line manually
  - **Highlight extract**: cycles through `==...==` matches in order — great for scripted reading
  - **Lyrics extract**: shows the currently playing lyric line from the music module, advancing with playback (deduplicated by song + line index so high-frequency state pushes never re-render); prev/next/wheel seek to the adjacent lyric line's timestamp (also while paused); a dim "not playing" hint appears with no session, and "♪ intro ♪" before the first line is sung
  - **Selection extract**: temporarily overrides the content with selected text, auto-restores on deselect
- **Mode switch**: a toolbar dropdown (line / highlight / lyrics extract) keeping the native arrow, with the collapsed value and the popup options both centered; the window's drag/wheel handlers exempt the dropdown so its popup opens normally, and it is hidden while click-through locked
- **Highlight index integration**: clicking an index card binds that document and switches to highlight-extract mode; double-clicking the teleprompter text area selects the matching index card, and with scroll-sync on, prev/next steps select the corresponding card too
- **Scroll sync**: the button (lucide `link`) right of the click-through lock — when active, prev/next also syncs: line-extract mode moves the editor cursor to the previous/next line, highlight-extract mode selects the previous/next index card; hidden with the other non-interactive buttons while locked
- **Document binding**: pin the window to a specific document instead of following the active one; once bound, clicking the bind button again always unbinds instead of binding the currently active document
- **Click-through lock**: whole window becomes mouse-transparent (interactive buttons kept), never blocks the editor; the lock itself no longer changes the background — full background transparency is handled solely by the "Hide Background" button; while locked the toolbar shows only on hover and fades out on mouse-leave, and the "Track Cursor" / "Scroll Sync" buttons are hidden with the other non-interactive buttons
- **Hide Background**: when active, the window background becomes fully transparent (including hover/drag states) and the text automatically gets a subtitle drop shadow; when inactive, the background color stays visible with the opacity set in the settings
- **Text shadow (subtitle effect)**: while the background is hidden, a soft drop shadow (`drop-shadow`, strictly beneath the text) is added to the teleprompter text; the collapsible "Text Shadow" settings group adjusts the shadow toggle, horizontal/vertical offset, blur radius and opacity (each with a reset button), defaulting to right 2px / down 3px / blur 6px / opacity 35%
- **Text gradient**: gradient coloring for the teleprompter text; the collapsible "Text Gradient" settings group offers a gradient toggle (overrides "Font Color"), linear/radial type, whole-text/per-character scope (per-character mode clips the gradient independently for each glyph, emoji and combined characters stay intact), gradient angle, and a color-stop editor (add/remove, position, palette, sorted by position), with a live preview sharing the teleprompter's parameters
- **Width auto-fit**: width adapts to the content's widest line (prev/next never grows the window), clamped to the viewport so long text wraps without overflowing; the right edge is draggable and auto-locks, and stays draggable while locked — the new width inherits as the locked value
- **Drag snapping**: snaps to viewport edges and center lines with guide overlays
- **Stable position**: the window's position is yours — content-height changes (line changes, font-size changes, width re-fitting) never move it; after a restart it comes back exactly where it was saved instead of being lifted by taller restored content
- **Font size**: cycles 32/40/50/64/80px
- **Font / weight / color**: adjustable in settings — the body font uses a local-font picker modal (`queryLocalFonts()` enumeration, falling back to canvas measurement over a candidate list; multi-select with drag-to-reorder priority — the first available font wins, missing ones fall through; search, self-preview, and custom-font input included), font weight is a dropdown (follow theme / 100–900), and text color is a palette applied live ("Clear" restores the theme default); each has a "Reset to initial value" button
- **Toolbar**: the mode toggle is a dropdown (line / highlight / lyrics extract); track cursor (`text-cursor`, cursor-following toggle), prev/next (`arrow-big-left`/`arrow-big-right`), width lock (`move-horizontal`), click-through lock (`lock`/`unlock`), hide background (`eye-off`), and font-size slot icons (`heading-1`~`heading-5`) all use semantic lucide icons; button tooltips default to popping above and flip below only when there is no room above; when locked, only interactive buttons (prev/next, lock, close) remain; the settings button jumps straight to the teleprompter settings page
- **Opacity**: font opacity (default 100%) and background opacity (default 80%) adjustable in settings, each with a "Reset to initial value" button (lucide `rotate-ccw`); the background color, border and outline shadow are always visible and the opacity applies live
- **Theme adaptation**: the window background updates instantly when toggling light/dark themes — no restart needed
- **Theme / custom CSS styling**: content reuses theme and user CSS snippets (headings, code blocks, inline formatting); only font size is controlled by the teleprompter. Leading tabs/spaces are stripped before rendering a single line, so indented content (e.g. nested list items) renders as unindented list/text instead of a code block
- **Vertical centering**: content is vertically centered within the text display area — short content no longer sits at the top; when content exceeds the max height it falls back to normal scrolling (top never clipped); the height cap is `min(70vh, space below the window)`, so long content near the bottom of the screen scrolls inside the window instead of pushing it off-screen
- **Status bar entry**: "Open teleprompter" button in the bottom-right status bar (lucide-presentation) for one-click open/focus, toggleable in settings
- **Double-click to jump & select**: double-click the text area to move the editor cursor to the captured text's line and select the matching text (the match segment in highlight-extract mode, the whole line in line mode, the existing selection preserved in selection-extract mode), focus the editor, and scroll the selection to the center of the viewport
- **Right-click to copy**: right-click the text area to copy the rendered plain text of the captured content (no Markdown syntax); a "已复制" notice confirms success
- **State persistence**: closing a window and reopening it restores its position, size, mode, binding, track-cursor toggle, and more; closed-window states survive an Obsidian restart (reopening still restores them), and closed windows never auto-reopen on restart; **the window position comes back exactly as saved** instead of being lifted by taller restored content
- **Empty-line fallback**: shows previous item's text (half-opacity placeholder) when the current line is empty
- **Commands**: "打开提词器" and "关闭所有提词器", multiple instances supported

### Music

A sidebar lyrics music panel (click the music ribbon icon or run the "Open music panel" command):

**Playback**

- **Playlist pane (default, three tabs)**: the header holds a "Songs (count)" title + the "playlist/lyrics" switch button (lucide icon + the current pane's name; the lyrics pane's header mirrors it and shows a line count); below is the shared search box + category dropdown (local = album type; online = platform), then three full-width equal-width segmented tabs: **Account playlists** (after a NetEase login it lists every playlist on the account — cover, track count and creator on each card; open one to browse its tracks, and its header has "sync to local" to batch-download the whole playlist), **Online playlists** (real-time four-platform search streaming as you type, sorted by keyword relevance, with inline preview/download; with no keyword it shows the four-source recommended-playlist home screen), **Local songs** (the audio-folder playlist, with custom groups and drag ordering)
- **Custom groups for the local playlist**: a "group" button on each song row (or right-click a group header) creates a group, assigns the song, or ungroups it; the list renders grouped **accordion** sections — sticky header bars pinned to the top of the list while scrolling, group names using the theme's bold styling and the interface font, a handle on the left that **reorders groups by dragging**, name + count, **all collapsed by default** (clicking expands that group and collapses the others, clicking again collapses it), rows indented inside the group with an accent bar on the playing row; while searching/filtering all matching groups render expanded; unassigned songs fall into an "ungrouped" section; group data lives in data.json (no extra files), and with no groups defined the list stays flat
- **Drag to reorder**: press and drag any song row up or down to reorder it (a 5px threshold avoids accidental drags; dragging near the list's edges auto-scrolls; inside a group view the move stays within the same group); the order is stored in data.json and **also drives the sequential play mode's track order**; dragging is disabled while searching/filtering
- **Sequential playback scoped to the group**: when the playing song belongs to a custom group, sequential mode's next/previous only cycles within that group (the group's last song wraps to its first; a one-song group behaves like single loop); songs outside any group, or with no groups defined, keep the whole-playlist order
- **Song row interaction**: **double-click to play** (single clicks are left for browsing/scrolling), with a hover state of a raised background + shadow + cover play overlay fading in (no outline, default arrow cursor, and the hover background uses an opaque step of the theme scale so the panel never shows through); the cover overlay *is* the play/stop button (the playing row shows a pause icon on hover — click to pause/resume), and rows in account playlists that already exist locally use the same local playback path
- **Sidebar lyrics panel**: header layout mirrors the playlist pane; the current line is enlarged and highlighted while the others shrink and fade, and clicking any line seeks to it; **scrolling manually pauses auto-follow** (scrolling up to read earlier lyrics is never yanked back, and line changes keep the viewport pinned by anchor), resuming automatically once the current line is fully back in view; the header also carries a ±2000ms **lyric offset** slider (per song, default -150ms, negative = lyrics earlier)
- **Karaoke word highlighting**: the current line is colored word by word with a glow; supports precise `<mm:ss.xx>` timestamps from enhanced LRC (e.g. `<00:12.16>Words<00:13.00>more`), with even distribution as fallback
- **Bilingual annotations**: `original | translation` pipe syntax renders the translation as small gray text below the original, excluded from word highlighting
- **Playlist source**: point the "Audio folder" setting at a vault folder or an absolute Windows path outside the vault (e.g. `D:\Music`; a "Browse" button opens the system file explorer), and MP3/FLAC/M4A/OGG files are scanned; embedded title/artist/album/cover populate the playlist, and **duration and file size** are probed and shown as metadata pills
- **Lyrics sources**: a same-named `.lrc` sidecar file next to the audio takes priority (editing it in Obsidian refreshes the playing lyrics immediately), falling back to embedded lyrics (MP3 USLT / FLAC Vorbis / M4A ©lyr / OGG comment); external changes to the audio or lyrics file are re-read automatically
- **Automatic online lyric search**: when the lyrics pane finds no lyrics it searches the four platforms (NetEase / QQ / Kugou / Kuwo) and **applies the first candidate that has lyrics in relevance order** (saved as a sidecar .lrc and shown immediately); if none has lyrics it falls back to the manual candidate list, and the "replace lyrics" button re-searches at any time
- **Playback controls (two-row bottom bar)**: row 1 holds the "playlist/lyrics" switch + the selectable/copyable song title + a "locate current song" button (switches to the local playlist, expands the group and center-scrolls to the row); row 2 holds the play mode (single loop / sequential / shuffle, icon-only changes), **prev / play-pause / next**, a **draggable seek bar** (synced with playback, instant scrubbing), the time label, speed (0.5–2x from a popup list) and a horizontal volume slider popup; icon buttons follow Obsidian's native `clickable-icon` look (lucide icons, hover background tint, default arrow cursor); the command palette offers play/pause, previous and next
- **Background playback & resume**: music keeps playing when the app is minimized or in the background; on quit the playing track and position are saved automatically (throttled to every 5s while playing, immediate on pause/track change/quit) and the next launch loads that track, seeks to the saved position and stays paused; restore is silently skipped if the file is gone
- **Tag editing**: hover a playlist row to edit tags (MP3/M4A writable; FLAC/OGG read-only viewer), rename and delete (vault files go to the system trash); the playing song's title/lyrics refresh live

**Lyrics fetching**

- **Multi-platform online lyrics**: the tag editor's "Fetch lyrics" button searches NetEase / QQ / Kugou / Kuwo for the current song and presents a candidate list (source + duration) to import manually; "Fetch cover" works the same way with a thumbnail grid
- **Temporary lyrics for previews**: previewed songs (no local file) can also search online and **mount lyrics in memory** for that preview session only (nothing written to disk), clearing on track change or preview end

**Download & preview**

- **Multi-platform download**: merged into the sidebar's "Online playlists" tab, searching NetEase / QQ / Kugou / Kuwo in real time (results stream in as you type, debounced 300ms, sorted by keyword relevance) and saving to the audio folder with lyrics/cover/title embedded automatically; free QQ songs download/preview without any cookie (verified working), VIP songs require a green-diamond account's valid cookie (newer web-login cookies may be rejected by the download API — the "Test connection" button probes the real download channel instead); an optional NetEase VIP cookie unlocks lossless quality (weapi/eapi with fallbacks); duplicate filenames get a source suffix
- **Preview before download**: the "preview" button on each result pulls the standard-quality audio and plays it immediately (nothing written to the vault) **through the bottom-bar main player** (play/pause, seek, volume and the lyrics pane all apply; when it ends it continues within the preview queue per the play mode, skipping failures automatically); a second click on the same song replays instantly from the in-session cache, and the settings page can flush the cache
- **NetEase client cache**: point the "NetEase client cache folder" setting at the desktop client's cache and previews plus NetEase downloads (including account-playlist sync) read the cached audio first — instant and offline on a hit
- **Recommended playlists**: with no keyword the "Online playlists" tab shows four-source recommendations (capsule switcher, filterable by platform and keyword); open a playlist to download songs one by one, with back navigation and refresh

### Settings

The settings dialog is organized into five tabs:

- **Selection**: toggle highlighting all occurrences of the selected text; highlight delay in milliseconds (≥200); minimap toggle; a "Max selection length" slider (2-60, default 30, with a "Restore default" button)
- **Persistent**: create, edit, and delete highlighters, group management, one-click import/export. The form covers name, description, background color (may be left empty), search term/expression (with a regex toggle), mark toggles and a code editor with CSS autocompletion, plus a one-click "Clear current edit" reset
- **Highlight index**: "Startup auto-open highlight index" toggle — enables the index tab on plugin load
- **Teleprompter**: font (local-font picker), font weight (follow theme / 100–900), font color, font opacity (default 100%) and background opacity (default 80%), each with a "Reset to initial value" button; collapsible "Text Shadow" group (shadow toggle, horizontal/vertical offset, blur radius, opacity) and "Text Gradient" group (gradient toggle, type, scope, angle, color stops, with a live preview); selection-extract mode and status-bar button toggles
- **Music**: audio folder picker (a "Browse" button opens the system file explorer to pick a folder, plus a refresh button and search dropdown; absolute Windows paths supported), karaoke highlighting toggle, a bottom-status-bar adapt toggle (when on, the Obsidian default `view-content` styles are kept so the panel bottom reserves safe-area space for the floating app status bar; when off, those defaults are removed and the panel fills edge-to-edge — for themes with a relative status bar), lyrics auto-scroll toggle, preview cache flush; the "Download" group holds collapsible per-platform cookie rows (enable checkbox, status badge, an "Open login page" button that jumps straight to the platform's login page, a click-to-copy `document.cookie` code chip, test connection, clear — collapsed by default); platform-priority drag ordering was removed (results are relevance-sorted) and drag-to-reorder platform priority

### Limitations

- Reading mode does not support dynamic selection highlighting
- Music: audio outside the vault (absolute paths) and download-to-disk are desktop-only; on mobile only in-vault audio playback works, and online lyrics/download APIs may be unavailable because the Referer header is stripped

### Sponsorship

If Glimpse helps you, consider supporting the author:

[PayPal](https://paypal.me/Sofqi)

### Acknowledgments

Thanks to @chrisgrieser (aka @pseudometa) for the plugin concept and feedback.  
Thanks to @chetachiezikeuzor for the settings UI code, inspired by <https://github.com/chetachiezikeuzor/highlightr-Plugin/>
