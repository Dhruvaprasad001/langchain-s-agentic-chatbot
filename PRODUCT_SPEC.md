# Xenon AI — Product Specification

**Version:** 1.0
**Status:** Live
**URL:** https://langchain-s-agentic-chatbot-bdtw.vercel.app/login

---

## 1. Overview

Xenon AI is a production-grade agentic chatbot that routes every user message through a multi-node LangGraph graph, maintaining per-user semantic memory across conversations. It is not a wrapper around a chat completion endpoint — it classifies intent, plans multi-step work, executes steps with accumulated context, and synthesises a final response. It also does live web search and structured startup critiques as first-class modes.

The system is fully multi-tenant: every user's sessions, messages, memory, and custom rules are isolated by Firebase UID and can never be read or written by other users.

---

## 2. Goals

- Give users an AI that feels like a knowledgeable peer, not a support ticket system.
- Route each message to the right agent path automatically — no user configuration required.
- Persist a growing semantic memory per user so the AI gets more useful over time.
- Let power users steer AI behaviour through natural-language custom rules.
- Stream responses token-by-token so the UI never feels like it is waiting.

---

## 3. Non-Goals

- This is not a multi-model selector — GPT-4o-mini is the only LLM.
- This is not a document Q&A / RAG system — memory is about the user, not uploaded files.
- This does not support team or org-level accounts — one user, one isolated data set.
- Mobile-native apps are out of scope; the web UI is responsive but not a PWA.

---

## 4. Users

Single user type. Anyone who signs in with Google gets full access to all features. There is no admin panel or tiered access.

---

## 5. Authentication

**Stack:** Firebase Authentication · Google OAuth 2.0 · Firebase Admin SDK (Python)

| Behaviour | Detail |
|---|---|
| Sign-in method | Google OAuth popup (Firebase JS SDK `signInWithPopup`) |
| Token handling | Firebase ID token fetched on every API call via `getIdToken()`, which awaits `auth.authStateReady()` to handle hard-refresh hydration races |
| Backend verification | Every authenticated route runs `Depends(get_current_user)`, which calls `firebase_admin.auth.verify_id_token()`. Returns `401` on failure |
| Data isolation | All Firestore documents and ChromaDB collections are keyed on `uid`. No cross-user access is possible at the data layer |
| Session persistence | Firebase handles token refresh automatically. Users stay signed in until they explicitly sign out |

---

## 6. Agent Graph

**Stack:** LangGraph · LangChain · LangChain-OpenAI · LangChain-Community · OpenAI GPT-4o-mini · DuckDuckGo Search

Every message flows through a LangGraph `StateGraph`. The graph carries a shared `AgentState` containing the conversation history, user identity, routing decision, plan steps, accumulated step results, retrieved memories, and custom rules context.

### 6.1 Routing

A fast, non-streaming LLM call classifies each message into one of four routes before any work is done. The router prompt is tight and returns a single token.

| Route | Trigger |
|---|---|
| `conversational` | Casual chat, simple factual questions, greetings |
| `analytical` | Research, comparison, multi-step reasoning, planning tasks |
| `web_search` | Questions requiring current or live data; also force-triggered by `@web-search` prefix |
| `startup_critique` | Pitch decks, business ideas, startup validation requests |

The `@web-search` prefix hard-bypasses the router and routes directly to the web search agent.

### 6.2 Sub-agents

| Sub-agent | Route | Behaviour |
|---|---|---|
| **llm_node** | `conversational` | Direct streaming reply from GPT-4o-mini. No planning overhead. Memories and custom rules injected into system prompt. |
| **planner** | `analytical` | Decomposes the request into 2–4 concrete, independently-executable steps. Outputs a JSON array of step descriptions. |
| **executor** | After planner | Runs each step sequentially. Each step call receives the original message, current step description, and accumulated results from prior steps. |
| **synthesizer** | After executor | Merges all step results into a single, natural final response. Strips all "step N:" framing from the output. |
| **web_search_agent** | `web_search` | Runs a DuckDuckGo search for the user's query, then synthesises the results with today's date injected as context. Cites sources inline, never hallucinates URLs. |
| **startup_critique_agent** | `startup_critique` | Returns a structured critique with fixed sections: The Idea / What's Working / Red Flags / Biggest Question / Verdict. Anti-cheerleader guardrails are baked into the prompt. |

### 6.3 Graph Topology

```
START
  │
  ▼
router
  ├─ conversational    ──► llm_node              ──► END
  ├─ analytical        ──► planner → executor → synthesizer ──► END
  ├─ web_search        ──► web_search_agent       ──► END
  └─ startup_critique  ──► startup_critique_agent ──► END
```

### 6.4 Prompts

All agent prompts are plain Markdown files in `backend/app/agent/prompts/`, loaded once at import time. The AI persona is defined in `backend/app/agent/soul.md`.

**Persona highlights (soul.md):**
- Sharp, dry-witted, warm but honest — not sycophantic
- Banned openers: "Great question!", "Certainly!", "Absolutely!", and all variants
- No hollow filler, no puns, no jokes mid-function in technical mode
- Hard guardrails: no harmful content, no hallucinated citations, no pretending to be human

---

## 7. Vector Memory

**Stack:** ChromaDB (SQLite backend) · LangChain-Chroma · OpenAI `text-embedding-3-small` · Firestore (audit log)

Memory makes the AI aware of facts the user has shared across all past conversations. It is personal, isolated, and grows automatically.

### 7.1 Extraction

After every assistant reply, a fire-and-forget background task (`asyncio.create_task`) calls GPT-4o-mini with a non-streaming prompt that extracts up to 3 facts the user stated in that turn. Facts are embedded with `text-embedding-3-small` and written to:
- ChromaDB collection `memory_{uid}` (vector search)
- Firestore `users/{uid}/memory/{uuid}` (audit log, displayed in the Memory panel)

Extraction never blocks the chat response. All extraction errors are silently swallowed.

### 7.2 Retrieval

At the start of every message, the user's query is embedded and the top-5 semantically closest memories are fetched from ChromaDB using cosine similarity. They are injected into the system prompt as:

```
What you know about this user:
- <fact 1>
- <fact 2>
…
```

### 7.3 Multi-tenancy

Each Firebase UID gets exactly one ChromaDB collection. UIDs are sanitised (dots and `@` replaced) before use as collection names. There is no mechanism by which one user can query another user's collection.

### 7.4 UI

The Memory panel (accessible from the sidebar) lists every stored memory with its timestamp. Users can view and clear all memories.

---

## 8. Custom Rules

**Stack:** Firestore · FastAPI `/api/v1/custom-rules`

Users can write free-text instructions that are injected verbatim into the system prompt on every request. Examples:
- "Always respond in Spanish."
- "Format all code in Python unless I specify otherwise."
- "Be more concise — three sentences max per answer."

Rules are stored per-user in Firestore (`users/{uid}/custom_rules`) and fetched on every chat call. There is no schema validation — the field is a free string.

The Custom Rules panel is accessible from the sidebar.

---

## 9. Chat & Sessions

**Stack:** FastAPI · Server-Sent Events (SSE) · Firestore

### 9.1 Sessions

- Each conversation is a session with a title, `created_at`, and `updated_at`.
- Sessions are created with the title "New conversation" and auto-renamed after the first assistant reply.
- Sessions and their messages are stored in Firestore: `sessions/{uid}/{sessionId}` and `sessions/{uid}/{sessionId}/messages/{messageId}`.
- Sessions support create, rename (PATCH), delete (cascades message deletion), and paginated list.

### 9.2 Streaming

Chat responses are streamed over SSE. The FastAPI endpoint (`POST /api/v1/chat/{session_id}`) uses `astream_events` from LangGraph and emits:
- `delta` events — raw text tokens appended to the assistant message
- `plan_step` events — planning steps for the analytical route, rendered as a "Thinking" block in the UI
- `thinking` events — per-step status (`start` / `done`) for the executor, also rendered in the "Thinking" block

On the frontend, `chatService.ts` reads the SSE stream and progressively patches the assistant message in React state as events arrive.

### 9.3 Message Persistence

The user message is persisted to Firestore before the LLM call. The assembled assistant reply is persisted after the stream completes. If the user refreshes mid-stream, the frontend polls (`/api/v1/sessions/{sessionId}`) every 2 seconds until an assistant message appears, then stops.

### 9.4 Pagination

Both sessions and messages are paginated at 20 items per page. The frontend uses `IntersectionObserver`-based infinite scroll:
- **Sidebar**: scrolling to the bottom appends the next page of sessions.
- **Chat**: scrolling to the top prepends the next older page of messages. `scrollTop` is restored via `useLayoutEffect` so the viewport does not jump.

---

## 10. API

**Stack:** FastAPI · Pydantic · Uvicorn · OpenAPI (spec at `swagger_files/chat_bot.json`)

All routes are prefixed `/api/v1` and require a Firebase ID token in the `Authorization: Bearer <token>` header except `/health`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/sessions` | List sessions (paginated) |
| `POST` | `/api/v1/sessions` | Create session |
| `GET` | `/api/v1/sessions/{sessionId}` | Get session with messages (paginated) |
| `PATCH` | `/api/v1/sessions/{sessionId}` | Update session title |
| `DELETE` | `/api/v1/sessions/{sessionId}` | Delete session + all messages |
| `POST` | `/api/v1/chat/{sessionId}` | Send message, stream SSE response |
| `GET` | `/api/v1/memory` | List all stored memory facts |
| `DELETE` | `/api/v1/memory` | Clear all memory for the user |
| `GET` | `/api/v1/custom-rules` | Get custom rules string |
| `PUT` | `/api/v1/custom-rules` | Update custom rules string |

Interactive docs available at `/docs` when running locally.

The TypeScript client in `frontend/clients/` is auto-generated from the OpenAPI spec, keeping frontend and backend types in sync.

---

## 11. Frontend

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Lucide icons · `react-markdown` + `remark-gfm` · `date-fns` · Axios · Firebase JS SDK v12 · Vercel

### 11.1 Pages

| Route | Description |
|---|---|
| `/login` | Google sign-in page |
| `/` | Redirects to the most-recent session or prompts new chat |
| `/session/[sessionId]` | Chat view for a given session |

### 11.2 Layout

The dashboard layout renders a collapsible sidebar alongside the chat area. The sidebar contains:
- New chat button
- Paginated session list (infinite scroll)
- Custom Rules panel trigger
- Memory panel trigger
- Sign out

### 11.3 Chat View

- **ChatNavbar** — session title + sidebar toggle + new chat button
- **MessageList** — scrollable message thread with infinite scroll upward for history
- **MessageBubble** — user messages as indigo pills; assistant messages as Markdown cards. Collapsible "Thinking" block shows live planning and execution steps during analytical responses. Streaming caret animates on the last assistant token.
- **ChatInput** — textarea with send on Enter (Shift+Enter for newline), disabled while streaming

### 11.4 Markdown Support

Assistant responses are rendered with `react-markdown` + `remark-gfm`, supporting:
- Fenced code blocks with language labels
- Tables, task lists, strikethrough
- Inline code, bold, italic, blockquotes

---

## 12. Data Model

### Firestore Collections

```
sessions/
  {uid}/
    {sessionId}/
      title: string
      created_at: timestamp
      updated_at: timestamp
      messages/
        {messageId}/
          role: "user" | "assistant"
          content: string
          timestamp: timestamp

users/
  {uid}/
    memory/
      {memoryId}/
        content: string
        user_id: string
        timestamp: timestamp
        source: "conversation"
    custom_rules/
      rules: string
```

### ChromaDB

One collection per user: `memory_{sanitized_uid}`. Documents are embedded fact strings; metadata stores `user_id` and `timestamp`.

---

## 13. Infrastructure & Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel (Next.js) |
| Backend | Any ASGI host (Uvicorn) |
| Database | Firebase Firestore (managed, serverless) |
| Auth | Firebase Authentication (managed) |
| Vector DB | ChromaDB (self-hosted, SQLite persistence) |
| LLM | OpenAI API (GPT-4o-mini + text-embedding-3-small) |

---

## 14. Configuration

### Backend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override for proxies |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `./serviceAccountKey.json` | Local dev: path to JSON key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | — | Cloud deploy: full JSON string |
| `CHROMA_PERSIST_DIRECTORY` | `./chroma_db` | ChromaDB data directory |
| `MEMORY_COLLECTION_PREFIX` | `memory` | Prefix for per-user Chroma collections |
| `MAX_MEMORIES_INJECTED` | `5` | Max memory facts injected per request |
| `MAX_SEARCH_RESULTS` | `5` | Max DuckDuckGo results per web search |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL (e.g. `http://localhost:8000`) |

---

## 15. Key Design Decisions

| Decision | Rationale |
|---|---|
| LangGraph `StateGraph` over a simple chain | Enables explicit routing, conditional branching, and accumulated state across nodes without imperative spaghetti |
| Markdown prompt files per agent | Prompts are readable and editable without touching Python. Loaded at import time so no runtime I/O per request |
| Fire-and-forget memory extraction | Memory extraction runs after the response is fully streamed — it never adds latency to the user-visible path |
| ChromaDB per-user collections | Hard tenant isolation at the vector DB layer; no query-time filtering needed |
| Dual-write to Firestore for memory | Gives a human-readable audit log without parsing Chroma embeddings |
| SSE over WebSockets | Simpler server implementation, works over standard HTTP, sufficient for unidirectional streaming |
| OpenAPI-generated TypeScript client | Frontend and backend types stay in sync; no hand-written fetch wrappers |
| `IntersectionObserver` for infinite scroll | No scroll event listeners, no polling; browser-native, performant, zero dependencies |
| `useLayoutEffect` for scroll restoration | Restoring `scrollTop` after DOM mutation must happen synchronously before paint, or the viewport visibly jumps |
