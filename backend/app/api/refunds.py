"""Refund request endpoints (admin + customer submission).

Note: `async def` endpoints with a sync SQLAlchemy Session are acceptable at
SQLite single-writer scale (see app.services.refund_orchestrator).
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.base import LLMProvider
from app.api.deps import get_llm_provider, get_policy_engine
from app.db.base import get_db
from app.db.models import RefundRequest
from app.policy.engine import PolicyEngine
from app.schemas.refund import RefundRequestCreate, RefundRequestResponse
from app.security.limiter import limiter, refund_rate_limit
from app.security.keys import client_key
from app.security.sanitize import detect_injection_markers, normalize_request_text
from app.services.refund_orchestrator import process_refund_request

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/refund-requests", response_model=RefundRequestResponse, status_code=201)
@limiter.limit(refund_rate_limit)
async def create_refund_request(
    request: Request,
    body: RefundRequestCreate,
    db: Session = Depends(get_db),
    provider: LLMProvider = Depends(get_llm_provider),
    engine: PolicyEngine = Depends(get_policy_engine),
) -> RefundRequestResponse:
    try:
        request_text = normalize_request_text(body.request_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    injection_markers = detect_injection_markers(request_text)
    if injection_markers:
        logger.warning(
            "Injection markers from %s on %s: %s",
            client_key(request),
            request.url.path,
            injection_markers,
        )

    row = await process_refund_request(
        db=db,
        provider=provider,
        engine=engine,
        customer_id=body.customer_id,
        request_text=request_text,
        explicit_order_id=body.order_id,
        pre_extraction_indicators=injection_markers,
    )
    return RefundRequestResponse.model_validate(row)


@router.get("/refund-requests", response_model=list[RefundRequestResponse])
def list_refund_requests(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    decision: Literal["approved", "denied", "escalated"] | None = None,
    db: Session = Depends(get_db),
) -> list[RefundRequestResponse]:
    query = select(RefundRequest).order_by(
        RefundRequest.created_at.desc(), RefundRequest.id.desc()
    )
    if decision is not None:
        query = query.where(RefundRequest.decision == decision)
    rows = db.scalars(query.offset(offset).limit(limit)).all()
    return [RefundRequestResponse.model_validate(r) for r in rows]


@router.get("/refund-requests/{refund_request_id}", response_model=RefundRequestResponse)
def get_refund_request(
    refund_request_id: int,
    db: Session = Depends(get_db),
) -> RefundRequestResponse:
    row = db.get(RefundRequest, refund_request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Refund request not found")
    return RefundRequestResponse.model_validate(row)
