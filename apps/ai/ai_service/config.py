import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Settings:
    api_key: str = field(default="", repr=False)
    service_token: str = field(default="", repr=False)
    base_url: str = ""
    model: str = "qwen3.8-flash"
    asr_model: str = "qwen-audio-3.1-asr-flash"
    asr_enabled: bool = False

    @property
    def asr_ready(self):
        return self.asr_enabled and self.configured and self.asr_model in {
            "qwen3-asr-flash", "qwen-audio-3.0-asr-flash", "qwen-audio-3.1-asr-flash",
        }

    @property
    def configured(self):
        try:
            url = urlsplit(self.base_url)
            return bool(self.api_key and url.scheme == "https" and url.hostname
                        and url.hostname.endswith(".cn-beijing.maas.aliyuncs.com")
                        and not url.username and not url.password and not url.query
                        and not url.fragment and url.port in (None, 443)
                        and url.path.rstrip("/") == "/compatible-mode/v1")
        except ValueError:
            return False

    @classmethod
    def from_env(cls):
        values = {**dotenv_values(ROOT / ".env"), **os.environ}
        return cls(api_key=values.get("DASHSCOPE_API_KEY", ""),
                   service_token=values.get("AI_SERVICE_TOKEN", ""),
                   base_url=values.get("LLM_BASE_URL", ""),
                   model=values.get("LLM_MODEL", "qwen3.8-flash"),
                   asr_model=values.get("ASR_MODEL", "qwen-audio-3.1-asr-flash"),
                   asr_enabled=values.get("ASR_ENABLED", "false").lower() == "true")
