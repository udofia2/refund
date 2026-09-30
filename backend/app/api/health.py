from fastapi import APIRouter

from app.ai.factory import get_provider
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    provider = get_provider(settings)
    return {"status": "ok", "provider": provider.name}
