"""Rate limiter wiring: instance, dynamic limit value, 429 response.

Verified against installed slowapi (0.1.9 pin) / limits 5.8.0:
- `limiter.reset()` exists and resets the in-memory storage — tests use it
  (there is no public `.storage` attribute; only `_storage`).
- `limit_value` accepts a callable and `LimitGroup.__iter__` re-evaluates it
  per request, so `refund_rate_limit()` reads live settings (tests can
  monkeypatch them mid-session).
- `key_func` is bound at decoration time; changing `limiter._key_func`
  afterwards has no effect on already-decorated routes.
"""

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.security.keys import client_key

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=client_key, enabled=settings.rate_limit_enabled)


def refund_rate_limit() -> str:
    """Callable limit value — re-read per request so tests can change settings."""
    return f"{settings.rate_limit_requests}/{settings.rate_limit_window_seconds} second"


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 in FastAPI's {"detail": ...} convention so frontend ApiError parses it."""
    logger.warning(
        "Rate limit exceeded for %s on %s", client_key(request), request.url.path
    )
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait before submitting again."
        },
        headers={"Retry-After": str(settings.rate_limit_window_seconds)},
    )
