from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ── Request schemas ───────────────────────────────────────────────────────────

class SessionCreateRequest(BaseModel):
    title: str


class SessionUpdateRequest(BaseModel):
    title: str


class ChatRequest(BaseModel):
    message: str


# ── Response schemas ──────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    session_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, session) -> "SessionResponse":
        return cls(
            session_id=session.session_id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
        )


class MessageResponse(BaseModel):
    message_id: str
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime

    @classmethod
    def from_domain(cls, message) -> "MessageResponse":
        return cls(
            message_id=message.message_id,
            role=message.role,
            content=message.content,
            timestamp=message.timestamp,
        )


class PaginatedSessionsResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: list[SessionResponse]


class PaginatedMessagesResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: list[MessageResponse]
