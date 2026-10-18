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


def test_task_plan_is_validated_and_remains_a_draft():
    client, calls = setup({"tasks": [{"title": "听力练习", "description": "听一段短材料，并整理没有听懂的句子。"}]})
    result = post(client, "/tasks/plan", {"text": "三个月达到雅思7分", "project_name": "雅思"})
    assert result.status_code == 200
    assert result.json()["tasks"][0]["title"] == "听力练习"
    assert calls[0]["response_format"]["json_schema"]["strict"] is True
    assert "不声称任务已经完成" in calls[0]["messages"][0]["content"]


@pytest.mark.parametrize("tasks", [[], [{"title": "", "description": "无效"}], [{"title": "太长", "description": "长" * 111}]])
def test_invalid_task_plan_is_not_returned(tasks):
    client, calls = setup({"tasks": tasks})
    result = post(client, "/tasks/plan", {"text": "学习英语", "project_name": "英语"})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "AI_PARSE_FAILED"


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


def test_goal_match_must_belong_to_matched_project_and_never_changes_progress():
    client, calls = setup({"items": [
        {"content": "剪完视频", "type": "action", "project_id": "p1", "goal_id": "g1",
         "emotion": None, "source_text": "剪完视频"},
        {"content": "背了单词", "type": "action", "project_id": "p2", "goal_id": "g1",
         "emotion": None, "source_text": "背了单词"},
    ]})
    response = post(client, "/records/analyze", {
        "text": "剪完视频。背了单词", "projects": [
            {"id": "p1", "name": "视频", "goals": [
                {"id": "g1", "title": "发布10条视频", "mode": "count", "unit": "条"}]},
            {"id": "p2", "name": "学习", "goals": []},
        ]})
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["goal_id"] == "g1"
    assert items[1]["goal_id"] is None
    assert "contribution" not in items[0]
    assert "剪完视频不等于发布视频" in calls[0]["messages"][0]["content"]


def test_short_feedback_is_bounded_and_does_not_claim_growth():
    client, calls = setup({"text": "今天的努力已经被好好记下了。"})
    response = post(client, "/feedback", {"actions": ["剪完视频"]})
    assert response.status_code == 200
    assert response.json()["text"] == "今天的努力已经被好好记下了。"
    assert "不声称目标完成、果实成熟或小树升级" in calls[0]["messages"][0]["content"]
    client, _ = setup({"text": "字" * 61})
    assert post(client, "/feedback", {"actions": ["剪完视频"]}).status_code == 503


def test_emotion_dialogue_uses_only_supplied_today_and_does_not_extract_actions():
    client, calls = setup({"reply": "先休息一下。今天读完一章也是实实在在的付出。", "referenced_action_ids": ["a1"]})
    body = {"text": "我很累，感觉什么都没做", "history": [{"role": "user", "content": "想聊聊"}],
            "today": {"date": "2026-10-18", "action_count": 1, "actions": [{"id": "a1", "content": "读完一章", "project_name": "读书"}]}}
    response = post(client, "/emotions/respond", body)
    assert response.status_code == 200
    assert response.json()["referenced_action_ids"] == ["a1"]
    system = calls[0]["messages"][0]["content"]
    assert "这是陪伴对话，不是事项提取" in system
    assert "不能杜撰做过的事或次数" in system
    assert "不得声称此对话已保存行动" in system
    assert json.loads(calls[0]["messages"][1]["content"])["today"]["action_count"] == 1


@pytest.mark.parametrize("result", [
    {"reply": "虚构", "referenced_action_ids": ["foreign"]},
    {"reply": "字" * 601, "referenced_action_ids": []},
    {"reply": "", "referenced_action_ids": []},
])
def test_emotion_output_rejects_invented_references_and_invalid_messages(result):
    client, calls = setup(result)
    response = post(client, "/emotions/respond", {"text": "很累", "today": {"date": "2026-10-18", "action_count": 0, "actions": []}})
    assert response.status_code == 503
    assert len(calls) == 1


def test_records_separate_emotion_source_from_actual_events():
    client, calls = setup({"items": [{"content": "剪完视频", "type": "action", "project_id": None, "goal_id": None, "emotion": None, "source_text": "剪完视频"}], "emotion_text": "我很累"})
    response = post(client, "/records/analyze", {"text": "我很累，剪完视频", "projects": []})
    assert response.status_code == 200
    assert response.json()["emotion_text"] == "我很累"
    assert len(response.json()["items"]) == 1
    assert "情绪、感受、自我评价都不是行动" in calls[0]["messages"][0]["content"]
    assert "emotion_text" in calls[0]["response_format"]["json_schema"]["schema"]["required"]
    client, _ = setup({"items": [], "emotion_text": "原文未说的感觉"})
    assert post(client, "/records/analyze", {"text": "我很累", "projects": []}).status_code == 503
