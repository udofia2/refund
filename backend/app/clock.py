"""Shared clock helpers.

Single source of truth for "now" so no module defines its own duplicate
(and so the policy engine can default to naive UTC without importing app.db).
"""

from datetime import datetime, timezone


def utcnow_naive() -> datetime:
    """Naive UTC timestamp — drop-in replacement for datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
