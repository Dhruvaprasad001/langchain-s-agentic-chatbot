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

// ── Public API ───────────────────────────────────────────────────────────────

export async function listSessions(_token?: string): Promise<Session[]> {
  const res = await getSessionsApi().listSessionsApiV1SessionsGet();
  return res.data.map(toSession);
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
): Promise<{ session: Session; messages: Message[] }> {
  const res = await getSessionsApi().getSessionApiV1SessionsSessionIdGet({ sessionId });
  return {
    session: toSession(res.data.session),
    messages: res.data.messages.map(toMessage),
  };
}
