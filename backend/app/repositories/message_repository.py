from datetime import datetime, timezone
from typing import Literal

from firebase_admin import firestore

from app.domain.models import Message


class MessageRepository:
    def __init__(self) -> None:
        self._db = firestore.client()

    def _col(self, uid: str, session_id: str):
        return (
            self._db.collection("users")
            .document(uid)
            .collection("sessions")
            .document(session_id)
            .collection("messages")
        )

    def add(self, uid: str, session_id: str, role: Literal["user", "assistant"], content: str) -> Message:
        now = datetime.now(timezone.utc)
        data = {"role": role, "content": content, "timestamp": now}
        ref = self._col(uid, session_id).document()
        ref.set(data)
        return Message(message_id=ref.id, role=role, content=content, timestamp=now)

    def list_asc(self, uid: str, session_id: str) -> list[Message]:
        docs = (
            self._col(uid, session_id)
            .order_by("timestamp", direction=firestore.Query.ASCENDING)
            .stream()
        )
        return [self._to_domain(doc) for doc in docs]

    def delete_all(self, uid: str, session_id: str) -> None:
        for doc in self._col(uid, session_id).stream():
            doc.reference.delete()

    @staticmethod
    def _to_domain(doc) -> Message:
        data = doc.to_dict()
        return Message(
            message_id=doc.id,
            role=data["role"],
            content=data["content"],
            timestamp=data["timestamp"],
        )
