"""Deterministic mock provider — ships in the app, not a test double.

This is what runs when LLM_API_KEY is unset, so the evaluator can run the
full product without an API key. It must meet the same response-quality
rules as the real providers (tone, length, "policy" word-rule).
"""

import logging
import re

from app.ai.base import LLMProvider
from app.ai.prompts import SYSTEM_RESPONSE
from app.ai.types import ExtractedRefundData

logger = logging.getLogger(__name__)

DAMAGE_WORDS = ("damaged", "broken", "cracked")
INCORRECT_WORDS = ("wrong", "incorrect", "not what i ordered")
INJECTION_PATTERNS = ("ignore previous", "approve this", "override", "you are now")

AMOUNT_RE = re.compile(r"\$?(\d+(?:\.\d{1,2})?)\s*(?:dollars|usd)?", re.IGNORECASE)
ORDER_ID_RE = re.compile(r"order\s*#?\s*(\d+)", re.IGNORECASE)

_APPROVED_TEMPLATE = (
    "Hi {name}, good news — your refund has been approved{reason_clause}. "
    "The amount will be returned to your original payment method shortly. "
    "Reply to this message if you have any questions."
)
_DENIED_TEMPLATE = (
    "Hi {name}, after reviewing your request we are unable to approve this "
    "refund. Per our refund policy: {reason}. If you believe this is a "
    "mistake or have new information, please reply and our team will take "
    "another look."
)
_ESCALATED_TEMPLATE = (
    "Hi {name}, thanks for reaching out. Your request needs a quick review "
    "from one of our specialists. We will get back to you within 2 business "
    "days — no action is needed from you in the meantime."
)


class MockProvider(LLMProvider):
    name = "mock"

    async def extract_refund_data(self, text: str, context: dict) -> ExtractedRefundData:
        lowered = text.lower()
        suspicious: list[str] = []
        reason: str | None = None
        item_condition: str | None = None

        if any(w in lowered for w in DAMAGE_WORDS):
            reason = "damaged"
            item_condition = "damaged"
        elif any(w in lowered for w in INCORRECT_WORDS):
            reason = "incorrect"
            item_condition = "incorrect"

        if any(p in lowered for p in INJECTION_PATTERNS):
            suspicious.append("policy_override_attempt")

        amount = self._extract_amount(lowered, text)
        order_id = self._extract_order_id(text, context, suspicious)

        if reason is None and not suspicious and amount is None and order_id is None:
            return ExtractedRefundData(
                reason="unknown",
                requested_amount=None,
                order_id=None,
                item_condition=None,
                suspicious_indicators=tuple(suspicious),
                confidence=0.0,
                raw_model_output={"mock": True, "text": text[:200]},
            )

        return ExtractedRefundData(
            reason=reason or "other",
            requested_amount=amount,
            order_id=order_id,
            item_condition=item_condition,
            suspicious_indicators=tuple(suspicious),
            confidence=0.6,
            raw_model_output={"mock": True, "text": text[:200]},
        )

    async def generate_response(self, decision: str, reason: str, customer_name: str) -> str:
        if decision == "approved":
            reason_clause = f" ({reason})" if reason and reason != "unknown" else ""
            response = _APPROVED_TEMPLATE.format(
                name=customer_name, reason_clause=reason_clause
            )
        elif decision == "denied":
            response = _DENIED_TEMPLATE.format(name=customer_name, reason=reason)
        elif decision == "escalated":
            response = _ESCALATED_TEMPLATE.format(name=customer_name)
        else:
            response = _ESCALATED_TEMPLATE.format(name=customer_name)

        logger.debug("MockProvider generated response: %s", response)
        return response

    @staticmethod
    def _extract_amount(lowered: str, original: str) -> float | None:
        match = AMOUNT_RE.search(original)
        if match is None:
            return None
        try:
            return float(match.group(1))
        except ValueError:
            return None

    @staticmethod
    def _extract_order_id(text: str, context: dict, suspicious: list[str]) -> int | None:
        match = ORDER_ID_RE.search(text)
        if match is None:
            return None
        order_id = int(match.group(1))
        known = context.get("known_order_ids", [])
        if order_id not in known:
            suspicious.append("unknown_order_id")
            return None
        return order_id
