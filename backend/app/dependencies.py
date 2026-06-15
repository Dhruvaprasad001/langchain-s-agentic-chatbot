"""
Shared dependency factories for API routes.

Dependency graph:

    get_session_repo  ─┐
                       ├─► get_session_service
    get_message_repo  ─┘

    get_session_repo  ─┐
                       ├─► get_chat_service
    get_message_repo  ─┘

    get_memory_service  ─►  (injected directly into api/chat)
"""

from fastapi import Depends

from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository
from app.services.chat_service import ChatService
from app.services.memory_service import MemoryService
from app.services.session_service import SessionService

__all__ = [
    "get_session_repo",
    "get_message_repo",
    "get_session_service",
    "get_chat_service",
    "get_memory_service",
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


def get_chat_service(
    session_repo: SessionRepository = Depends(get_session_repo),
    message_repo: MessageRepository = Depends(get_message_repo),
) -> ChatService:
    """Provide a ChatService with its repository dependencies injected."""
    return ChatService(session_repo=session_repo, message_repo=message_repo)


def get_memory_service() -> MemoryService:
    """Provide a MemoryService instance (stateless — Chroma client is a class-level singleton)."""
    return MemoryService()
