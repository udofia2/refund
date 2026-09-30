"""Tests for the refund policy engine.

Note: `now=` is ALWAYS passed explicitly in these tests — the engine stays
deterministic and the utcnow_naive() helper's only production use is the
default branch of rule_order_age.
"""

from dataclasses import astuple
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.policy.engine import PolicyEngine
from app.policy.types import PolicyDecision, RuleCode, RuleResult

NOW = datetime(2026, 9, 30, 12, 0, 0)


def make_item(**overrides):
    defaults = dict(
        product_name="Widget",
        price=100.0,
        quantity=1,
        is_final_sale=False,
        condition="new",
    )
    return SimpleNamespace(**{**defaults, **overrides})


def make_order(**overrides):
    defaults = dict(
        id=1,
        customer_id=1,
        order_date=NOW - timedelta(days=5),
        total_amount=100.0,
        status="delivered",
        items=[make_item()],
    )
    return SimpleNamespace(**{**defaults, **overrides})


def make_customer():
    return SimpleNamespace(id=1, name="Test Customer", email="test@example.com")


def make_extracted(**overrides):
    defaults = dict(
        order_id=1,
        reason="changed my mind",
        requested_amount=100.0,
        suspicious_indicators=[],
    )
    return {**defaults, **overrides}


@pytest.fixture
def engine():
    return PolicyEngine(max_refund_days=30, high_value_threshold=500.0)


@pytest.fixture
def customer():
    return make_customer()


def test_happy_path_damaged(engine, customer):
    order = make_order(items=[make_item(condition="damaged")])
    decision = engine.evaluate(
        customer, order, make_extracted(reason="damaged"), now=NOW
    )
    assert decision.decision == "approved"
    assert decision.rule_codes == (RuleCode.DAMAGED_OR_INCORRECT,)


def test_clean_eligible(engine, customer):
    decision = engine.evaluate(customer, make_order(), make_extracted(), now=NOW)
    assert decision.decision == "approved"
    assert decision.rule_codes == (RuleCode.CLEAN_ELIGIBLE,)


def test_final_sale_denies(engine, customer):
    order = make_order(items=[make_item(is_final_sale=True)])
    decision = engine.evaluate(
        customer, order, make_extracted(reason="damaged"), now=NOW
    )
    assert decision.decision == "denied"
    assert RuleCode.FINAL_SALE_ITEM in decision.rule_codes


def test_age_boundary_day_29_not_denied(engine, customer):
    order = make_order(order_date=NOW - timedelta(days=29))
    decision = engine.evaluate(customer, order, make_extracted(), now=NOW)
    assert decision.decision == "approved"


def test_age_boundary_day_31_denied(engine, customer):
    order = make_order(order_date=NOW - timedelta(days=31))
    decision = engine.evaluate(customer, order, make_extracted(), now=NOW)
    assert decision.decision == "denied"
    assert RuleCode.ORDER_TOO_OLD in decision.rule_codes


def test_high_value_escalates(engine, customer):
    order = make_order(total_amount=800.0)
    decision = engine.evaluate(
        customer, order, make_extracted(requested_amount=800.0), now=NOW
    )
    assert decision.decision == "escalated"
    assert RuleCode.HIGH_VALUE in decision.rule_codes


def test_amount_boundary_exactly_500_not_escalated(engine, customer):
    order = make_order(total_amount=500.0)
    decision = engine.evaluate(
        customer, order, make_extracted(requested_amount=500.0), now=NOW
    )
    assert decision.decision == "approved"
    assert RuleCode.HIGH_VALUE not in decision.rule_codes


def test_amount_boundary_500_01_escalated(engine, customer):
    order = make_order(total_amount=500.01)
    decision = engine.evaluate(
        customer, order, make_extracted(requested_amount=500.01), now=NOW
    )
    assert decision.decision == "escalated"
    assert RuleCode.HIGH_VALUE in decision.rule_codes


def test_precedence_final_sale_beats_high_value(engine, customer):
    order = make_order(
        total_amount=850.0, items=[make_item(price=850.0, is_final_sale=True)]
    )
    decision = engine.evaluate(
        customer, order, make_extracted(requested_amount=850.0), now=NOW
    )
    assert decision.decision == "denied"
    assert RuleCode.FINAL_SALE_ITEM in decision.rule_codes
    assert RuleCode.HIGH_VALUE not in decision.rule_codes
    triggered_codes = {
        entry["rule_code"]
        for entry in decision.metadata["rules_evaluated"]
        if entry["triggered"]
    }
    assert RuleCode.HIGH_VALUE in triggered_codes


def test_precedence_old_beats_damaged(engine, customer):
    order = make_order(
        order_date=NOW - timedelta(days=45), items=[make_item(condition="damaged")]
    )
    decision = engine.evaluate(
        customer, order, make_extracted(reason="damaged"), now=NOW
    )
    assert decision.decision == "denied"
    assert RuleCode.ORDER_TOO_OLD in decision.rule_codes


def test_order_not_found_escalates(engine, customer):
    decision = engine.evaluate(customer, None, make_extracted(), now=NOW)
    assert decision.decision == "escalated"
    assert decision.rule_codes == (RuleCode.ORDER_NOT_FOUND,)


def test_cancelled_order_denied(engine, customer):
    order = make_order(status="cancelled")
    decision = engine.evaluate(customer, order, make_extracted(), now=NOW)
    assert decision.decision == "denied"
    assert RuleCode.ORDER_CANCELLED in decision.rule_codes


def test_suspicious_indicators_escalate(engine, customer):
    decision = engine.evaluate(
        customer,
        make_order(),
        make_extracted(suspicious_indicators=["threatening language"]),
        now=NOW,
    )
    assert decision.decision == "escalated"
    assert RuleCode.SUSPICIOUS_INDICATORS in decision.rule_codes


def test_duplicate_recent_escalates(engine, customer):
    decision = engine.evaluate(
        customer, make_order(), make_extracted(), recent_request_count=5, now=NOW
    )
    assert decision.decision == "escalated"
    assert RuleCode.DUPLICATE_RECENT in decision.rule_codes


def test_no_eligible_reason_escalates(engine, customer):
    decision = engine.evaluate(
        customer, make_order(), make_extracted(reason=""), now=NOW
    )
    assert decision.decision == "escalated"
    assert decision.rule_codes == (RuleCode.NO_ELIGIBLE_REASON,)


def test_engine_is_pure_with_explicit_now(engine, customer):
    order = make_order(items=[make_item(condition="damaged")])
    extracted = make_extracted(reason="damaged")
    explicit_now = datetime(2026, 9, 30, 12, 0, 0)

    first = engine.evaluate(customer, order, extracted, now=explicit_now)
    second = engine.evaluate(customer, order, extracted, now=explicit_now)

    assert first == second
    assert astuple(first) == astuple(second)


def test_metadata_completeness(engine, customer):
    order = make_order()
    decision = engine.evaluate(
        customer, order, make_extracted(), recent_request_count=1, now=NOW
    )
    assert isinstance(decision, PolicyDecision)

    evaluated = decision.metadata["rules_evaluated"]
    all_codes = {entry["rule_code"] for entry in evaluated}
    assert RuleCode.ORDER_NOT_FOUND in all_codes
    assert RuleCode.ORDER_CANCELLED in all_codes
    assert RuleCode.FINAL_SALE_ITEM in all_codes
    assert RuleCode.ORDER_TOO_OLD in all_codes
    assert RuleCode.HIGH_VALUE in all_codes
    assert RuleCode.SUSPICIOUS_INDICATORS in all_codes
    assert RuleCode.DUPLICATE_RECENT in all_codes
    assert RuleCode.CLEAN_ELIGIBLE in all_codes
    assert all(set(entry) == {"rule_code", "triggered"} for entry in evaluated)

    snapshot = decision.metadata["inputs_snapshot"]
    assert snapshot["customer_id"] == 1
    assert snapshot["order_id"] == 1
    assert snapshot["order_status"] == "delivered"
    assert snapshot["requested_amount"] == 100.0
    assert snapshot["recent_request_count"] == 1
    assert snapshot["now"] == NOW.isoformat()


def test_rule_results_are_frozen():
    result = RuleResult(
        triggered=True,
        rule_code=RuleCode.CLEAN_ELIGIBLE,
        message="msg",
        severity="approved",
    )
    with pytest.raises(Exception):
        result.triggered = False
