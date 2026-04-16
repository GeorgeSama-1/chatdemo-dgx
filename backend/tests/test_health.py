from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


client = TestClient(app)


def test_health_returns_service_status_and_model_name() -> None:
    response = client.get("/api/health")
    settings = get_settings()

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "chatdemo-dgx-backend",
        "model": settings.model_name,
    }
