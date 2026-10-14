"""用几秒钟的阿里云官方公开语音验证端到端转写，无重试、不保存音频。"""
import base64
import argparse
import io
import json
import sys
import wave
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai_service.config import Settings

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--api-url", default="http://127.0.0.1:3001")
parser.add_argument("--origin", default="http://localhost:5173")
args = parser.parse_args()
if not Settings.from_env().asr_ready:
    raise SystemExit("语音未启用：先确认免费额度和用完即停，再设置 ASR_ENABLED=true")
sample_url = "https://dashscope.oss-cn-beijing.aliyuncs.com/samples/audio/paraformer/hello_world_female2.wav"
sample = httpx.get(sample_url, timeout=15, follow_redirects=False)
sample.raise_for_status()
audio = sample.content
with wave.open(io.BytesIO(audio)) as wav:
    seconds = wav.getnframes() / wav.getframerate()
if not 0 < seconds <= 10 or len(audio) > 500_000:
    raise SystemExit("样例超出小额度验证范围，不调用模型")
with httpx.Client(base_url=args.api_url, timeout=40,
                  headers={"Origin": args.origin}) as client:
    session = client.post("/api/v1/session", json={})
    session.raise_for_status()
    capabilities = client.get("/api/v1/ai/capabilities")
    capabilities.raise_for_status()
    if not capabilities.json()["data"]["asr_enabled"]:
        raise SystemExit("业务后端尚未连接已启用的语音服务，不调用模型")
    result = client.post("/api/v1/asr/transcribe", json={
        "audio_base64": base64.b64encode(audio).decode(), "mime_type": "audio/wav"})
    if result.status_code != 200:
        error = result.json()
        print(json.dumps({"status": result.status_code, "code": error.get("code"),
                          "message": error.get("message")}, ensure_ascii=False))
        raise SystemExit(1)
    text = result.json().get("data", {}).get("text")
    if not isinstance(text, str) or not text.strip():
        raise SystemExit("转写未得到有效文字")
    # 输出仅包含公开样例的识别文字，不输出认证信息或音频。
    print(json.dumps({"passed": True, "model": Settings.from_env().asr_model,
                      "sample_seconds": round(seconds, 2), "asr_calls": 1, "text": text}, ensure_ascii=False))
