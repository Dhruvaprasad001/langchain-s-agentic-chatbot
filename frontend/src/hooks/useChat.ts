"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken } from "@/src/services/authService";
import { getSession } from "@/src/services/sessionService";
import { streamMessage } from "@/src/services/chatService";
import type { Message, ThinkingStep } from "@/src/types";

interface UseChatReturn {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  pendingReply: boolean;   // true while polling for a server-side reply after refresh
  error: string | null;
  sendMessage: (content: string) => void;
}

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS  = 90_000;

function tempId() {
  return `tmp-${Date.now()}-${Math.random()}`;
}

export function useChat(sessionId: string): UseChatReturn {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [pendingReply, setPending]  = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const streamingIdRef              = useRef<string | null>(null);
  const pollTimerRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef                = useRef<number>(0);

  // ── Stop any running poll ────────────────────────────────────────────────
  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPending(false);
  }

  // ── Poll Firestore every POLL_INTERVAL_MS until an assistant reply appears
  function startPolling() {
    stopPolling();
    setPending(true);
    pollStartRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      // Timeout guard
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        return;
      }
      try {
        const token = await getIdToken();
        const { messages: fresh } = await getSession(token, sessionId);
        const lastFresh = fresh[fresh.length - 1];
        if (lastFresh?.role === "assistant") {
          setMessages(fresh);
          stopPolling();
        }
      } catch {
        // silent — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Load history on mount ─────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const { messages: history } = await getSession(token, sessionId);
      setMessages(history);

      // If the last persisted message is from the user, the server is likely
      // still streaming (or the response was lost). Poll until it appears.
      const last = history[history.length - 1];
      if (last?.role === "user") {
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    loadHistory();
    return () => stopPolling();          // clean up on unmount / session change
  }, [loadHistory]);

  // ── Send a new message ─────────────────────────────────────────────────────
  function sendMessage(content: string): void {
    if (sending || !content.trim()) return;
    stopPolling();
    setSending(true);
    setError(null);

    const userMsgId      = tempId();
    const assistantMsgId = tempId();
    streamingIdRef.current = assistantMsgId;

    const userMsg: Message = {
      messageId: userMsgId,
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: Message = {
      messageId: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      planSteps: [],
      thinkingSteps: [],
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    getIdToken()
      .then((token) => {
        streamMessage(
          token,
          sessionId,
          content.trim(),
          // plain text token
          (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.messageId === streamingIdRef.current
                  ? { ...m, content: m.content + delta }
                  : m,
              ),
            );
          },
          // done
          () => {
            setSending(false);
            streamingIdRef.current = null;
          },
          // error
          (err) => {
            setError(err.message);
            setSending(false);
            streamingIdRef.current = null;
          },
          // plan step
          (step) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.messageId === streamingIdRef.current
                  ? { ...m, planSteps: [...(m.planSteps ?? []), step] }
                  : m,
              ),
            );
          },
          // thinking: step label + status
          (stepLabel, status) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.messageId !== streamingIdRef.current) return m;
                const existing = m.thinkingSteps ?? [];
                if (status === "start") {
                  return {
                    ...m,
                    thinkingSteps: [...existing, { label: stepLabel, status: "start" } as ThinkingStep],
                  };
                }
                return {
                  ...m,
                  thinkingSteps: existing.map((s) =>
                    s.label === stepLabel && s.status === "start"
                      ? { ...s, status: "done" as const }
                      : s,
                  ),
                };
              }),
            );
          },
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Auth error");
        setSending(false);
      });
  }

  return { messages, loading, sending, pendingReply, error, sendMessage };
}
