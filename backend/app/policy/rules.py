"""Pure rule functions for the refund policy engine.

Each rule takes plain data (structurally satisfying the Protocols in
types.py) and returns a RuleResult. No I/O, no DB access, no AI calls.
"""

from datetime import datetime

from app.clock import utcnow_naive
from app.policy.types import OrderLike, RuleCode, RuleResult

DAMAGED_REASON_CODES = {"damaged", "incorrect", "wrong_item", "not_as_described"}
DAMAGED_ITEM_CONDITIONS = {"damaged", "incorrect"}


def rule_order_exists(order: OrderLike | None) -> RuleResult:
    if order is None:
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.ORDER_NOT_FOUND,
            message="No matching order found; manual lookup required.",
            severity="escalated",
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.ORDER_NOT_FOUND,
        message="Order found.",
        severity="escalated",
    )


def rule_order_status(order: OrderLike | None) -> RuleResult:
    if order is not None and order.status == "cancelled":
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.ORDER_CANCELLED,
            message="Order was cancelled; refund already handled.",
            severity="denied",
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.ORDER_CANCELLED,
        message="Order is not cancelled.",
        severity="denied",
    )


def rule_final_sale(order: OrderLike | None) -> RuleResult:
    if order is not None:
        final_sale_count = sum(1 for item in order.items if item.is_final_sale)
        if final_sale_count > 0:
            return RuleResult(
                triggered=True,
                rule_code=RuleCode.FINAL_SALE_ITEM,
                message=(
                    f"Order contains {final_sale_count} final-sale item(s); "
                    "final-sale items are not eligible for refunds."
                ),
                severity="denied",
                metadata={"final_sale_item_count": final_sale_count},
            )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.FINAL_SALE_ITEM,
        message="No final-sale items.",
        severity="denied",
    )


def rule_order_age(
    order: OrderLike | None,
    max_days: int,
    now: datetime | None = None,
) -> RuleResult:
    now = now if now is not None else utcnow_naive()
    if order is not None:
        age_days = (now - order.order_date).days
        if age_days > max_days:
            return RuleResult(
                triggered=True,
                rule_code=RuleCode.ORDER_TOO_OLD,
                message=(
                    f"Order is {age_days} days old; refunds are only available "
                    f"within {max_days} days of purchase."
                ),
                severity="denied",
                metadata={"age_days": age_days, "max_days": max_days},
            )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.ORDER_TOO_OLD,
        message="Order is within the refund window.",
        severity="denied",
    )


def rule_high_value(
    order: OrderLike | None,
    extracted_amount: float | None,
    threshold: float,
) -> RuleResult:
    amount = extracted_amount if extracted_amount is not None else (
        order.total_amount if order is not None else None
    )
    if amount is not None and amount > threshold:
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.HIGH_VALUE,
            message=(
                f"Refund amount ${amount:.2f} exceeds the ${threshold:.2f} "
                "threshold; requires human review."
            ),
            severity="escalated",
            metadata={"amount": amount, "threshold": threshold},
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.HIGH_VALUE,
        message="Refund amount is within the auto-decision threshold.",
        severity="escalated",
    )


def rule_suspicious_indicators(extracted_data: dict) -> RuleResult:
    indicators = extracted_data.get("suspicious_indicators")
    if isinstance(indicators, list) and len(indicators) > 0:
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.SUSPICIOUS_INDICATORS,
            message=(
                "Request flagged as suspicious: " + "; ".join(map(str, indicators)) + "."
            ),
            severity="escalated",
            metadata={"indicators": indicators},
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.SUSPICIOUS_INDICATORS,
        message="No suspicious indicators.",
        severity="escalated",
    )


def rule_duplicate_recent(recent_request_count: int, threshold: int = 3) -> RuleResult:
    if recent_request_count >= threshold:
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.DUPLICATE_RECENT,
            message=(
                f"Customer has made {recent_request_count} refund requests in "
                "the last 24 hours; possible duplicate or abuse."
            ),
            severity="escalated",
            metadata={"recent_request_count": recent_request_count, "threshold": threshold},
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.DUPLICATE_RECENT,
        message="No recent duplicate requests.",
        severity="escalated",
    )


def rule_damaged_or_incorrect(order: OrderLike | None, extracted_data: dict) -> RuleResult:
    reason = extracted_data.get("reason")
    item_hit = order is not None and any(
        item.condition in DAMAGED_ITEM_CONDITIONS for item in order.items
    )
    reason_hit = reason in DAMAGED_REASON_CODES
    if item_hit or reason_hit:
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.DAMAGED_OR_INCORRECT,
            message="Customer reports damaged or incorrect item.",
            severity="approved",
            metadata={"item_match": item_hit, "reason_match": reason_hit},
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.DAMAGED_OR_INCORRECT,
        message="No damaged/incorrect claim.",
        severity="approved",
    )


def rule_clean_eligible(order: OrderLike | None, extracted_data: dict) -> RuleResult:
    """Fallback positive rule.

    The engine only consults this when no denied/escalated rule fired, so the
    order is guaranteed to exist, be non-cancelled, non-final-sale, and within
    the age window by that point.
    """
    reason = extracted_data.get("reason")
    if order is not None and isinstance(reason, str) and reason.strip():
        return RuleResult(
            triggered=True,
            rule_code=RuleCode.CLEAN_ELIGIBLE,
            message="Order eligible for refund per policy.",
            severity="approved",
        )
    return RuleResult(
        triggered=False,
        rule_code=RuleCode.CLEAN_ELIGIBLE,
        message="No eligible refund reason supplied.",
        severity="approved",
    )
