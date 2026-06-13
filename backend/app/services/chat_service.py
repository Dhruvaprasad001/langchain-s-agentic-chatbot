import logging
import os
from datetime import datetime
from typing import Annotated, Awaitable, Callable, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from app.exceptions import ChatStreamError
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository

logger = logging.getLogger(__name__)


# ── Agent prompt ──────────────────────────────────────────────────────────────

def _load_agent_files() -> str:
    base = os.path.join(os.path.dirname(__file__), "../agent")
    soul = open(os.path.join(base, "soul.md")).read()
    agent = open(os.path.join(base, "agent.md")).read()
    return f"{soul}\n\n{agent}"


AGENT_SYSTEM_PROMPT = _load_agent_files()


# ── LLM factory ───────────────────────────────────────────────────────────────

def _make_llm(streaming: bool = False) -> ChatOpenAI:
    return ChatOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY", ""),
        model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        streaming=streaming,
    )


# ── State ─────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    session_id: str
    route: str


# ── Nodes ─────────────────────────────────────────────────────────────────────

def router_node(state: AgentState) -> AgentState:
    """Classify the last user message as 'conversational' or 'analytical'."""
    last_content = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            last_content = msg.content
            break

    try:
        llm = _make_llm(streaming=False)
        result = llm.invoke([
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


def llm_node(state: AgentState) -> AgentState:
    """Generate a streaming response to the full conversation."""
    llm = _make_llm(streaming=True)
    system = f"{AGENT_SYSTEM_PROMPT}\n\nCurrent date: {datetime.now().strftime('%B %d, %Y')}"
    prompt = ChatPromptTemplate.from_messages([
        ("system", system),
        MessagesPlaceholder(variable_name="messages"),
    ])
    chain = prompt | llm
    response = chain.invoke({"messages": state["messages"]})
    return {**state, "messages": [response]}


def analytical_node(state: AgentState) -> AgentState:
    """Placeholder — analytical path to be implemented."""
    logger.info(
        "Analytical node reached (stub) session_id=%s uid=%s",
        state["session_id"], state["user_id"],
    )
    return {**state, "messages": [AIMessage(content="Analytical path coming soon.")]}


# ── Graph ─────────────────────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("router", router_node)
    graph.add_node("llm_node", llm_node)
    graph.add_node("analytical_node", analytical_node)
    graph.add_edge(START, "router")
    graph.add_conditional_edges(
        "router",
        lambda state: state["route"],
        {"conversational": "llm_node", "analytical": "analytical_node"},
    )
    graph.add_edge("llm_node", END)
    graph.add_edge("analytical_node", END)
    return graph


_graph = _build_graph().compile()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_lc_messages(history: list[dict]) -> list[BaseMessage]:
    result: list[BaseMessage] = []
    for m in history:
        if m["role"] == "user":
            result.append(HumanMessage(content=m["content"]))
        else:
            result.append(AIMessage(content=m["content"]))
    return result


# ── Public interface ──────────────────────────────────────────────────────────

async def stream_chat(
    uid: str,
    session_id: str,
    user_message: str,
    model: str,
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
    session_repo = SessionRepository()
    message_repo = MessageRepository()

    # verify session ownership before any LLM work
    session_repo.get(uid=uid, session_id=session_id)
    logger.info("Session verified session_id=%s uid=%s", session_id, uid)

    # load conversation history
    history_objs = message_repo.list_asc(uid=uid, session_id=session_id)
    history = [{"role": m.role, "content": m.content} for m in history_objs]
    logger.info("History loaded: %d message(s) session_id=%s uid=%s", len(history), session_id, uid)

    # persist user turn before streaming
    message_repo.add(uid=uid, session_id=session_id, role="user", content=user_message)
    logger.info("User message persisted session_id=%s uid=%s", session_id, uid)

    # build LangGraph initial state
    messages = _to_lc_messages(history)
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
        async for event in _graph.astream_events(initial_state, version="v2"):
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
        message_repo.add(uid=uid, session_id=session_id, role="assistant", content=accumulated)
        logger.info("Assistant message persisted session_id=%s uid=%s", session_id, uid)

    await on_done(accumulated)
