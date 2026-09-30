"""Customer read endpoints (light payload for selectors, detailed for tests)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Customer
from app.schemas.customer import CustomerRead, CustomerWithOrders
from app.schemas.order import OrderRead

router = APIRouter()


@router.get("/customers", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)) -> list[CustomerRead]:
    customers = db.scalars(select(Customer).order_by(Customer.id)).all()
    return [CustomerRead.model_validate(c) for c in customers]


@router.get("/customers/{customer_id}", response_model=CustomerWithOrders)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
) -> CustomerWithOrders:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerWithOrders.model_validate(customer)


@router.get("/customers/{customer_id}/orders", response_model=list[OrderRead])
def list_customer_orders(
    customer_id: int,
    db: Session = Depends(get_db),
) -> list[OrderRead]:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return [OrderRead.model_validate(o) for o in customer.orders]
