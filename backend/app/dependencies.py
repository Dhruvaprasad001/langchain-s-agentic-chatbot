"""
Shared dependency factories for API routes.

Each function is a FastAPI Depends()-compatible factory that constructs and
returns the appropriate repository or service instance.  The graph is:

    get_session_repo  ─┐
                       ├─► get_session_service
    get_message_repo  ─┘

    get_session_repo  ─┐
                       ├─► get_chat_dependencies  (passed into stream_chat)
    get_message_repo  ─┘
"""

from fastapi import Depends

from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository
from app.services.session_service import SessionService

__all__ = [
    "get_session_repo",
    "get_message_repo",
    "get_session_service",
    "get_chat_dependencies",
]


def get_session_repo() -> SessionRepository:
    """Provide a SessionRepository bound to the Firestore client."""
    return SessionRepository()


def get_message_repo() -> MessageRepository:
    """Provide a MessageRepository bound to the Firestore client."""
    return MessageRepository()


def get_session_service(
    session_repo: SessionRepository = Depends(get_session_repo),
    message_repo: MessageRepository = Depends(get_message_repo),
) -> SessionService:
    """Provide a SessionService with its repository dependencies injected."""
    return SessionService(session_repo=session_repo, message_repo=message_repo)


def get_chat_dependencies(
    session_repo: SessionRepository = Depends(get_session_repo),
    message_repo: MessageRepository = Depends(get_message_repo),
) -> tuple[SessionRepository, MessageRepository]:
    """Provide the two repositories required by chat_service.stream_chat."""
    return session_repo, message_repo
