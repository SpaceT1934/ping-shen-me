from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=2000)]
Id = Annotated[str, Field(min_length=1, max_length=100)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class GoalContext(Input):
    id: Id
    title: Annotated[str, Field(max_length=200)]
    mode: Literal["count", "percentage", "manual"]
    unit: Annotated[str, Field(max_length=30)]


class ProjectContext(Input):
    id: Id
    name: Annotated[str, Field(min_length=1, max_length=200)]
    goal: Annotated[str, Field(max_length=200)] | None = None
    goals: Annotated[list[GoalContext], Field(max_length=2000)] = Field(default_factory=list)


class ProjectRequest(Input):
    text: Annotated[str, Field(min_length=1, max_length=300)]


class RecordRequest(Input):
    text: Text
    projects: Annotated[list[ProjectContext], Field(max_length=200)]


class RecordItem(Input):
    content: Text
    type: Literal["action", "task", "idea", "goal"]
    project_id: Id | None
    goal_id: Id | None = None
    emotion: Annotated[str, Field(max_length=100)] | None
    source_text: Text


class ProjectItem(Input):
    name: Annotated[str, Field(min_length=1, max_length=80)]
    goal_text: Annotated[str, Field(min_length=1, max_length=200)] | None
    source_text: Annotated[str, Field(min_length=1, max_length=300)]
    category: Literal["工作事业", "学习成长", "健康运动", "生活习惯", "兴趣爱好", "其他"] = "其他"


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


class FeedbackRequest(Input):
    actions: Annotated[list[Text], Field(max_length=3)]


class TaskPlanRequest(Input):
    text: Annotated[str, Field(min_length=1, max_length=200)]
    project_name: Annotated[str, Field(min_length=1, max_length=200)]


class TaskPlanItem(Input):
    title: Annotated[str, Field(min_length=1, max_length=80)]
    description: Annotated[str, Field(min_length=1, max_length=110)]


class EmotionMessage(Input):
    role: Literal["user", "assistant"]
    content: Text


class EmotionAction(Input):
    id: Id
    content: Text
    project_name: Annotated[str, Field(max_length=200)] | None


class EmotionToday(Input):
    date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    action_count: Annotated[int, Field(ge=0)]
    actions: Annotated[list[EmotionAction], Field(max_length=6)]


class EmotionRequest(Input):
    text: Text
    history: Annotated[list[EmotionMessage], Field(max_length=10)] = Field(default_factory=list)
    today: EmotionToday
