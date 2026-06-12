from fastapi import APIRouter, Depends, status

from app.api.schemas import (
    MessageResponse,
    SessionCreateRequest,
    SessionDetailResponse,
    SessionResponse,
)
from app.auth import get_current_user
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_session_service() -> SessionService:
    return SessionService()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreateRequest,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    session = svc.create_session(uid=current_user["uid"], title=body.title)
    return SessionResponse.from_domain(session)


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    sessions = svc.list_sessions(uid=current_user["uid"])
    return [SessionResponse.from_domain(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    session, messages = svc.get_session_with_messages(
        uid=current_user["uid"], session_id=session_id
    )
    return SessionDetailResponse(
        session=SessionResponse.from_domain(session),
        messages=[MessageResponse.from_domain(m) for m in messages],
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    svc.delete_session(uid=current_user["uid"], session_id=session_id)
