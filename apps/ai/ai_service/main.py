import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings
from .models import AudioRequest, ProjectRequest, RecordRequest, ReportRequest, FeedbackRequest, TaskPlanRequest
from .provider import Bailian, ServiceError


def create_app(settings=None, provider=None):
    settings = settings or Settings.from_env()
    provider = provider or Bailian(settings)

    @asynccontextmanager
    async def lifespan(app):
        yield
        provider.close()

    app = FastAPI(title="苹什么 AI 服务", lifespan=lifespan)
    bearer = HTTPBearer(auto_error=False)

    def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if (not settings.service_token or not credentials
                or not secrets.compare_digest(credentials.credentials, settings.service_token)):
            raise ServiceError("UNAUTHORIZED", "服务认证失败", 401)

    @app.middleware("http")
    async def body_limit(request: Request, call_next):
        # 同时检查流式传输，不仅依赖客户端声明的 Content-Length。
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > 7 * 1024 * 1024:
                return JSONResponse({"error": {"code": "PAYLOAD_TOO_LARGE", "message": "输入过大"}}, 413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
        return await call_next(request)

    @app.exception_handler(ServiceError)
    async def service_error(request, error):
        return JSONResponse({"error": {"code": error.code, "message": error.message}}, error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # 不回传 Pydantic 的原始 input，避免音频或正文出现在错误响应。
        return JSONResponse({"error": {"code": "VALIDATION_ERROR", "message": "请检查输入内容"}}, 400)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "apple-ai"}

    @app.get("/internal/v1/capabilities", dependencies=[Depends(authorize)])
    def capabilities():
        return {"aiConfigured": settings.configured,
                "asrEnabled": settings.asr_ready}

    @app.post("/internal/v1/projects/analyze", dependencies=[Depends(authorize)])
    def projects(body: ProjectRequest):
        return provider.projects(body)

    @app.post("/internal/v1/records/analyze", dependencies=[Depends(authorize)])
    def records(body: RecordRequest):
        return provider.records(body)

    @app.post("/internal/v1/reports/summarize", dependencies=[Depends(authorize)])
    def summarize(body: ReportRequest):
        return provider.summarize(body)

    @app.post("/internal/v1/feedback", dependencies=[Depends(authorize)])
    def feedback(body: FeedbackRequest):
        return provider.feedback(body)

    @app.post("/internal/v1/tasks/plan", dependencies=[Depends(authorize)])
    def task_plan(body: TaskPlanRequest):
        return provider.plan(body)

    @app.post("/internal/v1/asr/transcribe", dependencies=[Depends(authorize)])
    def transcribe(body: AudioRequest):
        return provider.transcribe(body)

    return app


app = create_app()
