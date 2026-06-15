import logging

from fastapi import APIRouter, Depends

from app.api.schemas import CustomRulesResponse, CustomRulesUpdateRequest
from app.auth import get_current_user
from app.repositories.custom_rules_repository import CustomRulesRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-rules", tags=["custom-rules"])


def _repo() -> CustomRulesRepository:
    return CustomRulesRepository()


@router.get("", response_model=CustomRulesResponse)
async def get_custom_rules(current_user: dict = Depends(get_current_user)) -> CustomRulesResponse:
    """Return the authenticated user's custom rules string (null if not set)."""
    uid = current_user["uid"]
    rules = _repo().get(uid)
    return CustomRulesResponse(rules=rules)


@router.put("", response_model=CustomRulesResponse)
async def update_custom_rules(
    body: CustomRulesUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> CustomRulesResponse:
    """Upsert the authenticated user's custom rules string."""
    uid = current_user["uid"]
    _repo().save(uid, body.rules)
    return CustomRulesResponse(rules=body.rules)
