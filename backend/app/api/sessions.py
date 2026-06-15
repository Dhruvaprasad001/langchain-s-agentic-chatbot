import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.schemas import (
    MessageResponse,
    PaginatedMessagesResponse,
    PaginatedSessionsResponse,
    SessionCreateRequest,
    SessionDetailResponse,
    SessionResponse,
    SessionUpdateRequest,
)
from app.auth import get_current_user
from app.dependencies import get_session_service
from app.exceptions import RepositoryError, SessionNotFoundError
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreateRequest,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    uid = current_user["uid"]
    logger.info("POST /sessions uid=%s title=%r", uid, body.title)
    try:
        session = svc.create_session(uid=uid, title=body.title)
        logger.info("POST /sessions → 201 session_id=%s uid=%s", session.session_id, uid)
        return SessionResponse.from_domain(session)
    except RepositoryError as exc:
        logger.error("POST /sessions storage error uid=%s: %s", uid, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable") from exc
    except Exception as exc:
        logger.error("POST /sessions unexpected error uid=%s: %s", uid, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc


@router.get("", response_model=PaginatedSessionsResponse)
async def list_sessions(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    uid = current_user["uid"]
    logger.info("GET /sessions uid=%s page=%d limit=%d", uid, page, limit)
    try:
        sessions, total = svc.list_sessions_paginated(uid=uid, page=page, limit=limit)
        logger.info("GET /sessions → 200 count=%d total=%d uid=%s", len(sessions), total, uid)
        return PaginatedSessionsResponse(
            total=total,
            page=page,
            limit=limit,
            items=[SessionResponse.from_domain(s) for s in sessions],
        )
    except RepositoryError as exc:
        logger.error("GET /sessions storage error uid=%s: %s", uid, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable") from exc
    except Exception as exc:
        logger.error("GET /sessions unexpected error uid=%s: %s", uid, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc


@router.get("/{session_id}", response_model=PaginatedMessagesResponse)
async def get_session(
    session_id: str,
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(50, ge=1, le=200, description="Messages per page"),
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    uid = current_user["uid"]
    logger.info("GET /sessions/%s uid=%s page=%d limit=%d", session_id, uid, page, limit)
    try:
        session, messages, total = svc.get_session_with_messages_paginated(
            uid=uid, session_id=session_id, page=page, limit=limit
        )
        logger.info(
            "GET /sessions/%s → 200 messages=%d total=%d uid=%s",
            session_id, len(messages), total, uid,
        )
        return PaginatedMessagesResponse(
            total=total,
            page=page,
            limit=limit,
            items=[MessageResponse.from_domain(m) for m in messages],
        )
    except SessionNotFoundError as exc:
        logger.warning("GET /sessions/%s → 404 uid=%s", session_id, uid)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found") from exc
    except RepositoryError as exc:
        logger.error("GET /sessions/%s storage error uid=%s: %s", session_id, uid, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable") from exc
    except Exception as exc:
        logger.error("GET /sessions/%s unexpected error uid=%s: %s", session_id, uid, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    body: SessionUpdateRequest,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    uid = current_user["uid"]
    logger.info("PATCH /sessions/%s uid=%s title=%r", session_id, uid, body.title)
    try:
        svc.update_session_title(uid=uid, session_id=session_id, title=body.title)
        session, _ = svc.get_session_with_messages(uid=uid, session_id=session_id)
        logger.info("PATCH /sessions/%s → 200 uid=%s", session_id, uid)
        return SessionResponse.from_domain(session)
    except SessionNotFoundError as exc:
        logger.warning("PATCH /sessions/%s → 404 uid=%s", session_id, uid)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found") from exc
    except RepositoryError as exc:
        logger.error("PATCH /sessions/%s storage error uid=%s: %s", session_id, uid, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable") from exc
    except Exception as exc:
        logger.error("PATCH /sessions/%s unexpected error uid=%s: %s", session_id, uid, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    svc: SessionService = Depends(get_session_service),
):
    uid = current_user["uid"]
    logger.info("DELETE /sessions/%s uid=%s", session_id, uid)
    try:
        svc.delete_session(uid=uid, session_id=session_id)
        logger.info("DELETE /sessions/%s → 204 uid=%s", session_id, uid)
    except SessionNotFoundError as exc:
        logger.warning("DELETE /sessions/%s → 404 uid=%s", session_id, uid)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found") from exc
    except RepositoryError as exc:
        logger.error("DELETE /sessions/%s storage error uid=%s: %s", session_id, uid, exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Storage unavailable") from exc
    except Exception as exc:
        logger.error("DELETE /sessions/%s unexpected error uid=%s: %s", session_id, uid, exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc
