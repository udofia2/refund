"""Provider factory: selects the LLMProvider implementation from settings.

Falls back to MockProvider when LLM_API_KEY is unset, so the app runs
end-to-end for evaluation without credentials.

get_provider is idempotent per process (module-level cache).
_reset_provider_cache exists ONLY for test isolation.
"""

import logging

from app.ai.base import LLMProvider
from app.ai.mock_provider import MockProvider

logger = logging.getLogger(__name__)

_provider: LLMProvider | None = None


def _build_provider(settings) -> LLMProvider:
    if not settings.llm_api_key:
        logger.warning(
            "Using mock LLM provider — set LLM_API_KEY to enable real model."
        )
        return MockProvider()

    match settings.llm_provider:
        case "gemini":
            from app.ai.gemini_provider import GeminiProvider

            return GeminiProvider(settings)
        case "openai":
            from app.ai.openai_provider import OpenAIProvider

            return OpenAIProvider(settings)
        case "anthropic":
            from app.ai.anthropic_provider import AnthropicProvider

            return AnthropicProvider(settings)
        case _:
            raise ValueError(
                f"Unknown LLM_PROVIDER: {settings.llm_provider!r}. "
                "Expected gemini, openai, or anthropic."
            )


def get_provider(settings) -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = _build_provider(settings)
    return _provider


def _reset_provider_cache() -> None:
    """Test-only: clear the module-level provider cache between tests."""
    global _provider
    _provider = None
