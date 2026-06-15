import asyncio
import json
import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Awaitable, Callable, ClassVar, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from app.agent.prompts import (
    EXECUTOR,
    PLANNER,
    ROUTER,
    STARTUP_CRITIQUE,
    SYNTHESIZER,
    WEB_SEARCH,
)
from app.core.config import settings
from app.exceptions import ChatStreamError
from app.repositories.message_repository import MessageRepository
from app.repositories.session_repository import SessionRepository

if TYPE_CHECKING:
    from app.services.memory_service import MemoryService

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
    plan: list[str]           # steps the planner creates
    step_results: list[str]   # output of each executed step
    original_message: str     # preserved for executor + synthesizer context
    memory_context: str       # injected before graph run; empty for new users


# ── ChatService ───────────────────────────────────────────────────────────────

class ChatService:
    # System prompt — loaded once at class definition time.
    _system_prompt: ClassVar[str] = _load_agent_files()

    # LLM singletons — built once, shared across all instances and requests.
    _router_llm: ClassVar[ChatOpenAI] = ChatOpenAI(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        streaming=False,
    )
    _streaming_llm: ClassVar[ChatOpenAI] = ChatOpenAI(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        streaming=True,
    )
    _analytical_llm: ClassVar[ChatOpenAI] = ChatOpenAI(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        streaming=False,  # planner and executor don't stream
    )

    _graph: ClassVar = None  # compiled graph — assigned at bottom of module

    def __init__(
        self,
        session_repo: SessionRepository,
        message_repo: MessageRepository,
    ) -> None:
        self._session_repo = session_repo
        self._message_repo = message_repo

    # ── Graph ─────────────────────────────────────────────────────────────────

    @classmethod
    def _build_graph(cls):
        graph = StateGraph(AgentState)

        graph.add_node("router", cls._router_node)
        graph.add_node("llm_node", cls._llm_node)
        graph.add_node("planner", cls._planner_node)
        graph.add_node("executor", cls._executor_node)
        graph.add_node("synthesizer", cls._synthesizer_node)
        graph.add_node("web_search_agent", cls._web_search_agent_node)
        graph.add_node("startup_critique_agent", cls._startup_critique_agent_node)

        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            lambda state: state["route"],
            {
                "conversational": "llm_node",
                "analytical": "planner",
                "web_search": "web_search_agent",
                "startup_critique": "startup_critique_agent",
            },
        )
        graph.add_edge("llm_node", END)
        graph.add_edge("planner", "executor")
        graph.add_edge("executor", "synthesizer")
        graph.add_edge("synthesizer", END)
        graph.add_edge("web_search_agent", END)
        graph.add_edge("startup_critique_agent", END)

        return graph.compile()

    # ── Conversational nodes (unchanged) ─────────────────────────────────────

    @classmethod
    def _router_node(cls, state: AgentState) -> AgentState:
        """Classify the last user message into one of four routes."""
        last_content = ""
        for msg in reversed(state["messages"]):
            if isinstance(msg, HumanMessage):
                last_content = msg.content
                break

        # Fast-path: explicit @web-search prefix — no LLM call needed
        if last_content.strip().startswith("@web-search"):
            logger.info("SKILL: [web_search] (explicit prefix) session_id=%s", state["session_id"])
            return {**state, "route": "web_search"}

        try:
            result = cls._router_llm.invoke([
                {"role": "system", "content": ROUTER},
                {"role": "user", "content": last_content},
            ])
            route = result.content.strip().lower()
            valid_routes = ("conversational", "analytical", "web_search", "startup_critique")
            if route not in valid_routes:
                route = "conversational"
        except Exception as exc:
            logger.warning("Router classification failed (%s) — defaulting to conversational", exc)
            route = "conversational"

        if route != "conversational":
            logger.info("SKILL: [%s] session_id=%s", route, state["session_id"])

        return {**state, "route": route}

    @classmethod
    def _llm_node(cls, state: AgentState) -> AgentState:
        """Generate a streaming response to the full conversation."""
        system = f"{cls._system_prompt}\n\nCurrent date: {datetime.now().strftime('%B %d, %Y')}"
        if state.get("memory_context"):
            system += state["memory_context"]
        prompt = ChatPromptTemplate.from_messages([
            ("system", system),
            MessagesPlaceholder(variable_name="messages"),
        ])
        chain = prompt | cls._streaming_llm
        response = chain.invoke({"messages": state["messages"]})
        return {**state, "messages": [response]}

    # ── Analytical nodes ──────────────────────────────────────────────────────

    @classmethod
    def _planner_node(cls, state: AgentState) -> AgentState:
        """Break the user request into 2-4 concrete execution steps."""
        original_message = state["messages"][-1].content

        try:
            result = cls._analytical_llm.invoke([
                {"role": "system", "content": PLANNER},
                {"role": "user", "content": original_message},
            ])
            plan: list[str] = json.loads(result.content.strip())
            if not isinstance(plan, list) or not plan:
                raise ValueError("Parsed plan is empty or not a list")
        except Exception as exc:
            logger.warning("[PLANNER] failed to parse plan (%s) — using fallback", exc)
            plan = ["Analyze the request", "Formulate response"]

        logger.debug("[PLANNER] %d steps session_id=%s", len(plan), state["session_id"])
        return {**state, "original_message": original_message, "plan": plan, "step_results": []}

    @classmethod
    def _executor_node(cls, state: AgentState) -> AgentState:
        """Execute each planned step sequentially and collect results."""
        plan = state["plan"]
        step_results: list[str] = list(state["step_results"])

        for i, step in enumerate(plan):
            result = cls._analytical_llm.invoke([
                {"role": "system", "content": EXECUTOR},
                {"role": "user", "content": (
                    f"Original request: {state['original_message']}\n"
                    f"Current step: {step}\n"
                    f"Results from previous steps: {'; '.join(step_results) or 'None yet'}"
                )},
            ])
            step_results.append(result.content)
            logger.debug("[EXECUTOR] step %d/%d done session_id=%s", i + 1, len(plan), state["session_id"])

        return {**state, "step_results": step_results}

    @classmethod
    def _synthesizer_node(cls, state: AgentState) -> AgentState:
        """Synthesize all step results into a single, natural final answer."""
        step_summary = "\n".join(
            f"{i + 1}. {r}" for i, r in enumerate(state["step_results"])
        )
        system = (
            f"You are a synthesis agent with the following personality:\n{cls._system_prompt}\n\n"
            + SYNTHESIZER.format(
                original_message=state["original_message"],
                step_summary=step_summary,
            )
        )
        if state.get("memory_context"):
            system += state["memory_context"]
        prompt = ChatPromptTemplate.from_messages([
            ("system", system),
            MessagesPlaceholder(variable_name="messages"),
        ])
        chain = prompt | cls._streaming_llm
        response = chain.invoke({"messages": state["messages"]})
        return {**state, "messages": [response]}

    # ── Sub-agents ────────────────────────────────────────────────────────────

    @classmethod
    def _web_search_agent_node(cls, state: AgentState) -> AgentState:
        """Strip @web-search prefix if present, run DuckDuckGo, synthesize with personality."""
        from langchain_community.tools import DuckDuckGoSearchRun  # lazy import

        raw = state["messages"][-1].content
        # strip the explicit prefix if the user typed it; otherwise use the message as-is
        query = raw.replace("@web-search", "").strip() or raw.strip()

        logger.info("[WEB_SEARCH] query=%r session_id=%s", query, state["session_id"])

        try:
            search = DuckDuckGoSearchRun()
            results = search.run(query)
        except Exception as exc:
            logger.warning("[WEB_SEARCH] DuckDuckGo failed (%s) — using empty results", exc)
            results = "No search results available."

        system = (
            f"{cls._system_prompt}\n\n"
            + WEB_SEARCH.format(
                query=query,
                results=results,
                date=datetime.now().strftime("%B %d, %Y"),
            )
        )
        if state.get("memory_context"):
            system += state["memory_context"]

        prompt = ChatPromptTemplate.from_messages([
            ("system", system),
            MessagesPlaceholder(variable_name="messages"),
        ])
        chain = prompt | cls._streaming_llm
        response = chain.invoke({"messages": state["messages"]})
        return {**state, "messages": [response]}

    @classmethod
    def _startup_critique_agent_node(cls, state: AgentState) -> AgentState:
        """Give a structured, honest startup critique using the agent's personality."""
        logger.debug("[STARTUP_CRITIQUE] session_id=%s", state["session_id"])

        system = (
            f"{cls._system_prompt}\n\n"
            + STARTUP_CRITIQUE.format(date=datetime.now().strftime("%B %d, %Y"))
        )
        if state.get("memory_context"):
            system += state["memory_context"]

        prompt = ChatPromptTemplate.from_messages([
            ("system", system),
            MessagesPlaceholder(variable_name="messages"),
        ])
        chain = prompt | cls._streaming_llm
        response = chain.invoke({"messages": state["messages"]})
        return {**state, "messages": [response]}

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

    # ── Public interface ──────────────────────────────────────────────────────

    async def _maybe_set_title_from_first_message(
        self, uid: str, session_id: str, user_message: str
    ) -> None:
        """Fire-and-forget: set a meaningful title the first time a user sends a message."""
        try:
            session = self._session_repo.get(uid=uid, session_id=session_id)
            if session.title != "New conversation":
                return
            title = self._derive_title(user_message)
            self._session_repo.update_title(uid=uid, session_id=session_id, title=title)
            logger.info("Auto-titled session_id=%s uid=%s title=%r", session_id, uid, title)
        except Exception as exc:
            logger.warning("Auto-title failed session_id=%s uid=%s: %s", session_id, uid, exc)

    @staticmethod
    def _derive_title(text: str, max_chars: int = 50) -> str:
        """Truncate text to max_chars at a word boundary and append ellipsis if needed."""
        text = text.strip()
        if len(text) <= max_chars:
            return text
        truncated = text[:max_chars].rsplit(" ", 1)[0]
        return truncated + "…"

    async def stream_chat(
        self,
        uid: str,
        session_id: str,
        user_message: str,
        on_chunk: Callable[[str], Awaitable[None]],
        on_done: Callable[[str], Awaitable[None]],
        on_plan_step: Callable[[str], Awaitable[None]] | None = None,
        on_thinking: Callable[[str, str], Awaitable[None]] | None = None,
        memory_service: "MemoryService | None" = None,
    ) -> None:
        """
        Full chat orchestration: verify session, load history, persist user message,
        run LangGraph, stream tokens via on_chunk, persist assistant reply via on_done.

        on_chunk        — plain text token deltas
        on_plan_step    — each plan step string once the planner finishes
        on_thinking     — (step_label, status) "start" or "done" from the executor
        on_done         — called with the full accumulated response when streaming ends
        memory_service  — injected by the API layer; if provided, memories are
                          retrieved before the graph runs and new facts are extracted
                          after streaming completes (fire-and-forget, non-blocking)

        Raises:
            SessionNotFoundError: if session does not exist or belong to uid.
            RepositoryError: if Firestore is unavailable.
            ChatStreamError: if the LLM graph fails during streaming.
        """
        # verify session ownership before any LLM work
        self._session_repo.get(uid=uid, session_id=session_id)

        # load conversation history
        history_objs = self._message_repo.list_asc(uid=uid, session_id=session_id)
        history = [{"role": m.role, "content": m.content} for m in history_objs]

        # persist user turn before streaming
        self._message_repo.add(uid=uid, session_id=session_id, role="user", content=user_message)

        # auto-title the session from the first user message if it still has the default name
        asyncio.create_task(
            self._maybe_set_title_from_first_message(uid, session_id, user_message)
        )

        # retrieve relevant memories and build context string
        memory_context = ""
        if memory_service is not None:
            memories = await memory_service.retrieve_relevant(uid, user_message)
            if memories:
                memory_context = "\n\nWhat you know about this user:\n" + "\n".join(
                    f"- {m}" for m in memories
                )
                logger.debug("[MEMORY] injected %d fact(s) session_id=%s", len(memories), session_id)

        # build LangGraph initial state
        messages = self._to_lc_messages(history)
        messages.append(HumanMessage(content=user_message))
        initial_state: AgentState = {
            "messages": messages,
            "user_id": uid,
            "session_id": session_id,
            "route": "conversational",
            "plan": [],
            "step_results": [],
            "original_message": "",
            "memory_context": memory_context,
        }

        logger.info("Chat started session_id=%s uid=%s", session_id, uid)
        accumulated = ""

        try:
            async for event in self.__class__._graph.astream_events(initial_state, version="v2"):
                kind = event["event"]
                node = event.get("metadata", {}).get("langgraph_node", "")

                # emit plan steps as soon as the planner finishes
                if kind == "on_chain_end" and event.get("name") == "planner":
                    plan = event["data"].get("output", {}).get("plan", [])
                    if on_plan_step is not None:
                        for step in plan:
                            await on_plan_step(step)

                # emit thinking events as the executor works through each step
                if on_thinking is not None and node == "executor":
                    if kind == "on_chain_start":
                        plan = event["data"].get("input", {}).get("plan", [])
                        for step in plan:
                            await on_thinking(step, "start")
                    elif kind == "on_chain_end":
                        plan = event["data"].get("output", {}).get("plan", [])
                        for step in plan:
                            await on_thinking(step, "done")

                # stream plain text tokens from conversational, synthesizer, and sub-agent nodes
                if kind == "on_chat_model_stream" and node in (
                    "llm_node", "synthesizer", "web_search_agent", "startup_critique_agent"
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
            raise ChatStreamError(str(exc)) from exc

        logger.info("Chat complete: %d chars session_id=%s uid=%s", len(accumulated), session_id, uid)

        # persist assembled assistant reply
        if accumulated:
            self._message_repo.add(uid=uid, session_id=session_id, role="assistant", content=accumulated)

        await on_done(accumulated)

        # fire-and-forget: extract and store new facts without blocking the response
        if memory_service is not None and accumulated:
            asyncio.create_task(
                memory_service.extract_and_store(uid, user_message, accumulated)
            )


# Build the graph once at module load time and attach it to the class.
ChatService._graph = ChatService._build_graph()
