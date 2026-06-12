import json
import os
from typing import AsyncGenerator

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.auth import get_current_user
from app.models import ChatRequest
from app.services.firestore import FirestoreService

load_dotenv()

router = APIRouter(prefix="/chat", tags=["chat"])

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def get_firestore() -> FirestoreService:
    return FirestoreService()


async def _stream_openrouter(
    messages: list[dict],
    model: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://chatbot-api",
        "X-Title": "Chatbot API",
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    full_content = ""

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[len("data: "):]
                if raw.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(raw)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        full_content += delta
                        yield json.dumps({"content": delta})
                except (KeyError, json.JSONDecodeError):
                    continue

    yield f"__FULL_CONTENT__:{full_content}"


@router.post("/{session_id}")
async def chat(
    session_id: str,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: FirestoreService = Depends(get_firestore),
):
    uid = current_user["uid"]

    db.get_session(uid=uid, session_id=session_id)

    history = db.get_messages(uid=uid, session_id=session_id)
    openrouter_messages = [{"role": m["role"], "content": m["content"]} for m in history]
    openrouter_messages.append({"role": "user", "content": body.message})

    db.add_message(uid=uid, session_id=session_id, role="user", content=body.message)

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = body.model or "anthropic/claude-sonnet-4-6"

    async def event_generator() -> AsyncGenerator[str, None]:
        accumulated = ""
        async for chunk in _stream_openrouter(openrouter_messages, model, api_key):
            if chunk.startswith("__FULL_CONTENT__:"):
                accumulated = chunk[len("__FULL_CONTENT__:"):]
            else:
                yield f"data: {chunk}\n\n"

        if accumulated:
            db.add_message(uid=uid, session_id=session_id, role="assistant", content=accumulated)

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
