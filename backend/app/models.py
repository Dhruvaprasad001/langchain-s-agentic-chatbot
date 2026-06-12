from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class SessionCreate(BaseModel):
    title: str


class SessionResponse(BaseModel):
    session_id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class MessageResponse(BaseModel):
    message_id: str
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime


class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "anthropic/claude-sonnet-4-6"
