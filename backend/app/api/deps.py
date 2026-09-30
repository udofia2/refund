"""Shared FastAPI dependencies: policy engine and LLM provider via DI."""

from fastapi import Depends

from app.ai.base import LLMProvider
from app.ai.factory import get_provider
from app.config import Settings, get_settings
from app.policy.engine import PolicyEngine


def get_policy_engine(settings: Settings = Depends(get_settings)) -> PolicyEngine:
    return PolicyEngine(
        max_refund_days=settings.refund_max_days,
        high_value_threshold=settings.refund_high_value_threshold,
        duplicate_recent_threshold=settings.refund_duplicate_recent_threshold,
    )


def get_llm_provider(settings: Settings = Depends(get_settings)) -> LLMProvider:
    return get_provider(settings)
