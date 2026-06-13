from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal


@dataclass
class Session:
    session_id: str
    uid: str
    title: str
    created_at: datetime
    updated_at: datetime


@dataclass
class Message:
    message_id: str
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime
