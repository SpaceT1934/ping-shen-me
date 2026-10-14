"""从已填好的本地 .env 导入密钥；不打印凭证，也不调用模型。"""
import argparse
import json
import secrets
from pathlib import Path

from dotenv import dotenv_values

parser = argparse.ArgumentParser()
parser.add_argument("--from-env", required=True)
args = parser.parse_args()
ai_root = Path(__file__).resolve().parents[1]
api_env = ai_root.parent / "api" / ".env"
ai_env = ai_root / ".env"
source = dotenv_values(Path(args.from_env))
if not source.get("DASHSCOPE_API_KEY") or not source.get("LLM_BASE_URL"):
    raise SystemExit("来源配置缺少模型密钥或地址")
existing_api = dotenv_values(api_env) if api_env.exists() else {}
existing_ai = dotenv_values(ai_env) if ai_env.exists() else {}
token = existing_api.get("AI_SERVICE_TOKEN") or existing_ai.get("AI_SERVICE_TOKEN") or secrets.token_urlsafe(32)
values = {**existing_ai, **{k: source[k] for k in ("DASHSCOPE_API_KEY", "LLM_BASE_URL")},
          "LLM_MODEL": source.get("LLM_MODEL") or "qwen3.8-flash", "AI_SERVICE_TOKEN": token,
          "ASR_MODEL": "qwen-audio-3.1-asr-flash", "ASR_ENABLED": "false"}
api_values = {**existing_api, "AI_SERVICE_URL": "http://127.0.0.1:8002", "AI_SERVICE_TOKEN": token}
for path, fields in ((ai_env, values), (api_env, api_values)):
    path.write_text("".join(f"{key}={json.dumps(value or '', ensure_ascii=False)}\n" for key, value in fields.items()), encoding="utf-8")
print("本地 AI 与 API 配置已连接；语音保持关闭。")
