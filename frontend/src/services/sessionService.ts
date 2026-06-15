import type { Message, Session } from "@/src/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function toSession(raw: Record<string, string>): Session {
  return {
    sessionId: raw.session_id,
    title: raw.title,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toMessage(raw: Record<string, string>): Message {
  return {
    messageId: raw.message_id,
    role: raw.role as "user" | "assistant",
    content: raw.content,
    timestamp: raw.timestamp,
  };
}

export async function listSessions(token: string): Promise<Session[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/sessions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`listSessions failed: ${res.statusText}`);
  const data: Record<string, string>[] = await res.json();
  return data.map(toSession);
}

export async function createSession(token: string, title: string): Promise<Session> {
  const res = await fetch(`${BACKEND_URL}/api/v1/sessions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.statusText}`);
  return toSession(await res.json());
}

export async function updateSession(token: string, sessionId: string, title: string): Promise<Session> {
  const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`updateSession failed: ${res.statusText}`);
  return toSession(await res.json());
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`deleteSession failed: ${res.statusText}`);
}

export async function getSession(
  token: string,
  sessionId: string,
): Promise<{ session: Session; messages: Message[] }> {
  const res = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getSession failed: ${res.statusText}`);
  const data = await res.json();
  return {
    session: toSession(data.session),
    messages: (data.messages as Record<string, string>[]).map(toMessage),
  };
}
