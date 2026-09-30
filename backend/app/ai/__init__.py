"""AI provider layer.

The AI layer NEVER makes policy decisions — it parses customer requests into
structured data and renders decision explanations as customer-facing text.
All decision logic lives in app.policy.

Hard boundaries:
- No imports of app.policy or app.db (hard boundary).
- No SDK imports at module scope (lazy, inside provider __init__).
"""

from app.ai.base import LLMProvider
from app.ai.factory import get_provider
from app.ai.types import (
    ExtractedRefundData,
    LLMError,
    LLMRefusalError,
    LLMParsingError,
)

__all__ = [
    "LLMProvider",
    "get_provider",
    "ExtractedRefundData",
    "LLMError",
    "LLMRefusalError",
    "LLMParsingError",
]
