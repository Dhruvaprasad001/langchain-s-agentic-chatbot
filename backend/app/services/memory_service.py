import json
import logging
import uuid
from datetime import datetime, timezone
from typing import ClassVar

import chromadb
from langchain_openai import OpenAIEmbeddings

from app.core.config import settings
from app.repositories.memory_repository import MemoryRepository

logger = logging.getLogger(__name__)

_memory_repo = MemoryRepository()


class MemoryService:
    """
    Per-user vector memory backed by a persistent Chroma collection.

    Each user gets their own Chroma collection namespaced by uid.
    Memories are also written to Firestore (via MemoryRepository) for durability.

    All public methods swallow exceptions — memory failures must never break chat.
    """

    # Shared singletons — built once at class definition time.
    _embeddings: ClassVar[OpenAIEmbeddings] = OpenAIEmbeddings(
        api_key=settings.openai_api_key,
        model="text-embedding-3-small",
    )
    _chroma_client: ClassVar[chromadb.PersistentClient] = chromadb.PersistentClient(
        path=settings.chroma_persist_directory,
    )
    # Non-streaming LLM used only for fact extraction.
    _extraction_llm: ClassVar = None  # assigned after ChatOpenAI is importable

    # ── Internal helpers ──────────────────────────────────────────────────────

    @classmethod
    def _collection_name(cls, user_id: str) -> str:
        safe_uid = user_id.replace(".", "_").replace("@", "_")[:40]
        return f"{settings.memory_collection_prefix}_{safe_uid}"

    @classmethod
    def _get_chroma_collection(cls, user_id: str) -> chromadb.Collection:
        return cls._chroma_client.get_or_create_collection(
            name=cls._collection_name(user_id),
            metadata={"hnsw:space": "cosine"},
        )

    # ── Public interface ──────────────────────────────────────────────────────

    @classmethod
    async def list_all(cls, user_id: str) -> list[dict]:
        """
        Return all stored memory facts for a user, newest first.
        Never raises — returns empty list on any error.
        """
        try:
            return _memory_repo.list_all(user_id)
        except Exception as exc:
            logger.warning("[MEMORY] list_all failed for uid=%s: %s", user_id, exc)
            return []

    @classmethod
    async def extract_and_store(
        cls,
        user_id: str,
        user_message: str,
        assistant_response: str,
    ) -> None:
        """
        Extract memorable facts from one conversation turn and persist them.

        Never raises — any failure is logged as a warning and swallowed so that
        memory never breaks the chat response.
        """
        try:
            # lazy import to avoid circular deps at module load time
            from langchain_openai import ChatOpenAI  # noqa: PLC0415
            if cls._extraction_llm is None:
                cls._extraction_llm = ChatOpenAI(
                    api_key=settings.openai_api_key,
                    model=settings.openai_model,
                    streaming=False,
                )

            result = cls._extraction_llm.invoke([
                {"role": "system", "content": (
                    "You extract memorable facts about the user from what THEY said. "
                    "Return ONLY a valid JSON array of strings — each string is one fact worth remembering. "
                    "Rules:\n"
                    "- Only extract facts the USER explicitly stated about themselves.\n"
                    "- NEVER extract anything from the assistant's reply.\n"
                    "- NEVER infer or assume facts the user did not directly express.\n"
                    "- Focus on: their preferences, projects, tech stack, goals, and workflows.\n"
                    "- If the user's message contains nothing personal or memorable, return [].\n"
                    "- Max 3 facts per turn."
                )},
                {"role": "user", "content": (
                    f"User said: {user_message}\n\n"
                    f"[Assistant reply — for context only, do NOT extract facts from this]\n{assistant_response}"
                )},
            ])

            facts: list[str] = json.loads(result.content.strip())
            if not isinstance(facts, list):
                facts = []

        except Exception as exc:
            logger.warning("[MEMORY] fact extraction failed for uid=%s: %s", user_id, exc)
            return

        if not facts:
            logger.debug("[MEMORY] no facts extracted uid=%s", user_id)
            return

        chroma_col = cls._get_chroma_collection(user_id)
        now = datetime.now(timezone.utc).isoformat()

        for fact in facts:
            try:
                embedding = await cls._embeddings.aembed_query(fact)
                memory_id = str(uuid.uuid4())

                chroma_col.add(
                    ids=[memory_id],
                    embeddings=[embedding],
                    documents=[fact],
                    metadatas={"user_id": user_id, "timestamp": now, "source": "conversation"},
                )

                _memory_repo.save(
                    user_id=user_id,
                    memory_id=memory_id,
                    content=fact,
                    timestamp=now,
                )

            except Exception as exc:
                logger.warning(
                    "[MEMORY] failed to store fact for uid=%s: %s — fact=%r",
                    user_id, exc, fact,
                )

        logger.info("SKILL: [memory_store] stored %d fact(s) uid=%s", len(facts), user_id)

    @classmethod
    async def retrieve_relevant(
        cls,
        user_id: str,
        query: str,
        k: int | None = None,
    ) -> list[str]:
        """
        Return up to k memories most relevant to the current query.

        Returns an empty list if the user has no memories yet or on any error.
        Never raises.
        """
        k = k if k is not None else settings.max_memories_injected
        try:
            collection = cls._get_chroma_collection(user_id)
            count = collection.count()
            if count == 0:
                return []

            query_embedding = await cls._embeddings.aembed_query(query)
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, count),
            )
            documents: list[str] = results.get("documents", [[]])[0]
            logger.info(
                "SKILL: [memory_retrieve] retrieved %d fact(s) uid=%s",
                len(documents), user_id,
            )
            return documents

        except Exception as exc:
            logger.warning("[MEMORY] retrieval failed for uid=%s: %s", user_id, exc)
            return []
