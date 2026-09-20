/**
 * 音乐设置页：歌单（音频文件夹选择器）、播放（逐字高亮/自动滚动/试听缓存释放）、
 * 下载（四平台 Cookie 折叠行 + 启用勾选 + 测试连接）。
 */
import { FileSystemAdapter, Notice, Platform, Setting, TFolder, setIcon, type App } from "obsidian";
import type GlimpsePlugin from "../../main";
import type MusicView from "../../music/musicView";
import { copyText } from "../export";
import {
  testPlatformConnection, getPreviewCacheSize, getPreviewCacheCount, clearPreviewCache,
} from "../../music/downloadManager";
import { formatBytes } from "../../music/tagSize";
import { isWindowsAbsolutePath } from "../../music/songScanner";
import { MUSIC_SOURCES, type MusicSource } from "../../music/shared";

/** 平台元信息（Cookie 行渲染用）：loginUrl 供「打开登录页」按钮直达；
 *  酷狗/酷我无稳定直达登录页，用官网首页（登录入口在页面右上角） */
const PLATFORMS: Record<string, { name: string; site: string; loginUrl: string }> = {
  netease: { name: "网易云音乐", site: "music.163.com", loginUrl: "https://music.163.com/#/login" },
  qq: { name: "QQ 音乐", site: "y.qq.com", loginUrl: "https://y.qq.com/n/ryqq/login" },
  kugou: { name: "酷狗音乐", site: "kugou.com", loginUrl: "https://www.kugou.com/" },
  kuwo: { name: "酷我音乐", site: "kuwo.cn", loginUrl: "https://www.kuwo.cn/" },
};

export function render(containerEl: HTMLElement, plugin: GlimpsePlugin, tab: { registerDisposable?: (d: () => void) => void } = {}) {
  const music = plugin.music;
  if (!music) return;
  const settings = music.getSettings();
  void tab;

  new Setting(containerEl).setName("歌单").setHeading();

  // 音频文件夹选择器：vault 内相对路径或库外 Windows 盘符绝对路径（下载同路径）
  createFolderPicker(containerEl, plugin, {
    name: "音频文件夹",
    desc: "歌单来源：指定音频文件夹（MP3/FLAC/M4A/OGG，含内嵌歌词的歌曲进歌单）。可点「浏览」打开系统资源管理器选择；支持库外 Windows 盘符绝对路径（如 D:\\Music）；下载的歌曲也写入此处",
    placeholder: "例如：Music 或 D:\\Music",
    value: settings.audioFolder,
    onChange: (folder) => {
      settings.audioFolder = folder;
      void plugin.saveSettings();
      void music.scanLyricSongs();
    },
  });

  // 网易云客户端缓存目录：试听与网易云下载优先读取客户端已缓存的音频（离线可用）
  createFolderPicker(containerEl, plugin, {
    name: "网易云客户端缓存目录",
    desc: "可选：指向网易云音乐客户端的缓存目录（客户端 设置 → 下载与缓存 里可查看，默认 C:\\Users\\<用户名>\\AppData\\Local\\Netease\\CloudMusic\\Cache\\Cache）。配置后「试听」与网易云歌曲下载优先读取客户端已缓存的音频（<歌曲ID>-<码率>.mp3/.flac），命中即离线秒开、不再联网；音质取决于客户端当时缓存的档位。仅存本地 data.json",
    placeholder: "例如 C:\\Users\\<用户名>\\AppData\\Local\\Netease\\CloudMusic\\Cache\\Cache",
    value: settings.neteaseCacheFolder,
    onChange: (folder) => {
      settings.neteaseCacheFolder = folder;
      void plugin.saveSettings();
    },
  });

  new Setting(containerEl)
    .setName("逐字高亮（卡拉OK）")
    .setDesc("开启后当前行按字/词变色 + 光晕。支持精确逐字时间戳：如 <00:12.16>沧<00:13.00>海（增强 LRC）")
    .addToggle((toggle) => {
      toggle.setValue(settings.karaoke);
      toggle.onChange(async (value) => {
        settings.karaoke = value;
        await plugin.saveSettings();
        // 重新推送状态使侧边栏立即切换渲染模式
        const state = music.getState();
        if (state) music.emitState({ ...state, karaoke: value });
      });
    });

  new Setting(containerEl)
    .setName("底部状态栏适配")
    .setDesc("开启后保留 Obsidian view-content 默认样式：面板底部为悬浮的应用状态栏预留安全区留白（适配状态栏固定悬浮的主题）；关闭则移除该默认样式，面板贴边铺满（状态栏相对布局或不显示时无多余留白）。切换后立即生效。")
    .addToggle((toggle) => {
      toggle.setValue(settings.statusBarAdapt);
      toggle.onChange(async (value) => {
        settings.statusBarAdapt = value;
        await plugin.saveSettings();
        // 已打开的音乐面板即时应用
        const view = plugin.app.workspace.getLeavesOfType("glimpse-music-panel")[0]?.view;
        if (view && typeof (view as MusicView).applyStatusBarAdapt === "function") {
          (view as MusicView).applyStatusBarAdapt();
        }
      });
    });

  new Setting(containerEl)
    .setName("歌词自动滚动")
    .setDesc("开启后侧边栏歌词跟随播放进度自动滚动居中")
    .addToggle((toggle) => {
      toggle.setValue(settings.autoScroll);
      toggle.onChange(async (value) => {
        settings.autoScroll = value;
        await plugin.saveSettings();
      });
    });

  // 试听缓存：显示试听播放拉取的会话内缓存大小，一键清除
  const previewCacheSetting = new Setting(containerEl)
    .setName("试听缓存")
    .setDesc("下载弹窗「试听」拉取的音频字节缓存（会话内，重启 Obsidian 自动清空）");
  previewCacheSetting.addButton((btn) => {
    btn.setClass("gm-clear-cache-btn");
    btn.setButtonText(`释放缓存（${formatBytes(getPreviewCacheSize())}）`)
      .onClick(() => {
        clearPreviewCache();
        btn.setButtonText("释放缓存（0 B）");
        new Notice(`已释放试听缓存（${getPreviewCacheCount()} 条）`);
      });
  });

  // 下载分组顶部说明：免费歌曲四平台均免登录可下，Cookie 仅 VIP 场景需要
  new Setting(containerEl)
    .setName("下载")
    .setHeading()
    .setDesc(
      "搜索 / 歌词 / 推荐歌单均无需登录；免费歌曲免登录即可直接下载与试听（四平台均支持）。"
      + "Cookie 仅 VIP 场景需要：网易云 VIP 高音质需会员 Cookie；QQ VIP 歌曲需绿钻 Cookie（新版网页登录的 Cookie 可能不被下载接口认可，以「测试连接」与下载实测为准）；酷狗 / 酷我下载不使用 Cookie。各平台获取方式见下方行展开说明。",
    );

  // 四个平台 Cookie 行（固定顺序渲染；搜索结果已改为纯相关度排序，不再有平台优先级）
  for (const key of MUSIC_SOURCES) {
    const p = PLATFORMS[key];
    if (!p) continue;
    createCookieRow(containerEl, plugin, key, p.name, p.site);
  }
}

/**
 * 创建带搜索下拉的文件夹选择器（音频文件夹）。
 * 选择或输入后更新设置并重扫歌单；支持 vault 内文件夹与库外盘符绝对路径。
 */
function createFolderPicker(
  containerEl: HTMLElement,
  plugin: GlimpsePlugin,
  opts: {
    name: string;
    desc: string;
    placeholder: string;
    value: string;
    onChange: (folder: string) => void;
  },
): void {
  const music = plugin.music!;
  const setting = new Setting(containerEl)
    .setName(opts.name)
    .setDesc(opts.desc);

  // 「浏览」按钮（桌面端）：打开系统资源管理器选择文件夹
  if (Platform.isDesktopApp) {
    setting.addButton((btn) => {
      btn.setClass("gm-browse-btn");
      btn.setIcon("folder-open")
        .setTooltip("浏览：打开系统资源管理器选择文件夹")
        .onClick(async () => {
          const selected = await selectFolderNative(plugin.app, textInput.value);
          if (selected === null) return;
          applyFolder(selected);
        });
    });
  }

  // 手动刷新按钮
  setting.addButton((btn) => {
    btn.setClass("gm-reload-btn");
    btn.setIcon("refresh-cw")
      .setTooltip("刷新歌单列表")
      .onClick(async () => {
        btn.setDisabled(true);
        btn.setIcon("loader");
        await music.scanLyricSongs();
        btn.setIcon("check");
        setTimeout(() => {
          btn.setIcon("refresh-cw");
          btn.setDisabled(false);
        }, 1000);
        new Notice(`歌单已刷新，共 ${music.getSongList().length} 首歌曲`);
      });
  });

  // 输入框
  const inputEl = setting.controlEl.createDiv({ cls: "gm-folder-input-wrap" });
  const textInput = inputEl.createEl("input", {
    cls: "gm-folder-input",
    attr: {
      type: "text",
      placeholder: opts.placeholder,
      value: opts.value,
    },
  });

  // 下拉建议
  const suggestionsEl = inputEl.createDiv({ cls: "gm-folder-suggestions" });
  suggestionsEl.hide();

  // 取 vault 全部文件夹路径（直接收集 TFolder，含空文件夹）
  const getAllFolders = (): string[] => {
    const folders = new Set<string>();
    for (const file of plugin.app.vault.getAllLoadedFiles()) {
      if (file instanceof TFolder) {
        folders.add(file.path);
      }
    }
    return Array.from(folders).sort();
  };

  const allFolders = getAllFolders();

  // 应用所选/所输：更新设置 + 重扫歌单
  const applyFolder = (folder: string) => {
    textInput.value = folder;
    opts.onChange(folder);
    void music.scanLyricSongs();
    suggestionsEl.hide();
  };

  // 过滤并显示建议
  const showSuggestions = (query: string) => {
    suggestionsEl.empty();
    const lowerQuery = query.toLowerCase();
    const filtered = (query
      ? allFolders.filter((f) => f.toLowerCase().includes(lowerQuery))
      : allFolders
    ).slice(0, 20);
    if (filtered.length === 0) {
      suggestionsEl.hide();
      return;
    }
    renderSuggestions(filtered);
    suggestionsEl.show();
  };

  let activeIndex = -1;

  const renderSuggestions = (folders: string[]) => {
    suggestionsEl.empty();
    activeIndex = -1;

    folders.forEach((folder, index) => {
      const item = suggestionsEl.createDiv({ cls: "gm-folder-suggestion-item" });
      item.setText(folder);

      item.addEventListener("click", () => applyFolder(folder));
      item.addEventListener("mouseenter", () => {
        activeIndex = index;
        updateActive();
      });
    });

    const updateActive = () => {
      suggestionsEl.querySelectorAll(".gm-folder-suggestion-item").forEach((el, i) => {
        el.classList.toggle("gm-folder-suggestion-active", i === activeIndex);
      });
    };

    textInput.onkeydown = (e: KeyboardEvent) => {
      const items = suggestionsEl.querySelectorAll(".gm-folder-suggestion-item");
      if (!items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActive();
        items[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive();
        items[activeIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        applyFolder(folders[activeIndex]);
      } else if (e.key === "Escape") {
        suggestionsEl.hide();
        textInput.blur();
      }
    };
  };

  // 输入事件
  textInput.addEventListener("input", () => {
    showSuggestions(textInput.value);
  });
  textInput.addEventListener("focus", () => {
    showSuggestions(textInput.value);
  });
  textInput.addEventListener("blur", () => {
    setTimeout(() => {
      suggestionsEl.hide();
    }, 200);
  });
  // 直接输入（未选下拉）也更新
  textInput.addEventListener("change", () => {
    applyFolder(textInput.value);
  });
}

/**
 * 打开系统「选择文件夹」对话框（参考 ziping 的 electronRemote 双通道方案，桌面端专用）。
 * 与 ziping 的差异：不限定必须选 vault 内目录 —— 选 vault 内目录返回相对路径（可随同步迁移），
 * 选 vault 外目录返回 Windows 绝对路径（库外音频文件夹用）。取消/失败返回 null。
 */
// electron API 需动态访问（原 eslint-disable 指令已失效：本仓库配置未启用 no-unsafe-* 规则）
async function selectFolderNative(app: App, defaultPath: string): Promise<string | null> {
  const adapter = app.vault.adapter;
  const vaultRoot = adapter instanceof FileSystemAdapter ? adapter.getBasePath().replace(/\\/g, "/") : null;
  // 对话框初始目录：已填的是盘符绝对路径则用它，否则用 vault 根
  const options = {
    properties: ["openDirectory"] as Array<string>,
    defaultPath: defaultPath && isWindowsAbsolutePath(defaultPath) ? defaultPath : (vaultRoot ?? undefined),
  };

  // Obsidian ≥ 1.1：app.electronRemote
  let result: any = null;
  try {
    const remote = (app as unknown as Record<string, any>).electronRemote;
    if (remote?.dialog) {
      result = await remote.dialog.showOpenDialog(options);
    }
  } catch { /* 回退旧通道 */ }

  // 旧版 Obsidian：window.require('electron').remote
  if (!result) {
    try {
      const { dialog } = (window as any).require("electron").remote;
      result = await dialog.showOpenDialog(options);
    } catch {
      new Notice("无法打开文件夹选择对话框（仅桌面端可用）");
      return null;
    }
  }
  if (!result || result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return null;
  }
  const selected = String(result.filePaths[0]);
  // vault 内目录 → 存 vault 相对路径；vault 外 → 保留 Windows 绝对路径
  if (vaultRoot) {
    const norm = selected.replace(/\\/g, "/");
    if (norm === vaultRoot) return ""; // 选中的就是 vault 根：等价于未指定
    if (norm.startsWith(vaultRoot + "/")) {
      return norm.slice(vaultRoot.length + 1);
    }
  }
  return selected;
}

/**
 * 「document.cookie」可点击代码芯片：点击复制到剪贴板（复用全局 copyText，带 execCommand 降级），
 * 图标短暂变为 ✓ 反馈后复原，免去用户手动键入。
 */
function createCookieCopyChip(container: HTMLElement) {
  const chip = container.createEl("code", { cls: "gm-cookie-copy-chip" });
  chip.setAttribute("title", "点击复制 document.cookie");
  chip.createSpan({ cls: "gm-cookie-copy-chip-text", text: "document.cookie" });
  const iconEl = chip.createSpan({ cls: "gm-cookie-copy-chip-icon" });
  setIcon(iconEl, "copy");
  chip.addEventListener("click", async () => {
    const ok = await copyText("document.cookie");
    if (!ok) {
      new Notice("复制失败，请在控制台手动输入 document.cookie", 3000);
      return;
    }
    iconEl.empty();
    setIcon(iconEl, "check");
    chip.addClass("gm-cookie-copy-chip-done");
    new Notice("已复制 document.cookie，请到控制台粘贴并回车", 2000);
    window.setTimeout(() => {
      iconEl.empty();
      setIcon(iconEl, "copy");
      chip.removeClass("gm-cookie-copy-chip-done");
    }, 1500);
  });
}

/** 拖动排序落点：把 src 平台移到 target 平台之前/之后 → 持久化 → 重排 cookie 行 DOM → 刷新序号 */
/**
 * 创建可折叠的 Cookie 输入行：头部勾选框（控制搜索结果是否包含该平台）
 * + 平台名 + 状态徽标（未配置/已配置 N 字符），点击行展开/收起 textarea。
 * 四平台均有 Cookie 输入（网易云为可选，用于 VIP 下载；QQ 必需；酷狗/酷我可选预留）。
 */
function createCookieRow(
  containerEl: HTMLElement,
  plugin: GlimpsePlugin,
  key: MusicSource,
  name: string,
  site: string,
): void {
  const settings = plugin.music!.getSettings();
  const value = settings.platformCookies[key] ?? "";
  const enabled = settings.downloadSources[key] !== false;
  const row = containerEl.createDiv({ cls: "gm-cookie-row" });
  row.dataset.source = key; // 供「平台优先级」换序时按 source 重排/刷新序号
  if (!enabled) row.addClass("gm-cookie-row-disabled");
  const header = row.createDiv({ cls: "gm-cookie-header" });

  // 勾选框：控制该平台是否参与搜索（不触发行折叠）
  const checkbox = header.createEl("input", { cls: "gm-cookie-checkbox", attr: { type: "checkbox" } });
  checkbox.checked = enabled;
  checkbox.addEventListener("click", (e) => e.stopPropagation());
  checkbox.addEventListener("change", () => {
    settings.downloadSources = { ...settings.downloadSources, [key]: checkbox.checked };
    void plugin.saveSettings();
    row.toggleClass("gm-cookie-row-disabled", !checkbox.checked);
  });

  header.createSpan({ cls: "gm-cookie-name", text: name });
  const statusEl = header.createSpan({
    cls: "gm-cookie-status",
    text: value ? `已配置（${value.length} 字符）` : "未配置",
  });
  if (value) statusEl.addClass("gm-cookie-status-on");
  header.createSpan({ cls: "gm-cookie-chevron", text: "▸" });

  const body = row.createDiv({ cls: "gm-cookie-body" });
  const textarea = body.createEl("textarea", { cls: "gm-cookie-input" });
  textarea.value = value;
  textarea.placeholder = `登录 ${site} 后 F12 → 控制台输入 document.cookie 复制整段`;
  textarea.addEventListener("input", () => {
    const v = textarea.value.trim();
    settings.platformCookies = { ...settings.platformCookies, [key]: v };
    void plugin.saveSettings();
    statusEl.setText(v ? `已配置（${v.length} 字符）` : "未配置");
    statusEl.toggleClass("gm-cookie-status-on", !!v);
  });
  // 获取提示：QQ 的登录凭证 Cookie（qqmusic_key/qm_keyst）为 HttpOnly，控制台 document.cookie 读不到，
  // 必须从网络面板复制请求头；其余平台 document.cookie 可用，做成可点击代码芯片（点击复制，图标短暂变 ✓ 反馈）
  const hint = body.createDiv({ cls: "gm-cookie-hint" });
  if (key === "qq") {
    hint.createSpan({
      text: "QQ 免费歌曲无需 Cookie 即可直接下载/试听；Cookie 仅用于 VIP 歌曲（需绿钻账号）。获取方式：点「打开登录页」登录并播放任意歌曲 → 按 F12 打开「网络 (Network)」面板 → 找到发往 u.y.qq.com 的请求 → 复制请求标头中整段 Cookie 值。注意：控制台 document.cookie 读不到 QQ 登录凭证（HttpOnly）；且新版网页登录的 Cookie 可能不被下载接口认可（服务端实测为准），此时免费歌曲不受影响。仅存本地 data.json。",
    });
  } else {
    hint.createSpan({
      text: key === "netease"
        ? "可选：网易云 Cookie 用于 VIP 高音质下载与「账号歌单」同步。获取方式（登录凭证 MUSIC_U 是 HttpOnly，控制台 document.cookie 读不到）：点「打开登录页」登录 → 按 F12 打开「网络 (Network)」面板 → 刷新页面 → 点任意发往 music.163.com 的请求 → 复制请求标头中整段 Cookie 值（需含 MUSIC_U=…）粘贴到上方输入框。仅存本地 data.json。"
        : key === "kugou"
          ? "可选（下载不使用 Cookie，此项仅用于展示登录状态）。如需配置：点「打开登录页」登录 → 按 F12 打开控制台 → 点击 "
          : "可选（下载不使用 Cookie，预留）。如需配置：点「打开登录页」登录 → 按 F12 打开控制台 → 点击 ",
    });
    if (key !== "netease") {
      createCookieCopyChip(hint);
      hint.createSpan({ text: " 并回车执行 → 复制控制台输出，粘贴到上方输入框。仅存本地 data.json。" });
    }
  }
  const actions = body.createDiv({ cls: "gm-cookie-body-actions" });
  const loginBtn = actions.createEl("button", { text: "打开登录页", cls: "gm-cookie-login-btn" });
  loginBtn.setAttribute("title", `在系统浏览器打开 ${site} 的登录页面`);
  loginBtn.addEventListener("click", () => {
    window.open(PLATFORMS[key]?.loginUrl ?? `https://${site}/`, "_blank");
  });
  const testBtn = actions.createEl("button", { text: "测试连接", cls: "mod-cta" });
  const testResultEl = actions.createSpan({ cls: "gm-cookie-test-result" });
  actions.createEl("button", { text: "清除", cls: "mod-cta" }).addEventListener("click", () => {
    textarea.value = "";
    settings.platformCookies = { ...settings.platformCookies, [key]: "" };
    void plugin.saveSettings();
    statusEl.setText("未配置");
    statusEl.removeClass("gm-cookie-status-on");
    testResultEl.setText("");
  });

  // 测试连接：QQ/酷狗发请求验证 Cookie；酷我免登录直接提示
  testBtn.addEventListener("click", async () => {
    testBtn.disabled = true;
    testBtn.setText("测试中…");
    testResultEl.setText("");
    const res = await testPlatformConnection(key, textarea.value.trim());
    testBtn.disabled = false;
    testBtn.setText("测试连接");
    testResultEl.setText(res.ok ? "✓ " + res.message : "✗ " + res.message);
    testResultEl.toggleClass("gm-cookie-test-ok", res.ok);
    testResultEl.toggleClass("gm-cookie-test-bad", !res.ok);
  });

  header.addEventListener("click", () => {
    const wasCollapsed = body.hasClass("gm-cookie-collapsed");
    body.toggleClass("gm-cookie-collapsed", !wasCollapsed);
    row.toggleClass("gm-cookie-row-expanded", wasCollapsed);
    if (wasCollapsed) textarea.focus();
  });
  // 默认全部收起（安全）：登录凭证不随设置页展开而暴露，需点击平台行才展开
  body.addClass("gm-cookie-collapsed");
}
