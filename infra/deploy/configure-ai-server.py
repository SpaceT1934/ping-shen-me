"""服务器本地配置：不打印密钥，不向 GitHub 上传配置。"""
import secrets
import stat
import sys
from pathlib import Path

from dotenv import dotenv_values, set_key

base = Path("/home/ubuntu/ping-shen-me")
sys.path.insert(0, str(base / "current/apps/ai"))
from ai_service.config import Settings
shared = base / "shared"
ai_env, api_env = shared / "ai.env", shared / "api.env"
if not api_env.is_file():
    raise SystemExit("找不到现有 shared/api.env，停止配置")
if not ai_env.exists():
    ai_env.write_text((base / "current/apps/ai/.env.example").read_text(encoding="utf-8"), encoding="utf-8")
    ai_env.chmod(stat.S_IRUSR | stat.S_IWUSR)
    set_key(str(ai_env), "AI_SERVICE_TOKEN", secrets.token_urlsafe(32))
    raise SystemExit("已生成 shared/ai.env。请在服务器本地填写模型密钥、地址并确认 ASR_ENABLED，再重复运行 setup-ai.sh。不要把密钥提交 GitHub。")
ai = dotenv_values(ai_env)
settings = Settings(api_key=ai.get("DASHSCOPE_API_KEY", ""),
                    base_url=ai.get("LLM_BASE_URL", ""),
                    asr_model=ai.get("ASR_MODEL", "qwen-audio-3.1-asr-flash"),
                    asr_enabled=ai.get("ASR_ENABLED", "false").lower() == "true")
if not settings.configured or "YOUR-ENDPOINT" in settings.base_url:
    raise SystemExit("请先在 shared/ai.env 填写有效的 DASHSCOPE_API_KEY 与 LLM_BASE_URL")
if settings.asr_enabled and not settings.asr_ready:
    raise SystemExit("ASR_MODEL 不受当前同步语音接口支持，请检查型号")
token = ai.get("AI_SERVICE_TOKEN") or secrets.token_urlsafe(32)
set_key(str(ai_env), "AI_SERVICE_TOKEN", token)
set_key(str(api_env), "AI_SERVICE_URL", "http://127.0.0.1:8002")
set_key(str(api_env), "AI_SERVICE_TOKEN", token)
set_key(str(api_env), "AI_REQUIRED_ON_DEPLOY", "true")
for path in (ai_env, api_env):
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)
print("AI 与业务服务认证已同步，配置文件仅服务器用户可读。")
