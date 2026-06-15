import logging

from app.domain.models import Message, Session
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(
        self,
        session_repo: SessionRepository,
        message_repo: MessageRepository,
    ) -> None:
        self._sessions = session_repo
        self._messages = message_repo

    def create_session(self, uid: str, title: str) -> Session:
        logger.info("Creating session uid=%s title=%r", uid, title)
        session = self._sessions.create(uid=uid, title=title)
        logger.info("Session created session_id=%s uid=%s", session.session_id, uid)
        return session

    def list_sessions(self, uid: str) -> list[Session]:
        logger.info("Listing sessions uid=%s", uid)
        sessions = self._sessions.list_all(uid=uid)
        logger.info("Returning %d session(s) uid=%s", len(sessions), uid)
        return sessions

    def get_session_with_messages(self, uid: str, session_id: str) -> tuple[Session, list[Message]]:
        logger.info("Fetching session_id=%s uid=%s", session_id, uid)
        # verify the session exists and belongs to this user
        session = self._sessions.get(uid=uid, session_id=session_id)
        # load the full message history ordered chronologically
        messages = self._messages.list_asc(uid=uid, session_id=session_id)
        logger.info(
            "Returning session session_id=%s with %d message(s) uid=%s",
            session_id, len(messages), uid,
        )
        return session, messages

    def update_session_title(self, uid: str, session_id: str, title: str) -> None:
        logger.info("Updating title session_id=%s uid=%s title=%r", session_id, uid, title)
        # confirm ownership before mutating
        self._sessions.get(uid=uid, session_id=session_id)
        # persist the new title
        self._sessions.update_title(uid=uid, session_id=session_id, title=title)
        logger.info("Title updated session_id=%s uid=%s", session_id, uid)

    def delete_session(self, uid: str, session_id: str) -> None:
        logger.info("Deleting session_id=%s uid=%s", session_id, uid)
        # confirm ownership before any destructive operation
        self._sessions.get(uid=uid, session_id=session_id)
        # remove all messages in the subcollection first (Firestore doesn't cascade)
        self._messages.delete_all(uid=uid, session_id=session_id)
        # remove the session document itself
        self._sessions.delete(uid=uid, session_id=session_id)
        logger.info("Session deleted session_id=%s uid=%s", session_id, uid)
