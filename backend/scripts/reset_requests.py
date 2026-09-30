"""Clear refund_requests only. Customers/orders untouched.
Run before acceptance flows to avoid duplicate_recent escalation on re-runs.

Usage (inside the backend container):
    python -m scripts.reset_requests
"""
from app.db.base import SessionLocal
from app.db.models import RefundRequest

s = SessionLocal()
n = s.query(RefundRequest).delete()
s.commit()
print(f"cleared {n} refund request(s)")
