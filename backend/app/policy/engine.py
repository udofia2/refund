"""PolicyEngine: composes the pure rules into a single PolicyDecision.

Precedence: denied > escalated > approved. If nothing triggers, the request
is escalated under NO_ELIGIBLE_REASON rather than silently approved.

The engine is a pure function of its inputs — no DB, no AI, no I/O.
"""

from datetime import datetime

from app.policy import rules
from app.policy.types import CustomerLike, Decision, OrderLike, PolicyDecision, RuleCode, RuleResult


class PolicyEngine:
    def __init__(
        self,
        max_refund_days: int,
        high_value_threshold: float,
        duplicate_recent_threshold: int = 3,
    ):
        self.max_refund_days = max_refund_days
        self.high_value_threshold = high_value_threshold
        self.duplicate_recent_threshold = duplicate_recent_threshold

    def evaluate(
        self,
        customer: CustomerLike,
        order: OrderLike | None,
        extracted_data: dict,
        recent_request_count: int = 0,
        now: datetime | None = None,
    ) -> PolicyDecision:
        results: list[RuleResult] = [
            rules.rule_order_exists(order),
            rules.rule_order_status(order),
            rules.rule_final_sale(order),
            rules.rule_order_age(order, self.max_refund_days, now),
            rules.rule_high_value(
                order,
                extracted_data.get("requested_amount"),
                self.high_value_threshold,
            ),
            rules.rule_suspicious_indicators(extracted_data),
            rules.rule_duplicate_recent(
                recent_request_count, self.duplicate_recent_threshold
            ),
        ]

        # Positive rules are only consulted when no denial/escalation fired,
        # so clean_eligible/damaged_or_incorrect can't override a denial.
        if not any(r.triggered and r.severity in ("denied", "escalated") for r in results):
            results.append(rules.rule_damaged_or_incorrect(order, extracted_data))
            results.append(rules.rule_clean_eligible(order, extracted_data))

        denied = [r for r in results if r.triggered and r.severity == "denied"]
        escalated = [r for r in results if r.triggered and r.severity == "escalated"]
        approved = [r for r in results if r.triggered and r.severity == "approved"]

        # DAMAGED_OR_INCORRECT takes precedence over CLEAN_ELIGIBLE when both
        # fire (e.g. reason="damaged" is non-empty and also a damage code).
        if any(r.rule_code == RuleCode.DAMAGED_OR_INCORRECT for r in approved):
            approved = [
                r for r in approved if r.rule_code != RuleCode.CLEAN_ELIGIBLE
            ]

        decision: Decision
        if denied:
            decision = "denied"
            driving = denied
        elif escalated:
            decision = "escalated"
            driving = escalated
        elif approved:
            decision = "approved"
            driving = approved
        else:
            decision = "escalated"
            driving = [
                RuleResult(
                    triggered=True,
                    rule_code=RuleCode.NO_ELIGIBLE_REASON,
                    message=(
                        "No policy-based reason to approve or deny; "
                        "escalating for review."
                    ),
                    severity="escalated",
                )
            ]

        return PolicyDecision(
            decision=decision,
            reason="; ".join(r.message for r in driving),
            rule_codes=tuple(r.rule_code for r in driving),
            metadata={
                "rules_evaluated": [
                    {"rule_code": r.rule_code, "triggered": r.triggered}
                    for r in results
                ],
                "inputs_snapshot": {
                    "customer_id": customer.id,
                    "order_id": order.id if order is not None else None,
                    "order_status": order.status if order is not None else None,
                    "requested_amount": extracted_data.get("requested_amount"),
                    "recent_request_count": recent_request_count,
                    "now": now.isoformat() if now is not None else None,
                },
            },
        )
