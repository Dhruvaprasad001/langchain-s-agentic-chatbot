import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.schemas import ChatRequest
from app.auth import get_current_user
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository
from app.services.chat_service import stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{session_id}")
async def chat(
    session_id: str,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    session_repo = SessionRepository()
    message_repo = MessageRepository()

    # verify ownership and load history before opening the stream
    session_repo.get(uid=uid, session_id=session_id)
    history_objs = message_repo.list_asc(uid=uid, session_id=session_id)
    history = [{"role": m.role, "content": m.content} for m in history_objs]

    # persist the user turn immediately
    message_repo.add(uid=uid, session_id=session_id, role="user", content=body.message)

    async def event_stream() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def on_chunk(delta: str) -> None:
            await queue.put(delta)

        async def on_done(full_response: str) -> None:
            if full_response:
                message_repo.add(
                    uid=uid,
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                )
            await queue.put(None)  # sentinel signals stream end

        graph_task = asyncio.create_task(
            stream_chat(
                user_id=uid,
                session_id=session_id,
                user_message=body.message,
                history=history,
                on_chunk=on_chunk,
                on_done=on_done,
            )
        )

        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {json.dumps({'content': item})}\n\n"

        await graph_task  # propagate any exceptions from the graph
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
