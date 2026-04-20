from typing import Literal

from pydantic import BaseModel, Field


MessageRole = Literal["system", "user", "assistant"]


class ChatMessage(BaseModel):
    role: MessageRole
    content: str = ""
    attachments: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=8192)
    system_prompt: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    model: str


class UploadFileInfo(BaseModel):
    upload_id: str
    name: str
    mime_type: str
    size: int
    preview_url: str


class UploadResponse(BaseModel):
    files: list[UploadFileInfo]
