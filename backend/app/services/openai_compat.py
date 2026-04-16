import json
from collections.abc import AsyncIterator


def to_event(payload: dict[str, str]) -> str:
    return json.dumps(payload, separators=(",", ":")) + "\n"


def build_upstream_messages(
    system_prompt: str | None,
    messages: list[dict[str, str]],
) -> list[dict[str, str]]:
    upstream_messages: list[dict[str, str]] = []

    if system_prompt and system_prompt.strip():
        upstream_messages.append(
            {"role": "system", "content": system_prompt.strip()}
        )

    upstream_messages.extend(messages)
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
