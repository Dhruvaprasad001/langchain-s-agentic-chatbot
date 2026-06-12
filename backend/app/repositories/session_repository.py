from datetime import datetime, timezone

from firebase_admin import firestore
from fastapi import HTTPException, status

from app.domain.models import Session


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
        ref = self._col(uid).document()
        ref.set(data)
        return Session(session_id=ref.id, **data)

    def list_all(self, uid: str) -> list[Session]:
        docs = (
            self._col(uid)
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .stream()
        )
        return [self._to_domain(doc) for doc in docs]

    def get(self, uid: str, session_id: str) -> Session:
        doc = self._doc(uid, session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        data = doc.to_dict()
        if data.get("uid") != uid:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        return self._to_domain(doc)

    def delete(self, uid: str, session_id: str) -> None:
        self._doc(uid, session_id).delete()

    def touch_updated_at(self, uid: str, session_id: str, timestamp: datetime) -> None:
        self._doc(uid, session_id).update({"updated_at": timestamp})

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
