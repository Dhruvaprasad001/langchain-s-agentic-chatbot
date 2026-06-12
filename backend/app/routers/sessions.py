from fastapi import APIRouter, Depends, status

from app.auth import get_current_user
from app.models import SessionCreate, SessionResponse, MessageResponse
from app.services.firestore import FirestoreService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_firestore() -> FirestoreService:
    return FirestoreService()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    current_user: dict = Depends(get_current_user),
    db: FirestoreService = Depends(get_firestore),
):
    session = db.create_session(uid=current_user["uid"], title=body.title)
    return SessionResponse(
        session_id=session["session_id"],
        title=session["title"],
        created_at=session["created_at"],
        updated_at=session["updated_at"],
    )


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: FirestoreService = Depends(get_firestore),
):
    sessions = db.list_sessions(uid=current_user["uid"])
    return [
        SessionResponse(
            session_id=s["session_id"],
            title=s["title"],
            created_at=s["created_at"],
            updated_at=s["updated_at"],
        )
        for s in sessions
    ]


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: FirestoreService = Depends(get_firestore),
):
    session = db.get_session(uid=current_user["uid"], session_id=session_id)
    messages = db.get_messages(uid=current_user["uid"], session_id=session_id)
    return {
        "session": SessionResponse(
            session_id=session["session_id"],
            title=session["title"],
            created_at=session["created_at"],
            updated_at=session["updated_at"],
        ),
        "messages": [
            MessageResponse(
                message_id=m["message_id"],
                role=m["role"],
                content=m["content"],
                timestamp=m["timestamp"],
            )
            for m in messages
        ],
    }


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: FirestoreService = Depends(get_firestore),
):
    db.delete_session(uid=current_user["uid"], session_id=session_id)
