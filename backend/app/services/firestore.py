from datetime import datetime, timezone
from typing import Any

from firebase_admin import firestore
from fastapi import HTTPException, status


class FirestoreService:
    def __init__(self) -> None:
        self._db = firestore.client()

    def _sessions_ref(self, uid: str):
        return self._db.collection("users").document(uid).collection("sessions")

    def _session_ref(self, uid: str, session_id: str):
        return self._sessions_ref(uid).document(session_id)

    def _messages_ref(self, uid: str, session_id: str):
        return self._session_ref(uid, session_id).collection("messages")

    def create_session(self, uid: str, title: str) -> dict:
        now = datetime.now(timezone.utc)
        data: dict[str, Any] = {
            "title": title,
            "uid": uid,
            "created_at": now,
            "updated_at": now,
        }
        doc_ref = self._sessions_ref(uid).document()
        doc_ref.set(data)
        return {"session_id": doc_ref.id, **data}

    def list_sessions(self, uid: str) -> list:
        docs = self._sessions_ref(uid).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
        sessions = []
        for doc in docs:
            d = doc.to_dict()
            sessions.append({"session_id": doc.id, **d})
        return sessions

    def get_session(self, uid: str, session_id: str) -> dict:
        doc = self._session_ref(uid, session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        data = doc.to_dict()
        if data.get("uid") != uid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        return {"session_id": doc.id, **data}

    def delete_session(self, uid: str, session_id: str) -> None:
        self.get_session(uid, session_id)
        messages = self._messages_ref(uid, session_id).stream()
        for msg in messages:
            msg.reference.delete()
        self._session_ref(uid, session_id).delete()

    def add_message(self, uid: str, session_id: str, role: str, content: str) -> dict:
        now = datetime.now(timezone.utc)
        data: dict[str, Any] = {
            "role": role,
            "content": content,
            "timestamp": now,
        }
        msg_ref = self._messages_ref(uid, session_id).document()
        msg_ref.set(data)
        self._session_ref(uid, session_id).update({"updated_at": now})
        return {"message_id": msg_ref.id, **data}

    def get_messages(self, uid: str, session_id: str) -> list:
        docs = (
            self._messages_ref(uid, session_id)
            .order_by("timestamp", direction=firestore.Query.ASCENDING)
            .stream()
        )
        return [{"message_id": doc.id, **doc.to_dict()} for doc in docs]
