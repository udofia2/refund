"""Idempotent seed script for the mock CRM database.

Run manually with: python -m app.db.seed
Use --force to drop and recreate all tables before seeding.
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.clock import utcnow_naive
from app.db.base import Base, SessionLocal, engine, init_db
from app.db.models import Customer, Order, OrderItem

logger = logging.getLogger(__name__)


def _days_ago(days: int) -> datetime:
    return utcnow_naive() - timedelta(days=days)


def _add_order(
    session: Session,
    customer: Customer,
    order_date: datetime,
    status: str,
    items: list[dict],
) -> Order:
    order = Order(
        customer=customer,
        order_date=order_date,
        total_amount=round(sum(i["price"] * i.get("quantity", 1) for i in items), 2),
        status=status,
        items=[
            OrderItem(
                product_name=i["product_name"],
                price=i["price"],
                quantity=i.get("quantity", 1),
                is_final_sale=i.get("is_final_sale", False),
                condition=i.get("condition", "new"),
            )
            for i in items
        ],
    )
    session.add(order)
    return order


def build_seed_data(session: Session) -> None:
    """Create the 15-customer coverage matrix. Caller commits."""

    # 1. Clean recent order -> approved path
    ada = Customer(name="Ada Whitfield", email="ada.whitfield@example.com")
    _add_order(session, ada, _days_ago(5), "delivered", [
        {"product_name": "Wireless Headphones", "price": 129.99},
        {"product_name": "USB-C Cable", "price": 12.99},
    ])

    # 2. Damaged item, recent -> approved path
    marcus = Customer(name="Marcus Chen", email="marcus.chen@example.com")
    _add_order(session, marcus, _days_ago(8), "delivered", [
        {"product_name": "Ceramic Dinner Set", "price": 89.50, "condition": "damaged"},
    ])

    # 3. Incorrect item, recent -> approved path
    priya = Customer(name="Priya Nair", email="priya.nair@example.com")
    _add_order(session, priya, _days_ago(3), "delivered", [
        {"product_name": "Running Shoes (Size 9)", "price": 110.00, "condition": "incorrect"},
    ])

    # 4. Final-sale item -> denied path
    sofia = Customer(name="Sofia Ramirez", email="sofia.ramirez@example.com")
    _add_order(session, sofia, _days_ago(10), "delivered", [
        {"product_name": "Holiday Jumpers (Clearance)", "price": 45.00, "is_final_sale": True},
    ])

    # 5. Old order -> denied path
    ethan = Customer(name="Ethan Brooks", email="ethan.brooks@example.com")
    _add_order(session, ethan, _days_ago(60), "delivered", [
        {"product_name": "Coffee Maker", "price": 79.99},
    ])

    # 6. High-value refund -> escalated path (>$500)
    hannah = Customer(name="Hannah Osei", email="hannah.osei@example.com")
    _add_order(session, hannah, _days_ago(7), "delivered", [
        {"product_name": "4K Monitor", "price": 520.00},
        {"product_name": "Monitor Arm", "price": 280.00},
    ])

    # 7. High-value + damaged -> escalated path
    liam = Customer(name="Liam Fitzgerald", email="liam.fitzgerald@example.com")
    _add_order(session, liam, _days_ago(6), "delivered", [
        {"product_name": "Smart TV 65\"", "price": 700.00, "condition": "damaged"},
    ])

    # 8. Final sale + high value -> denied wins (precedence test)
    olivia = Customer(name="Olivia Grant", email="olivia.grant@example.com")
    _add_order(session, olivia, _days_ago(4), "delivered", [
        {"product_name": "Designer Handbag (Final Sale)", "price": 850.00, "is_final_sale": True},
    ])

    # 9. Old + damaged -> denied wins (age)
    noah = Customer(name="Noah Petrov", email="noah.petrov@example.com")
    _add_order(session, noah, _days_ago(45), "delivered", [
        {"product_name": "Desk Lamp", "price": 60.00, "condition": "damaged"},
    ])

    # 10. Multiple orders, mixed -> good for extraction tests
    emma = Customer(name="Emma Lindqvist", email="emma.lindqvist@example.com")
    _add_order(session, emma, _days_ago(12), "delivered", [
        {"product_name": "Yoga Mat", "price": 35.00},
    ])
    _add_order(session, emma, _days_ago(20), "delivered", [
        {"product_name": "Electric Kettle (Clearance)", "price": 40.00, "is_final_sale": True},
    ])

    # 11. No orders yet -> tests "no order found" handling
    jack = Customer(name="Jack O'Donnell", email="jack.odonnell@example.com")

    # 12. Cancelled order -> policy edge case
    amara = Customer(name="Amara Diallo", email="amara.diallo@example.com")
    _add_order(session, amara, _days_ago(9), "cancelled", [
        {"product_name": "Bluetooth Speaker", "price": 55.00},
    ])

    # 13. Borderline age: exactly 29 days -> approved
    felix = Customer(name="Felix Nguyen", email="felix.nguyen@example.com")
    _add_order(session, felix, _days_ago(29), "delivered", [
        {"product_name": "Backpack", "price": 65.00},
    ])

    # 14. Borderline age: exactly 31 days -> denied
    grace = Customer(name="Grace Kimani", email="grace.kimani@example.com")
    _add_order(session, grace, _days_ago(31), "delivered", [
        {"product_name": "Stand Mixer", "price": 220.00},
    ])

    # 15. Borderline amount: exactly $500.00 -> NOT escalated (threshold is > 500)
    henry = Customer(name="Henry Castellanos", email="henry.castellanos@example.com")
    _add_order(session, henry, _days_ago(6), "delivered", [
        {"product_name": "Standing Desk", "price": 500.00},
    ])

    session.add_all([ada, marcus, priya, sofia, ethan, hannah, liam, olivia, noah,
                     emma, jack, amara, felix, grace, henry])


def is_seeded(session: Session) -> bool:
    return session.scalar(select(func.count(Customer.id))) > 0


def seed(session: Session) -> None:
    build_seed_data(session)
    session.commit()
    logger.info(
        "Seeded: %d customers, %d orders, %d order items",
        session.scalar(select(func.count(Customer.id))),
        session.scalar(select(func.count(Order.id))),
        session.scalar(select(func.count(OrderItem.id))),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the refund database.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Drop and recreate all tables before seeding.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if args.force:
        logger.info("Dropping and recreating all tables (--force).")
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    else:
        init_db()

    with SessionLocal() as session:
        if is_seeded(session):
            logger.info("Database already seeded, skipping. Use --force to reseed.")
            return 0
        seed(session)

    return 0


if __name__ == "__main__":
    sys.exit(main())
