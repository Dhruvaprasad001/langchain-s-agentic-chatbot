import json
import os
from typing import AsyncGenerator

import httpx
from fastapi import HTTPException, status

from app.domain.models import Message
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class ChatService:
    def __init__(self) -> None:
        self._sessions = SessionRepository()
        self._messages = MessageRepository()

    async def stream_reply(
        self,
        uid: str,
        session_id: str,
        user_text: str,
        model: str,
    ) -> AsyncGenerator[str, None]:
        # confirm session ownership before doing any I/O
        self._sessions.get(uid=uid, session_id=session_id)
        # load prior conversation turns for context
        history = self._messages.list_asc(uid=uid, session_id=session_id)
        # persist the new user turn immediately
        self._messages.add(uid=uid, session_id=session_id, role="user", content=user_text)
        # build the payload OpenRouter expects
        openrouter_messages = self._build_openrouter_messages(history, user_text)
        # stream the LLM response and persist the completed assistant turn
        return self._generate_and_persist(uid, session_id, openrouter_messages, model)

    async def _generate_and_persist(
        self,
        uid: str,
        session_id: str,
        openrouter_messages: list[dict],
        model: str,
    ) -> AsyncGenerator[str, None]:
        api_key = self._get_api_key()
        accumulated = ""

        async for delta in self._call_openrouter(openrouter_messages, model, api_key):
            accumulated += delta
            yield json.dumps({"content": delta})

        if accumulated:
            # save the fully assembled assistant reply once streaming completes
            self._messages.add(uid=uid, session_id=session_id, role="assistant", content=accumulated)

    async def _call_openrouter(
        self,
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
        payload = {"model": model, "messages": messages, "stream": True}

        try:
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
                                yield delta
                        except (KeyError, json.JSONDecodeError):
                            continue
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenRouter returned {exc.response.status_code}",
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to reach OpenRouter",
            ) from exc

    @staticmethod
    def _build_openrouter_messages(history: list[Message], user_text: str) -> list[dict]:
        messages = [{"role": m.role, "content": m.content} for m in history]
        messages.append({"role": "user", "content": user_text})
        return messages

    @staticmethod
    def _get_api_key() -> str:
        key = os.getenv("OPENROUTER_API_KEY", "")
        if not key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OPENROUTER_API_KEY is not configured",
            )
        return key
