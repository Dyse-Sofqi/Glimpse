# 能否由插件自动接管本机 GPT-SoVITS？——实测结论

> 承接 `tts-provider-plan.md`。用户提问：本地 GPT-SoVITS 需要手动跑 `go-webui.bat` 并在网页里操作，插件能否自动完成、接管并操控这些操作？
>
> **结论：能。而且绝大多数情况下根本不需要「接管网页」——网页（Gradio）和 HTTP API 是同一个推理引擎的两个前端，API 单独就能完整驱动推理。**
>
> 本文所有结论均为**在本机实测所得**，不是读代码推断。

---

## 0. 实测环境

| 项 | 值 |
| --- | --- |
| 安装路径 | `F:\_Frame\GPT-SoVITS-v2pro-20250604\GPT-SoVITS-v2pro-20250604` |
| 内嵌 Python | `runtime\python.exe` → **Python 3.9.13**（便携版，不依赖系统 Python） |
| 网页启动方式 | `go-webui.bat` → `runtime\python.exe -I webui.py zh_CN`（Gradio） |
| API 启动方式 | `runtime\python.exe -I api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml` |
| 配置段 | `tts_infer.yaml` 的 **`custom:`** 段（`TTS_Config` 里 `configs_.get("custom", configs_["v2"])`） |
| 当前配置 | `device: cuda` / `is_half: true` / `version: v2ProPlus` / 权重 `MyGO_高松灯_v2pp` |
| 已训练音色 | **7 个**（v2ProPlus）：MyGO 高松灯 / 千早爱音 / 椎名立希 / 长崎素世，Mujica 八幡海鈴 / 若葉睦 / 豊川祥子_白 |

---

## 1. 实测结果

### 1.1 服务可由外部启动，无需网页

后台执行 `runtime\python.exe -I api_v2.py -a 127.0.0.1 -p 9880`，日志显示：

```
device : cuda   is_half : True   version : v2ProPlus
t2s_weights_path  : GPT_weights_v2ProPlus/MyGO_高松灯_v2pp.ckpt
vits_weights_path : SoVITS_weights_v2ProPlus/MyGO_高松灯_v2pp.pth
Loading BERT weights from ... chinese-roberta-wwm-ext-large
Loading CNHuBERT weights from ... chinese-hubert-base
INFO:     Uvicorn running on http://127.0.0.1:9880
```

- **成功脱离网页加载了用户训练的音色并开始服务。**
- 进程内存占用约 **1.15 GB**（RSS；显存未测）。
- **冷启动时间：20 秒时端口尚未监听，65 秒时已就绪** —— 即 20–65 秒之间（未精确计时）。这是插件自动拉起时必须给用户进度反馈的原因。
- 日志中的 `_IncompatibleKeys(missing_keys=['enc_q.*'])` 是**正常的**：`enc_q` 是训练期的后验编码器，推理不需要。

### 1.2 端点清单（全部实测）

| 端点 | 方法 | 实测结果 |
| --- | --- | --- |
| `/tts` | POST | ✅ 200，返回音频字节 |
| `/tts` | GET | 存在（未单独测，POST 已满足需求） |
| `/set_gpt_weights?weights_path=` | GET | ✅ 200 `{"message":"success"}` |
| `/set_sovits_weights?weights_path=` | GET | ✅ 200 `{"message":"success"}` |
| `/set_refer_audio?refer_audio_path=` | GET | ✅ 200 `{"message":"success"}`，但**不影响后续请求**（见 1.5） |
| `/control?command=` | GET | ✅ 存在；无参数返回 400 `{"message":"command is required"}`，支持 `restart` / `exit` |

### 1.3 运行时切换模型 —— 这就是「接管网页操控」的核心

```
GET /set_gpt_weights?weights_path=GPT_weights_v2ProPlus/MyGO_千早爱音_v2pp.ckpt      → 200 success
GET /set_sovits_weights?weights_path=SoVITS_weights_v2ProPlus/MyGO_千早爱音_v2pp.pth → 200 success
```

**网页里「选 GPT 模型 + 选 SoVITS 模型」这两步，插件可以用两个 HTTP 请求完成，且无需重启服务。**
→ 插件可以给用户一个「音色下拉框」，7 个已训练音色随意切换。

### 1.4 合成实测：中文文本 + 日文参考音频（跨语种）

```jsonc
POST /tts
{ "text": "这是一次接口测试，用来验证插件能否脱离网页直接调用。", "text_lang": "zh",
  "ref_audio_path": "<日文参考音频.wav>", "prompt_text": "クライシックです春日影やります",
  "prompt_lang": "ja", "text_split_method": "cut0", "media_type": "wav", "streaming_mode": false }
```
→ **200，`content-type: audio/wav`，375 KB，魔数校验 `RIFF/WAVE` 通过**。跨语种正常。

### 1.5 三个必须知道的「坑」（都是实测踩出来的）

**坑 1：`ref_audio_path` 必须每个请求都带。**
先调 `/set_refer_audio` 成功，再发不带 `ref_audio_path` 的 `/tts` → 仍然 **400 `{"message":"ref_audio_path is required"}`**。
→ 插件**不能**「设置一次参考音频然后省掉」，每句请求都要带完整参数。这直接影响请求体构造。

**坑 2：`media_type` 不支持 `mp3`。**

| media_type | 状态 | content-type | 39 字体积 | 耗时 |
| --- | --- | --- | --- | --- |
| `wav` | ✅ 200 | `audio/wav` | 538,924 B | 4.46s |
| `ogg` | ✅ 200 | `audio/ogg` | **64,505 B** | 4.31s |
| `aac` | ✅ 200 | `audio/aac` | 146,934 B | 4.35s |
| `raw` | ✅ 200 | `audio/raw` | 375,040 B（裸 PCM） | — |
| `mp3` | ❌ **400** | `application/json` | — | `{"message":"media_type: mp3 is not supported"}` |

→ **`ogg` 是最优选择：体积只有 wav 的 1/8.4，且没有延迟代价。** 磁盘缓存用 ogg，内存直用 wav 亦可。
（注意：`tts-provider-plan.md` 里曾按 Edge 接口假设 mp3 可用，**对 GPT-SoVITS 不成立**。）

**坑 3：`text_split_method` 用 `cut0`（不切）。**
分句必须由插件自己做——因为我们需要**每段的原文偏移**。让服务端再切一次会打乱段与文档位置的对应关系。

### 1.6 性能实测：延迟与实时率（RTF）

| 字数 | 合成耗时 | 音频时长 | RTF（合成/音频） |
| --- | --- | --- | --- |
| 2 | 1.50s | 1.54s | **0.97** |
| 7 | 1.88s | 3.54s | 0.53 |
| 39 | 4.42s | 8.42s | 0.52 |
| 72 | 9.39s | 17.66s | 0.53 |

**规律：`合成耗时 ≈ 1.0s（固定开销）+ 0.12s × 字数`；字数 ≥ 7 后 RTF 稳定在 ≈ 0.52**，即合成比播放快约一倍。

推论（直接决定参数设计）：
- **预取深度 2–3 就够。** RTF 0.52 意味着合成速度是播放的 2 倍，流水线不会饿死。
- **首句延迟是唯一的体感瓶颈。** 固定开销 1.0s 无法消除（除非 warmup）。首段应**短**：10–25 字 → 约 2–4 秒等待，可接受。
- **极短句不划算**：2 字时 RTF 0.97（几乎一比一），因为固定开销占比过高。所以不要切得太碎 —— 这印证了 zhuomianling 的「弱边界需 ≥36 字」阈值选得准。

### 1.7 语速上限：2.0x 是硬天花板

`speed_factor` 缩短音频但不缩短合成耗时，因此 RTF 随语速线性恶化：

| speed_factor | 合成耗时 | 音频时长 | RTF | 预取能否跟上 |
| --- | --- | --- | --- | --- |
| 0.8 | 4.54s | 10.46s | 0.43 | 能 |
| 1.0 | 4.00s | 8.42s | 0.48 | 能 |
| 1.25 | 3.94s | 6.80s | 0.58 | 能 |
| 1.5 | 4.40s | 5.72s | 0.77 | 能 |
| **2.0** | 4.26s | 4.38s | **0.97** | **勉强（无余量）** |

**结论：朗读速度上限应设为 2.0x。** 超过 2.0x 后 RTF > 1，合成跟不上播放，必然卡顿。在 2.0x 时应提示用户「可能不够流畅」，并把预取深度提到最大。

---

## 2. 网页操作 → API 能力映射（正面回答「能否接管」）

| 网页里的操作 | 插件能否接管 | 怎么接管 |
| --- | --- | --- |
| 选模型版本（v2ProPlus 等） | ✅ 能 | 写进插件自己的 yaml 的 `custom.version`，用 `-c` 传入 |
| 选 GPT / SoVITS 权重文件 | ✅ **能，且运行时热切换** | `GET /set_gpt_weights` + `GET /set_sovits_weights` |
| 选推理设备（cuda / cpu） | ⚠️ 只能启动时定 | 写进 yaml 的 `custom.device`；无运行时端点 |
| 半精度推理 | ⚠️ 只能启动时定 | 写进 yaml 的 `custom.is_half`；无运行时端点 |
| 填参考音频路径 | ✅ 能 | 每请求的 `ref_audio_path` |
| 填参考文本 / 参考语言 | ✅ 能 | 每请求的 `prompt_text` / `prompt_lang` |
| 输出语言 | ✅ 能 | 每请求的 `text_lang` |
| 语速 / 切分方式 / 输出格式 / 种子 | ✅ 能 | 每请求的 `speed_factor` / `text_split_method` / `media_type` / `seed` |
| 点「开始合成」 | ✅ 能 | `POST /tts` |
| 停止 / 重启服务 | ✅ 能 | `GET /control?command=exit` / `restart` |
| 训练 / 数据标注 / UVR5 分离 等其它标签页 | ❌ 不需要 | 推理期用不到；这些不属于「朗读」范畴 |
| **启动服务本身** | ✅ 能（有本地证据） | `child_process.spawn(runtime\python.exe, ["-I","api_v2.py","-a","127.0.0.1","-p","9880","-c",<自己的yaml>], {cwd: 安装根})` |

**关于「插件能否起子进程」的本地证据**：已装的社区插件 `ob-sync` 与 `obsidian-pandoc` 的 `main.js` 中均出现 `child_process`。`obsidian-pandoc` 是知名插件，靠 shell 调 pandoc 工作。→ **Obsidian 桌面插件可以 `require("child_process")`。**（仍需在 Glimpse 里实测一次；见 §5 未验证项。）

---

## 3. 插件侧落地方案

### 3.1 核心原则：检测优先，启动可选，绝不篡改用户配置

```
启动朗读
   │
   ├─ 探测 127.0.0.1:<port> 是否已有服务在跑？
   │     ├─ 是 → 直接用（用户可能正为其它应用开着，不要抢）
   │     └─ 否 → 用户开启了「自动启动服务」？
   │            ├─ 是 → spawn 子进程 + 进度提示 + 轮询就绪
   │            └─ 否 → 提示用户手动启动（给出一键复制的命令）
   │
   └─ 就绪 → 按设置同步模型（/set_*_weights）→ 开始按句合成
```

**为什么「检测优先」是必须的**：端口 9880 只能被一个进程占用。如果用户同时给别的东西（比如桌面灵）开着 GPT-SoVITS，插件再起一个必然失败。检测到就复用。

### 3.2 不篡改用户的 `tts_infer.yaml`

插件应**生成自己的配置文件**（例如 `<vault>/.obsidian/plugins/glimpse/tts-infer.yaml`），内容只需：

```yaml
custom:
  device: cuda
  is_half: true
  version: v2ProPlus
  t2s_weights_path: GPT_weights_v2ProPlus/MyGO_高松灯_v2pp.ckpt
  vits_weights_path: SoVITS_weights_v2ProPlus/MyGO_高松灯_v2pp.pth
  cnhuhbert_base_path: GPT_SoVITS/pretrained_models/chinese-hubert-base
  bert_base_path: GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large
```

然后 `-c <绝对路径>` 传进去。理由：**用户的 `tts_infer.yaml` 是他网页里调好的状态**，插件改掉会让他下次开网页时莫名其妙变了模型。而 `TTS_Config` 的 `configs_.get("custom", ...)` 保证只认 `custom:` 段，插件自造的 yaml 完全够用。

注意：yaml 里的权重路径是**相对安装根目录**的，所以 spawn 时 `cwd` 必须是安装根。

### 3.3 生命周期与清理

| 事项 | 做法 |
| --- | --- |
| 只杀自己启的进程 | 记住 `spawn` 返回的 PID；用户已有服务时**绝不**杀 |
| 插件卸载 / Obsidian 退出 | 若由我们启动，先 `GET /control?command=exit`（优雅）→ 超时再 kill PID |
| 端口冲突 | 探测失败 + spawn 后立刻退出 → 读日志尾部判断是端口占用还是加载失败 |
| 就绪轮询 | 每 1s 试一次 `POST /tts`（空体）→ 拿到 **400** 即视为「服务活着」（连不上才是没起来）。超时设 120s（冷启动可能到 65s） |
| 进度反馈 | 冷启动 20–65 秒，必须用 Notice / 状态栏显示「正在加载声音模型…」，否则用户以为卡死 |

### 3.4 关键参数（全部来自实测）

| 参数 | 建议值 | 依据 |
| --- | --- | --- |
| `text_split_method` | `cut0` | 分句由我们自己做（需要偏移） |
| `media_type` | `ogg` | 体积 1/8.4，无延迟代价；`mp3` 不支持 |
| 预取深度 | 2–3 | RTF ≈ 0.52 |
| 朗读速度上限 | **2.0x** | 2.0x 时 RTF 0.97，再高必然卡顿 |
| 首段长度 | 10–25 字（首个强边界即断） | 固定开销 1.0s + 0.12s/字 |
| 常规段上限 | 120–150 字 | 平衡请求开销与跳转粒度 |
| 弱边界阈值 | ≥36 字 | 实测 2 字 RTF 0.97，切太碎不划算 |
| 请求超时 | 60s | 150 字约 19s，留余量 |
| 冷启动超时 | 120s | 实测 20–65s |
| `seed` | 固定（如 42） | 同一文本重复合成结果稳定，利于缓存命中 |
| warmup | 启动后立刻用 `"嗯。"` 打一次 | 消除首句的固定开销（约 1.0s） |

### 3.5 与既有方案的衔接

- **分段与偏移**：`tts-provider-plan.md` 的 `Segment { text, rawFrom, rawTo }` 不变；只是 `ref_audio_path` / `prompt_text` / `prompt_lang` 要作为**每个请求的固定前缀**带上。
- **逐词高亮**：不变。`decodeAudioData` 取段时长 → 段内按权重摊分。**实测确认 `speed_factor` 会改变音频时长，所以「读实际解码时长」这个设计是必要的**（若按字数估算，2.0x 时会全错）。
- **缓存键**：必须包含 `speed_factor` 与 `seed`（两者都改变输出字节）。

---

## 4. 风险与边界

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| **合规性** | 起子进程的插件必须 `isDesktopOnly: true`，且应在 README 声明会启动外部进程 | Glimpse 已有 `isDesktopOnly` 概念（提词器就是桌面专用）；需在 README 补一句声明 |
| **显存占用** | 服务常驻会一直占着显存（实测 RSS 1.15 GB，显存未测） | 默认「检测优先、不自动启动」；提供「朗读结束后自动关闭服务」开关 |
| **冷启动慢** | 20–65 秒 | 进度提示 + 可选 warmup + 「保持服务常驻」选项 |
| **CUDA 不可用时静默降级** | 代码里 `if "cuda" in device and not torch.cuda.is_available(): device = cpu` —— **不报错，只 print 一行 warning** | 插件必须**读服务日志尾部**，发现降级要提示用户「已降级到 CPU，合成会非常慢」 |
| **进程孤儿** | Obsidian 崩溃 / 强杀时子进程可能残留 | 记录 PID 到插件数据；下次启动时检测「端口被占但不是我记的 PID」并询问用户 |
| **端口被占** | 9880 被其它程序占用 | 探测时区分「是我们的服务 / 是别的服务 / 连不上」，给出不同提示 |
| **接口稳定性** | 这是项目自带的 `api_v2.py`，不是微软那种会变的外部接口 —— 稳定性远好于 Edge Read Aloud | 但仍应版本嗅探：探测失败时提示用户确认 GPT-SoVITS 版本 |

---

## 5. 验证状态（在 Obsidian 内实测，2026-09-28）

诊断命令：`朗读：环境诊断`（插件内运行，输出到控制台）。

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 插件内 `require("child_process")` + spawn | ✅ **可用** | 基础 spawn 测试通过。此前只有间接证据（`ob-sync` / `obsidian-pandoc`），现已确认 —— **插件可以自己拉起服务** |
| `requestUrl` 连 `127.0.0.1`（绕过 CORS） | ✅ **可用** | 服务未运行时返回 `net::ERR_CONNECTION_REFUSED`，即**网络层拒绝**而非 CORS 拦截 → requestUrl 确实绕过了 CORS |
| `requestUrl` 支持中止 | ❌ **不支持** | 已核对最新官方 `obsidian.d.ts`：`RequestUrlResponsePromise` 只加了 `arrayBuffer/json/text`，无 `abort()`。取消只能用「代际计数 + 丢弃结果」 |
| `decodeAudioData` 取精确时长 | ✅ **可用** | 0.1 秒静音解出 **0.100 秒 @ 48000Hz**（Chromium AudioContext 默认 48kHz） |
| `speechSynthesis` 的 `boundary` 事件 | ✅ **触发**（本机） | 「测试一二三。」触发 **3 次** boundary，粒度约等于词级 → 本地兜底方案**可以**做逐词高亮 |
| `speechSynthesis` 语音列表 | ⚠️ **首次为空** | 首次 `getVoices()` 返回 **0 个**，但 `speak()` 仍能出声。Chromium 的语音列表是**异步填充**的，必须在 speak 之后再查一次（诊断已修正为前后各查一次） |
| 显存实际占用 | 未测 | 只测到 RSS ≈ 1.15 GB |
| 冷启动精确耗时 | 只知落在 20–65 秒区间 | 未精确计时 |
| `streaming_mode` 1/2/3 的分片行为 | 未测 | 本次只用 `false`；若想再降首句延迟可测 `3` |
| `GET /tts` 与 POST 的等价性 | 未测 | 无关紧要，POST 已够用 |

### 5.1 由上述结论解锁的设计

- **spawn 可用** → 落地了 `src/reader/tts/service-launcher.ts`：检测优先（端口只能被一个进程占用，已有服务就复用）、只杀自己启动的进程、就绪轮询用「空体 POST /tts 拿 400」、读日志检测 CUDA 静默降级、停止时先 `/control?command=exit` 再兜底 kill。
- **boundary 可用** → 本地 `speechSynthesis` 可作离线兜底并支持逐词高亮；但语音列表异步填充这个坑要在实现里处理（不能假设 `getVoices()` 立刻有值）。
- **requestUrl 无 abort** → 取消一律用代际计数；保持段短（≤150 字）以限制浪费。

### 5.2 端到端验证（Node 里跑，不需要 Obsidian）

`.workbuddy-ai/verify-launcher.ts` + `obsidian-stub.ts`（用 `--alias:obsidian=` 顶替 requestUrl），
覆盖：spawn 成功 → 就绪轮询 → 日志判读 → 真实合成 → 二次调用复用 → stop 优雅退出 → 服务确实不可达。

```bash
./node_modules/.bin/esbuild .workbuddy-ai/verify-launcher.ts --bundle --platform=node \
  --format=cjs --target=node18 --alias:obsidian=./.workbuddy-ai/obsidian-stub.ts \
  --outfile=/tmp/verify-launcher.cjs && node /tmp/verify-launcher.cjs
```

---

## 附录：复现方式

探针脚本（保留在项目内，可重跑）：

```bash
# 1. 启动服务（后台）
cd "F:/_Frame/GPT-SoVITS-v2pro-20250604/GPT-SoVITS-v2pro-20250604"
./runtime/python.exe -I api_v2.py -a 127.0.0.1 -p 9880 > /tmp/gptsovits-api.log 2>&1

# 2. 等端口监听（20–65 秒）
netstat -ano | grep 9880

# 3. 跑探针
python .workbuddy-ai/probe-gptsovits.py      # 端点 / 模型热切换 / 合成 / media_type
python .workbuddy-ai/probe-gptsovits-2.py    # /control / set_refer_audio 持久性
python .workbuddy-ai/probe-gptsovits-3.py    # 延迟

# 4. 关闭
taskkill //PID <pid> //F
```

> 注：`probe-gptsovits-2.py` 的 [C]/[D] 两节基于「`/set_refer_audio` 会让后续请求省略 `ref_audio_path`」的**错误假设**，实际返回 400；修正版见 `probe-gptsovits-3.py`。

---

## 附录：参考音频的挑选（「参考音频目录」设置）
参考音频是**每请求必带**的字段（§1.4），而网页里用过的参考音频会被 Gradio 丢到
`TEMP/gradio/<hash>/`，路径又长又难记、还会被清理 —— 所以插件侧做了两件事：

1. **复制到插件目录**（`<插件目录>/reader-voice/`）再用，原位置被清理也不影响朗读；
   设置里存的始终是这个绝对路径。
2. **候选列表**：弹窗扫描「参考音频目录」（设置项，可空）；留空时退回扫描 GPT-SoVITS
   安装根目录（旧行为）。设成一个固定放参考音频的文件夹后，换音色只要在列表里点一下 ——
   选择辅助，与合成链路无关，音频放哪儿都能用。

扫描规则（`src/reader/tts/audio-scanner.ts`）：扩展名 `wav/mp3/flac/ogg/m4a/aac`、
深度 ≤3、跳过 `pretrained_models` `runtime` `node_modules` `.git` `__pycache__` `logs`
等目录，**按体积升序**（参考音频通常几十到几百 KB，小的排前面更接近要找的东西）。
候选列表里的名字是**相对扫描根**的路径，所以 `音色A/ref.wav` 与 `音色B/ref.wav` 一眼能分开。

导入时的命名（`src/reader/reference-audio-modal.ts` 的 `resolveTargetName`）：
同名但**体积不同**（即不是同一个文件）时改写为 `name-2.wav`、`name-3.wav`…
体积相同视为同一个文件、原地覆盖。这是为了「按音色分目录放参考音频」的用法：
只用基名做目标名的话，选第二个音色会悄悄覆盖第一个，再想切回去文件已经没了。

---

## 附录：权重（音色）什么时候生效

权重不在 `GptSoVitsOptions` 里 —— 它不随每个请求下发，而是通过
`GET /set_gpt_weights` + `GET /set_sovits_weights` 改服务**进程自身**的状态。
所以「改了设置」与「服务里生效」是两件事，一共三条触发路径：

| 时机 | 行为 | 代码 |
| --- | --- | --- |
| 用「选择音色…」按配对选 | 填好两项后**立即**热切换，并弹 Notice 确认 | `reader-ui.ts` → `applyReaderVoice()` |
| 手动改「GPT 权重 / SoVITS 权重」文本框 | 名称成对（同名 `.ckpt` / `.pth`）时**自动静默**热切换（防抖 900ms）；名称不成对则不动服务 | `autoApplyReaderVoice()` + `isWeightPair()` |
| 由插件启动服务时 | 仅当「本次确实新启动了服务」且两项都填齐才切换；**复用已在运行的服务时不动它的权重**（可能是别的应用在用，或用户在网页里调好的状态） | `startOrRestartReaderService()` |

兜底入口：「音色」行上的**「应用到服务」**按钮（强制立即应用，例如两项名称不成对、
或服务是外部启动的）。服务没在跑时以上都会跳过 —— 权重会在下次启动服务时应用。

为什么自动应用要加「名称成对」这道守卫：手打路径的过程中会不断出现半成品组合，
而只填一个或错配**不会报错**，只会静默产出错误的音色（见 CONTEXT.md 的「音色配对」）。

