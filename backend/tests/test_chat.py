from collections.abc import AsyncIterator
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


client = TestClient(app)
captured_request_json: dict | None = None


class DummyStreamResponse:
    def __init__(self, lines: list[str], status_code: int = 200) -> None:
        self.status_code = status_code
        self._lines = lines

    async def __aenter__(self) -> "DummyStreamResponse":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def aiter_lines(self) -> AsyncIterator[str]:
        for line in self._lines:
            yield line

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError("upstream failure")


class DummyAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        return None

    async def __aenter__(self) -> "DummyAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    def stream(self, *args, **kwargs) -> DummyStreamResponse:
        global captured_request_json
        captured_request_json = kwargs.get("json")
        return DummyStreamResponse(
            [
                'data: {"choices":[{"delta":{"content":"Hello"}}]}',
                'data: {"choices":[{"delta":{"content":" world"}}]}',
                "data: [DONE]",
            ]
        )


def test_chat_rejects_empty_messages() -> None:
    response = client.post(
        "/api/chat",
        json={"messages": [], "temperature": 0.5, "max_tokens": 512},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "messages must not be empty"


def test_chat_streams_transformed_ndjson_chunks() -> None:
    global captured_request_json
    captured_request_json = None
    payload = {
        "messages": [{"role": "user", "content": "Say hello"}],
        "temperature": 0.3,
        "max_tokens": 256,
        "system_prompt": "You are concise.",
    }

    with patch("app.main.httpx.AsyncClient", DummyAsyncClient):
        with client.stream("POST", "/api/chat", json=payload) as response:
            body = "".join(
                chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk
                for chunk in response.iter_text()
            )

    assert response.status_code == 200
    assert '{"type":"delta","delta":"Hello"}' in body
    assert '{"type":"delta","delta":" world"}' in body
    assert '{"type":"done"}' in body
    assert captured_request_json is not None
    assert captured_request_json["chat_template_kwargs"] == {
        "enable_thinking": False
    }


def test_chat_builds_multimodal_user_message(tmp_path, monkeypatch) -> None:
    global captured_request_json
    captured_request_json = None
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    get_settings.cache_clear()

    upload_response = client.post(
        "/api/uploads",
        files=[("files", ("chart.png", b"image-bytes", "image/png"))],
    )
    upload_id = upload_response.json()["files"][0]["upload_id"]

    payload = {
        "messages": [
            {
                "role": "user",
                "content": "请分析这张图",
                "attachments": [upload_id],
            }
        ],
        "temperature": 0.3,
        "max_tokens": 256,
    }

    with patch("app.main.httpx.AsyncClient", DummyAsyncClient):
        with client.stream("POST", "/api/chat", json=payload) as response:
            body = "".join(
                chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk
                for chunk in response.iter_text()
            )

    assert response.status_code == 200
    assert '{"type":"done"}' in body
    assert captured_request_json is not None
    user_message = captured_request_json["messages"][0]
    assert isinstance(user_message["content"], list)
    assert user_message["content"][0] == {"type": "text", "text": "请分析这张图"}
    assert user_message["content"][1]["type"] == "image_url"
    assert user_message["content"][1]["image_url"]["url"].startswith(
        "data:image/png;base64,"
    )


def test_chat_rejects_missing_attachment(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    get_settings.cache_clear()

    response = client.post(
        "/api/chat",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "请分析这张图",
                    "attachments": ["upl_missing"],
                }
            ]
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "附件不存在或已失效，请重新上传"


def test_chat_accepts_large_max_tokens_values() -> None:
    payload = {
        "messages": [{"role": "user", "content": "Write a long answer"}],
        "temperature": 0.3,
        "max_tokens": 100000,
    }

    with patch("app.main.httpx.AsyncClient", DummyAsyncClient):
        with client.stream("POST", "/api/chat", json=payload) as response:
            body = "".join(
                chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk
                for chunk in response.iter_text()
            )

    assert response.status_code == 200
    assert '{"type":"done"}' in body
