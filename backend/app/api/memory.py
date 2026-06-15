import logging

from fastapi import APIRouter, Depends

from app.api.schemas import MemoryFactResponse, MemoryResponse
from app.auth import get_current_user
from app.services.memory_service import MemoryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=MemoryResponse)
async def get_memory(current_user: dict = Depends(get_current_user)) -> MemoryResponse:
    """Return all stored memory facts for the authenticated user."""
    uid = current_user["uid"]
    raw_facts = await MemoryService.list_all(uid)
    return MemoryResponse(
        facts=[MemoryFactResponse(**f) for f in raw_facts]
    )
