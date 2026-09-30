# Qwen3-TTS（VoiceDesign）桥接与引擎切换

> 承接 `gpt-sovits-integration.md` 与 `reader-handoff.md`。用户需求：朗读模块已接通
> 本机 GPT-SoVITS，希望**切换**到本地模型 `F:\_Frame\Qwen3-TTS-12Hz-1.7B-VoiceDesign`。
>
> 本文记录设计取舍、桥接协议与验证状态。日期：2026-09-29。

---

## 0. 结论摘要

1. **Qwen3-TTS 官方只有 Gradio demo（`qwen-tts-demo`），没有可编程的 HTTP API**；
   vLLM-Omni 目前只支持离线推理。所以桥接采用与 GPT-SoVITS 同构的方案：
   **插件生成一个小型推理服务脚本（`reader-qwen-server.py`）并 spawn**，
   插件继续只做 HTTP 客户端。
2. 引擎切换的架构约束：`SegmentQueue` 构造时捕获引擎引用，**不能靠替换
   `plugin.readerEngine` 字段切引擎** —— 引入常驻的 `RoutingTtsEngine` 门面，
   切换只改路由目标。
3. 两个提供方**各有一套独立的服务与音色配置、各自的启动器与归属记录**；
   「TTS 引擎」下拉切换的是路由目标，**并会自动停止上一套引擎由本插件启动的服务**
   （两套模型同时常驻显存叠加太重；外部启动的服务不替用户关，只提示）。
   手动仍可让两套并存（分别点各自的「启动」）。
4. VoiceDesign 的音色机制与 GPT-SoVITS 完全不同：**没有参考音频/权重对，
   音色 = 一段自然语言描述（instruct），随每个请求发送，改完即生效**。
   「应用音色」这个步骤对 Qwen3-TTS 不存在（该步骤现已并入「音色」行，见 `gpt-sovits-integration.md`）。
5. `generate_voice_design` **没有 speed 参数** —— Qwen3-TTS 引擎暂不支持语速调节；
   输出固定 wav（脚本用 stdlib `wave` 写 16bit PCM，无额外编码依赖）。
6. 验证状态：引擎协议层 14/14（Node 桩服务）、启动器 14/14（真实 spawn 系统
   Python 的确定性负路径）、`npm run build` 通过、既有回归（reader / playback）全过。
   **真实合成（装好 qwen-tts 后）尚未跑过** —— 见 §6。

---

## 1. 模型与运行环境（事实）

| 项 | 值 |
| --- | --- |
| 模型目录 | `F:\_Frame\Qwen3-TTS-12Hz-1.7B-VoiceDesign`（HF 快照布局：`config.json` / `model.safetensors` / `speech_tokenizer/`） |
| 架构 | `Qwen3TTSForConditionalGeneration`，`tts_model_type: "voice_design"`，12Hz speech tokenizer |
| 官方包 | `pip install -U qwen-tts`（Apache-2.0），推荐 **Python 3.12** |
| 加载 | `Qwen3TTSModel.from_pretrained(路径, device_map="cuda:0", dtype=torch.bfloat16, attn_implementation=...)` |
| VoiceDesign 生成 | `model.generate_voice_design(text=..., language="Chinese", instruct=...)` → `(wavs, sr)` |
| 语种 | 中/英/日/韩/德/法/俄/葡/西/意共 10 种（language 用首字母大写英文名） |
| 本机 Python | 系统 3.14.6（torch 2.12.1+**cpu**，无 qwen_tts）；`py` 有 3.12（Astral 标签）。**尚无装好 qwen-tts 的环境** |

环境搭建有两种方式：

**方式一（推荐）：设置页「一键准备环境」按钮**。自动扫描各盘符两层找模型目录
（名字含 Qwen3-TTS 且结构完整）→ 解析 `py -0p` 按 3.12 > 3.11 > 3.13 > 3.10 挑解释器
（排除 3.14+ 与 <3.10）→ 在模型目录旁建 `glimpse-qwen-tts-env` → pip 安装 qwen-tts
（失败自动换清华镜像重试；5 分钟无输出判停滞）→ 终检后回填路径。**幂等**：
已就绪的项直接复用，装过再点秒回。

**方式二（手动）**：

```bash
py -V:Astral/CPython3.12.13 -m venv "F:\_Frame\qwen3-tts-env"
"F:\_Frame\qwen3-tts-env\Scripts\python.exe" -m pip install -U qwen-tts
# 也可以用任意 Python 3.10+；装完把解释器路径填进「设置 → 朗读 → Python 解释器」
```

注意：系统 Python 3.14 已装有 CPU 版 torch，qwen-tts 在它上面**未必有兼容 wheel**；
建议用独立的 3.12 venv（上例），不要污染全局环境。

---

## 2. 桥接协议（reader-qwen-server.py）

插件把脚本写到插件目录（内容内嵌于 `qwen-server-script.ts`，启动前内容有变就覆盖，
**手改会被覆盖**），spawn 参数：

```
<python> -X utf8 reader-qwen-server.py --model <模型目录> --host 127.0.0.1 --port 9872 --device cuda:0
```

| 端点 | 方法 | 行为 |
| --- | --- | --- |
| `/health` | GET | `{"ok":true,"ready":bool,"error":str\|null,"model":...,"device":...}` —— 端口先监听、模型后台加载，所以启动器能区分「加载中 / 就绪 / 加载失败」 |
| `/tts` | POST | `{"text","language"?,"instruct"?}` → `audio/wav`；instruct **实际是必填**（实测 500），留空时服务端用内置默认音色；未就绪 503、加载失败 500（带 Exception）、参数错误 400、推理异常 500 `{"message":"tts failed","Exception":...}` |
| `/shutdown` | POST | 200 后 `os._exit(0)`（stop / forceStop 都走这里，等端口释放再兜底 kill） |

设计要点：

- **HTTP 骨架零第三方依赖**（stdlib `http.server` + `wave`）：没装 qwen_tts 时服务照样
  起来，`/health.error` 直接给出 `ModuleNotFoundError` —— 比读日志猜原因强得多。
- `qwen_tts` / `torch` **在加载线程里才 import**，与「端口先监听」配合。
- 合成串行（`threading.Lock`）：单 GPU 并行只会互相拖慢；`ThreadingHTTPServer`
  保证 `/health` 在合成期间仍可达。
- stdout 带 `[glimpse-qwen]` 前缀，方便在日志里区分。
- CUDA 不可用时**显式打日志**「已降级到 CPU」（GPT-SoVITS 是静默降级，
  启动器读这行提示用户）。

## 3. 引擎与切换架构

```
设置 reader.provider = "gpt-sovits" | "qwen3-tts"
        │
        ▼
RoutingTtsEngine（常驻，onload 创建一次）
  ├── "gpt-sovits" → GptSoVitsEngine ── api_v2.py:9880   （GptSoVitsServiceLauncher）
  └── "qwen3-tts"  → Qwen3TtsEngine  ── reader-qwen-server.py:9872（QwenTtsServiceLauncher）
        │
        ▼
SegmentQueue（构造时拿的是 RoutingTtsEngine，永远不用换）
```

为什么需要路由器：`SegmentQueue` 在构造时捕获 engine 引用，替换字段对它无效；
换引擎只改 `RoutingTtsEngine.active` 即可全局生效。

两套引擎的对比（决定各自设置组的形状）：

| 维度 | GPT-SoVITS | Qwen3-TTS (VoiceDesign) |
| --- | --- | --- |
| 音色 | 参考音频 + 参考文本 + 权重对（需配对、需「应用」） | 自然语言描述（instruct），随请求发送，即改即生效 |
| 服务 | 用户自部署的 api_v2.py | 插件生成的 reader-qwen-server.py |
| 就绪判定 | 空体 POST /tts 拿任意状态码 | `GET /health` 的 `ready` 字段 |
| 语速 | `speed_factor`（上限 2.0x，实测） | **无 speed 参数，不支持** |
| 输出 | ogg（实测体积 1/8.4） | wav（16bit PCM） |
| 失败探测 | 日志正则（Errno 22 / CUDA 降级） | `/health.error` 直读 + 日志 |
| 归属记录 | `reader-service.json` | `reader-qwen-service.json`（互不覆盖） |

### 设置页结构（reader-ui.ts）

- **引擎**（共用顶部）：`TTS 引擎` 下拉；切换即存盘 + `refreshReaderEngine()` + 重绘。
- **服务（GPT-SoVITS）／声音（GPT-SoVITS）**：原有全部配置，仅 provider 为 gpt-sovits 时渲染；安装根目录带「浏览…」按钮（系统文件夹对话框，选完自动校验）。
- **服务（Qwen3-TTS）**：状态行（颜色点 + 推理健康度 + 当前音色摘要）、**一键准备环境**
  （自动完成模型目录/解释器/venv/安装四步并回填）、服务地址、
  模型目录（「浏览…」选目录，选完自动校验三要素）、Python 解释器（「浏览…」选 python.exe，
  另有「检查」按钮真实 `import torch, qwen_tts`）、推理设备、启动/停止/强制停止。
- **声音（Qwen3-TTS）**：音色预设（5 个模板下拉，选中填入描述框）、音色描述（textarea）、
  朗读语种（10 种）、合成超时、环境诊断。
- **朗读 / 分段 / 内容过滤**：对引擎无感，保持共用。语速/输出格式只在 GPT-SoVITS 组出现。

## 4. 生命周期（与 GPT-SoVITS 启动器同构）

- **检测优先**：`ensureRunning` 先探 `/health`——已有服务直接复用（外部启动的不动、不停）。
- **只杀自己的进程**：spawn 记 PID，归属落盘 `reader-qwen-service.json`，插件重载后
  `adoptFromRecord` 认领（PID 存活 + 端口在服务双重确认）。
- **就绪轮询**：每秒查 `/health`；`ready=true` 成功、`error` 非空立即失败（带根因）、
  进程退出立即失败。默认超时 **240 秒**（首次加载含读盘与内核预热）。
- **日志重定向到文件**（`reader-qwen-service.log`）：管道会随插件重载失效
  （GPT-SoVITS 的 Errno 22 教训，坑 1），spawn 即带 `-X utf8`（坑 13 同源）。
- **stop 顺序**：`POST /shutdown` → 等端口释放（3s）→ kill PID → 再等（2.5s）。

## 5. 验证状态

| 验证 | 结果 | 方式 |
| --- | --- | --- |
| 引擎协议（probe / synthesize / 取消 / 超时 / 魔数 / JSON 错误 / instruct 透传 / 空字段省略 / shutdown） | ✅ **14/14** | `.workbuddy-ai/verify-qwen-engine.ts`（Node HTTP 桩服务） |
| 启动器（脚本写入含父目录 / spawn / 健康轮询 / 失败根因 `ModuleNotFoundError` / stop 优雅退出 / 二次可重复 / 模型目录校验对真实路径判定） | ✅ **14/14** | `.workbuddy-ai/verify-qwen-launcher.ts`（真实 spawn 系统 Python 的确定性负路径） |
| 一键准备环境（py -0p 解析 / 3.12 优先挑选并排除 3.14 / 真实盘符扫描找到模型目录 / GPU 检测与 cu 标签选择 / 现有 venv 被正确判为 CPU torch） | ✅ **13/13** | `.workbuddy-ai/verify-qwen-setup.ts`（真实环境探测；完整安装链路由用户点按钮时首次触发） |
| CUDA torch 换装（RTX 3060 / 驱动 616.56 = UMD 13.4 → cu132 → `torch 2.14.0+cu132`，`cuda.is_available() = True`，qwen_tts 导入完好） | ✅ 实测通过 | 2026-09-29 真机执行 |
| **性能（RTX 3060，bf16 + SDPA，GPU 利用率 31–40% / 显存 6.7GB）**：2 字预热 1.1s；25 字 16.4s/6.0s 音频；50 字 ~31s/11s；100 字 58.6s/21.2s → **RTF ≈ 2.8（≈0.6 s/字），预热后不变** | ✅ 实测 | `.workbuddy-ai/bench-qwen.mjs`；对照 GPT-SoVITS 同机 RTF ≈ 0.52（0.12 s/字）——**慢约 5 倍，且 RTF > 1 意味着流水线追不上播放，每段播完要等 ≈1.8× 段长**。结论：这是 LLM 自回归架构在 3060 上的固有代价，非配置问题；长文朗读用 GPT-SoVITS，Qwen3-TTS 适合短段与音色设计 |
| `generate_voice_design` 的 **instruct 是必填位置参数**（留空 → 500 `missing 1 required positional argument`） | ✅ 已修 | 服务端加内置默认音色 `DEFAULT_INSTRUCT`；「音色描述」留空 = 用默认音色而非「模型默认」 |
| `npm run build`（tsc --noEmit + esbuild production） | ✅ | — |
| 既有回归 verify-reader / verify-playback | ✅ 全过 | — |
| **真实合成**（装好 qwen-tts 后端到端） | ⬜ 未做 | 装 `qwen-tts` 后：设置页填模型目录与解释器 → 「检查 Python 环境」→「启动服务」→ 环境诊断 |
| 合成延迟 / RTF / 显存占用 | ⬜ 未测 | 首测时记录，用于校准预取深度与超时 |

复现：

```bash
node .workbuddy-ai/build-verify.mjs .workbuddy-ai/verify-qwen-engine.ts  && node "$(node -e 'console.log(require("os").tmpdir())')/verify-out.cjs"
node .workbuddy-ai/build-verify.mjs .workbuddy-ai/verify-qwen-launcher.ts && node "$(node -e 'console.log(require("os").tmpdir())')/verify-out.cjs"
```

> 踩坑记录：第一次跑启动器验证时没桩 `window`（`window.setTimeout`）导致脚本崩溃，
> spawn 出的服务成了孤儿占着 9873；后续运行被「端口上有服务但模型加载失败」分支正确拦截
> —— 行为符合设计，但暴露了**验证脚本必须先清理端口**，已加 `cleanupStaleService()`。

## 6. 为什么装了 CUDA 还是「已降级到 CPU」（实测踩坑，2026-09-29）

**现象**：机器是 RTX 3060、装过 CUDA，一键准备环境也成功，但服务日志报
`[glimpse-qwen] CUDA 不可用，已降级到 CPU`。

**根因**：**PyTorch 不使用系统安装的 CUDA Toolkit** —— Windows 版 torch 的轮子自带
CUDA 运行时，而 **PyPI 默认源上的 torch 只有 CPU 版**（版本号带 `+cpu` 后缀，
实测装出 `torch 2.14.0+cpu`）。`torch.cuda.is_available()` 只看 torch 自带的运行时
与驱动，系统装没装 CUDA、CUDA 版本多新都无关。qwen-tts 把 torch 声明为普通依赖，
`pip install qwen-tts` 自然拉进来 +cpu 版。

**修法**：从 PyTorch 官方源显式装 CUDA 构建并**先卸载 +cpu 版**：

```bash
"<venv>/Scripts/python.exe" -m pip uninstall -y torch
"<venv>/Scripts/python.exe" -m pip install torch --index-url https://download.pytorch.org/whl/cu132
```

两个坑：

1. **不能只 `pip install -U torch --index-url …`**：PEP 440 的本地版本序里
   `+cpu` 排在 `+cuXXX` 之后（`cpu` > `cu132`），pip 会认为已装的更新而跳过。
   必须先 uninstall。
2. **cu 标签要按驱动选**：`nvidia-smi` 表头的 `CUDA UMD Version` 是驱动支持的
   运行时上限（本机 616.56 驱动 = 13.4）。标签选法见 `qwen-setup.ts` 的
   `TORCH_CUDA_TAGS`（cu132 → cu130 → cu128 → cu126 → cu124 → cu121，
   从驱动支持的最新的开始试，失败降级）。2026-09 时 cu132 有 torch 2.14.0+cu132。

**插件化**：`prepareQwenEnvironment` 已把这一步织入流程 ——
检测到 NVIDIA GPU（`nvidia-smi`）时：新环境**先装 CUDA torch 再装 qwen-tts**
（避免依赖解析拉 +cpu）；已有环境若发现 `torch.cuda.is_available() === false`
则自动换装（自愈）。最终消息会如实汇报 `GPU：xxx（CUDA 版 torch 可用）`。

**注意**：换装 torch 后，**正在运行的推理服务仍持有旧 torch 的内存映像**，
必须停止再启动服务（或「朗读：重启本地服务」）才会真正用上 GPU。
另外 GPT-SoVITS 与 Qwen3-TTS 同时常驻会叠加显存占用，12GB 卡建议用哪个开哪个。

## 7. 「换 0.6B-Base 能把 RTF 压进 1 吗」——大概率不能（2026-09-29 分析）

- **瓶颈不在模型算力**：实测推理时 GPU 利用率仅 31–40% —— 时间花在 HF `generate` 的
  逐步 Python 循环 + 多码本 sub-talker 逐帧预测 + 每步 logits 处理上（GPU 在等 CPU）。
  模型从 1.7B 缩到 0.6B 只能压缩 GPU 那约 35% 的份额，RTF 粗估 2.8 → **~2.0–2.3**；
  即便乐观假设全部耗时随参数量线性缩放，也只是 2.8/2.8 ≈ 1.0 贴线。压进 1 不现实。
- **0.6B-Base 是另一个物种**：它是「3 秒参考音频克隆」底座（`generate_voice_clone(text,
  language, ref_audio, ref_text)`，源码位于 qwen_tts/inference/qwen3_tts_model.py:470），
  且 `generate_voice_design` 对 `tts_model_type != "voice_design"` 硬校验直接抛错。
  接它 = 音色回到「给参考音频」的 GPT-SoVITS 式玩法，失去文字定义音色。
- **源码佐证**：`non_streaming_mode=False` 在当前开源包里只是「模拟流式文本输入」，
  并非真流式生成（generate_voice_design 的 docstring 明说）；采样参数
  （top_k/top_p/temperature 等）不改变解码速度。
- 结论：流畅长文用 GPT-SoVITS（0.52）；音色设计用 1.7B-VoiceDesign；0.6B-Base 两头不占。

## 8. 后续（装好 qwen-tts 后的第一轮实测清单）

1. `pip install -U qwen-tts` 后跑「检查 Python 环境」→「启动本地服务」→「环境诊断」。
2. 实测合成延迟与 RTF（对照 GPT-SoVITS 的 1.0s + 0.12s/字），校准：
   预取深度（当前 2）、首段上限、超时（120s）。
3. `instruct` 的稳定性：同一描述多次生成的音色是否一致（影响缓存键设计）。
4. `decodeAudioData` 对脚本产出的 wav 解码时长（P2 逐词高亮的前置，理论上无风险）。
5. 确认 `generate_voice_design` 在长段（150 字）下不产生服务端自行分句的副作用。
