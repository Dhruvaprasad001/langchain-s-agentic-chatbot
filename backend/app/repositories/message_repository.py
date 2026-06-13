import logging
from datetime import datetime, timezone
from typing import Literal

from firebase_admin import firestore
from google.api_core.exceptions import GoogleAPICallError

from app.domain.models import Message
from app.exceptions import RepositoryError

logger = logging.getLogger(__name__)


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
        try:
            ref = self._col(uid, session_id).document()
            ref.set(data)
            logger.info(
                "Persisted %s message message_id=%s session_id=%s uid=%s",
                role, ref.id, session_id, uid,
            )
            return Message(message_id=ref.id, role=role, content=content, timestamp=now)
        except GoogleAPICallError as exc:
            logger.error(
                "Firestore error adding message session_id=%s uid=%s role=%s: %s",
                session_id, uid, role, exc,
            )
            raise RepositoryError(f"Failed to persist message: {exc}") from exc

    def list_asc(self, uid: str, session_id: str) -> list[Message]:
        try:
            docs = (
                self._col(uid, session_id)
                .order_by("timestamp", direction=firestore.Query.ASCENDING)
                .stream()
            )
            messages = [self._to_domain(doc) for doc in docs]
            logger.info(
                "Loaded %d message(s) session_id=%s uid=%s",
                len(messages), session_id, uid,
            )
            return messages
        except GoogleAPICallError as exc:
            logger.error(
                "Firestore error listing messages session_id=%s uid=%s: %s",
                session_id, uid, exc,
            )
            raise RepositoryError(f"Failed to list messages: {exc}") from exc

    def delete_all(self, uid: str, session_id: str) -> None:
        try:
            docs = list(self._col(uid, session_id).stream())
            for doc in docs:
                doc.reference.delete()
            logger.info(
                "Deleted %d message(s) session_id=%s uid=%s",
                len(docs), session_id, uid,
            )
        except GoogleAPICallError as exc:
            logger.error(
                "Firestore error deleting messages session_id=%s uid=%s: %s",
                session_id, uid, exc,
            )
            raise RepositoryError(f"Failed to delete messages: {exc}") from exc

    @staticmethod
    def _to_domain(doc) -> Message:
        data = doc.to_dict()
        return Message(
            message_id=doc.id,
            role=data["role"],
            content=data["content"],
            timestamp=data["timestamp"],
        )
