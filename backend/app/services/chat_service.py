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
            logger.info(
                "Router fast-path: web_search session_id=%s uid=%s",
                state["session_id"], state["user_id"],
            )
            return {**state, "route": "web_search"}

        try:
            result = cls._router_llm.invoke([
                {"role": "system", "content": (
                    "Classify the user message into exactly one of these four categories. "
                    "Reply with only the category word, nothing else.\n\n"
                    "Categories:\n"
                    "- conversational: casual chat, simple questions, general knowledge\n"
                    "- analytical: comparison, research, planning, multi-step reasoning\n"
                    "- web_search: message starts with @web-search\n"
                    "- startup_critique: user wants feedback or critique on a business idea, "
                    "startup, or product concept\n\n"
                    "Rules:\n"
                    "- If message starts with @web-search → always return web_search\n"
                    "- If user mentions pitching an idea, getting feedback on a startup, "
                    "critiquing a business model → startup_critique\n"
                    "- Otherwise use your judgment between conversational and analytical"
                )},
                {"role": "user", "content": last_content},
            ])
            route = result.content.strip().lower()
            valid_routes = ("conversational", "analytical", "web_search", "startup_critique")
            if route not in valid_routes:
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
                {"role": "system", "content": (
                    "You are a planning agent. Break the user's request into 2-4 clear execution steps. "
                    "Return ONLY a valid JSON array of strings. No explanation, no markdown, no code fences. "
                    'Example: ["Research X", "Compare Y and Z", "Synthesize findings"]'
                )},
                {"role": "user", "content": original_message},
            ])
            plan: list[str] = json.loads(result.content.strip())
            if not isinstance(plan, list) or not plan:
                raise ValueError("Parsed plan is empty or not a list")
        except Exception as exc:
            logger.warning("[PLANNER] failed to parse plan (%s) — using fallback", exc)
            plan = ["Analyze the request", "Formulate response"]

        logger.info(
            "[PLANNER] created %d steps uid=%s session_id=%s",
            len(plan), state["user_id"], state["session_id"],
        )
        return {**state, "original_message": original_message, "plan": plan, "step_results": []}

    @classmethod
    def _executor_node(cls, state: AgentState) -> AgentState:
        """Execute each planned step sequentially and collect results."""
        plan = state["plan"]
        step_results: list[str] = list(state["step_results"])

        for i, step in enumerate(plan):
            result = cls._analytical_llm.invoke([
                {"role": "system", "content": (
                    "You are an execution agent. Complete this specific step thoroughly and concisely."
                )},
                {"role": "user", "content": (
                    f"Original request: {state['original_message']}\n"
                    f"Current step: {step}\n"
                    f"Results from previous steps: {'; '.join(step_results) or 'None yet'}"
                )},
            ])
            step_results.append(result.content)
            logger.info(
                "[EXECUTOR] completed step %d/%d uid=%s session_id=%s",
                i + 1, len(plan), state["user_id"], state["session_id"],
            )

        return {**state, "step_results": step_results}

    @classmethod
    def _synthesizer_node(cls, state: AgentState) -> AgentState:
        """Synthesize all step results into a single, natural final answer."""
        step_summary = "\n".join(
            f"{i + 1}. {r}" for i, r in enumerate(state["step_results"])
        )
        system = (
            f"You are a synthesis agent with the following personality:\n{cls._system_prompt}\n\n"
            "Given the research steps below, write a clear, direct final answer. "
            "Do not mention 'steps' or 'research' — just deliver the answer naturally.\n"
            f"Original request: {state['original_message']}\n"
            f"Step results:\n{step_summary}"
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
        """Strip @web-search prefix, run DuckDuckGo, synthesize with personality."""
        from langchain_community.tools import DuckDuckGoSearchRun  # lazy import

        raw = state["messages"][-1].content
        query = raw.replace("@web-search", "").strip()

        logger.info("[WEB_SEARCH] query='%s' uid=%s session_id=%s", query, state["user_id"], state["session_id"])

        try:
            search = DuckDuckGoSearchRun()
            results = search.run(query)
        except Exception as exc:
            logger.warning("[WEB_SEARCH] DuckDuckGo failed (%s) — using empty results", exc)
            results = "No search results available."

        system = (
            f"{cls._system_prompt}\n\n"
            "You have just performed a web search. Synthesize the results into a clear, "
            "direct answer. Cite key points. Be concise — no padding.\n\n"
            f"Search query: {query}\n"
            f"Search results:\n{results}\n\n"
            f"Current date: {datetime.now().strftime('%B %d, %Y')}"
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
        logger.info("[STARTUP_CRITIQUE] uid=%s session_id=%s", state["user_id"], state["session_id"])

        system = (
            f"{cls._system_prompt}\n\n"
            "You are now in startup critique mode. You are a sharp, experienced investor and "
            "product thinker. Critique the idea honestly — no sugarcoating, no empty validation.\n\n"
            "Structure your response EXACTLY like this:\n\n"
            "## The Idea\n"
            "One line summary of what they're building.\n\n"
            "## What's Working\n"
            "2-3 genuine strengths. Be specific, not generic.\n\n"
            "## Red Flags\n"
            "2-3 honest concerns. Market size, competition, execution risk, monetization.\n\n"
            "## Biggest Question\n"
            "The single most important thing they need to figure out.\n\n"
            "## Verdict\n"
            "One of: Early but promising / Needs rethinking / Strong foundation / Pivot needed\n"
            "Then 2-3 lines on what to do next.\n\n"
            "Be direct. Use your Bangalore personality. Don't pad. If the idea is weak, say so.\n\n"
            f"Current date: {datetime.now().strftime('%B %d, %Y')}"
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
        logger.info("Session verified session_id=%s uid=%s", session_id, uid)

        # load conversation history
        history_objs = self._message_repo.list_asc(uid=uid, session_id=session_id)
        history = [{"role": m.role, "content": m.content} for m in history_objs]
        logger.info("History loaded: %d message(s) session_id=%s uid=%s", len(history), session_id, uid)

        # persist user turn before streaming
        self._message_repo.add(uid=uid, session_id=session_id, role="user", content=user_message)
        logger.info("User message persisted session_id=%s uid=%s", session_id, uid)

        # retrieve relevant memories and build context string
        memory_context = ""
        if memory_service is not None:
            memories = await memory_service.retrieve_relevant(uid, user_message)
            if memories:
                memory_context = "\n\nWhat you know about this user:\n" + "\n".join(
                    f"- {m}" for m in memories
                )
                logger.info(
                    "[MEMORY] injected %d memory/memories session_id=%s uid=%s",
                    len(memories), session_id, uid,
                )

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

        logger.info("Starting LangGraph stream session_id=%s uid=%s", session_id, uid)
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

        logger.info(
            "Stream complete: %d chars session_id=%s uid=%s",
            len(accumulated), session_id, uid,
        )

        # persist assembled assistant reply
        if accumulated:
            self._message_repo.add(uid=uid, session_id=session_id, role="assistant", content=accumulated)
            logger.info("Assistant message persisted session_id=%s uid=%s", session_id, uid)

        await on_done(accumulated)

        # fire-and-forget: extract and store new facts without blocking the response
        if memory_service is not None and accumulated:
            asyncio.create_task(
                memory_service.extract_and_store(uid, user_message, accumulated)
            )


# Build the graph once at module load time and attach it to the class.
ChatService._graph = ChatService._build_graph()
