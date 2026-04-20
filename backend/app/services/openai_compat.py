import base64
import json
from collections.abc import AsyncIterator

from fastapi import HTTPException

from app.uploads import resolve_upload


def to_event(payload: dict[str, str]) -> str:
    return json.dumps(payload, separators=(",", ":")) + "\n"


def upload_to_data_url(upload_id: str, uploads_dir: str) -> str:
    try:
        metadata, binary_path = resolve_upload(upload_id, uploads_dir)
    except HTTPException as exc:
        raise HTTPException(
            status_code=400,
            detail="附件不存在或已失效，请重新上传",
        ) from exc
    encoded = base64.b64encode(binary_path.read_bytes()).decode("utf-8")
    return f"data:{metadata['mime_type']};base64,{encoded}"


def build_upstream_messages(
    system_prompt: str | None,
    messages: list[dict],
    uploads_dir: str | None = None,
) -> list[dict]:
    upstream_messages: list[dict] = []

    if system_prompt and system_prompt.strip():
        upstream_messages.append(
            {"role": "system", "content": system_prompt.strip()}
        )

    for message in messages:
        role = message["role"]
        content = (message.get("content") or "").strip()
        attachments = message.get("attachments") or []

        if role == "user" and attachments:
            if not uploads_dir:
                raise HTTPException(status_code=400, detail="附件不存在或已失效，请重新上传")

            parts: list[dict] = []
            if content:
                parts.append({"type": "text", "text": content})
            for upload_id in attachments:
                parts.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": upload_to_data_url(upload_id, uploads_dir),
                        },
                    }
                )

            upstream_messages.append({"role": role, "content": parts})
            continue

        upstream_messages.append({"role": role, "content": content})

    return upstream_messages


async def iter_ndjson_events(lines: AsyncIterator[str]) -> AsyncIterator[str]:
    has_content = False

    async for raw_line in lines:
        line = raw_line.strip()
        if not line or not line.startswith("data:"):
            continue

        payload = line[5:].strip()
        if payload == "[DONE]":
            if not has_content:
                yield to_event(
                    {
                        "type": "error",
                        "error": "Model returned an empty response.",
                    }
                )
            yield to_event({"type": "done"})
            return

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            yield to_event(
                {"type": "error", "error": "Invalid streaming chunk from model."}
            )
            continue

        choice = (data.get("choices") or [{}])[0]
        delta = choice.get("delta") or {}
        content = delta.get("content")
        if content:
            has_content = True
            yield to_event({"type": "delta", "delta": content})
