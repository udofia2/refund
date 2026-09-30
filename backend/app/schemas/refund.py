from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.db.models import Customer, Order, OrderItem, RefundRequest


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_name: str
    price: float
    quantity: int
    is_final_sale: bool
    condition: str


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    order_date: datetime
    total_amount: float
    status: str
    items: list[OrderItemRead]


class RefundRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    order_id: Optional[int]
    request_text: str
    extracted_data: Optional[dict[str, Any]]
    decision: Optional[str]
    decision_reason: Optional[str]
    ai_response: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    customer: CustomerRead
    order: Optional[OrderRead]
