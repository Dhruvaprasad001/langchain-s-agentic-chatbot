import asyncio
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.schemas import ChatRequest
from app.auth import get_current_user
from app.exceptions import ChatStreamError, SessionNotFoundError
from app.services import chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{session_id}")
async def chat(
    session_id: str,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    logger.info("POST /chat/%s uid=%s model=%s", session_id, uid, body.model)

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def on_chunk(delta: str) -> None:
        await queue.put(json.dumps({"content": delta}))

    async def on_done(_full_response: str) -> None:
        await queue.put(None)

    async def sse_generator():
        graph_task = asyncio.create_task(
            chat_service.stream_chat(
                uid=uid,
                session_id=session_id,
                user_message=body.message,
                model=body.model,
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

        # re-raise any exceptions that occurred in graph_task so they surface as
        # SSE error events if the queue consumer hasn't already handled them
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
