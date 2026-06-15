# Xenon AI — LangGraph Agentic Chatbot

A production-grade agentic chatbot built with **LangGraph**, **FastAPI**, **Next.js 16**, and **Firebase**. It routes every message through a multi-node agent graph, maintains per-user vector memory, streams responses over SSE, and ships with a clean dark-mode UI.

**Live:** [https://langchain-s-agentic-chatbot-bdtw.vercel.app/login](https://langchain-s-agentic-chatbot-bdtw.vercel.app/login)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Agent Graph](#agent-graph)
  - [Sub-agents](#sub-agents)
- [Authentication](#authentication)
- [Vector Memory (Multi-tenant)](#vector-memory-multi-tenant)
- [Custom Rules](#custom-rules)
- [Frontend](#frontend)
- [Monorepo Structure](#monorepo-structure)
- [Running Locally](#running-locally)

---

## Architecture Overview

**Backend stack:** Python 3.11 · FastAPI · LangGraph · LangChain · OpenAI · ChromaDB · Firebase Admin SDK · Firestore · Uvicorn

**Frontend stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Firebase JS SDK · Vercel

```
┌─────────────────────────────────────────────────────────┐
│  Browser  (Next.js 16 + React 19)                        │
│  Firebase Auth ─► ID Token ─► API requests               │
└────────────────────┬────────────────────────────────────┘
                     │  HTTPS / SSE
┌────────────────────▼────────────────────────────────────┐
│  FastAPI backend                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  LangGraph StateGraph  (chat_service.py)          │   │
│  │  router → planner → executor → synthesizer        │   │
│  │           └─► web_search_agent                    │   │
│  │           └─► startup_critique_agent              │   │
│  └──────────────────────────────────────────────────┘   │
│  Firebase Admin SDK ─► verifies ID tokens               │
│  Firestore ─► sessions, messages, memory, custom rules  │
│  ChromaDB  ─► per-user vector store (cosine similarity) │
│  OpenAI    ─► GPT-4o-mini (chat) + text-embedding-3-small│
└─────────────────────────────────────────────────────────┘
```

---

## Agent Graph

**Stack:** `langgraph` · `langchain-openai` · `langchain-community` · `duckduckgo-search` · `openai` (GPT-4o-mini)

Every incoming message is processed by a **LangGraph `StateGraph`**. The graph maintains a shared `AgentState` that carries messages, user identity, routing decision, plan steps, step results, retrieved memories, and custom rules context.

```
START
  │
  ▼
router ──────────────────────────────────────────────────────┐
  │                                                           │
  ├─ conversational ──► llm_node ──────────────────────► END │
  │                                                           │
  ├─ analytical ──► planner ──► executor ──► synthesizer ► END│
  │                                                           │
  ├─ web_search ──► web_search_agent ──────────────────► END  │
  │                                                           │
  └─ startup_critique ──► startup_critique_agent ──────► END  │
```

The router is a fast, non-streaming LLM call with a tight classification prompt. It can be bypassed: any message prefixed with `@web-search` is fast-pathed directly to the web search sub-agent.

### Sub-agents

| Sub-agent | Trigger | What it does |
|---|---|---|
| **llm_node** | `conversational` route | Direct streaming reply. No planning overhead for simple questions or chat. |
| **planner** | `analytical` route | Decomposes the request into 2–4 concrete, independently-executable steps (JSON array). |
| **executor** | After planner | Runs each plan step sequentially, accumulating `prior_results` for context. |
| **synthesizer** | After executor | Merges all step outputs into a single, natural response. Strips all "step N:" framing. |
| **web_search_agent** | `web_search` route or `@web-search` prefix | Runs a DuckDuckGo search, then synthesises the results with today's date as context. Cites inline, never hallucinates URLs. |
| **startup_critique_agent** | `startup_critique` route | Structured critique: The Idea / What's Working / Red Flags / Biggest Question / Verdict. Anti-cheerleader guardrails baked into the prompt. |

All agent prompts live in `backend/app/agent/prompts/` as plain Markdown files and are loaded once at import time.

The persona Xenon operates with is defined in `backend/app/agent/soul.md` — sharp, dry-witted, honest, and warm without being sycophantic.

---

## Authentication

**Stack:** `firebase` (JS SDK) · `firebase-admin` (Python SDK) · Google OAuth 2.0

Authentication is handled end-to-end with **Firebase**.

- **Frontend**: Google OAuth popup via `signInWithGoogle()` (Firebase JS SDK). After sign-in, the Firebase ID token is fetched on every API request via `getIdToken()`, which waits for `auth.authStateReady()` to handle hard-refresh races.
- **Backend**: Every authenticated route uses a FastAPI `Depends(get_current_user)` guard that calls `firebase_admin.auth.verify_id_token()`. Invalid or expired tokens return `401`.
- Sessions, messages, memory, and custom rules are all scoped to the Firebase `uid` — users can never read or write each other's data.

---

## Vector Memory (Multi-tenant)

**Stack:** `chromadb` · `langchain-chroma` · OpenAI `text-embedding-3-small` · Firestore (dual-write audit log)

Each user gets an isolated vector store. Memory is completely invisible to other users.

- **Vector DB**: ChromaDB with a persistent SQLite backend (`./chroma_db`).
- **Collection naming**: `memory_{sanitized_uid}` — one collection per Firebase `uid`.
- **Embeddings**: OpenAI `text-embedding-3-small`.
- **Extraction**: After each assistant reply, a fire-and-forget `asyncio.create_task()` runs a non-streaming LLM call that extracts up to 3 memorable facts the user stated in that turn. These are embedded and stored in Chroma and also written to Firestore for auditability.
- **Retrieval**: At the start of each message, the user's query is embedded and the top-5 semantically closest memories are fetched (cosine similarity). They are injected into the system prompt as `What you know about this user: …`.
- **Resilience**: All memory operations swallow exceptions — a Chroma failure never breaks the chat response.

The memory panel in the UI lets users view every stored memory and clear them.

---

## Custom Rules

**Stack:** Firestore · FastAPI (`/api/v1/custom-rules`)

Users can write free-text rules that are injected verbatim into the system prompt on every request. This lets users steer tone, output format, language preference, or any other behavioural constraint without any prompt-engineering knowledge.

Rules are stored per-user in Firestore (`users/{uid}/custom_rules`) and fetched on every chat call.

---

## Frontend

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Firebase JS SDK v12 · Axios · `react-markdown` + `remark-gfm` · Lucide icons · `date-fns`

Built with **Next.js 16 (App Router)** and **React 19**.

- **Routing**: `(auth)` group for login, `(dashboard)` group for the chat UI with a shared sidebar layout.
- **Streaming**: `chatService.ts` opens an `EventSource`-style SSE connection and progressively patches the assistant message as tokens arrive. Planning steps and thinking steps stream separately and are rendered as a collapsible "Thinking" block.
- **Infinite scroll**:
  - *Sidebar*: Sessions are loaded 20 at a time. Scrolling to the bottom of the sidebar triggers `IntersectionObserver`, which fetches and appends the next page.
  - *Chat*: Messages are loaded 20 at a time (most-recent first). Scrolling to the top of the chat fetches the next older page and prepends it, restoring `scrollTop` via `useLayoutEffect` so the viewport doesn't jump.
- **Generated API client**: The TypeScript client in `frontend/clients/` is auto-generated from the OpenAPI spec (`swagger_files/chat_bot.json`), keeping the frontend and backend types in sync.
- **Markdown rendering**: Assistant responses are rendered with `react-markdown` + `remark-gfm` (tables, code fences, strikethrough, task lists).

---

## Monorepo Structure

```
langchain-s-agentic-chatbot/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── soul.md              # Xenon persona definition
│   │   │   ├── agent.md             # Decision-making rules
│   │   │   └── prompts/             # One .md file per sub-agent prompt
│   │   ├── api/                     # FastAPI routers (chat, sessions, memory, custom_rules)
│   │   ├── core/                    # Settings (pydantic-settings)
│   │   ├── domain/                  # Domain models
│   │   ├── repositories/            # Firestore adapters
│   │   └── services/                # Business logic (chat, memory, session)
│   ├── scripts/
│   │   └── seed_data.py             # Seed script for local dev
│   └── requirements.txt
└── frontend/
    ├── clients/                     # OpenAPI-generated TypeScript client
    ├── swagger_files/               # OpenAPI spec
    └── src/
        ├── app/                     # Next.js App Router pages
        ├── components/              # chat/, session/, ui/
        ├── hooks/                   # useAuth, useChat, useSessions
        ├── services/                # API + Firebase service layer
        └── types/                   # Shared TypeScript types
```

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 20+
- A Firebase project with **Authentication** (Google provider) and **Firestore** enabled
- An OpenAI API key
- A Firebase service account key JSON file

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create your env file
cp .env.example .env
# Fill in: OPENAI_API_KEY, FIREBASE_SERVICE_ACCOUNT_PATH (or FIREBASE_SERVICE_ACCOUNT_JSON)

# Place your Firebase service account key
# Either set FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# or paste the JSON into FIREBASE_SERVICE_ACCOUNT_JSON

# Start the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create your env file
cp .env.local.example .env.local
# Fill in your Firebase public config:
# NEXT_PUBLIC_FIREBASE_API_KEY=
# NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
# NEXT_PUBLIC_FIREBASE_PROJECT_ID=
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

**Backend (`.env`)**

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Model name (default: `gpt-4o-mini`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON (local dev) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON string (for cloud deployment) |
| `CHROMA_PERSIST_DIRECTORY` | ChromaDB data directory (default: `./chroma_db`) |
| `MAX_MEMORIES_INJECTED` | Max memory facts injected per request (default: `5`) |

**Frontend (`.env.local`)**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL (default: `http://localhost:8000`) |
