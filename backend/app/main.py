from collections.abc import AsyncIterator

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.models import ChatRequest, HealthResponse, UploadResponse
from app.services.openai_compat import (
    build_upstream_messages,
    iter_ndjson_events,
    to_event,
)
from app.uploads import (
    MAX_FILES_PER_REQUEST,
    cleanup_expired_uploads,
    resolve_upload,
    save_upload_file,
)


app = FastAPI(title="chatdemo-dgx-backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service="chatdemo-dgx-backend",
        model=settings.model_name,
    )


@app.post("/api/uploads", response_model=UploadResponse)
async def upload_images(files: list[UploadFile] = File(...)) -> UploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一张图片")
    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail="单次最多上传 4 张图片")

    settings = get_settings()
    cleanup_expired_uploads(settings.uploads_dir, settings.upload_ttl_seconds)
    uploaded_files = [
        save_upload_file(upload_file, settings.uploads_dir) for upload_file in files
    ]
    return UploadResponse(files=uploaded_files)


@app.get("/api/uploads/{upload_id}/preview")
async def upload_preview(upload_id: str) -> FileResponse:
    settings = get_settings()
    metadata, binary_path = resolve_upload(upload_id, settings.uploads_dir)
    return FileResponse(binary_path, media_type=str(metadata["mime_type"]))


@app.post("/api/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    settings = get_settings()
    upstream_url = f"{settings.model_base_url.rstrip('/')}/chat/completions"
    upstream_payload = {
        "model": settings.model_name,
        "messages": build_upstream_messages(
            request.system_prompt,
            [message.model_dump() for message in request.messages],
            settings.uploads_dir,
        ),
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": True,
        "chat_template_kwargs": {
            "enable_thinking": settings.model_enable_thinking,
        },
    }
    headers = {"Content-Type": "application/json"}
    if settings.model_api_key:
        headers["Authorization"] = f"Bearer {settings.model_api_key}"

    async def event_stream() -> AsyncIterator[str]:
        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                async with client.stream(
                    "POST",
                    upstream_url,
                    headers=headers,
                    json=upstream_payload,
                ) as response:
                    response.raise_for_status()
                    async for chunk in iter_ndjson_events(response.aiter_lines()):
                        yield chunk
        except httpx.TimeoutException as exc:
            yield to_event({"type": "error", "error": "Model service timed out."})
            yield to_event({"type": "done"})
            return
        except httpx.HTTPStatusError as exc:
            detail = f"Model service returned HTTP {exc.response.status_code}."
            yield to_event({"type": "error", "error": detail})
            yield to_event({"type": "done"})
            return
        except httpx.HTTPError:
            yield to_event({"type": "error", "error": "Model service is unavailable."})
            yield to_event({"type": "done"})
            return
        except RuntimeError as exc:
            yield to_event({"type": "error", "error": str(exc)})
            yield to_event({"type": "done"})
            return

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
