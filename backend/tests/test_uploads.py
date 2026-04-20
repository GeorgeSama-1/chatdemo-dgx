from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_upload_image_returns_metadata(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))

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
