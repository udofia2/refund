from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api import customers, health, orders, refunds
from app.config import settings
from app.db.base import init_db
from app.security.limiter import limiter, rate_limit_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="WORKNOON Refund System API",
    description="AI-powered customer support refund system",
    version="0.1.0",
    lifespan=lifespan,
)

# Decorator-based rate limits need only state + exception handler — no
# SlowAPIMiddleware (that path is for default_limits, which we don't use).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(refunds.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
