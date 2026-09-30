from datetime import datetime

from sqlalchemy import func, select

from app.clock import utcnow_naive
from app.db.models import Customer, Order, OrderItem
from app.db.seed import build_seed_data, is_seeded


def test_seed_creates_15_customers(seeded_db):
    assert seeded_db.scalar(select(func.count(Customer.id))) == 15
    assert seeded_db.scalar(select(func.count(Order.id))) == 15
    assert seeded_db.scalar(select(func.count(OrderItem.id))) >= 15


def test_seed_borderline_age_cases(seeded_db):
    dates = {
        c.email: [o.order_date for o in c.orders]
        for c in seeded_db.scalars(select(Customer)).all()
    }
    now = utcnow_naive()

    def age_days(dt: datetime) -> int:
        return (now - dt).days

    assert any(age_days(d) == 29 for d in dates["felix.nguyen@example.com"])
    assert any(age_days(d) == 31 for d in dates["grace.kimani@example.com"])


def test_seed_borderline_amount_case(seeded_db):
    henry = seeded_db.scalar(
        select(Customer).where(Customer.email == "henry.castellanos@example.com")
    )
    assert henry is not None
    assert all(o.total_amount == 500.00 for o in henry.orders)


def test_seed_coverage_scenarios(seeded_db):
    by_email = {
        c.email: c for c in seeded_db.scalars(select(Customer)).all()
    }

    # Customer 11 exists with no orders
    assert by_email["jack.odonnell@example.com"].orders == []

    # Customer 12 has a cancelled order
    assert all(
        o.status == "cancelled"
        for o in by_email["amara.diallo@example.com"].orders
    )

    # Customer 4 has a final-sale item
    sofia_items = [
        item for o in by_email["sofia.ramirez@example.com"].orders for item in o.items
    ]
    assert any(i.is_final_sale for i in sofia_items)

    # Customer 2 has a damaged item
    marcus_items = [
        item for o in by_email["marcus.chen@example.com"].orders for item in o.items
    ]
    assert any(i.condition == "damaged" for i in marcus_items)


def test_seed_idempotent_via_cli_guard(db_session, monkeypatch):
    import app.db.seed as seed_mod

    monkeypatch.setattr(seed_mod, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(seed_mod, "engine", db_session.get_bind())

    # First run seeds; second run is skipped by the is_seeded guard in main().
    assert seed_mod.main([]) == 0
    first_count = db_session.scalar(select(func.count(Customer.id)))
    assert first_count == 15

    assert seed_mod.main([]) == 0
    assert db_session.scalar(select(func.count(Customer.id))) == first_count
