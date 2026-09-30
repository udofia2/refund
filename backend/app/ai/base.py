"""LLMProvider ABC — the single interface every provider implements."""

from abc import ABC, abstractmethod

from app.ai.types import ExtractedRefundData


class LLMProvider(ABC):
    name: str  # "gemini" | "openai" | "anthropic" | "mock"

    @abstractmethod
    async def extract_refund_data(self, text: str, context: dict) -> ExtractedRefundData:
        """Parse free-text refund request into structured fields.

        context: {"customer_name": str, "known_order_ids": list[int]}
        """

    @abstractmethod
    async def generate_response(self, decision: str, reason: str, customer_name: str) -> str:
        """Render a decision explanation as a customer-facing message."""

    async def health(self) -> dict:
        return {"provider": self.name, "ok": True}
