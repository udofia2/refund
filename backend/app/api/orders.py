"""Order detail endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Order
from app.schemas.order import OrderWithItems

router = APIRouter()


@router.get("/orders/{order_id}", response_model=OrderWithItems)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> OrderWithItems:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderWithItems.model_validate(order)
