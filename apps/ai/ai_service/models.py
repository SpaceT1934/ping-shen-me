from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=2000)]
Id = Annotated[str, Field(min_length=1, max_length=100)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ProjectContext(Input):
    id: Id
    name: Annotated[str, Field(min_length=1, max_length=200)]
    goal: Annotated[str, Field(max_length=200)] | None = None


class ProjectRequest(Input):
    text: Annotated[str, Field(min_length=1, max_length=300)]


class RecordRequest(Input):
    text: Text
    projects: Annotated[list[ProjectContext], Field(max_length=200)]


class RecordItem(Input):
    content: Text
    type: Literal["action", "task", "idea", "goal"]
    project_id: Id | None
    emotion: Annotated[str, Field(max_length=100)] | None
    source_text: Text


class ProjectItem(Input):
    name: Annotated[str, Field(min_length=1, max_length=80)]
    goal_text: Annotated[str, Field(min_length=1, max_length=200)] | None
    source_text: Annotated[str, Field(min_length=1, max_length=300)]


class ReportProject(Input):
    name: Annotated[str, Field(max_length=200)]
    count: Annotated[int, Field(ge=0)]
    delta: float | None = None


class ReportRequest(Input):
    period: Literal["7天", "30天", "本月", "全部"]
    action_count: Annotated[int, Field(ge=0)]
    active_count: Annotated[int, Field(ge=0)]
    result_count: Annotated[int, Field(ge=0)]
    projects: Annotated[list[ReportProject], Field(max_length=200)]


class AudioRequest(Input):
    # 5 MiB 的 base64 上限；不接受 URL，防止抓取任意外部资源。
    audio_base64: Annotated[str, Field(min_length=4, max_length=6990508)]
    mime_type: Literal["audio/wav", "audio/mpeg", "audio/webm", "audio/ogg", "audio/flac"]
