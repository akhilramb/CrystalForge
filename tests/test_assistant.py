from fastapi.testclient import TestClient
import pytest

from backend.main import app

client = TestClient(app)


def test_assistant_status_and_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert client.get("/api/assistant/status").json() == {"configured": False}
    response = client.post("/api/assistant/chat", json={"message": "Explain voltage"})
    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]


def test_assistant_rejects_oversized_message():
    response = client.post("/api/assistant/chat", json={"message": "x" * 1201})
    assert response.status_code == 422
    assert client.post("/api/assistant/chat", json={"message": "   "}).status_code == 422


def test_assistant_session_rate_limit(monkeypatch):
    from collections import OrderedDict, deque
    from fastapi import HTTPException
    from backend.routes import assistant
    from backend.services import storage

    token = storage.session_id.set("assistant-rate-test")
    monkeypatch.setattr(assistant, "_requests", OrderedDict())
    monkeypatch.setattr(assistant, "_all_requests", deque())
    try:
        for _ in range(assistant._RATE_LIMIT):
            assistant._check_rate_limit()
        with pytest.raises(HTTPException) as error:
            assistant._check_rate_limit()
        assert error.value.status_code == 429
    finally:
        storage.session_id.reset(token)


def test_assistant_uses_catalog_context_and_never_returns_provider_key(monkeypatch):
    from collections import OrderedDict
    from backend.routes import assistant

    monkeypatch.setenv("GEMINI_API_KEY", "test-only-key")
    monkeypatch.setattr(assistant, "_requests", OrderedDict())

    class Response:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "This is a catalog prediction; validate it independently."}]}}]}

    class Client:
        def __init__(self, **kwargs):
            self.request_headers = None
            self.request_json = None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, *, headers, json):
            self.request_headers = headers
            self.request_json = json
            assert url.endswith("/models/gemini-3.1-flash-lite:generateContent")
            assert headers["x-goog-api-key"] == "test-only-key"
            assert "cf-00001" in json["systemInstruction"]["parts"][0]["text"]
            return Response()

    monkeypatch.setattr(assistant.httpx, "AsyncClient", Client)
    response = client.post(
        "/api/assistant/chat",
        json={"message": "Explain this record cf-00001", "history": []},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["material_id"] == "cf-00001"
    assert body["answer"].startswith("This is a catalog prediction")
    assert body["sources"][0]["href"] == "/materials/cf-00001"
    assert "test-only-key" not in response.text
