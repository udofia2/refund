from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import Customer, Order, OrderItem, RefundRequest


def test_relationships_load(db_session):
    customer = Customer(name="Test User", email="test@example.com")
    order = Order(
        customer=customer,
        order_date=datetime(2026, 9, 1),
        total_amount=149.98,
        status="delivered",
        items=[
            OrderItem(product_name="Widget", price=74.99, quantity=2),
            OrderItem(
                product_name="Clearance Gadget",
                price=25.00,
                is_final_sale=True,
                condition="used",
            ),
        ],
    )
    refund = RefundRequest(customer=customer, order=order, request_text="I want a refund")
    db_session.add_all([customer, order, refund])
    db_session.commit()

    db_session.refresh(refund)
    assert refund.customer.name == "Test User"
    assert refund.order.status == "delivered"
    assert len(refund.order.items) == 2
    assert order.customer.email == "test@example.com"
    assert customer.orders[0].id == order.id


def test_extracted_data_json_round_trip(db_session):
    refund = RefundRequest(
        customer_id=1,
        request_text="text",
        extracted_data={
            "order_id": 123,
            "reason": "damaged",
            "requested_amount": 150.00,
            "suspicious_indicators": ["none"],
        },
    )
    db_session.add(refund)
    db_session.commit()

    stored = db_session.get(RefundRequest, refund.id)
    assert stored.extracted_data == {
        "order_id": 123,
        "reason": "damaged",
        "requested_amount": 150.00,
        "suspicious_indicators": ["none"],
    }


def test_cascade_delete_removes_items(db_session):
    customer = Customer(name="Cascade", email="cascade@example.com")
    order = Order(
        customer=customer,
        order_date=datetime(2026, 9, 1),
        total_amount=10.00,
        status="delivered",
        items=[OrderItem(product_name="Thing", price=10.00)],
    )
    db_session.add_all([customer, order])
    db_session.commit()
    order_id, item_id = order.id, order.items[0].id

    db_session.delete(order)
    db_session.commit()

    assert db_session.get(OrderItem, item_id) is None
    assert db_session.get(Order, order_id) is None


def test_duplicate_email_raises_integrity_error(db_session):
    db_session.add(Customer(name="First", email="dupe@example.com"))
    db_session.commit()

    db_session.add(Customer(name="Second", email="dupe@example.com"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
