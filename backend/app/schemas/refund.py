from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.customer import CustomerRead
from app.schemas.order import OrderRead


class RefundRequestCreate(BaseModel):
    customer_id: int
    request_text: str = Field(min_length=1, max_length=2000)
    order_id: int | None = None


class RefundRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    order_id: Optional[int]
    request_text: str
    extracted_data: Optional[dict]
    decision: Optional[str]
    decision_reason: Optional[str]
    ai_response: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    customer: CustomerRead
    order: Optional[OrderRead]


class RefundRequestResponse(RefundRequestRead):
    ai_provider: Optional[str] = None
