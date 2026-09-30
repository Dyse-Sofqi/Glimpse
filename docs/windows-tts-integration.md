# Windows 本地语音（SAPI5）提供方

> 承接 `gpt-sovits-integration.md` 与 `qwen3-tts-integration.md`。用户需求：
> 给**没有 GPT-SoVITS、也没有 Qwen3-TTS** 的用户一个兜底 —— 装上插件就能念。
>
> 本文记录设计取舍、脚本契约与实测数据。日期：2026-09-30。

---

## 0. 结论摘要

1. 新增第三个 TTS 提供方 **`windows-tts`**：直接调用 Windows 自带的 SAPI5 语音
   （中文系统上是 `Microsoft Huihui Desktop`）。**零安装、零模型、离线可用**。
2. 实现走 **PowerShell 调 `System.Speech.Synthesis` 合成到 wav 临时文件**，
   再把字节交给既有的段队列（Blob + `<audio>`）。**没有用浏览器的 `speechSynthesis`**，
   理由见 §1。
3. 与前两个提供方的关系：**引擎对象常驻、各自独立配置**，切换只改 `RoutingTtsEngine`
   的路由目标 —— 复用既有架构，没有新的生命周期概念（这个引擎没有服务、没有端口、
   没有 PID 归属，因此也没有启动器）。
4. 这个引擎**真的可以取消**：子进程句柄在手，`cancel()` 直接终止它
   （两个 HTTP 引擎受限于 `requestUrl` 无 `abort()`，只能靠代际计数丢弃结果）。
5. 顺带修掉一个既有缺陷：`controller.validateConfig()` 此前**不分提供方**都要求
   「参考音频」非空，Qwen3-TTS 用户（本来不需要参考音频）会被这条拦下 ——
   现改为只对 `gpt-sovits` 生效，`diagnostics` 里的同类判断同步修正。
6. 验证状态：脚本契约（枚举 / 合成 / 错误路径 / 编码）6 项、取消与并发 2 项
   **均在本机真实跑通**（数据见 §5），`tsc --noEmit` 与 `npm run build` 通过。
   尚未在「英文 Windows + 中文语音包缺失」等环境实测，见 §6。

---

## 1. 为什么是 SAPI5，而不是浏览器 speechSynthesis

`docs/tts-provider-plan.md` 里原本把兜底方案记作 `local-web-speech`（Web Speech API）。
真正落地时改成了 SAPI5，原因是**段队列的契约**：

| 维度 | 浏览器 `speechSynthesis` | SAPI5 → wav 字节（本方案） |
| --- | --- | --- |
| 产物 | 直接出声，**拿不到字节** | `TtsAudio { bytes, mimeType }` |
| 段队列 | 进不去：预取 / 暂停续播 / 段内进度全靠字节 | 原样复用，零改动 |
| 段内进度 | 只有不可靠的 `boundary` 事件 | `<audio>` 的 `timeupdate`，与其余引擎一致 |
| 标点细分高亮 | 依赖 `boundary`，Windows 上实测不稳 | 由音频时钟驱动，稳定 |
| 播放控制 | 与音乐模块/播放条两套体系 | `AudioPlayback` 工厂，同一套 |
| 取消 | `speechSynthesis.cancel()` | 终止子进程（28ms 收到 close，实测） |
| 语速/音量 | `utterance.rate` / `volume` | SAPI `Rate` / `Volume`（同为系统语音） |

一句话：`speechSynthesis` 只能「边说边算进度」，而 SAPI5 走字节这条路
**与另外两个引擎完全同构**，播放、预取、进度、高亮、取消全部免费复用。
`speechSynthesis` 仍留在环境诊断里（它验证的是「浏览器语音可用」，与朗读链路无关）。

---

## 2. 环境与实测数据

| 项 | 值 |
| --- | --- |
| 依赖 | Windows PowerShell 5.1（`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`，自带 `System.Speech`） |
| 备选 | PowerShell 7 —— **默认不带 `System.Speech`**，实测 `Add-Type` 失败；故 5.1 优先，PS7 仅作兜底 |
| 语音来源 | SAPI5 注册表 `HKLM\SOFTWARE\Microsoft\Speech\Voices\Tokens`（即 `SpeechSynthesizer.GetInstalledVoices()`） |
| 本机语音 | `Microsoft Huihui Desktop`（zh-CN，Female）、`Microsoft Zira Desktop`（en-US，Female） |
| 输出格式 | PCM 16bit **单声道 22050Hz** wav（`SetOutputToWaveFile` 的默认格式） |
| 文件系统 | 脚本与文本/输出文件都放在 `%TEMP%\glimpse-windows-tts\`，合成结束即删 |

实测（本机，均为「进程启动 + 合成」的端到端耗时）：

| 场景 | 结果 |
| --- | --- |
| 枚举语音（`-ListVoices`） | 0.37s，返回 2 个语音 + 系统默认语音名 |
| 合成 27 字 | 0.42s |
| 合成 155 字 | 0.46s |
| 并发 3 段 | 合计 0.56s（三个进程并行，互不干扰） |
| 取消 | `kill` 后 **28ms** 收到 close，tasklist 无残留 |
| 坏语音名 | 退出码 2 + stderr `GLIMPSE_TTS_ERROR: …不能设置语音…` |
| 中文往返 | UTF-8 文本写入 → 脚本读回完全一致（无乱码） |

固定开销约 **0.4 秒/段**（几乎全是 PowerShell 启动），与 GPT-SoVITS 的 1.0 秒
固定开销同量级 —— 所以设置页的「首段渐进」对这个引擎同样开启
（`main.ts: readerSegmentLimits()`）。

---

## 3. 脚本契约

脚本内容内嵌在 `src/reader/tts/windows-tts.ts` 的 `WINDOWS_TTS_SCRIPT`，
首次使用时写到 `%TEMP%\glimpse-windows-tts\reader-windows-tts.ps1`（**手改无效**，会被覆盖）。

调用参数：

```
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <脚本>
  [-ListVoices]
  [-TextFile <utf8 文本> -OutFile <wav> [-Rate -10..10] [-Volume 0..100] [-Voice <语音名>]]
```

约定：

| 项 | 说明 |
| --- | --- |
| 编码 | 脚本以**带 BOM 的 UTF-8** 写入。PS 5.1 按控制台代码页（简体中文为 GBK）读 .ps1，没有 BOM 时脚本里的中文文案会乱码 |
| 文本传递 | 文本经 **UTF-8 临时文件**传入，不走命令行 —— 避免引号/换行/编码三重坑 |
| 退出码 | `0` 成功；`2` 合成失败；`3` 缺 `System.Speech`；`4` 参数不全 |
| 错误标志 | 一律以 `GLIMPSE_TTS_ERROR: ` 前缀写 stderr，与 PowerShell 自身的噪声区分 |
| 输出 | stdout 只用于 `-ListVoices` 的 JSON：`{ default, voices: [{ name, culture, gender, enabled }] }` |
| 语音选择 | `-Voice` 为空/不传 = 不调用 `SelectVoice`（用系统默认语音） |

倍速换算：SAPI 的 `Rate` 是 −10…10 的档位而不是倍率。实测 `Rate 6 ≈ 2.0x`、
`3 ≈ 1.5x`、`−6 ≈ 0.5x`，即 **`rate ≈ (speed − 1) × 6`**（`windowsTtsRate()`），
夹在 −10…10 内。设置页滑块仍用 0.5–2.0x 的同一套刻度，便于与 GPT-SoVITS 对照。

---

## 4. 引擎实现要点（`src/reader/tts/windows-tts.ts`）

- **shell 探测**：候选顺序 = 用户配置的路径 → `powershell.exe` → `pwsh.exe` → `pwsh`。
  逐个**真跑一次 `-ListVoices`**才算可用（「命令存在」≠「带 System.Speech」），
  解析成功后缓存；spawn 报 ENOENT 时清空缓存下次重探。
- **并发**：每段一个独立子进程 + 独立临时文件（文件名带自增序号），
  段队列预取 2–3 段时天然并行。
- **取消**：`cancel()` 递增代际计数并终止所有在跑子进程；`synthesize()` 在
  子进程退出后检查代际，抛出 `TtsCanceledError`（段队列按「已取消」静默处理）。
- **超时**：默认 30 秒。超时同样终止子进程并给出「可能被安全软件拦截」的提示。
- **校验**：合成结果必须存在、非空、且魔数通过共享的 `sniffAudioFormat`（必须是 wav）。
- **清理**：无论成功、失败还是取消，临时文本与 wav 都在 `finally` 里删除。
- **健康度 / 日志**：与两个启动器同名同义（`getHealth` / `markHealthy` /
  `markUnhealthy` / `getLogTail`），所以设置页状态行与「查看服务日志」命令
  对这个引擎同样可用；日志内容 = 最近几次子进程的 stderr。
- **probe()**：环境不可用（非 Windows / 找不到 shell / 无语音）或**配置的语音名不存在**
  时返回失败并给出可用语音清单。语音名填错必须在这里就暴露 —— 否则会拖到
  「第 1 段合成失败」才报，那时用户已经等了一轮朗读启动。

---

## 5. 验证清单（本机实测）

| # | 项 | 结果 |
| --- | --- | --- |
| 1 | `-ListVoices` JSON 形状与默认语音 | ✅ `default=Microsoft Huihui Desktop`，2 个语音 |
| 2 | 合成（指定语音，带标点/数字/英文） | ✅ exit 0，RIFF/WAVE 校验通过，头长度与文件长度一致（无多余尾巴） |
| 3 | 合成（不传 `-Voice`，走系统默认） | ✅ exit 0 |
| 4 | 语音名不存在 | ✅ exit 2，stderr 带 `GLIMPSE_TTS_ERROR:`，未产出文件 |
| 5 | 空/纯空白文本 | ✅ exit 0（引擎层先 trim 并拒绝，不会走到这里） |
| 6 | 中文 UTF-8 往返 | ✅ 读回与写入逐字一致 |
| 7 | 取消（kill 长任务） | ✅ 28ms 收到 close，无残留进程，临时文件被清理 |
| 8 | 并发 3 段 | ✅ 全部成功，合计 0.56s |
| 9 | `tsc --noEmit` / `npm run build` | ✅ 通过（bundle +24KB） |

---

## 6. 已知限制

1. **只有 SAPI5 Desktop 语音**。Windows 10/11 更自然的一批（如 OneCore 的
   `Microsoft Xiaoxiao`）挂在 `Speech_OneCore` 下，`System.Speech` 枚举不到；
   想用它们得改注册表把 OneCore token 复制到 SAPI5 下（需管理员）。
   这是 SAPI5 路线的固有边界。
2. **语音数量取决于系统语言包**。英文 Windows 未装中文语音包时只有 en-US 语音，
   念中文会很怪；设置页会显示每个语音的 `culture`，probe 也会把当前语音列清楚。
3. **每段一次 PowerShell**（固定约 0.4 秒）。没有做常驻会话：兜底引擎优先「怎么都不会卡死」，
   进程用完即走，没有孤儿进程与状态污染风险。真嫌慢就该上 GPT-SoVITS。
4. **不禁用也不能调音高**。SAPI 的 `Rate` 只能给档位，没有音高/情感参数。
5. **非 Windows 不可用**（移动端/其它桌面系统）。设置页会在这种情况下给出明确提示。
6. 首次合成要写脚本与临时文件，若 `%TEMP%` 不可写会报错（错误信息里带路径）。

---

## 7. 相关文件

| 文件 | 作用 |
| --- | --- |
| `src/reader/tts/windows-tts.ts` | 引擎 + 内嵌 PowerShell 脚本 + 语音枚举 + Rate 换算 |
| `src/reader/settings-types.ts` | `ReaderTtsProvider` 增加 `windows-tts`；`ReaderWindowsTtsSettings` |
| `src/main.ts` | 引擎装配、路由、`ensureReaderServiceRunning` / 启停命令分支、健康度与日志分发、爬坡与语速 |
| `src/settings/tabs/reader-ui.ts` | 「引擎」下拉第三项 + 「环境（Windows 本地语音）」与「声音（Windows 本地语音）」两组 |
| `src/reader/controller.ts` | `validateConfig` 改为按提供方判定；进度估算用 `readerSpeedFactor()` |
| `src/reader/diagnostics.ts` | 参考音频前置检查改为只对 `gpt-sovits` 生效 |
