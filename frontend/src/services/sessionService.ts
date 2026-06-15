/**
 * Session service — thin wrappers over the generated SessionsApi client.
 *
 * Public signatures are identical to the old fetch-based version so no
 * call-sites outside this file need to change.
 *
 * The generated client handles auth (Bearer token) via apiClient.ts.
 * Token is no longer accepted as a parameter — the client fetches it
 * automatically from Firebase via getIdToken() on every request.
 */

import type { Message, Session } from "@/src/types";
import type {
  SessionResponse,
  MessageResponse,
} from "../../clients/api";
import { getSessionsApi } from "@/src/services/apiClient";

// ── Shape mappers ────────────────────────────────────────────────────────────

function toSession(raw: SessionResponse): Session {
  return {
    sessionId: raw.session_id,
    title: raw.title,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toMessage(raw: MessageResponse): Message {
  return {
    messageId: raw.message_id,
    role: raw.role,
    content: raw.content,
    timestamp: raw.timestamp,
  };
}

// ── Paginated result shapes ──────────────────────────────────────────────────

export interface PaginatedSessions {
  items: Session[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedMessages {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function listSessions(
  _token?: string,
  page = 1,
  limit = 20,
): Promise<PaginatedSessions> {
  const res = await getSessionsApi().listSessionsApiV1SessionsGet({ page, limit });
  return {
    items: res.data.items.map(toSession),
    total: res.data.total,
    page: res.data.page,
    limit: res.data.limit,
  };
}

export async function createSession(_token: string | undefined, title: string): Promise<Session> {
  const res = await getSessionsApi().createSessionApiV1SessionsPost({
    sessionCreateRequest: { title },
  });
  return toSession(res.data);
}

export async function updateSession(
  _token: string | undefined,
  sessionId: string,
  title: string,
): Promise<Session> {
  const res = await getSessionsApi().updateSessionApiV1SessionsSessionIdPatch({
    sessionId,
    sessionUpdateRequest: { title },
  });
  return toSession(res.data);
}

export async function deleteSession(_token: string | undefined, sessionId: string): Promise<void> {
  await getSessionsApi().deleteSessionApiV1SessionsSessionIdDelete({ sessionId });
}

export async function getSession(
  _token: string | undefined,
  sessionId: string,
  page = 1,
  limit = 50,
): Promise<PaginatedMessages> {
  const res = await getSessionsApi().getSessionApiV1SessionsSessionIdGet({
    sessionId,
    page,
    limit,
  });
  return {
    messages: res.data.items.map(toMessage),
    total: res.data.total,
    page: res.data.page,
    limit: res.data.limit,
  };
}

/** Fetch the title of a single session by finding it in the full list. */
export async function getSessionTitle(sessionId: string): Promise<string | undefined> {
  const res = await getSessionsApi().listSessionsApiV1SessionsGet({ page: 1, limit: 100 });
  const match = res.data.items.find((s) => s.session_id === sessionId);
  return match?.title;
}
