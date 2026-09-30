"""API integration tests via TestClient (MockProvider, seeded DB)."""

import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.db.models import RefundRequest


def test_post_refund_request_valid(client: TestClient, seeded_db):
    response = client.post(
        "/api/refund-requests",
        json={"customer_id": 1, "request_text": "My order arrived damaged"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["decision"] == "approved"
    assert body["ai_provider"] == "mock"
    assert body["customer"]["name"] == "Ada Whitfield"
    assert body["order"]["id"] == 1
    assert seeded_db.get(RefundRequest, body["id"]) is not None


def test_post_unknown_customer_404(client: TestClient):
    response = client.post(
        "/api/refund-requests",
        json={"customer_id": 9999, "request_text": "refund"},
    )
    assert response.status_code == 404


def test_post_empty_text_422(client: TestClient):
    response = client.post(
        "/api/refund-requests",
        json={"customer_id": 1, "request_text": ""},
    )
    assert response.status_code == 422


def test_post_oversized_text_422(client: TestClient):
    response = client.post(
        "/api/refund-requests",
        json={"customer_id": 1, "request_text": "a" * 2001},
    )
    assert response.status_code == 422


def test_list_ordered_desc(client: TestClient):
    for _ in range(3):
        client.post(
            "/api/refund-requests",
            json={"customer_id": 3, "request_text": "wrong item received"},
        )
    response = client.get("/api/refund-requests")
    assert response.status_code == 200
    ids = [r["id"] for r in response.json()]
    assert ids == sorted(ids, reverse=True)


def test_list_filter_by_decision(client: TestClient):
    client.post(
        "/api/refund-requests",
        json={"customer_id": 1, "request_text": "My order arrived damaged"},
    )
    client.post(
        "/api/refund-requests",
        json={"customer_id": 4, "request_text": "I want a refund"},
    )
    response = client.get("/api/refund-requests", params={"decision": "denied"})
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) > 0
    assert all(r["decision"] == "denied" for r in rows)


def test_get_refund_request_by_id(client: TestClient):
    created = client.post(
        "/api/refund-requests",
        json={"customer_id": 1, "request_text": "My order arrived damaged"},
    ).json()
    response = client.get(f"/api/refund-requests/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]

    missing = client.get("/api/refund-requests/999999")
    assert missing.status_code == 404


def test_list_customers_seeded(client: TestClient):
    response = client.get("/api/customers")
    assert response.status_code == 200
    assert len(response.json()) == 15


def test_get_customer_with_orders(client: TestClient):
    response = client.get("/api/customers/1")
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "ada.whitfield@example.com"
    assert len(body["orders"]) == 1

    missing = client.get("/api/customers/9999")
    assert missing.status_code == 404


def test_list_customer_orders(client: TestClient):
    response = client.get("/api/customers/1/orders")
    assert response.status_code == 200
    assert len(response.json()) == 1

    # customer 11 (Jack) exists but has no orders
    empty = client.get("/api/customers/11/orders")
    assert empty.status_code == 200
    assert empty.json() == []

    missing = client.get("/api/customers/9999/orders")
    assert missing.status_code == 404


def test_get_order_with_items(client: TestClient):
    response = client.get("/api/orders/1")
    assert response.status_code == 200
    body = response.json()
    assert body["total_amount"] == 142.98
    assert len(body["items"]) == 2

    missing = client.get("/api/orders/999999")
    assert missing.status_code == 404


def test_openapi_schema_lists_all_paths(client: TestClient):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = set(response.json()["paths"].keys())
    expected = {
        "/api/refund-requests",
        "/api/refund-requests/{refund_request_id}",
        "/api/customers",
        "/api/customers/{customer_id}",
        "/api/customers/{customer_id}/orders",
        "/api/orders/{order_id}",
    }
    assert expected <= paths


def test_api_layer_import_boundaries():
    api_dir = Path(__file__).resolve().parent.parent / "app" / "api"
    forbidden_rules = re.compile(r"from app\.policy\.rules import")
    forbidden_providers = re.compile(
        r"from app\.ai\.(gemini_provider|openai_provider|anthropic_provider|mock_provider) import"
    )
    for source_file in api_dir.rglob("*.py"):
        source = source_file.read_text(encoding="utf-8")
        assert not forbidden_rules.search(source), f"{source_file.name} imports policy rules directly"
        assert not forbidden_providers.search(source), f"{source_file.name} imports provider module directly"

    # The orchestrator's three-layer imports are intentional and documented
    orchestrator = (
        Path(__file__).resolve().parent.parent / "app" / "services" / "refund_orchestrator.py"
    ).read_text(encoding="utf-8")
    for allowed in ("app.db.models", "app.policy.engine", "app.ai.base"):
        assert allowed in orchestrator
