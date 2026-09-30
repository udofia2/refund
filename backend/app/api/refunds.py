"""Refund request endpoints (admin + customer submission).

Note: `async def` endpoints with a sync SQLAlchemy Session are acceptable at
SQLite single-writer scale (see app.services.refund_orchestrator).
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.base import LLMProvider
from app.api.deps import get_llm_provider, get_policy_engine
from app.db.base import get_db
from app.db.models import RefundRequest
from app.policy.engine import PolicyEngine
from app.schemas.refund import RefundRequestCreate, RefundRequestResponse
from app.services.refund_orchestrator import process_refund_request

router = APIRouter()


@router.post("/refund-requests", response_model=RefundRequestResponse, status_code=201)
async def create_refund_request(
    body: RefundRequestCreate,
    db: Session = Depends(get_db),
    provider: LLMProvider = Depends(get_llm_provider),
    engine: PolicyEngine = Depends(get_policy_engine),
) -> RefundRequestResponse:
    row = await process_refund_request(
        db=db,
        provider=provider,
        engine=engine,
        customer_id=body.customer_id,
        request_text=body.request_text,
        explicit_order_id=body.order_id,
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
