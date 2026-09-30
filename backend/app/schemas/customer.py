from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.order import OrderRead


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime


class CustomerWithOrders(CustomerRead):
    orders: list[OrderRead]
