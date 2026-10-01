"""Rate limiter behavior. Opt-in via the `rate_limited` fixture — the autouse
conftest fixture keeps `limiter.enabled = False` for every other test file.
"""

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.config import settings
from app.security.keys import client_key
from app.security.limiter import limiter

POST = "/api/refund-requests"
GET = "/api/refund-requests"


@pytest.fixture
def rate_limited(monkeypatch):
    limiter.enabled = True
    # limiter.reset() verified on installed slowapi: exists, resets MemoryStorage
    # (limiter.storage is NOT public — only _storage; use limiter.reset()).
    limiter.reset()
    monkeypatch.setattr(settings, "rate_limit_requests", 3)
    monkeypatch.setattr(settings, "rate_limit_window_seconds", 60)
    yield
    limiter.reset()


def post(client: TestClient, xff: str | None = None, text: str = "test refund"):
    headers = {"X-Forwarded-For": xff} if xff else {}
    return client.post(
        POST, json={"customer_id": 1, "request_text": text}, headers=headers
    )


def test_rate_limit_fires_after_threshold(client: TestClient, rate_limited):
    for _ in range(3):
        assert post(client, xff="9.9.9.1").status_code == 201
    blocked = post(client, xff="9.9.9.1")
    assert blocked.status_code == 429
    assert blocked.headers.get("Retry-After") == "60"
    assert blocked.json() == {
        "detail": "Too many requests. Please wait before submitting again."
    }


def test_get_requests_not_rate_limited(client: TestClient, rate_limited):
    for _ in range(10):
        assert client.get(GET).status_code == 200


def test_rate_limiting_disabled_by_default(client: TestClient):
    # autouse conftest fixture keeps the limiter off for non-opted-in tests
    assert limiter.enabled is False
    for _ in range(12):  # exceeds the config default of 10 without firing
        assert post(client, xff="8.8.8.8").status_code == 201


def test_different_xff_ips_are_isolated(client: TestClient, rate_limited):
    for _ in range(3):
        assert post(client, xff="203.0.113.10").status_code == 201
    for _ in range(2):
        assert post(client, xff="203.0.113.20").status_code == 201
    # bucket A exhausted …
    assert post(client, xff="203.0.113.10").status_code == 429
    # … but B is unaffected by A's block (per-IP independence) …
    assert post(client, xff="203.0.113.20").status_code == 201
    # … until B exhausts its own bucket.
    assert post(client, xff="203.0.113.20").status_code == 429


def test_429_body_uses_detail_convention(client: TestClient, rate_limited):
    for _ in range(3):
        post(client, xff="198.51.100.7")
    body = post(client, xff="198.51.100.7").json()
    assert isinstance(body.get("detail"), str)
    assert "error" not in body


def _request(headers: list[tuple[bytes, bytes]], client=("9.9.9.9", 12345)) -> Request:
    return Request({"type": "http", "headers": headers, "client": client})


def test_client_key_prefers_first_xff_entry():
    req = _request([(b"x-forwarded-for", b"1.1.1.1, 2.2.2.2")])
    assert client_key(req) == "1.1.1.1"


def test_client_key_falls_back_to_peer_address():
    assert client_key(_request([])) == "9.9.9.9"


def test_client_key_handles_missing_client():
    req = Request({"type": "http", "headers": []})
    assert client_key(req) == "unknown"
