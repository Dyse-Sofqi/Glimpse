/**
 * reader-qwen-server.py 的脚本内容。
 *
 * Qwen3-TTS 官方只提供 Gradio demo（qwen-tts-demo），没有可供程序调用的
 * HTTP API，所以桥接用这个自写的极简推理服务：
 * - 零第三方依赖的 HTTP 骨架（stdlib http.server），端口先监听、模型后台加载
 *   —— /health 立即可用，启动器能区分「加载中 / 就绪 / 加载失败」
 * - qwen_tts / torch 在加载线程里才 import：环境没装好时服务照样起来，
 *   /health 的 error 字段会给出「缺什么」的准确提示
 * - 生成串行（单 GPU）；输出 16bit PCM wav（stdlib wave 写，解码路径最直接）
 *
 * 由启动器写入插件目录并在内容变化时覆盖 —— 手改会被覆盖。
 */
export const QWEN_SERVER_SCRIPT_NAME = "reader-qwen-server.py";

export const QWEN_SERVER_SCRIPT = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Glimpse 朗读 - Qwen3-TTS（VoiceDesign）本机推理服务。

由 Glimpse 插件生成并拉起，改动会被插件覆盖。
协议：
  GET  /health    -> {"ok":true,"ready":bool,"error":str|null,"model":...,"device":...}
  POST /tts       body {"text","language"?,"instruct"?} -> audio/wav | JSON 错误
  POST /shutdown  -> 200 后自行退出
"""
import argparse
import io
import json
import os
import sys
import threading
import traceback
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE = {"ready": False, "error": None}
LOCK = threading.Lock()
MODEL = None
DEFAULT_LANGUAGE = "Chinese"
# 实测：generate_voice_design 的 instruct 是**必填**位置参数（留空不传会 500
# missing 1 required positional argument）。所以请求不带描述时用这个内置默认音色。
DEFAULT_INSTRUCT = "清晰自然的年轻女声，语速适中，咬字清晰"
MODEL_PATH = ""
DEVICE = ""


def log(message):
    print("[glimpse-qwen] " + str(message), flush=True)


def load_model():
    global MODEL
    try:
        import torch
        from qwen_tts import Qwen3TTSModel

        cuda_ok = DEVICE.startswith("cuda") and torch.cuda.is_available()
        if DEVICE.startswith("cuda") and not torch.cuda.is_available():
            log("CUDA 不可用，已降级到 CPU —— 合成会非常慢")
        effective_device = DEVICE if cuda_ok else "cpu"
        dtype = torch.bfloat16 if cuda_ok else torch.float32
        log("loading model from {} (device={}, dtype={})".format(MODEL_PATH, effective_device, dtype))
        MODEL = Qwen3TTSModel.from_pretrained(
            MODEL_PATH,
            device_map=effective_device,
            dtype=dtype,
            attn_implementation="sdpa",
        )
        STATE["ready"] = True
        log("model ready")
    except BaseException as exc:
        STATE["error"] = "{}: {}".format(type(exc).__name__, exc)
        traceback.print_exc()


def to_wav_bytes(wav, sample_rate):
    import numpy as np

    audio = np.asarray(wav, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1.0:
        audio = audio / peak
    pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm)
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        log("{} - {}".format(self.address_string(), fmt % args))

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            self.send_json(200, {
                "ok": True,
                "ready": STATE["ready"],
                "error": STATE["error"],
                "model": MODEL_PATH,
                "device": DEVICE,
            })
        else:
            self.send_json(404, {"message": "not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/shutdown":
            self.send_json(200, {"ok": True})
            threading.Timer(0.2, os._exit, args=(0,)).start()
            return
        if path != "/tts":
            self.send_json(404, {"message": "not found"})
            return
        if STATE["error"]:
            self.send_json(500, {"message": "模型加载失败", "Exception": STATE["error"]})
            return
        if not STATE["ready"] or MODEL is None:
            self.send_json(503, {"message": "模型正在加载，请稍候重试"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length > 0 else b"{}"
            req = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            self.send_json(400, {"message": "请求体不是合法 JSON", "Exception": str(exc)})
            return
        text = str(req.get("text") or "").strip()
        if not text:
            self.send_json(400, {"message": "text is required"})
            return
        language = str(req.get("language") or DEFAULT_LANGUAGE)
        instruct = str(req.get("instruct") or DEFAULT_INSTRUCT)
        try:
            kwargs = {"text": text, "language": language}
            if instruct:
                kwargs["instruct"] = instruct
            with LOCK:
                wavs, sample_rate = MODEL.generate_voice_design(**kwargs)
            audio = to_wav_bytes(wavs[0], sample_rate)
            log("synthesized {} chars -> {} bytes @ {}Hz".format(len(text), len(audio), sample_rate))
        except Exception as exc:
            traceback.print_exc()
            self.send_json(500, {"message": "tts failed", "Exception": str(exc)})
            return
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)


def main():
    global MODEL_PATH, DEVICE
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9872)
    parser.add_argument("--device", default="cuda:0")
    args = parser.parse_args()
    MODEL_PATH = args.model
    DEVICE = args.device
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    log("listening on {}:{}".format(args.host, args.port))
    threading.Thread(target=load_model, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
`;
