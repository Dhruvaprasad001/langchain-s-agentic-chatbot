from app.domain.models import Message, Session
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository


class SessionService:
    def __init__(self) -> None:
        self._sessions = SessionRepository()
        self._messages = MessageRepository()

    def create_session(self, uid: str, title: str) -> Session:
        # persist a new session owned by this user
        return self._sessions.create(uid=uid, title=title)

    def list_sessions(self, uid: str) -> list[Session]:
        # return all sessions belonging to this user, newest first
        return self._sessions.list_all(uid=uid)

    def get_session_with_messages(self, uid: str, session_id: str) -> tuple[Session, list[Message]]:
        # verify the session exists and belongs to this user
        session = self._sessions.get(uid=uid, session_id=session_id)
        # load the full message history ordered chronologically
        messages = self._messages.list_asc(uid=uid, session_id=session_id)
        return session, messages

    def delete_session(self, uid: str, session_id: str) -> None:
        # confirm ownership before any destructive operation
        self._sessions.get(uid=uid, session_id=session_id)
        # remove all messages in the subcollection first (Firestore doesn't cascade)
        self._messages.delete_all(uid=uid, session_id=session_id)
        # remove the session document itself
        self._sessions.delete(uid=uid, session_id=session_id)
