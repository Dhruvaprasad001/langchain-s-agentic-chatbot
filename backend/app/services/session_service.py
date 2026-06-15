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
        return self._sessions.create(uid=uid, title=title)

    def list_sessions_paginated(self, uid: str, page: int, limit: int) -> tuple[list[Session], int]:
        return self._sessions.list_paginated(uid=uid, page=page, limit=limit)

    def get_session_with_messages(self, uid: str, session_id: str) -> tuple[Session, list[Message]]:
        session = self._sessions.get(uid=uid, session_id=session_id)
        messages = self._messages.list_asc(uid=uid, session_id=session_id)
        return session, messages

    def get_session_with_messages_paginated(
        self, uid: str, session_id: str, page: int, limit: int
    ) -> tuple[Session, list[Message], int]:
        session = self._sessions.get(uid=uid, session_id=session_id)
        messages, total = self._messages.list_paginated(
            uid=uid, session_id=session_id, page=page, limit=limit
        )
        return session, messages, total

    def update_session_title(self, uid: str, session_id: str, title: str) -> None:
        # confirm ownership before mutating
        self._sessions.get(uid=uid, session_id=session_id)
        self._sessions.update_title(uid=uid, session_id=session_id, title=title)
        logger.info("Title updated session_id=%s uid=%s title=%r", session_id, uid, title)

    def delete_session(self, uid: str, session_id: str) -> None:
        # confirm ownership before any destructive operation
        self._sessions.get(uid=uid, session_id=session_id)
        # remove all messages in the subcollection first (Firestore doesn't cascade)
        self._messages.delete_all(uid=uid, session_id=session_id)
        self._sessions.delete(uid=uid, session_id=session_id)
        logger.info("Session deleted session_id=%s uid=%s", session_id, uid)
