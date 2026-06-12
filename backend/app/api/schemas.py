from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.domain.models import Message, Session


# ── Request schemas ───────────────────────────────────────────────────────────

class SessionCreateRequest(BaseModel):
    title: str


class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "anthropic/claude-sonnet-4-6"


# ── Response schemas ──────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    session_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, session: Session) -> "SessionResponse":
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
    def from_domain(cls, message: Message) -> "MessageResponse":
        return cls(
            message_id=message.message_id,
            role=message.role,
            content=message.content,
            timestamp=message.timestamp,
        )


class SessionDetailResponse(BaseModel):
    session: SessionResponse
    messages: list[MessageResponse]
