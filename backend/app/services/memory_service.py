import json
import logging
import uuid
from datetime import datetime, timezone
from typing import ClassVar

import chromadb
from firebase_admin import firestore
from langchain_openai import OpenAIEmbeddings

from app.core.config import settings

logger = logging.getLogger(__name__)


class MemoryService:
    """
    Per-user vector memory backed by a persistent Chroma collection.

    Each user gets their own Chroma collection namespaced by uid.
    Memories are also written to Firestore for durability and auditability.

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
        # Chroma collection names must be 3-63 chars, alphanumeric + hyphens/underscores.
        # Truncate uid to keep the name within limits.
        safe_uid = user_id.replace(".", "_").replace("@", "_")[:40]
        return f"{settings.memory_collection_prefix}_{safe_uid}"

    @classmethod
    def _get_collection(cls, user_id: str) -> chromadb.Collection:
        return cls._chroma_client.get_or_create_collection(
            name=cls._collection_name(user_id),
            metadata={"hnsw:space": "cosine"},
        )

    # ── Public interface ──────────────────────────────────────────────────────

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
                    "You extract memorable facts from conversations. "
                    "Return ONLY a valid JSON array of strings — each string is one fact worth remembering. "
                    "Focus on: user preferences, their projects, their stack, their goals, workflows they mention. "
                    "If nothing is worth remembering return an empty array []. "
                    "Max 3 facts per conversation turn."
                )},
                {"role": "user", "content": (
                    f"User said: {user_message}\nAssistant said: {assistant_response}"
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

        collection = cls._get_collection(user_id)
        db = firestore.client()
        now = datetime.now(timezone.utc)

        for fact in facts:
            try:
                embedding = await cls._embeddings.aembed_query(fact)
                memory_id = str(uuid.uuid4())
                metadata = {
                    "user_id": user_id,
                    "timestamp": now.isoformat(),
                    "source": "conversation",
                }

                # store in Chroma
                collection.add(
                    ids=[memory_id],
                    embeddings=[embedding],
                    documents=[fact],
                    metadatas=[metadata],
                )

                # mirror to Firestore for durability
                db.collection("users").document(user_id).collection("memory").document(
                    memory_id
                ).set({"content": fact, **metadata})

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
            collection = cls._get_collection(user_id)
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
