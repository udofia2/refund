from datetime import datetime

from pydantic import BaseModel, ConfigDict


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


class OrderWithItems(OrderRead):
    pass
