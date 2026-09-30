"""Types for the refund policy engine.

Defines the decision vocabulary, machine-readable rule codes, the frozen
result dataclasses, and structural Protocols for the inputs.

The Protocols let the engine stay pure (zero imports from app.db) while
SQLAlchemy models satisfy them structurally at runtime.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Protocol, runtime_checkable

Decision = Literal["approved", "denied", "escalated"]


class RuleCode:
    ORDER_NOT_FOUND = "ORDER_NOT_FOUND"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    FINAL_SALE_ITEM = "FINAL_SALE_ITEM"
    ORDER_TOO_OLD = "ORDER_TOO_OLD"
    HIGH_VALUE = "HIGH_VALUE"
    SUSPICIOUS_INDICATORS = "SUSPICIOUS_INDICATORS"
    DUPLICATE_RECENT = "DUPLICATE_RECENT"
    DAMAGED_OR_INCORRECT = "DAMAGED_OR_INCORRECT"
    CLEAN_ELIGIBLE = "CLEAN_ELIGIBLE"
    NO_ELIGIBLE_REASON = "NO_ELIGIBLE_REASON"


@runtime_checkable
class OrderItemLike(Protocol):
    product_name: str
    price: float
    quantity: int
    is_final_sale: bool
    condition: str


@runtime_checkable
class OrderLike(Protocol):
    id: int
    customer_id: int
    order_date: datetime
    total_amount: float
    status: str
    items: list[OrderItemLike]


@runtime_checkable
class CustomerLike(Protocol):
    id: int
    name: str
    email: str


@dataclass(frozen=True)
class RuleResult:
    triggered: bool
    rule_code: str
    message: str  # human-readable, goes into audit reason
    severity: Decision  # what this rule contributes to
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True)
class PolicyDecision:
    decision: Decision
    reason: str  # semicolon-joined messages from triggered rules
    rule_codes: tuple[str, ...]
    metadata: dict  # {"rules_evaluated": [...], "inputs_snapshot": {...}}
