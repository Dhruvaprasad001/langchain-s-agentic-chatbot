import logging
import os
from datetime import datetime
from typing import Annotated, Awaitable, Callable, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

logger = logging.getLogger(__name__)


def _load_agent_files() -> str:
    base = os.path.join(os.path.dirname(__file__), "../agent")
    soul = open(os.path.join(base, "soul.md")).read()
    agent = open(os.path.join(base, "agent.md")).read()
    return f"{soul}\n\n{agent}"


AGENT_SYSTEM_PROMPT = _load_agent_files()

# ── LLM ──────────────────────────────────────────────────────────────────────

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
            SystemMessage(content=(
                "Classify this message as exactly one word: "
                "'conversational' if it is casual chat, a question, or a simple request. "
                "'analytical' if it requires research, comparison, planning, or multi-step reasoning. "
                "Reply with only the word."
            )),
            HumanMessage(content=last_content),
        ])
        route = result.content.strip().lower()
        if route not in ("conversational", "analytical"):
            route = "conversational"
    except Exception as exc:
        logger.warning("Router classification failed (%s) — defaulting to conversational", exc)
        route = "conversational"

    logger.info("Router classified message as: %s", route)
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
    """Placeholder — analytical path will be implemented in hour 3."""
    logger.info("Analytical node reached — stub returning placeholder")
    placeholder = AIMessage(content="Analytical path coming soon.")
    return {**state, "messages": [placeholder]}


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
        {
            "conversational": "llm_node",
            "analytical": "analytical_node",
        },
    )
    graph.add_edge("llm_node", END)
    graph.add_edge("analytical_node", END)

    return graph


# Compiled once at import time — reused across all requests
_graph = _build_graph().compile()


# ── Public interface ──────────────────────────────────────────────────────────

def _to_lc_messages(history: list[dict]) -> list[BaseMessage]:
    """Convert [{"role": ..., "content": ...}] dicts to LangChain message objects."""
    result: list[BaseMessage] = []
    for m in history:
        if m["role"] == "user":
            result.append(HumanMessage(content=m["content"]))
        else:
            result.append(AIMessage(content=m["content"]))
    return result


async def stream_chat(
    user_id: str,
    session_id: str,
    user_message: str,
    history: list[dict],
    on_chunk: Callable[[str], Awaitable[None]],
    on_done: Callable[[str], Awaitable[None]],
) -> None:
    """
    Run the LangGraph agent and stream the LLM response token by token.

    - Converts history to LangChain messages.
    - Appends the new user message.
    - Streams via graph.astream_events() and calls on_chunk for each token.
    - Calls on_done with the fully assembled response string.
    """
    messages = _to_lc_messages(history)
    messages.append(HumanMessage(content=user_message))

    initial_state: AgentState = {
        "messages": messages,
        "user_id": user_id,
        "session_id": session_id,
        "route": "conversational",
    }

    accumulated = ""

    async for event in _graph.astream_events(initial_state, version="v2"):
        kind = event["event"]
        # Only stream tokens from the llm_node (not the router)
        if kind == "on_chat_model_stream" and event.get("metadata", {}).get("langgraph_node") == "llm_node":
            delta = event["data"]["chunk"].content
            if delta:
                accumulated += delta
                await on_chunk(delta)

    await on_done(accumulated)
