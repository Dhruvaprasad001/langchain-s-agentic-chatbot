import logging
from datetime import datetime, timezone

from firebase_admin import firestore
from google.api_core.exceptions import GoogleAPICallError

from app.exceptions import RepositoryError

logger = logging.getLogger(__name__)


class MemoryRepository:
    def __init__(self) -> None:
        self._db = firestore.client()

    def _col(self, user_id: str):
        return (
            self._db.collection("users")
            .document(user_id)
            .collection("memory")
        )

    def save(self, user_id: str, memory_id: str, content: str, timestamp: str) -> None:
        try:
            self._col(user_id).document(memory_id).set({
                "content": content,
                "user_id": user_id,
                "timestamp": timestamp,
                "source": "conversation",
            })
            logger.debug("Saved memory memory_id=%s uid=%s", memory_id, user_id)
        except GoogleAPICallError as exc:
            logger.error("Firestore error saving memory uid=%s: %s", user_id, exc)
            raise RepositoryError(f"Failed to save memory: {exc}") from exc

    def list_all(self, user_id: str) -> list[dict]:
        try:
            docs = (
                self._col(user_id)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .stream()
            )
            result = []
            for doc in docs:
                ts = doc.get("timestamp")
                ts_str = ts if isinstance(ts, str) else (ts.isoformat() if ts else None)
                result.append({
                    "id": doc.id,
                    "content": doc.get("content"),
                    "timestamp": ts_str,
                })
            logger.debug("Listed %d memory fact(s) uid=%s", len(result), user_id)
            return result
        except GoogleAPICallError as exc:
            logger.error("Firestore error listing memory uid=%s: %s", user_id, exc)
            raise RepositoryError(f"Failed to list memory: {exc}") from exc
