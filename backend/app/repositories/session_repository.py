import logging
from datetime import datetime, timezone

from firebase_admin import firestore
from google.api_core.exceptions import GoogleAPICallError

from app.domain.models import Session
from app.exceptions import RepositoryError, SessionNotFoundError

logger = logging.getLogger(__name__)


class SessionRepository:
    def __init__(self) -> None:
        self._db = firestore.client()

    def _col(self, uid: str):
        return self._db.collection("users").document(uid).collection("sessions")

    def _doc(self, uid: str, session_id: str):
        return self._col(uid).document(session_id)

    def create(self, uid: str, title: str) -> Session:
        now = datetime.now(timezone.utc)
        data = {"title": title, "uid": uid, "created_at": now, "updated_at": now}
        try:
            ref = self._col(uid).document()
            ref.set(data)
            logger.info("Created session session_id=%s uid=%s title=%r", ref.id, uid, title)
            return Session(session_id=ref.id, **data)
        except GoogleAPICallError as exc:
            logger.error("Firestore error creating session uid=%s: %s", uid, exc)
            raise RepositoryError(f"Failed to create session: {exc}") from exc

    def list_all(self, uid: str) -> list[Session]:
        try:
            docs = (
                self._col(uid)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .stream()
            )
            sessions = [self._to_domain(doc) for doc in docs]
            logger.info("Listed %d session(s) for uid=%s", len(sessions), uid)
            return sessions
        except GoogleAPICallError as exc:
            logger.error("Firestore error listing sessions uid=%s: %s", uid, exc)
            raise RepositoryError(f"Failed to list sessions: {exc}") from exc

    def get(self, uid: str, session_id: str) -> Session:
        try:
            doc = self._doc(uid, session_id).get()
        except GoogleAPICallError as exc:
            logger.error("Firestore error fetching session_id=%s uid=%s: %s", session_id, uid, exc)
            raise RepositoryError(f"Failed to fetch session: {exc}") from exc

        if not doc.exists:
            logger.warning("Session not found session_id=%s uid=%s", session_id, uid)
            raise SessionNotFoundError(f"Session {session_id} not found")

        data = doc.to_dict()
        if data.get("uid") != uid:
            logger.warning("Session ownership mismatch session_id=%s uid=%s", session_id, uid)
            raise SessionNotFoundError(f"Session {session_id} not found")

        logger.info("Fetched session session_id=%s uid=%s", session_id, uid)
        return self._to_domain(doc)

    def delete(self, uid: str, session_id: str) -> None:
        try:
            self._doc(uid, session_id).delete()
            logger.info("Deleted session session_id=%s uid=%s", session_id, uid)
        except GoogleAPICallError as exc:
            logger.error("Firestore error deleting session_id=%s uid=%s: %s", session_id, uid, exc)
            raise RepositoryError(f"Failed to delete session: {exc}") from exc

    def touch_updated_at(self, uid: str, session_id: str, timestamp: datetime) -> None:
        try:
            self._doc(uid, session_id).update({"updated_at": timestamp})
            logger.debug("Touched updated_at for session_id=%s uid=%s", session_id, uid)
        except GoogleAPICallError as exc:
            logger.error("Firestore error touching session_id=%s uid=%s: %s", session_id, uid, exc)
            raise RepositoryError(f"Failed to update session timestamp: {exc}") from exc

    @staticmethod
    def _to_domain(doc) -> Session:
        data = doc.to_dict()
        return Session(
            session_id=doc.id,
            uid=data["uid"],
            title=data["title"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )
