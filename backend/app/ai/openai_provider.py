"""OpenAI provider. SDK imported lazily inside __init__."""

import json
import logging

from app.ai.base import LLMProvider
from app.ai.prompts import SYSTEM_EXTRACT, SYSTEM_RESPONSE
from app.ai.types import ExtractedRefundData, LLMError, LLMParsingError

logger = logging.getLogger(__name__)

EXTRACT_TOOL = {
    "type": "function",
    "function": {
        "name": "extract_refund",
        "description": "Extract structured refund request data from customer text.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Closest match: damaged | incorrect | wrong_item | "
                    "not_as_described | changed_mind | late_delivery | duplicate_order "
                    "| other | unknown",
                },
                "requested_amount": {"type": "number", "nullable": True},
                "order_id": {"type": "integer", "nullable": True},
                "item_condition": {
                    "type": "string",
                    "enum": ["new", "damaged", "incorrect", "used"],
                    "nullable": True,
                },
                "suspicious_indicators": {"type": "array", "items": {"type": "string"}},
                "confidence": {"type": "number"},
            },
            "required": ["reason", "suspicious_indicators", "confidence"],
        },
    },
}


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, settings):
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            timeout=settings.llm_timeout_seconds,
        )
        self._model = settings.llm_model
        self._temperature = settings.llm_temperature
        self._max_tokens = settings.llm_max_tokens

    async def extract_refund_data(self, text: str, context: dict) -> ExtractedRefundData:
        try:
            completion = await self._client.chat.completions.create(
                model=self._model,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                messages=[
                    {"role": "system", "content": SYSTEM_EXTRACT.format(
                        context=json.dumps(context), message=text)},
                    {"role": "user", "content": text},
                ],
                tools=[EXTRACT_TOOL],
                tool_choice={"type": "function", "function": {"name": "extract_refund"}},
            )
        except Exception as exc:
            raise LLMError(f"OpenAI extraction failed: {exc}") from exc

        tool_calls = completion.choices[0].message.tool_calls
        if not tool_calls:
            raise LLMParsingError("OpenAI returned no tool call")
        try:
            data = json.loads(tool_calls[0].function.arguments)
        except (json.JSONDecodeError, AttributeError, IndexError) as exc:
            raise LLMParsingError("OpenAI tool arguments were malformed") from exc

        return self._to_extracted(data)

    async def generate_response(self, decision: str, reason: str, customer_name: str) -> str:
        try:
            completion = await self._client.chat.completions.create(
                model=self._model,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                messages=[
                    {"role": "system", "content": SYSTEM_RESPONSE.format(
                        decision=decision, reason=reason, customer_name=customer_name)},
                ],
            )
        except Exception as exc:
            raise LLMError(f"OpenAI response generation failed: {exc}") from exc
        return completion.choices[0].message.content.strip()

    @staticmethod
    def _to_extracted(data: dict) -> ExtractedRefundData:
        suspicious = tuple(str(s) for s in data.get("suspicious_indicators") or [])
        return ExtractedRefundData(
            reason=data.get("reason") or "unknown",
            requested_amount=data.get("requested_amount"),
            order_id=data.get("order_id"),
            item_condition=data.get("item_condition"),
            suspicious_indicators=suspicious,
            confidence=float(data.get("confidence") or 0.0),
            raw_model_output=data,
        )
