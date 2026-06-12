from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.schemas import ChatRequest
from app.auth import get_current_user
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


def get_chat_service() -> ChatService:
    return ChatService()


@router.post("/{session_id}")
async def chat(
    session_id: str,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    svc: ChatService = Depends(get_chat_service),
):
    model = body.model or "anthropic/claude-sonnet-4-6"

    async def event_stream() -> AsyncGenerator[str, None]:
        stream = await svc.stream_reply(
            uid=current_user["uid"],
            session_id=session_id,
            user_text=body.message,
            model=model,
        )
        async for chunk in stream:
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
