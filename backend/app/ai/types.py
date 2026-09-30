"""Data types and error hierarchy for the AI layer."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ExtractedRefundData:
    """Structured data extracted from a customer's free-text refund request.

    This is the ONLY structured output of extraction. Downstream consumers
    (policy engine, API layer) treat it as unvalidated until they apply
    their own checks.
    """

    reason: str  # "damaged" | "incorrect" | "changed_mind" | "unknown" | ...
    requested_amount: float | None = None
    order_id: int | None = None
    item_condition: str | None = None  # "new" | "damaged" | "incorrect" | "used" | None
    suspicious_indicators: tuple[str, ...] = ()  # empty tuple if none
    confidence: float = 0.0  # 0.0–1.0
    raw_model_output: dict = field(default_factory=dict)  # audit only; never trusted


class LLMError(Exception):
    """Base class for LLM failures."""


class LLMRefusalError(LLMError):
    """The model refused, or a safety filter blocked the response."""


class LLMParsingError(LLMError):
    """The model's output could not be parsed into the expected structure."""
