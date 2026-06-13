import asyncio
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.schemas import ChatRequest
from app.auth import get_current_user
from app.dependencies import get_chat_service
from app.exceptions import ChatStreamError, SessionNotFoundError
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{session_id}")
async def chat(
    session_id: str,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    svc: ChatService = Depends(get_chat_service),
):
    uid = current_user["uid"]
    logger.info("POST /chat/%s uid=%s", session_id, uid)

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def on_chunk(delta: str) -> None:
        await queue.put(json.dumps({"content": delta}))

    async def on_done(_full_response: str) -> None:
        await queue.put(None)

    async def sse_generator():
        graph_task = asyncio.create_task(
            svc.stream_chat(
                uid=uid,
                session_id=session_id,
                user_message=body.message,
                on_chunk=on_chunk,
                on_done=on_done,
            )
        )

        logger.info("SSE stream started session_id=%s uid=%s", session_id, uid)

        try:
            while True:
                item = await queue.get()
                if item is None:
                    # drain any exception from the task before finishing
                    await graph_task
                    break
                yield f"data: {item}\n\n"
        except SessionNotFoundError as exc:
            logger.warning("Chat session not found session_id=%s uid=%s: %s", session_id, uid, exc)
            yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
            graph_task.cancel()
        except ChatStreamError as exc:
            logger.error("Chat stream error session_id=%s uid=%s: %s", session_id, uid, exc)
            yield f"data: {json.dumps({'error': 'Stream failed, please retry'})}\n\n"
            graph_task.cancel()
        except Exception as exc:
            logger.error(
                "Unexpected SSE error session_id=%s uid=%s: %s", session_id, uid, exc, exc_info=True,
            )
            yield f"data: {json.dumps({'error': 'Internal server error'})}\n\n"
            graph_task.cancel()

        # surface any exception raised inside graph_task that wasn't caught above
        if not graph_task.done():
            graph_task.cancel()
        elif not graph_task.cancelled():
            exc = graph_task.exception()
            if exc is not None:
                if isinstance(exc, SessionNotFoundError):
                    yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                elif isinstance(exc, ChatStreamError):
                    yield f"data: {json.dumps({'error': 'Stream failed, please retry'})}\n\n"
                else:
                    logger.error(
                        "graph_task raised unexpected exc session_id=%s uid=%s: %s",
                        session_id, uid, exc, exc_info=True,
                    )
                    yield f"data: {json.dumps({'error': 'Internal server error'})}\n\n"

        yield "data: [DONE]\n\n"
        logger.info("SSE stream completed session_id=%s uid=%s", session_id, uid)

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
