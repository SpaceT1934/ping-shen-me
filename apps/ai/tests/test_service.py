import base64
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from ai_service.config import Settings
from ai_service.main import create_app
from ai_service.provider import Bailian

TOKEN = "test-internal-token"
BASE = "https://test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"


def setup(result=None, status=200, enabled=False, asr_model="qwen-audio-3.1-asr-flash", raw_response=None):
    calls = []

    def respond(request):
        calls.append(json.loads(request.content))
        content = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
        if request.url.path == "/api/v1/services/aigc/multimodal-generation/generation":
            return httpx.Response(status, json=raw_response if raw_response is not None else {"output": {"text": content}})
        return httpx.Response(status, json={"choices": [{"finish_reason": "stop", "message": {"content": content}}]})

    settings = Settings(api_key="test-provider-key", service_token=TOKEN, base_url=BASE,
                        asr_enabled=enabled, asr_model=asr_model)
    provider = Bailian(settings, httpx.Client(transport=httpx.MockTransport(respond)))
    client = TestClient(create_app(settings, provider))
    return client, calls


def post(client, path, body):
    return client.post("/internal/v1" + path, json=body, headers={"Authorization": "Bearer " + TOKEN})


def test_auth_is_required_without_model_call():
    client, calls = setup()
    assert client.post("/internal/v1/projects/analyze", json={"text": "学英语"}).status_code == 401
    assert not calls
    assert client.get("/health").json()["status"] == "ok"


def test_records_are_drafts_with_owned_project_ids_and_traceable_source():
    client, calls = setup({"items": [
        {"content": "剪完视频", "type": "action", "project_id": "owned", "emotion": None, "source_text": "剪完视频"},
        {"content": "背单词", "type": "task", "project_id": "foreign", "emotion": None, "source_text": "明天背单词"},
    ]})
    result = post(client, "/records/analyze", {"text": "剪完视频，明天背单词", "projects": [{"id": "owned", "name": "自媒体", "goal": None}]})
    assert result.status_code == 200
    assert result.json()["items"][1]["project_id"] is None
    assert calls[0]["enable_thinking"] is False
    assert calls[0]["max_tokens"] == 1536


@pytest.mark.parametrize("data", [
    {"items": [{"content": "杜撰", "type": "action", "project_id": None, "emotion": None, "source_text": "不存在"}]},
    {"items": [{"content": "完成", "type": "invalid", "project_id": None, "emotion": None, "source_text": "完成"}]},
    {"items": "bad"},
])
def test_invalid_model_output_is_rejected(data):
    client, calls = setup(data)
    result = post(client, "/records/analyze", {"text": "完成学习", "projects": []})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "AI_PARSE_FAILED"
    assert len(calls) == 1


def test_projects_and_no_business_data_writes():
    client, calls = setup({"candidates": [{"name": "英语", "goal_text": "雅思7分", "source_text": "学英语考雅思7分"}]})
    result = post(client, "/projects/analyze", {"text": "学英语考雅思7分"})
    assert result.status_code == 200
    assert len(calls) == 1
    assert client.post("/api/v1/garden/commands").status_code == 404


def test_validation_errors_do_not_echo_raw_input():
    client, calls = setup()
    result = post(client, "/projects/analyze", {"text": "secret-input" * 40})
    assert result.status_code == 400
    assert "secret-input" not in result.text
    assert not calls


def test_no_retry_after_provider_failure():
    client, calls = setup(status=429)
    result = post(client, "/projects/analyze", {"text": "学英语"})
    assert result.status_code == 503
    assert len(calls) == 1


def test_empty_report_does_not_consume_model_quota():
    client, calls = setup()
    result = post(client, "/reports/summarize", {"period": "7天", "action_count": 0, "active_count": 0, "result_count": 0, "projects": []})
    assert result.status_code == 200
    assert not calls


def test_report_summary_uses_given_statistics():
    client, calls = setup({"summary": "这段时间你完成了两次行动。"})
    result = post(client, "/reports/summarize", {"period": "7天", "action_count": 2, "active_count": 1, "result_count": 0, "projects": []})
    assert result.status_code == 200
    assert json.loads(calls[0]["messages"][1]["content"])["action_count"] == 2


def test_asr_disabled_never_calls_provider():
    client, calls = setup()
    result = post(client, "/asr/transcribe", {"audio_base64": "AAAA", "mime_type": "audio/wav"})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "ASR_NOT_CONFIGURED"
    assert not calls


@pytest.mark.parametrize("encoded", ["invalid!!!", base64.b64encode(b"fake-wav-content").decode()])
def test_enabled_asr_rejects_invalid_audio_without_provider_call(encoded):
    client, calls = setup(enabled=True)
    result = post(client, "/asr/transcribe", {"audio_base64": encoded, "mime_type": "audio/wav"})
    assert result.status_code == 400
    assert not calls


def test_enabled_asr_payload_only_with_mock_provider():
    client, calls = setup("今天剪完视频。", enabled=True, asr_model="qwen3-asr-flash")
    encoded = base64.b64encode(b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 20).decode()
    result = post(client, "/asr/transcribe", {"audio_base64": encoded, "mime_type": "audio/wav"})
    assert result.json()["text"] == "今天剪完视频。"
    assert calls[0]["model"] == "qwen3-asr-flash"
    assert calls[0]["messages"][0]["content"][0]["input_audio"]["data"].startswith("data:audio/wav;base64,")


@pytest.mark.parametrize("mime, header, audio_format", [
    ("audio/wav", b"RIFF\x00\x00\x00\x00WAVE", "wav"),
    ("audio/webm", b"\x1aE\xdf\xa3" + b"\x00" * 8, "webm"),
    ("audio/mpeg", b"ID3" + b"\x00" * 9, "mp3"),
])
def test_audio_31_asr_uses_dashscope_format_and_full_text(mime, header, audio_format):
    client, calls = setup(enabled=True, raw_response={"output": {
        "output": {"sentence": {"text": "第一句。"}}, "text": "第一句。第二句。"}})
    encoded = base64.b64encode(header + b"\x00" * 20).decode()
    response = post(client, "/asr/transcribe", {"audio_base64": encoded, "mime_type": mime})
    assert response.json()["text"] == "第一句。第二句。"
    assert calls[0]["model"] == "qwen-audio-3.1-asr-flash"
    assert calls[0]["parameters"] == {"format": audio_format}
    assert calls[0]["input"]["messages"][0]["content"][0]["input_audio"]["data"].startswith(f"data:{mime};base64,")


def test_unknown_streaming_model_is_not_sent_to_sync_endpoint():
    client, calls = setup(enabled=True, asr_model="qwen-audio-3.1-asr-flash-streaming")
    capabilities = client.get("/internal/v1/capabilities", headers={"Authorization": "Bearer " + TOKEN})
    assert capabilities.json()["asrEnabled"] is False
    response = post(client, "/asr/transcribe", {"audio_base64": "AAAA", "mime_type": "audio/wav"})
    assert response.json()["error"]["code"] == "ASR_NOT_CONFIGURED"
    assert not calls


def test_audio_31_asr_missing_full_text_is_rejected():
    client, calls = setup(enabled=True, raw_response={"output": {"sentence": {"text": "仅单句"}}})
    encoded = base64.b64encode(b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 20).decode()
    response = post(client, "/asr/transcribe", {"audio_base64": encoded, "mime_type": "audio/wav"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ASR_PARSE_FAILED"
    assert len(calls) == 1


def test_configuration_does_not_allow_credentials_or_redirect_targets():
    assert not Settings(api_key="x", base_url="http://test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1").configured
    assert not Settings(api_key="x", base_url=BASE + "?secret=1").configured
    assert "test-provider-key" not in repr(Settings(api_key="test-provider-key"))
