from pathlib import Path
import os
import time

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


client = TestClient(app)


def test_upload_image_returns_metadata(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    get_settings.cache_clear()

    response = client.post(
        "/api/uploads",
        files=[("files", ("chart.png", b"fake-png-bytes", "image/png"))],
    )

    assert response.status_code == 200
    payload = response.json()
    assert "files" in payload
    assert len(payload["files"]) == 1
    assert payload["files"][0]["upload_id"]
    assert payload["files"][0]["name"] == "chart.png"
    assert payload["files"][0]["mime_type"] == "image/png"
    assert payload["files"][0]["size"] == len(b"fake-png-bytes")
    assert payload["files"][0]["preview_url"].startswith("/api/uploads/")


def test_preview_endpoint_returns_uploaded_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    get_settings.cache_clear()

    upload_response = client.post(
        "/api/uploads",
        files=[("files", ("chart.png", b"preview-bytes", "image/png"))],
    )

    assert upload_response.status_code == 200
    preview_url = upload_response.json()["files"][0]["preview_url"]

    preview_response = client.get(preview_url)

    assert preview_response.status_code == 200
    assert preview_response.content == b"preview-bytes"
    assert preview_response.headers["content-type"] == "image/png"


def test_upload_cleans_up_expired_upload_files(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    monkeypatch.setenv("UPLOAD_TTL_SECONDS", "60")
    get_settings.cache_clear()

    stale_binary = Path(tmp_path) / "upl_stale.bin"
    stale_metadata = Path(tmp_path) / "upl_stale.json"
    fresh_binary = Path(tmp_path) / "upl_fresh.bin"
    fresh_metadata = Path(tmp_path) / "upl_fresh.json"

    stale_binary.write_bytes(b"old-bytes")
    stale_metadata.write_text('{"upload_id":"upl_stale"}', encoding="utf-8")
    fresh_binary.write_bytes(b"new-bytes")
    fresh_metadata.write_text('{"upload_id":"upl_fresh"}', encoding="utf-8")

    stale_time = time.time() - 120
    os.utime(stale_binary, (stale_time, stale_time))
    os.utime(stale_metadata, (stale_time, stale_time))

    upload_response = client.post(
        "/api/uploads",
        files=[("files", ("chart.png", b"fake-png-bytes", "image/png"))],
    )

    assert upload_response.status_code == 200
    assert not stale_binary.exists()
    assert not stale_metadata.exists()
    assert fresh_binary.exists()
    assert fresh_metadata.exists()
