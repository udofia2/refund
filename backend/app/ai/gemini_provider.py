"""Gemini provider (default). SDK imported lazily inside __init__."""

import json
import logging
from string import Template

from app.ai.base import LLMProvider
from app.ai.prompts import SYSTEM_EXTRACT, SYSTEM_RESPONSE
from app.ai.types import (
    ExtractedRefundData,
    LLMError,
    LLMParsingError,
    LLMRefusalError,
)

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, settings):
        from google import generativeai as genai

        self._genai = genai
        genai.configure(api_key=settings.llm_api_key)
        self._model_name = settings.llm_model
        self._temperature = settings.llm_temperature
        self._max_tokens = settings.llm_max_tokens
        self._timeout = settings.llm_timeout_seconds
        self._model = genai.GenerativeModel(self._model_name)

    async def extract_refund_data(self, text: str, context: dict) -> ExtractedRefundData:
        prompt = Template(SYSTEM_EXTRACT).substitute(
            context=json.dumps(context), message=text
        )
        try:
            response = await self._model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": self._temperature,
                    "max_output_tokens": self._max_tokens,
                },
                request_options={"timeout": self._timeout * 1000},
            )
        except Exception as exc:
            raise LLMError(f"Gemini extraction failed: {exc}") from exc

        if self._is_safety_block(response):
            raise LLMRefusalError("Gemini safety filter blocked the request")

        data = self._parse_json(response.text)
        return self._to_extracted(data, text)

    async def generate_response(self, decision: str, reason: str, customer_name: str) -> str:
        prompt = Template(SYSTEM_RESPONSE).substitute(
            decision=decision, reason=reason, customer_name=customer_name
        )
        try:
            response = await self._model.generate_content_async(
                prompt,
                generation_config={
                    "temperature": self._temperature,
                    "max_output_tokens": self._max_tokens,
                },
                request_options={"timeout": self._timeout * 1000},
            )
        except Exception as exc:
            raise LLMError(f"Gemini response generation failed: {exc}") from exc
        return response.text.strip()

    @staticmethod
    def _is_safety_block(response) -> bool:
        try:
            return response.candidates[0].finish_reason in (2, 3)  # SAFETY, RECITATION
        except (AttributeError, IndexError, TypeError):
            return False

    @staticmethod
    def _parse_json(raw: str) -> dict:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise LLMParsingError(f"Gemini returned malformed JSON: {raw[:200]}") from exc
        if not isinstance(data, dict):
            raise LLMParsingError("Gemini returned a non-object JSON value")
        return data

    @staticmethod
    def _to_extracted(data: dict, text: str) -> ExtractedRefundData:
        suspicious = tuple(
            data.get("suspicious_indicators") or []
        )
        return ExtractedRefundData(
            reason=data.get("reason") or "unknown",
            requested_amount=data.get("requested_amount"),
            order_id=data.get("order_id"),
            item_condition=data.get("item_condition"),
            suspicious_indicators=tuple(str(s) for s in suspicious),
            confidence=float(data.get("confidence") or 0.0),
            raw_model_output=data,
        )
