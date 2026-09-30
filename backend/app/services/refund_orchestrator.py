"""Refund request orchestration.

This module is the business-orchestration half of the application's
orchestration layer (HTTP concerns live in app.api). It is INTENTIONALLY
allowed to import from all three inner layers:

- app.db.models        — fetches customer/order, persists RefundRequest rows
- app.policy.engine    — deterministic decision
- app.ai.base          — LLM extraction + response rendering

No other module may import all three. Purity guarantees are unchanged:
app.policy and app.ai never import from app.db, app.ai, app.api, or
app.services.

Note: FastAPI `async def` endpoints + sync SQLAlchemy Session is acceptable
for SQLite single-writer scale; would move to AsyncSession + aiosqlite if
the DB were Postgres under load.
"""

import logging
from dataclasses import asdict
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.base import LLMProvider
from app.ai.types import ExtractedRefundData, LLMError
from app.clock import utcnow_naive
from app.db.models import Customer, Order, RefundRequest
from app.policy.engine import PolicyEngine

logger = logging.getLogger(__name__)

FALLBACK_RESPONSE = (
    "Thank you for contacting us, {name}. Your refund request has been "
    "reviewed and our team will follow up shortly."
)


async def process_refund_request(
    db: Session,
    provider: LLMProvider,
    engine: PolicyEngine,
    customer_id: int,
    request_text: str,
    explicit_order_id: int | None,
    now: datetime | None = None,
    duplicate_window_hours: int = 24,
) -> RefundRequest:
    """Full refund-request pipeline. Returns the persisted RefundRequest row.

    Raises HTTPException(404) for unknown customer, HTTPException(403) for an
    order the customer does not own (or that does not exist — same response,
    no existence leak).
    """
    now = now if now is not None else utcnow_naive()

    # 1. Customer
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    # 2. AI extraction context
    context = {
        "customer_name": customer.name,
        "known_order_ids": [o.id for o in customer.orders],
    }

    # 3. Extraction (never aborts the request on LLM failure)
    try:
        extracted = await provider.extract_refund_data(request_text, context)
    except LLMError as exc:
        logger.warning("LLM extraction failed; proceeding with unknown: %s", exc)
        extracted = ExtractedRefundData(
            reason="unknown",
            confidence=0.0,
            raw_model_output={"error": str(exc)},
        )

    # 4-5. Order resolution. Precedence: explicit > extracted (already
    # validated against known_order_ids by the provider contract) > the
    # customer's only order when exactly one exists (data resolution, not
    # policy — no ambiguity, so no need to force the customer to look it up).
    order_id = explicit_order_id if explicit_order_id is not None else extracted.order_id
    order: Order | None = None
    if order_id is not None:
        order = db.get(Order, order_id)
        if order is None or order.customer_id != customer_id:
            raise HTTPException(
                status_code=403, detail="Order does not belong to this customer"
            )
    elif len(customer.orders) == 1:
        order = customer.orders[0]

    # 6. Recent request count (tuple→list conversion: the engine dict payload
    # must not carry a tuple silently disabling rule_suspicious_indicators)
    extracted_dict = asdict(extracted)
    extracted_dict["suspicious_indicators"] = list(extracted.suspicious_indicators)

    window_start = now - timedelta(hours=duplicate_window_hours)
    recent_request_count = db.scalar(
        select(func.count(RefundRequest.id)).where(
            RefundRequest.customer_id == customer_id,
            RefundRequest.created_at > window_start,
        )
    ) or 0

    # 7. Deterministic decision
    decision = engine.evaluate(customer, order, extracted_dict, recent_request_count, now=now)

    # 8. Response rendering (never aborts on LLM failure)
    try:
        ai_response = await provider.generate_response(
            decision.decision, decision.reason, customer.name
        )
    except LLMError as exc:
        logger.warning("LLM response generation failed; using fallback: %s", exc)
        ai_response = FALLBACK_RESPONSE.format(name=customer.name)

    # 9. Persist
    row = RefundRequest(
        customer_id=customer_id,
        order_id=order.id if order is not None else None,
        request_text=request_text,
        extracted_data=extracted_dict,
        decision=decision.decision,
        decision_reason=decision.reason,
        ai_response=ai_response,
        ai_provider=provider.name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # 10. Done
    return row
