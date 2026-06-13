import logging
import os
from datetime import datetime
from typing import Annotated, Awaitable, Callable, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from app.core.config import settings
from app.exceptions import ChatStreamError
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository

logger = logging.getLogger(__name__)


# ── Agent prompt ──────────────────────────────────────────────────────────────

def _load_agent_files() -> str:
    base = os.path.join(os.path.dirname(__file__), "../agent")
    with open(os.path.join(base, "soul.md")) as f:
        soul = f.read()
    with open(os.path.join(base, "agent.md")) as f:
        agent = f.read()
    return f"{soul}\n\n{agent}"


# ── LangGraph state ───────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    session_id: str
    route: str


# ── ChatService ───────────────────────────────────────────────────────────────

class ChatService:
    # System prompt is the same for every instance — load once at class definition time.
    _system_prompt: str = _load_agent_files()

    # Two LLM singletons shared across all instances and requests.
    # Created once at class definition so there is no per-request construction overhead.
    _router_llm: ChatOpenAI = ChatOpenAI(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        streaming=False,
    )
    _streaming_llm: ChatOpenAI = ChatOpenAI(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        streaming=True,
    )
    _graph = None  # compiled graph — built once in __init_subclass__ equivalent below

    def __init__(
        self,
        session_repo: SessionRepository,
        message_repo: MessageRepository,
    ) -> None:
        self._session_repo = session_repo
        self._message_repo = message_repo

    # ── Graph (built once at class level) ────────────────────────────────────

    @classmethod
    def _build_graph(cls):
        graph = StateGraph(AgentState)
        graph.add_node("router", cls._router_node)
        graph.add_node("llm_node", cls._llm_node)
        graph.add_node("analytical_node", cls._analytical_node)
        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            lambda state: state["route"],
            {"conversational": "llm_node", "analytical": "analytical_node"},
        )
        graph.add_edge("llm_node", END)
        graph.add_edge("analytical_node", END)
        return graph.compile()

    # ── Nodes ─────────────────────────────────────────────────────────────────

    @classmethod
    def _router_node(cls, state: AgentState) -> AgentState:
        """Classify the last user message as 'conversational' or 'analytical'."""
        last_content = ""
        for msg in reversed(state["messages"]):
            if isinstance(msg, HumanMessage):
                last_content = msg.content
                break

        try:
            result = cls._router_llm.invoke([
                {"role": "system", "content": (
                    "Classify this message as exactly one word: "
                    "'conversational' if it is casual chat, a question, or a simple request. "
                    "'analytical' if it requires research, comparison, planning, or multi-step reasoning. "
                    "Reply with only the word."
                )},
                {"role": "user", "content": last_content},
            ])
            route = result.content.strip().lower()
            if route not in ("conversational", "analytical"):
                route = "conversational"
        except Exception as exc:
            logger.warning("Router classification failed (%s) — defaulting to conversational", exc)
            route = "conversational"

        logger.info(
            "Router classified message as '%s' session_id=%s uid=%s",
            route, state["session_id"], state["user_id"],
        )
        return {**state, "route": route}

    @classmethod
    def _llm_node(cls, state: AgentState) -> AgentState:
        """Generate a streaming response to the full conversation."""
        system = f"{cls._system_prompt}\n\nCurrent date: {datetime.now().strftime('%B %d, %Y')}"
        prompt = ChatPromptTemplate.from_messages([
            ("system", system),
            MessagesPlaceholder(variable_name="messages"),
        ])
        chain = prompt | cls._streaming_llm
        response = chain.invoke({"messages": state["messages"]})
        return {**state, "messages": [response]}

    @classmethod
    def _analytical_node(cls, state: AgentState) -> AgentState:
        """Placeholder — analytical path to be implemented."""
        logger.info(
            "Analytical node reached (stub) session_id=%s uid=%s",
            state["session_id"], state["user_id"],
        )
        return {**state, "messages": [AIMessage(content="Analytical path coming soon.")]}

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _to_lc_messages(history: list[dict]) -> list[BaseMessage]:
        result: list[BaseMessage] = []
        for m in history:
            if m["role"] == "user":
                result.append(HumanMessage(content=m["content"]))
            else:
                result.append(AIMessage(content=m["content"]))
        return result

    # ── Public interface ──────────────────────────────────────────────────────

    async def stream_chat(
        self,
        uid: str,
        session_id: str,
        user_message: str,
        on_chunk: Callable[[str], Awaitable[None]],
        on_done: Callable[[str], Awaitable[None]],
    ) -> None:
        """
        Full chat orchestration: verify session, load history, persist user message,
        run LangGraph, stream tokens via on_chunk, persist assistant reply via on_done.

        Raises:
            SessionNotFoundError: if session does not exist or belong to uid.
            RepositoryError: if Firestore is unavailable.
            ChatStreamError: if the LLM graph fails during streaming.
        """
        # verify session ownership before any LLM work
        self._session_repo.get(uid=uid, session_id=session_id)
        logger.info("Session verified session_id=%s uid=%s", session_id, uid)

        # load conversation history
        history_objs = self._message_repo.list_asc(uid=uid, session_id=session_id)
        history = [{"role": m.role, "content": m.content} for m in history_objs]
        logger.info("History loaded: %d message(s) session_id=%s uid=%s", len(history), session_id, uid)

        # persist user turn before streaming
        self._message_repo.add(uid=uid, session_id=session_id, role="user", content=user_message)
        logger.info("User message persisted session_id=%s uid=%s", session_id, uid)

        # build LangGraph initial state
        messages = self._to_lc_messages(history)
        messages.append(HumanMessage(content=user_message))
        initial_state: AgentState = {
            "messages": messages,
            "user_id": uid,
            "session_id": session_id,
            "route": "conversational",
        }

        logger.info("Starting LangGraph stream session_id=%s uid=%s", session_id, uid)
        accumulated = ""

        try:
            async for event in self.__class__._graph.astream_events(initial_state, version="v2"):
                kind = event["event"]
                if (
                    kind == "on_chat_model_stream"
                    and event.get("metadata", {}).get("langgraph_node") == "llm_node"
                ):
                    delta = event["data"]["chunk"].content
                    if delta:
                        accumulated += delta
                        await on_chunk(delta)
        except Exception as exc:
            logger.error(
                "LangGraph stream failed session_id=%s uid=%s: %s",
                session_id, uid, exc, exc_info=True,
            )
            raise ChatStreamError(f"LLM stream failed: {exc}") from exc

        logger.info(
            "Stream complete: %d chars session_id=%s uid=%s",
            len(accumulated), session_id, uid,
        )

        # persist assembled assistant reply
        if accumulated:
            self._message_repo.add(uid=uid, session_id=session_id, role="assistant", content=accumulated)
            logger.info("Assistant message persisted session_id=%s uid=%s", session_id, uid)

        await on_done(accumulated)


# Build the graph once at module load time and attach it to the class.
ChatService._graph = ChatService._build_graph()
